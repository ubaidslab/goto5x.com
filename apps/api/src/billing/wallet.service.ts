import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LedgerEntryType } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { AuditLogService } from "../admin/audit-log.service";
import { EventsService } from "../events/events.service";
import { round2 } from "../orders/money.util";
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
]);

const CREDIT_TYPES: ReadonlySet<LedgerEntryType> = new Set([
  "wallet_topup_credit",
  "program_commission_credit",
  "program_reward_credit",
]);

function signedContribution(type: LedgerEntryType, amount: number): number {
  if (CREDIT_TYPES.has(type)) return amount;
  if (type === "commission_waived") return -amount; // amount is already negative - this adds back
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

/** Module 20 (SRS §5.6e). "extends Module 11's ledger" per the founder's own instruction - same LedgerEntry table, new entry types, computed here. */
@Injectable()
export class WalletService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly auditLog: AuditLogService,
    private readonly events: EventsService,
    private readonly topUpAdapter: ManualBankTransferTopUpAdapter,
  ) {}

  async getBalance(sellerId: string): Promise<number> {
    const entries = await this.prismaAdmin.ledgerEntry.findMany({
      where: { sellerId },
      select: { type: true, amount: true },
    });
    return round2(entries.reduce((sum, e) => sum + signedContribution(e.type, Number(e.amount)), 0));
  }

  /** FR-6.27 - every credit/debit, plain language, newest first. */
  async getTransactionHistory(sellerId: string): Promise<WalletTransactionLine[]> {
    const entries = await this.prismaAdmin.ledgerEntry.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
      include: { order: { select: { id: true } } },
    });
    return entries.map((e) => ({
      id: e.id,
      type: e.type,
      amount: signedContribution(e.type, Number(e.amount)),
      currency: e.currency,
      createdAt: e.createdAt,
      label: this.labelFor(e.type, e.order?.id ?? null),
    }));
  }

  private labelFor(type: LedgerEntryType, orderId: string | null): string {
    switch (type) {
      case "wallet_topup_credit":
        return "Top-up verified";
      case "commission_accrued":
        return orderId ? `Commission - Order ${orderId.slice(0, 8)}` : "Commission";
      case "commission_waived":
        return "Commission waived";
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
   */
  async verifyTopUp(topUpId: string, adminUserId: string) {
    const request = await this.prismaAdmin.walletTopUpRequest.findUnique({ where: { id: topUpId } });
    if (!request) throw new NotFoundException("Top-up request not found.");
    if (request.status !== "pending") throw new BadRequestException("This top-up request has already been resolved.");
    if (request.ownerType !== "seller") throw new BadRequestException("This is not a seller top-up request.");

    await this.prismaAdmin.$transaction(async (tx) => {
      await tx.walletTopUpRequest.update({
        where: { id: topUpId },
        data: { status: "verified", verifiedAt: new Date(), verifiedBy: adminUserId },
      });
      await tx.ledgerEntry.create({
        data: {
          sellerId: request.ownerId,
          type: "wallet_topup_credit",
          amount: request.amount,
          currency: request.currency,
        },
      });
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
}
