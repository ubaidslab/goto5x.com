import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { addInterval } from "../plans/subscriptions.service";
import { round2 } from "../orders/money.util";
import { WalletService } from "./wallet.service";
import { SupplierWalletService } from "./supplier-wallet.service";

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
  ) {}

  async runMonthlyDebitSweep(now = new Date()): Promise<{ debited: number; downgraded: number }> {
    let debited = 0;
    let downgraded = 0;

    debited += await this.debitDuePlanFees(now, (n) => (downgraded += n));
    debited += await this.debitDueTeamSeatTotals(now);
    debited += await this.debitDueDeviceSlotAddOns(now);
    debited += await this.debitDueSupplierPlanFees(now, (n) => (downgraded += n));

    return { debited, downgraded };
  }

  /** FR-7.10 supplement - the supplier-side mirror of debitDuePlanFees, debiting the separate supplier wallet. */
  private async debitDueSupplierPlanFees(now: Date, onDowngrade: (count: number) => void): Promise<number> {
    const due = await this.prismaAdmin.subscription.findMany({
      where: { supplierId: { not: null }, currentPeriodEnd: { lte: now } },
      include: { plan: true },
    });

    const freeSupplierPlan = await this.prismaAdmin.plan.findFirst({ where: { planGroup: "supplier", tierOrder: 0 } });
    let debited = 0;
    let downgraded = 0;

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
      } else if (freeSupplierPlan) {
        await this.prismaAdmin.subscription.update({
          where: { id: subscription.id },
          data: { planId: freeSupplierPlan.id, currentPeriodEnd: null },
        });
        downgraded += 1;
      }
    }

    onDowngrade(downgraded);
    return debited;
  }

  /** FR-7.2 (revised v0.24) - insufficient balance downgrades to Free, never orders_paused/suspension. */
  private async debitDuePlanFees(now: Date, onDowngrade: (count: number) => void): Promise<number> {
    const due = await this.prismaAdmin.subscription.findMany({
      where: { sellerId: { not: null }, currentPeriodEnd: { lte: now } },
      include: { plan: true },
    });

    const freePlan = await this.prismaAdmin.plan.findFirst({ where: { planGroup: "individual", tierOrder: 0 } });
    let debited = 0;
    let downgraded = 0;

    for (const subscription of due) {
      // Team-sponsored members carry currentPeriodEnd: null (SubscriptionsService.sponsorMember) so
      // they never appear here; this loop is individual-group paid plans only.
      if (subscription.plan.planGroup !== "individual" || Number(subscription.plan.price) <= 0) continue;

      const balance = await this.wallet.getBalance(subscription.sellerId!);
      const fee = Number(subscription.plan.price);

      if (balance >= fee) {
        await this.prismaAdmin.ledgerEntry.create({
          data: {
            sellerId: subscription.sellerId!,
            type: "wallet_plan_fee_debit",
            amount: round2(fee),
            currency: subscription.plan.currency,
          },
        });
        await this.prismaAdmin.subscription.update({
          where: { id: subscription.id },
          data: { currentPeriodEnd: addInterval(subscription.currentPeriodEnd!, subscription.plan.billingInterval as "monthly" | "yearly") },
        });
        debited += 1;
      } else if (freePlan) {
        await this.prismaAdmin.subscription.update({
          where: { id: subscription.id },
          data: { planId: freePlan.id, pendingPlanId: null, currentPeriodEnd: null },
        });
        downgraded += 1;
      }
    }

    onDowngrade(downgraded);
    return debited;
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

      await this.prismaAdmin.ledgerEntry.create({
        data: { sellerId: team.leaderSellerId, type: "wallet_team_seat_fee_debit", amount: total, currency: team.plan.currency },
      });
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

      await this.prismaAdmin.ledgerEntry.create({
        data: { sellerId, type: "wallet_device_slot_fee_debit", amount: round2(addOnPrice), currency: "PKR" },
      });
      debited += 1;
    }
    return debited;
  }
}
