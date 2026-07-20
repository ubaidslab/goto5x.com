import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { SupplierLedgerEntryType } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { AuditLogService } from "../admin/audit-log.service";
import { round2 } from "../orders/money.util";
import { ManualBankTransferTopUpAdapter } from "./top-up-adapter.interface";

function signedContribution(type: SupplierLedgerEntryType, amount: number): number {
  return type === "topup_credit" ? amount : -amount;
}

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
    return round2(entries.reduce((sum, e) => sum + signedContribution(e.type, Number(e.amount)), 0));
  }

  async getTransactionHistory(supplierId: string) {
    const entries = await this.prismaAdmin.supplierWalletEntry.findMany({
      where: { supplierId },
      orderBy: { createdAt: "desc" },
    });
    return entries.map((e) => ({
      id: e.id,
      type: e.type,
      amount: signedContribution(e.type, Number(e.amount)),
      currency: e.currency,
      createdAt: e.createdAt,
      label: e.type === "topup_credit" ? "Top-up verified" : "Monthly plan fee",
    }));
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

  topUpInstructions(amount: number, currency: string): string {
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
