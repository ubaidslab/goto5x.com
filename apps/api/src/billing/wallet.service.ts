import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LedgerEntry, LedgerEntryType, Prisma } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { AuditLogService } from "../admin/audit-log.service";
import { EventsService } from "../events/events.service";
import { round2 } from "../orders/money.util";
import { SettingsService } from "../settings-registry/settings.service";
import { addInterval } from "../plans/subscriptions.service";
import { ManualBankTransferTopUpAdapter } from "./top-up-adapter.interface";

/**
 * Every debit type subtracts from balance, every credit type adds, and
 * commission_waived's already-negative amount adds back (see the schema
 * comment on LedgerEntry.amount) - this map is the one place that
 * knowledge lives.
 */
const DEBIT_TYPES: ReadonlySet<LedgerEntryType> = new Set([
  "commission_accrued",
  "wallet_plan_fee_debit",
  "wallet_team_seat_fee_debit",
  "wallet_device_slot_fee_debit",
  // Module 22 (SRS §5.33/FR-33.9/33.10) - `payout_debit` (reserved since
  // the original §5.6b schema, this module's first real writer) and the
  // clawback debit both reduce balance the same way every other debit
  // type here does.
  "payout_debit",
  "program_clawback_debit",
  // Module 23 (SRS §5.35/FR-35.2) - the Verified Store Program's
  // application-processing fee, same debit convention as every other fee
  // debit above.
  "verification_fee_debit",
  // Module 25 (Admin Completion) - the seller-360 page's manual "adjust
  // wallet" inline action.
  "admin_manual_debit",
]);

const CREDIT_TYPES: ReadonlySet<LedgerEntryType> = new Set([
  "wallet_topup_credit",
  "program_commission_credit",
  "program_reward_credit",
  "verification_fee_refund_credit",
  "admin_manual_credit",
]);

/** Exported so test fixtures that seed a LedgerEntry directly (bypassing the API) can keep WalletBalance in sync too - see test/e2e/setup.ts's seedLedgerEntry(). */
export function signedContribution(type: LedgerEntryType, amount: number): number {
  if (CREDIT_TYPES.has(type)) return amount;
  // amount is already negative for both of these - this adds back (a waiver
  // or a Module 53 refund's commission reversal both increase balance).
  if (type === "commission_waived" || type === "refund_adjustment") return -amount;
  if (DEBIT_TYPES.has(type)) return -amount;
  return 0; // dormant §5.6c/§5.6 entry types never contribute to the v1.0 wallet balance
}

export interface WalletTransactionLine {
  id: string;
  type: LedgerEntryType;
  amount: number;
  currency: string;
  createdAt: Date;
  label: string;
}

