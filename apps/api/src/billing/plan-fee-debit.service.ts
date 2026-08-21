import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { addInterval } from "../plans/subscriptions.service";
import { round2 } from "../orders/money.util";
import { ProgramCommissionService } from "./program-commission.service";
import { WalletService } from "./wallet.service";
import { SupplierWalletService } from "./supplier-wallet.service";
import { WalletGraceLadderService } from "./wallet-grace-ladder.service";

/** The calendar month a debit is "for" - team-seat/device-slot debits are idempotent per seller per this window. */
function currentCalendarMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Module 20 (SRS §5.6e/FR-6.24, revised FR-7.2, FR-25.7). The piece FR-7.2
 * always flagged as "schema ready, job never built" - now built as a wallet
 * debit instead of the dormant invoice-generation path (FR-6.28). Three
 * independent debit kinds, each idempotent in its own way:
 *  - plan fee: Module 73 (v0.38) retired the wallet auto-debit here (see
 *    debitDuePlanFees() below) - it's now purely an overdue-detection
 *    check, since a seller's plan fee is paid through the admin-verify
 *    flow instead (WalletService.verifyTopUp()), which is also what
 *    advances currentPeriodEnd now.
 *  - team seat total: idempotent per calendar month via a ledger-entry
 *    existence check (mirrors the old invoice job's per-period uniqueness
 *    check, since there's no per-team invoice row to key off anymore).
 *  - device-slot add-on: same per-calendar-month idempotency, derived from
 *    the existence of a seller-scoped `auth.max_concurrent_devices`
 *    override (FR-25.7's documented add-on signal).
 */
@Injectable()
export class PlanFeeDebitService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly wallet: WalletService,
    private readonly supplierWallet: SupplierWalletService,
    private readonly walletGraceLadder: WalletGraceLadderService,
    private readonly programCommission: ProgramCommissionService,
  ) {}

  /**
   * `renewedSellerIds` (Module 24, SRS §5.36, FR-36.1(a)) - Module 73
   * (v0.38) DORMANT: this sweep no longer performs renewals (see
   * debitDuePlanFees() below), so it never populates this any more. The
   * renewal-export trigger moved to the admin-verify path
   * (AdminWalletController.verify() -> PlanFeeRenewalExportTrigger), the
   * one place a renewal now actually happens. Field kept in the return
   * shape (always empty) to avoid churning worker.main.ts's consumer for
   * no behavioral gain.
   *
   * `downgraded` (v0.33) - now a mixed counter: on the seller side it
   * counts stores PAUSED for plan-fee non-payment (there is no more Free
   * Plan to fall back to - see debitDuePlanFees()); on the supplier side it
   * still counts a real downgrade to the (legitimate, FR-7.10) supplier
   * Free tier. Field name kept as-is to avoid churning every caller/test
   * for a rename with no behavioral stake.
   */
  async runMonthlyDebitSweep(now = new Date()): Promise<{ debited: number; downgraded: number; renewedSellerIds: string[] }> {
    let debited = 0;
    let downgraded = 0;
    const renewedSellerIds: string[] = [];

    downgraded += await this.debitDuePlanFees(now);
    debited += await this.debitDueTeamSeatTotals(now);
    debited += await this.debitDueDeviceSlotAddOns(now);
    debited += await this.debitDueSupplierPlanFees(now, (n) => (downgraded += n));

    return { debited, downgraded, renewedSellerIds };
  }

  /**
   * FR-7.10 supplement - the supplier-side mirror of debitDuePlanFees,
   * debiting the separate supplier wallet. v0.33: the silent reassignment
   * to the supplier Free tier on non-payment is REMOVED (per the founder's
   * explicit "no silent Free-Plan fallback anywhere" instruction) - an
   * overdue supplier subscription now simply stays overdue (currentPeriodEnd
   * left in the past) rather than being auto-downgraded. Disclosed scope
   * decision: no new supplier-dashboard enforcement was added for
   * non-payment in this module - that's new scope beyond the founder's
   * named list. `downgraded` is always 0 here now; the parameter/counter is
   * kept only so debitDueSupplierPlanFees stays call-compatible with
   * runMonthlyDebitSweep's shared onDowngrade callback.
   */
  private async debitDueSupplierPlanFees(now: Date, onDowngrade: (count: number) => void): Promise<number> {
    const due = await this.prismaAdmin.subscription.findMany({
      where: { supplierId: { not: null }, currentPeriodEnd: { lte: now } },
      include: { plan: true },
    });

    let debited = 0;

    for (const subscription of due) {
      if (Number(subscription.plan.price) <= 0) continue;

      const balance = await this.supplierWallet.getBalance(subscription.supplierId!);
      const fee = Number(subscription.plan.price);

      if (balance >= fee) {
        await this.prismaAdmin.supplierWalletEntry.create({
          data: { supplierId: subscription.supplierId!, type: "plan_fee_debit", amount: round2(fee), currency: subscription.plan.currency },
        });
        await this.prismaAdmin.subscription.update({
          where: { id: subscription.id },
          data: { currentPeriodEnd: addInterval(subscription.currentPeriodEnd!, subscription.plan.billingInterval as "monthly" | "yearly") },
        });
        debited += 1;
      }
      // else: insufficient balance - leave the subscription overdue
      // (currentPeriodEnd stays in the past); no downgrade, no pause.
    }

    onDowngrade(0);
    return debited;
  }

  /**
   * Module 73 (v0.38) - retires the wallet auto-debit this method used to
   * perform (FR-7.2). A seller's plan fee is now paid entirely through the
   * admin-verify flow (WalletService.getPlanFeePaymentPreview()/
   * requestPlanFeePayment(), verified by WalletService.verifyTopUp()),
   * which is also what advances currentPeriodEnd - never this sweep. This
   * is now purely an overdue-detection check: a subscription becomes due
   * at currentPeriodEnd, but stays un-paused for `billing.plan_fee_grace_days`
   * more days (covering the ordinary lag between "seller submitted a
   * payment proof" and "admin verified it") before its stores pause via
   * WalletGraceLadderService.pauseActiveStores() - the same mechanism the
   * (now-dormant) wallet-low-balance grace ladder used. The subscription
   * itself is left overdue (currentPeriodEnd stays in the past); it never
   * gets reassigned to another plan, so the seller resumes on the same
   * plan and cycle the moment their payment is verified and the store is
   * restored (WalletGraceLadderService.restoreAfterPlanFeePayment()).
   * Returns the number of sellers paused this run (there is no more
   * "debited" concept here).
   */
  private async debitDuePlanFees(now: Date): Promise<number> {
    const graceDays = await this.settings.resolve<number>("billing.plan_fee_grace_days");
    const due = await this.prismaAdmin.subscription.findMany({
      where: { sellerId: { not: null }, currentPeriodEnd: { lte: now } },
      include: { plan: true },
    });

    let paused = 0;

    for (const subscription of due) {
      // Team-sponsored members carry currentPeriodEnd: null (SubscriptionsService.sponsorMember) so
      // they never appear here; this loop is individual-group paid plans only.
      if (subscription.plan.planGroup !== "individual" || Number(subscription.plan.price) <= 0) continue;

      // Module 79 - an Ambassador's own store(s) exempt via granted free
      // slots never get paused for non-payment; their cycle advances
      // silently, exactly like a real verified renewal would, so
      // currentPeriodEnd stays close to "now." That matters if the
      // exemption is later revoked (suspended/terminated participant, or
      // they create more stores than their granted slot count) - the
      // existing grace-day window then behaves exactly as it would for
      // any other seller (one grace period before pause), never an unfair
      // immediate catch-up pause for however long they were exempt.
      if (
        subscription.billingInterval !== "none" &&
        (await this.programCommission.isExemptFromPlanFeeViaAmbassadorSlots(subscription.sellerId!))
      ) {
        await this.prismaAdmin.subscription.update({
          where: { id: subscription.id },
          // Module 65 (FR-6.42) - this advance is "exactly like a real
          // verified renewal" per the comment above, so it resets the
          // pre-expiry reminder ladder the same way WalletService.verifyTopUp()
          // does, for the same reason: the ladder is per-cycle.
          data: {
            currentPeriodEnd: addInterval(subscription.currentPeriodEnd!, subscription.billingInterval),
            renewalReminderDay7SentAt: null,
            renewalReminderDay3SentAt: null,
            renewalReminderDay1SentAt: null,
            renewalReminderExpiryDaySentAt: null,
          },
        });
        continue;
      }

      const graceDeadline = new Date(subscription.currentPeriodEnd!.getTime() + graceDays * 24 * 60 * 60 * 1000);
      if (graceDeadline > now) continue; // still within the admin-verification grace window - not overdue yet

      const result = await this.walletGraceLadder.pauseActiveStoresForNonPayment(subscription.sellerId!);
      if (result.count > 0) paused += 1;
    }

    return paused;
  }

  /** FR-7.15/7.18, ported to a wallet debit (leader-billed, active-member-count x seat price). */
  private async debitDueTeamSeatTotals(now: Date): Promise<number> {
    const periodStart = currentCalendarMonthStart(now);
    const teams = await this.prismaAdmin.team.findMany({ include: { plan: true } });
    let debited = 0;

    for (const team of teams) {
      const already = await this.prismaAdmin.ledgerEntry.findFirst({
        where: { sellerId: team.leaderSellerId, type: "wallet_team_seat_fee_debit", createdAt: { gte: periodStart } },
      });
      if (already) continue;

      const activeMemberCount = await this.prismaAdmin.teamMember.count({ where: { teamId: team.id, status: "active" } });
      if (activeMemberCount === 0) continue;

      const total = round2(activeMemberCount * Number(team.plan.seatPrice ?? 0));
      if (total <= 0) continue;

      await this.prismaAdmin.$transaction((tx) =>
        this.wallet.postLedgerEntry(tx, { sellerId: team.leaderSellerId, type: "wallet_team_seat_fee_debit", amount: total, currency: team.plan.currency }),
      );
      debited += 1;
    }
    return debited;
  }

  /** FR-25.7 - a seller-scoped auth.max_concurrent_devices override IS the purchased add-on; billed monthly at the flat add-on price. */
  private async debitDueDeviceSlotAddOns(now: Date): Promise<number> {
    const periodStart = currentCalendarMonthStart(now);
    const addOnPrice = await this.settings.resolve<number>("auth.extra_device_slot_price");
    if (addOnPrice <= 0) return 0;

    const overrides = await this.prismaAdmin.settingsValue.findMany({
      where: { definitionKey: "auth.max_concurrent_devices", scopeType: "seller" },
    });

    let debited = 0;
    for (const override of overrides) {
      const sellerId = override.scopeId!;
      const already = await this.prismaAdmin.ledgerEntry.findFirst({
        where: { sellerId, type: "wallet_device_slot_fee_debit", createdAt: { gte: periodStart } },
      });
      if (already) continue;

      await this.prismaAdmin.$transaction((tx) =>
        this.wallet.postLedgerEntry(tx, { sellerId, type: "wallet_device_slot_fee_debit", amount: round2(addOnPrice), currency: "PKR" }),
      );
      debited += 1;
    }
    return debited;
  }
}
