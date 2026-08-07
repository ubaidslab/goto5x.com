import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PayoutRequest, PayoutRequestStatus } from "@prisma/client";
import { AuditLogService } from "../admin/audit-log.service";
import { WalletGraceLadderService } from "../billing/wallet-grace-ladder.service";
import { WalletService } from "../billing/wallet.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";

const OUTSTANDING_STATUSES: PayoutRequestStatus[] = ["requested", "approved", "processing"];

/**
 * SRS §5.6b, reactivated by Module 22 (FR-33.9). Requesting/approving never
 * touches the ledger - the balance is only ever reduced the moment a
 * request is marked Paid, so a rejected request never needs a reversal
 * (nothing was ever taken). This is also why a rejection immediately makes
 * the seller's full balance requestable again: the "lock" is the existence
 * of an outstanding (non-terminal) request, not a ledger hold.
 */
@Injectable()
export class ProgramWithdrawalService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly wallet: WalletService,
    private readonly graceLadder: WalletGraceLadderService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Withdrawal is gated on CURRENTLY holding at least one `approved`
   * program participation - a plain seller with no program participation
   * (or one still `pending`, or `suspended`/`terminated`/`rejected`) can
   * never request one, since a positive wallet balance in v1.0 can only
   * ever come from these programs' own credits (commission is something a
   * seller owes the platform, never the reverse).
   */
  async requestPayout(sellerId: string, amount: number): Promise<PayoutRequest> {
    const approvedParticipation = await this.prismaAdmin.programParticipant.findFirst({
      where: { sellerId, status: "approved" },
    });
    if (!approvedParticipation) {
      throw new ForbiddenException("Only an approved program participant may request a withdrawal.");
    }

    const existingOutstanding = await this.prismaAdmin.payoutRequest.findFirst({
      where: { sellerId, status: { in: OUTSTANDING_STATUSES } },
    });
    if (existingOutstanding) {
      throw new BadRequestException("You already have an outstanding withdrawal request - wait for it to be resolved before requesting another.");
    }

    const minimum = await this.settings.resolve<number>("growth.withdrawal_minimum_pkr");
    const balance = await this.wallet.getBalance(sellerId);
    if (balance < minimum) {
      throw new BadRequestException(`Your wallet balance (${balance}) is below the minimum withdrawal amount (${minimum}).`);
    }
    if (amount > balance) {
      throw new BadRequestException(`Requested amount (${amount}) exceeds your current wallet balance (${balance}).`);
    }

    return this.prismaAdmin.payoutRequest.create({ data: { sellerId, amount, currency: "PKR" } });
  }

  async listOwn(sellerId: string): Promise<PayoutRequest[]> {
    return this.prismaAdmin.payoutRequest.findMany({ where: { sellerId }, orderBy: { requestedAt: "desc" } });
  }

  /** FR-33.11 - the withdrawal approval queue: everything not yet in a terminal state. */
  async listQueue(): Promise<PayoutRequest[]> {
    return this.prismaAdmin.payoutRequest.findMany({
      where: { status: { in: OUTSTANDING_STATUSES } },
      orderBy: { requestedAt: "asc" },
    });
  }

  async approve(adminUserId: string, payoutId: string, notes: string | undefined): Promise<PayoutRequest> {
    const before = await this.requireStatus(payoutId, ["requested"]);
    const after = await this.prismaAdmin.payoutRequest.update({
      where: { id: payoutId },
      data: { status: "approved", decidedByAdminUserId: adminUserId, decidedAt: new Date(), decisionNotes: notes ?? null },
    });
    await this.record(adminUserId, "growth_programs.payout_approved", payoutId, before.status, "approved");
    return after;
  }

  async markProcessing(adminUserId: string, payoutId: string): Promise<PayoutRequest> {
    const before = await this.requireStatus(payoutId, ["approved"]);
    const after = await this.prismaAdmin.payoutRequest.update({ where: { id: payoutId }, data: { status: "processing" } });
    await this.record(adminUserId, "growth_programs.payout_processing", payoutId, before.status, "processing");
    return after;
  }

  /** FR-6.11 - the manual disbursement adapter's own action: the ONLY moment money actually leaves the platform (a real `payout_debit` ledger entry). */
  async markPaid(adminUserId: string, payoutId: string, paymentReference: string | undefined): Promise<PayoutRequest> {
    const before = await this.requireStatus(payoutId, ["approved", "processing"]);

    await this.prismaAdmin.$transaction((tx) =>
      this.wallet.postLedgerEntry(tx, { sellerId: before.sellerId, type: "payout_debit", amount: Number(before.amount), currency: before.currency }),
    );
    const after = await this.prismaAdmin.payoutRequest.update({
      where: { id: payoutId },
      data: { status: "paid", paidAt: new Date(), paymentReference: paymentReference ?? null },
    });
    await this.record(adminUserId, "growth_programs.payout_paid", payoutId, before.status, "paid");
    return after;
  }

  /** Rejectable from `requested` or `approved` - never from `processing`/`paid` (those have already committed to disbursement or moved money). No ledger reversal needed since nothing was ever debited. */
  async reject(adminUserId: string, payoutId: string, notes: string | undefined): Promise<PayoutRequest> {
    const before = await this.requireStatus(payoutId, ["requested", "approved"]);
    const after = await this.prismaAdmin.payoutRequest.update({
      where: { id: payoutId },
      data: { status: "rejected", decidedByAdminUserId: adminUserId, decidedAt: new Date(), decisionNotes: notes ?? null },
    });
    await this.record(adminUserId, "growth_programs.payout_rejected", payoutId, before.status, "rejected");
    return after;
  }

  /**
   * FR-33.10 - a confirmed fraud finding's clawback, reusing §5.6e's
   * existing negative-balance mechanism verbatim: a plain ledger debit,
   * no balance check, so it can take a participant's wallet negative even
   * against already-withdrawn (paid) earnings. checkImmediateFloorPause
   * mirrors OrdersService.markAsPaid()'s call after a commission debit -
   * a harmless no-op for a referral-only participant with no stores to
   * pause.
   */
  async clawback(adminUserId: string, sellerId: string, amount: number, notes: string): Promise<void> {
    await this.prismaAdmin.$transaction((tx) =>
      this.wallet.postLedgerEntry(tx, { sellerId, type: "program_clawback_debit", amount, currency: "PKR" }),
    );
    await this.auditLog.record({
      adminUserId,
      action: "growth_programs.clawback",
      targetType: "seller",
      targetId: sellerId,
      afterValue: { amount, notes },
    });
    await this.graceLadder.checkImmediateFloorPause(sellerId);
  }

  private async requireStatus(payoutId: string, allowed: PayoutRequestStatus[]): Promise<PayoutRequest> {
    const request = await this.prismaAdmin.payoutRequest.findUnique({ where: { id: payoutId } });
    if (!request) throw new NotFoundException("Withdrawal request not found.");
    if (!allowed.includes(request.status)) {
      throw new BadRequestException(`This withdrawal request cannot be transitioned from its current status (${request.status}).`);
    }
    return request;
  }

  private async record(adminUserId: string, action: string, payoutId: string, beforeStatus: string, afterStatus: string): Promise<void> {
    await this.auditLog.record({
      adminUserId,
      action,
      targetType: "payout_request",
      targetId: payoutId,
      beforeValue: { status: beforeStatus },
      afterValue: { status: afterStatus },
    });
  }
}