export interface WalletTransactionPage {
  items: WalletTransactionLine[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const DEFAULT_TRANSACTION_PAGE_LIMIT = 20;
const MAX_TRANSACTION_PAGE_LIMIT = 100;

/** Module 20 (SRS §5.6e). "extends Module 11's ledger" per the founder's own instruction - same LedgerEntry table, new entry types, computed here. */
@Injectable()
export class WalletService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly auditLog: AuditLogService,
    private readonly events: EventsService,
    private readonly topUpAdapter: ManualBankTransferTopUpAdapter,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Module 47 (SRS §5.6e, FR-6.21 amended v0.33) - O(1) read of the
   * maintained WalletBalance cache, not a re-aggregation. A seller with no
   * wallet activity yet has no WalletBalance row (postLedgerEntry() creates
   * one on its first write) - that's balance 0, same as an empty ledger sum
   * always was.
   */
  async getBalance(sellerId: string): Promise<number> {
    const row = await this.prismaAdmin.walletBalance.findUnique({ where: { sellerId } });
    return row ? round2(Number(row.balance)) : 0;
  }

  /**
   * Module 47 (new FR-6.29) - the independent, from-scratch ledger
   * re-aggregation WalletService.getBalance() used to do on every call,
   * before this module. Used ONLY by WalletReconciliationService's daily
   * sweep, which compares this against the cached column - never called on
   * any hot path, so its O(n) cost is fine here.
   */
  async computeLedgerBalance(sellerId: string): Promise<number> {
    const entries = await this.prismaAdmin.ledgerEntry.findMany({
      where: { sellerId },
      select: { type: true, amount: true },
    });
    return round2(entries.reduce((sum, e) => sum + signedContribution(e.type, Number(e.amount)), 0));
  }

  /**
   * Module 47 (SRS §5.6e, FR-6.21 amended v0.33) - the ONE function that
   * creates a wallet-relevant LedgerEntry. Every prior direct
   * `prisma.ledgerEntry.create()` call site in the codebase now goes
   * through this instead, so the WalletBalance cache can never drift from a
   * write path that forgot to update it: the ledger insert and the atomic
   * balance increment/decrement always happen in the SAME transaction
   * (`tx`, always caller-supplied - this never opens its own transaction,
   * so a caller doing other work in the same transaction stays atomic with
   * both writes here). `tx.walletBalance.upsert()`'s `update.increment` is
   * a single `UPDATE ... SET balance = balance + $delta` at the database
   * level - not a read-then-write in application code - so two concurrent
   * callers debiting/crediting the same seller can never lose an update to
   * each other, regardless of how many run at once (FR-6.21's "correctness
   * problem" this module fixes).
   */
  async postLedgerEntry(
    tx: Prisma.TransactionClient,
    data: { sellerId: string; type: LedgerEntryType; amount: number; currency: string; orderId?: string; invoiceId?: string },
  ): Promise<LedgerEntry> {
    const entry = await tx.ledgerEntry.create({ data });
    const delta = signedContribution(data.type, data.amount);
    await tx.walletBalance.upsert({
      where: { sellerId: data.sellerId },
      create: { sellerId: data.sellerId, balance: delta },
      update: { balance: { increment: delta } },
    });
    return entry;
  }

  /**
   * FR-6.27 - every credit/debit, plain language, newest first. Phase B
   * pre-launch audit finding: this used to return every ledger entry with
   * no limit, which degrades for a high-volume seller (thousands of
   * commission/fee rows over time). Page/limit, same shape a future
   * cursor-based rewrite could still slot behind if offset pagination ever
   * gets too slow at real scale - not needed at v1.0's volume.
   */
  async getTransactionHistory(
    sellerId: string,
    page = 1,
    limit = DEFAULT_TRANSACTION_PAGE_LIMIT,
  ): Promise<WalletTransactionPage> {
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(MAX_TRANSACTION_PAGE_LIMIT, Math.max(1, Math.floor(limit)));

    const [entries, total] = await Promise.all([
      this.prismaAdmin.ledgerEntry.findMany({
        where: { sellerId },
        orderBy: { createdAt: "desc" },
        include: { order: { select: { id: true } } },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prismaAdmin.ledgerEntry.count({ where: { sellerId } }),
    ]);

    return {
      items: entries.map((e) => ({
        id: e.id,
        type: e.type,
        amount: signedContribution(e.type, Number(e.amount)),
        currency: e.currency,
        createdAt: e.createdAt,
        label: this.labelFor(e.type, e.order?.id ?? null),
      })),
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  private labelFor(type: LedgerEntryType, orderId: string | null): string {
    switch (type) {
      case "wallet_topup_credit":
        return "Top-up verified";
      case "commission_accrued":
        return orderId ? `Commission - Order ${orderId.slice(0, 8)}` : "Commission";
      case "commission_waived":
        return "Commission waived";
      case "refund_adjustment":
        return orderId ? `Refund - commission reversed for order ${orderId.slice(0, 8)}` : "Refund - commission reversed";
      case "wallet_plan_fee_debit":
        return "Monthly plan fee";
      case "wallet_team_seat_fee_debit":
        return "Team seat fee";
      case "wallet_device_slot_fee_debit":
        return "Extra device slot fee";
      case "program_commission_credit":
        return "Growth program referral commission";
      case "program_reward_credit":
        return "Growth program reward";
      case "program_clawback_debit":
        return "Growth program clawback";
      case "payout_debit":
        return "Withdrawal paid";
      case "verification_fee_debit":
        return "Verified Store application fee";
      case "verification_fee_refund_credit":
        return "Verified Store application fee refunded";
      case "admin_manual_credit":
        return "Manual admin credit";
      case "admin_manual_debit":
        return "Manual admin debit";
      default:
        return type;
    }
  }

  /** FR-6.23 - the instructions the seller sees before/while requesting a top-up. */
  topUpInstructions(amount: number, currency: string): string {
    return this.topUpAdapter.instructionsFor(amount, currency);
  }

  async requestTopUp(sellerId: string, amount: number, currency: string) {
    if (amount <= 0) throw new BadRequestException("Top-up amount must be greater than zero.");
    return this.prismaAdmin.walletTopUpRequest.create({
      data: { ownerType: "seller", ownerId: sellerId, amount, currency, method: this.topUpAdapter.method },
    });
  }

  /**
   * Module 59 (SRS §5.6g, FR-6.33) - the combined signup total, computed
   * server-side (never client-supplied - a seller cannot choose their own
   * plan-fee portion). `planFeePortion` is the plan's `firstCyclePrice`
   * (Module 61, FR-7.20) - a one-time discount for the subscription's very
   * first billing cycle - falling back to `price` for a tier with no
   * firstCyclePrice set (e.g. one created outside the launch seed).
   */
  async getSignupPaymentPreview(sellerId: string, currency: string) {
    const subscription = await this.prismaAdmin.subscription.findUnique({
      where: { sellerId },
      include: { plan: true },
    });
    if (!subscription) throw new NotFoundException("No subscription found for this seller.");

    const topUpPortion = round2(await this.settings.resolve<number>("billing.minimum_signup_wallet_topup"));
    const planFeePortion = round2(Number(subscription.plan.firstCyclePrice ?? subscription.plan.price));
    return {
      planName: subscription.plan.name,
      planFeePortion,
      topUpPortion,
      total: round2(planFeePortion + topUpPortion),
      currency,
      instructions: this.topUpAdapter.instructionsFor(planFeePortion + topUpPortion, currency),
    };
  }

  /**
   * FR-6.33 - one proof-of-payment for the combined total, submitted
   * through the exact same WalletTopUpRequest row an ordinary top-up uses
   * (`amount` keeps meaning "the wallet-credit portion"; `planFeePortion`
   * carries the rest). One-time by design: a second combined request is
   * rejected while an earlier one is still pending or already verified,
   * but a REJECTED one may be resubmitted, same as any ordinary top-up.
   */
  async requestCombinedSignupPayment(sellerId: string, currency: string) {
    const existing = await this.prismaAdmin.walletTopUpRequest.findFirst({
      where: { ownerType: "seller", ownerId: sellerId, planFeePortion: { not: null }, status: { in: ["pending", "verified"] } },
    });
    if (existing) {
      throw new BadRequestException("A combined signup payment has already been submitted for this account.");
    }

    const preview = await this.getSignupPaymentPreview(sellerId, currency);
    const request = await this.prismaAdmin.walletTopUpRequest.create({
      data: {
        ownerType: "seller",
        ownerId: sellerId,
        amount: preview.topUpPortion,
        planFeePortion: preview.planFeePortion,
        currency,
        method: this.topUpAdapter.method,
      },
    });
    return { request, ...preview };
  }

  async listOwnTopUpRequests(sellerId: string) {
    return this.prismaAdmin.walletTopUpRequest.findMany({
      where: { ownerType: "seller", ownerId: sellerId },
      orderBy: { requestedAt: "desc" },
    });
  }

  async listPendingForAdmin() {
    return this.prismaAdmin.walletTopUpRequest.findMany({
      where: { status: "pending" },
      orderBy: { requestedAt: "asc" },
    });
  }

  /**
   * FR-6.23 - the credit lands only once an admin verifies it, audit-logged
   * exactly like every other control-plane mutation (FR-8.9). Returns the
   * seller id so the caller (AdminWalletController) can trigger
   * WalletGraceLadderService's instant-restore check (FR-6.25) - kept as a
   * separate call rather than a callback so the two services don't need to
   * know about each other.
   *
   * FR-6.33 (Module 59) - when `planFeePortion` is set, this is a combined
   * signup payment: in the SAME transaction as the wallet-credit ledger
   * post, the seller's Subscription.currentPeriodEnd is activated for one
   * full billing interval measured from THIS verification (not stacked on
   * top of the free placeholder period SubscriptionsService.
   * assignBasicPlanAtSignup() already granted at signup) - this is what
   * "activates" (rather than "advances") means here: the real, paid clock
   * starts the moment payment is actually confirmed, so an admin-processing
   * delay after signup never costs the seller part of a paid cycle.
   */
  async verifyTopUp(topUpId: string, adminUserId: string) {
    const request = await this.prismaAdmin.walletTopUpRequest.findUnique({ where: { id: topUpId } });
    if (!request) throw new NotFoundException("Top-up request not found.");
    if (request.status !== "pending") throw new BadRequestException("This top-up request has already been resolved.");
    if (request.ownerType !== "seller") throw new BadRequestException("This is not a seller top-up request.");

    const planFeePortion = request.planFeePortion !== null ? Number(request.planFeePortion) : null;

    await this.prismaAdmin.$transaction(async (tx) => {
      await tx.walletTopUpRequest.update({
        where: { id: topUpId },
        data: { status: "verified", verifiedAt: new Date(), verifiedBy: adminUserId },
      });
      await this.postLedgerEntry(tx, {
        sellerId: request.ownerId,
        type: "wallet_topup_credit",
        amount: Number(request.amount),
        currency: request.currency,
      });
      if (planFeePortion !== null && planFeePortion > 0) {
        const subscription = await tx.subscription.findUniqueOrThrow({
          where: { sellerId: request.ownerId },
          include: { plan: true },
        });
        await tx.subscription.update({
          where: { sellerId: request.ownerId },
          data: { currentPeriodEnd: addInterval(new Date(), subscription.plan.billingInterval as "monthly" | "yearly") },
        });
      }
    });

    await this.auditLog.record({
      adminUserId,
      action: "billing.wallet_topup_verified",
      targetType: "wallet_topup_request",
      targetId: topUpId,
      beforeValue: { status: "pending" },
      afterValue: { status: "verified", amount: Number(request.amount) },
    });
    await this.events.emit({
      eventType: "wallet.topup_verified",
      actorType: "admin",
      actorId: adminUserId,
      entityType: "seller",
      entityId: request.ownerId,
      metadata: { amount: Number(request.amount) },
    });

    return this.prismaAdmin.walletTopUpRequest.findUniqueOrThrow({ where: { id: topUpId } });
  }

  async rejectTopUp(topUpId: string, adminUserId: string) {
    const request = await this.prismaAdmin.walletTopUpRequest.findUnique({ where: { id: topUpId } });
    if (!request) throw new NotFoundException("Top-up request not found.");
    if (request.status !== "pending") throw new BadRequestException("This top-up request has already been resolved.");

    const after = await this.prismaAdmin.walletTopUpRequest.update({
      where: { id: topUpId },
      data: { status: "rejected", verifiedAt: new Date(), verifiedBy: adminUserId },
    });

    await this.auditLog.record({
      adminUserId,
      action: "billing.wallet_topup_rejected",
      targetType: "wallet_topup_request",
      targetId: topUpId,
      beforeValue: { status: "pending" },
      afterValue: { status: "rejected" },
    });
    return after;
  }

  /**
   * Module 25 (Admin Completion) - the seller-360 page's "adjust wallet"
   * inline action. `amount` is signed: positive credits, negative debits
   * (never zero - a no-op adjustment has no reason to exist). A reason is
   * mandatory and lands on the audit entry, not the ledger row itself (no
   * ledger entry type here carries a free-text reason column, same as
   * every other entry type).
   */
  async adminManualAdjust(sellerId: string, amount: number, currency: string, reason: string, adminUserId: string) {
    if (amount === 0) {
      throw new BadRequestException("Adjustment amount must not be zero.");
    }
    if (!reason.trim()) {
      throw new BadRequestException("A reason is required for a manual wallet adjustment.");
    }

    const type: LedgerEntryType = amount > 0 ? "admin_manual_credit" : "admin_manual_debit";
    const entry = await this.prismaAdmin.$transaction((tx) =>
      this.postLedgerEntry(tx, { sellerId, type, amount: round2(Math.abs(amount)), currency }),
    );

    await this.auditLog.record({
      adminUserId,
      action: "billing.wallet_manual_adjust",
      targetType: "seller",
      targetId: sellerId,
      afterValue: { type, amount: round2(Math.abs(amount)), currency, reason },
    });

    return entry;
  }
}
