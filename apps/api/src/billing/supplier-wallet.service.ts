import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SupplierLedgerEntryType } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { AuditLogService } from "../admin/audit-log.service";
import { round2 } from "../orders/money.util";
import { ManualBankTransferTopUpAdapter } from "./top-up-adapter.interface";

function signedContribution(type: SupplierLedgerEntryType, amount: number): number {
  return type === "topup_credit" ? amount : -amount;
}

export interface SupplierWalletTransactionPage {
  items: {
    id: string;
    type: SupplierLedgerEntryType;
    amount: number;
    currency: string;
    createdAt: Date;
    label: string;
  }[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const DEFAULT_TRANSACTION_PAGE_LIMIT = 20;
const MAX_TRANSACTION_PAGE_LIMIT = 100;

/**
 * Module 20 (SRS FR-7.10 supplement). A supplier's own small wallet - only
 * ever pays its own Premium-tier plan fee, so this is a dedicated ledger
 * rather than a second owner type crammed into the seller wallet's richer
 * entry-type set. Top-up REQUESTS still share `wallet_topup_requests`
 * (ownerType: "supplier") with the seller wallet - identical manual-
 * verification workflow, just a different table the credit lands on.
 */
@Injectable()
export class SupplierWalletService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly auditLog: AuditLogService,
    private readonly topUpAdapter: ManualBankTransferTopUpAdapter,
  ) {}

  async getBalance(supplierId: string): Promise<number> {
    const entries = await this.prismaAdmin.supplierWalletEntry.findMany({
      where: { supplierId },
      select: { type: true, amount: true },
    });
    return this.sumEntries(entries);
  }

  private sumEntries(entries: { type: SupplierLedgerEntryType; amount: unknown }[]): number {
    return round2(entries.reduce((sum, e) => sum + signedContribution(e.type, Number(e.amount)), 0));
  }

  /**
   * P2 fix (docs/security-audit-report.md #9) - this used to be a plain
   * read-then-recompute in `PlanFeeDebitService.debitDueSupplierPlanFees()`
   * (getBalance(), then a separate create() if sufficient): a genuine
   * check-then-write race, unlike every other money-path in this codebase
   * (WalletService.postLedgerEntry()'s atomic `increment` on a real balance
   * column; the discount-code/gift-card atomic conditional `updateMany`).
   * There's no cached balance column here to `updateMany` against - the
   * balance is a ledger SUM - so the fix instead takes a `SELECT ... FOR
   * UPDATE` lock on the supplier's own Subscription row (one per supplier,
   * `@unique`, always exists - the same technique proven on the campaign-
   * quota race, docs/security-audit-report.md #17) for the duration of the
   * caller's transaction, serializing concurrent debit attempts for that
   * supplier so a second one sees the first's already-committed entry
   * before deciding whether the balance is still sufficient. Returns
   * false (no entry created) on insufficient balance - same "leave it
   * overdue, never go negative" behavior as before.
   */
  async debitIfSufficientBalance(
    tx: Prisma.TransactionClient,
    supplierId: string,
    amount: number,
    currency: string,
    type: SupplierLedgerEntryType = "plan_fee_debit",
  ): Promise<boolean> {
    await tx.$queryRawUnsafe(`SELECT id FROM subscriptions WHERE supplier_id = $1::uuid FOR UPDATE`, supplierId);

    const entries = await tx.supplierWalletEntry.findMany({
      where: { supplierId },
      select: { type: true, amount: true },
    });
    const balance = this.sumEntries(entries);
    if (balance < amount) return false;

    await tx.supplierWalletEntry.create({ data: { supplierId, type, amount: round2(amount), currency } });
    return true;
  }

  /** Phase B pre-launch audit finding - same unbounded-growth fix as WalletService.getTransactionHistory(). */
  async getTransactionHistory(
    supplierId: string,
    page = 1,
    limit = DEFAULT_TRANSACTION_PAGE_LIMIT,
  ): Promise<SupplierWalletTransactionPage> {
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(MAX_TRANSACTION_PAGE_LIMIT, Math.max(1, Math.floor(limit)));

    const [entries, total] = await Promise.all([
      this.prismaAdmin.supplierWalletEntry.findMany({
        where: { supplierId },
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prismaAdmin.supplierWalletEntry.count({ where: { supplierId } }),
    ]);

    return {
      items: entries.map((e) => ({
        id: e.id,
        type: e.type,
        amount: signedContribution(e.type, Number(e.amount)),
        currency: e.currency,
        createdAt: e.createdAt,
        label: e.type === "topup_credit" ? "Top-up verified" : "Monthly plan fee",
      })),
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  async requestTopUp(supplierId: string, amount: number, currency: string) {
    if (amount <= 0) throw new BadRequestException("Top-up amount must be greater than zero.");
    return this.prismaAdmin.walletTopUpRequest.create({
      data: { ownerType: "supplier", ownerId: supplierId, amount, currency, method: this.topUpAdapter.method },
    });
  }

  async listOwnTopUpRequests(supplierId: string) {
    return this.prismaAdmin.walletTopUpRequest.findMany({
      where: { ownerType: "supplier", ownerId: supplierId },
      orderBy: { requestedAt: "desc" },
    });
  }

  topUpInstructions(amount: number, currency: string): Promise<string> {
    return this.topUpAdapter.instructionsFor(amount, currency);
  }

  async verifyTopUp(topUpId: string, adminUserId: string) {
    const request = await this.prismaAdmin.walletTopUpRequest.findUnique({ where: { id: topUpId } });
    if (!request) throw new NotFoundException("Top-up request not found.");
    if (request.status !== "pending") throw new BadRequestException("This top-up request has already been resolved.");
    if (request.ownerType !== "supplier") throw new BadRequestException("This is not a supplier top-up request.");

    await this.prismaAdmin.$transaction(async (tx) => {
      await tx.walletTopUpRequest.update({
        where: { id: topUpId },
        data: { status: "verified", verifiedAt: new Date(), verifiedBy: adminUserId },
      });
      await tx.supplierWalletEntry.create({
        data: { supplierId: request.ownerId, type: "topup_credit", amount: request.amount, currency: request.currency },
      });
    });

    await this.auditLog.record({
      adminUserId,
      action: "billing.supplier_wallet_topup_verified",
      targetType: "wallet_topup_request",
      targetId: topUpId,
      beforeValue: { status: "pending" },
      afterValue: { status: "verified", amount: Number(request.amount) },
    });
    return this.prismaAdmin.walletTopUpRequest.findUniqueOrThrow({ where: { id: topUpId } });
  }
}
