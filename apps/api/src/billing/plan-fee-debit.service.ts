import { Injectable } from "@nestjs/common";
import { Plan, PlanBillingInterval } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { addInterval } from "../plans/subscriptions.service";
import { computeCyclePrice, resolveActivePlanPrice } from "../plans/plan-pricing.util";
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
 *  - plan fee: gated on Subscription.currentPeriodEnd, same as the old
 *    invoice job would have been, but now also the thing that ADVANCES
 *    currentPeriodEnd (no prior job ever did that for an unchanged plan).
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
    private readonly programCommission: ProgramCommissionService,
    private readonly walletGraceLadder: WalletGraceLadderService,
  ) {}

  /**
   * `renewedSellerIds` (Module 24, SRS §5.36, FR-36.1(a)) - every seller
   * whose plan fee was just successfully debited this sweep (i.e. actually
   * renewed, not downgraded) - the worker triggers each one's data export
   * AFTER this sweep returns, at the orchestration layer rather than via a
   * direct service injection here, so BillingModule never needs to import
   * DataExportModule (which itself imports MediaModule -> AuthModule ->
   * GrowthProgramsModule -> BillingModule - a real cycle this avoids
   * entirely rather than papering over with forwardRef()).
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

    debited += await this.debitDuePlanFees(now, (n) => (downgraded += n), (id) => renewedSellerIds.push(id));
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
   * FR-7.2 (revised v0.33) - there is no more Free Plan to fall back to.
   * Insufficient balance now pauses every one of the seller's active
   * stores via WalletGraceLadderService.pauseActiveStores() - the exact
   * same mechanism the wallet-low-balance grace ladder already uses, per
   * the founder's explicit "unify the two mechanisms" instruction. The
   * subscription itself is left overdue (currentPeriodEnd stays in the
   * past); it never gets reassigned to another plan, so the seller resumes
   * on the same plan and cycle the moment they pay and the store is
   * restored (WalletGraceLadderService.checkAndRestore()).
   */
  private async debitDuePlanFees(now: Date, onDowngrade: (count: number) => void, onRenewed: (sellerId: string) => void): Promise<number> {
    const due = await this.prismaAdmin.subscription.findMany({
      where: { sellerId: { not: null }, currentPeriodEnd: { lte: now } },
      include: { plan: true },
    });

    let debited = 0;
    let paused = 0;

    for (const subscription of due) {
      // Team-sponsored members carry currentPeriodEnd: null (SubscriptionsService.sponsorMember) so
      // they never appear here; this loop is individual-group paid plans only.
      if (subscription.plan.planGroup !== "individual" || Number(subscription.plan.price) <= 0) continue;

      const balance = await this.wallet.getBalance(subscription.sellerId!);
      // Module 61 (FR-7.20) - the renewal amount respects an active
      // campaign price the same way the pricing page does (resolveActivePlanPrice),
      // then the subscription's own chosen cycle multiplier (monthly/six_month/yearly) -
      // never a stored per-cycle price.
      const fee = await this.cyclePriceFor(subscription.plan, subscription.billingInterval);

      if (balance >= fee) {
        await this.prismaAdmin.$transaction((tx) =>
          this.wallet.postLedgerEntry(tx, {
            sellerId: subscription.sellerId!,
            type: "wallet_plan_fee_debit",
            amount: round2(fee),
            currency: subscription.plan.currency,
          }),
        );
        await this.prismaAdmin.subscription.update({
          where: { id: subscription.id },
          data: { currentPeriodEnd: addInterval(subscription.currentPeriodEnd!, subscription.billingInterval as "monthly" | "six_month" | "yearly") },
        });
        // SRS §5.33 FR-33.4 - the ONLY call site: referral commission is
        // calculated exclusively against a referred seller's own paid
        // plan-subscription amount, never GMV/sales/wallet top-ups. Never
        // blocks this debit - a missing/expired/suspended attribution is a
        // silent no-op inside this call.
        await this.programCommission.accrueReferralCommissionIfApplicable(subscription.sellerId!, round2(fee), subscription.plan.currency);
        onRenewed(subscription.sellerId!);
        debited += 1;
      } else {
        const result = await this.walletGraceLadder.pauseActiveStores(subscription.sellerId!);
        if (result.count > 0) paused += 1;
      }
    }

    onDowngrade(paused);
    return debited;
  }

  /** Module 61 (FR-7.20) - the amount a renewal actually bills: the resolved active (campaign-aware) monthly price, times the subscription's own cycle multiplier. */
  private async cyclePriceFor(plan: Plan, billingInterval: PlanBillingInterval): Promise<number> {
    const activeMonthlyPrice = resolveActivePlanPrice(plan);
    const sixMonth = await this.settings.resolve<number>("billing.six_month_price_multiplier");
    const yearly = await this.settings.resolve<number>("billing.yearly_price_multiplier");
    return computeCyclePrice(activeMonthlyPrice, billingInterval as "monthly" | "six_month" | "yearly", { sixMonth, yearly });
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
