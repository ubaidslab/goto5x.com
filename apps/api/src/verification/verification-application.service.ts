import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../admin/audit-log.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { WalletService } from "../billing/wallet.service";
import { VerificationEligibilityService } from "./verification-eligibility.service";

const CURRENCY = "PKR";

/**
 * SRS §5.35, FR-35.2-35.6. Applications are the audit-queue history
 * (`VerifiedStoreApplication`); `Store.verifiedStatus`/`verifiedSince`/
 * `verifiedExpiresAt`/`reReviewFlaggedAt` are the live badge state a single
 * store carries. An admin decision on an application is the only thing
 * that ever moves a store INTO `verified`; a drift-triggered re-review flag
 * or a direct admin revoke are the only things that ever move it OUT
 * without a fresh application (see class comments on the schema itself).
 */
@Injectable()
export class VerificationApplicationService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly auditLog: AuditLogService,
    private readonly eligibility: VerificationEligibilityService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * FR-35.2 - re-checks eligibility server-side regardless of what the
   * seller's own portal call showed (§14.35's "cannot be bypassed via
   * direct API call"), debits the fee BEFORE any admin decision exists,
   * then opens the mandatory audit-queue row. Never auto-approved, even
   * when every criterion passes.
   */
  async apply(sellerId: string, storeId: string) {
    const store = await this.prismaAdmin.store.findUniqueOrThrow({ where: { id: storeId } });
    if (store.sellerId !== sellerId) throw new NotFoundException("Store not found.");

    if (store.verifiedStatus === "verified") {
      throw new BadRequestException("This store is already verified.");
    }
    if (store.verifiedStatus === "pending_re_review") {
      throw new BadRequestException("This store is currently under re-review - resolve that before applying again.");
    }
    const existingPending = await this.prismaAdmin.verifiedStoreApplication.findFirst({
      where: { storeId, status: "pending_review" },
    });
    if (existingPending) {
      throw new BadRequestException("An application for this store is already pending review.");
    }

    const eligibility = await this.eligibility.check(storeId);
    if (!eligibility.allPass) {
      throw new BadRequestException({
        message: "This store does not yet meet every Verified Store eligibility criterion.",
        criteria: eligibility.criteria,
      });
    }

    const hasPriorApproval = await this.prismaAdmin.verifiedStoreApplication.findFirst({
      where: { storeId, status: "approved" },
    });
    const feeAmount = await this.settings.resolve<number>(
      hasPriorApproval ? "verification.reverification_fee_pkr" : "verification.fee_pkr",
    );

    if (feeAmount > 0) {
      const balance = await this.wallet.getBalance(sellerId);
      if (balance < feeAmount) {
        throw new BadRequestException(
          `Insufficient wallet balance to pay the Rs. ${feeAmount} verification fee - top up your wallet first.`,
        );
      }
    }

    const application = await this.prismaAdmin.$transaction(async (tx) => {
      if (feeAmount > 0) {
        await this.wallet.postLedgerEntry(tx, { sellerId, type: "verification_fee_debit", amount: feeAmount, currency: CURRENCY });
      }
      return tx.verifiedStoreApplication.create({
        data: {
          storeId,
          sellerId,
          feeAmount,
          currency: CURRENCY,
          eligibilitySnapshot: eligibility as unknown as object,
        },
      });
    });

    return application;
  }

  async listOwn(sellerId: string, storeId: string) {
    return this.prismaAdmin.verifiedStoreApplication.findMany({
      where: { storeId, sellerId },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Mandatory admin audit queue (FR-35.2) - includes the frozen eligibility snapshot the reviewer needs (health/T&S/KYC picture). */
  async listQueue() {
    return this.prismaAdmin.verifiedStoreApplication.findMany({
      where: { status: "pending_review" },
      orderBy: { createdAt: "asc" },
      include: { store: { select: { id: true, name: true, slug: true } }, seller: { select: { id: true, businessName: true } } },
    });
  }

  async approve(adminUserId: string, applicationId: string, notes?: string) {
    const application = await this.prismaAdmin.verifiedStoreApplication.findUnique({ where: { id: applicationId } });
    if (!application) throw new NotFoundException("Application not found.");
    if (application.status !== "pending_review") throw new BadRequestException("This application has already been decided.");

    const annualReverificationEnabled = await this.settings.resolve<boolean>("verification.annual_reverification_enabled");
    const now = new Date();
    const verifiedExpiresAt = annualReverificationEnabled ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) : null;

    await this.prismaAdmin.$transaction(async (tx) => {
      await tx.verifiedStoreApplication.update({
        where: { id: applicationId },
        data: { status: "approved", decidedBy: adminUserId, decidedAt: now, decisionNotes: notes },
      });
      await tx.store.update({
        where: { id: application.storeId },
        data: {
          verifiedStatus: "verified",
          verifiedSince: now,
          verifiedExpiresAt,
          reReviewFlaggedAt: null,
          reReviewReason: null,
        },
      });
    });

    await this.auditLog.record({
      adminUserId,
      action: "verification.application.approve",
      targetType: "verified_store_application",
      targetId: applicationId,
      beforeValue: { status: "pending_review" },
      afterValue: { status: "approved", notes },
    });

    return this.prismaAdmin.verifiedStoreApplication.findUniqueOrThrow({ where: { id: applicationId } });
  }

  /** FR-35.3 - a reject can happen even when every automated criterion passed; the fee is refunded per the Settings-controlled policy. */
  async reject(adminUserId: string, applicationId: string, notes?: string) {
    const application = await this.prismaAdmin.verifiedStoreApplication.findUnique({ where: { id: applicationId } });
    if (!application) throw new NotFoundException("Application not found.");
    if (application.status !== "pending_review") throw new BadRequestException("This application has already been decided.");

    const refundOnReject = await this.settings.resolve<boolean>("verification.refund_on_reject");

    await this.prismaAdmin.$transaction(async (tx) => {
      await tx.verifiedStoreApplication.update({
        where: { id: applicationId },
        data: { status: "rejected", decidedBy: adminUserId, decidedAt: new Date(), decisionNotes: notes },
      });
      if (refundOnReject && Number(application.feeAmount) > 0) {
        await this.wallet.postLedgerEntry(tx, {
          sellerId: application.sellerId,
          type: "verification_fee_refund_credit",
          amount: Number(application.feeAmount),
          currency: application.currency,
        });
      }
    });

    await this.auditLog.record({
      adminUserId,
      action: "verification.application.reject",
      targetType: "verified_store_application",
      targetId: applicationId,
      beforeValue: { status: "pending_review" },
      afterValue: { status: "rejected", notes, refunded: refundOnReject },
    });

    return this.prismaAdmin.verifiedStoreApplication.findUniqueOrThrow({ where: { id: applicationId } });
  }

  /** FR-35.5 - the admin's standing, any-time override; also how a flagged re-review is resolved as "confirm revoke". */
  async revoke(adminUserId: string, storeId: string, notes: string) {
    const store = await this.prismaAdmin.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException("Store not found.");

    await this.prismaAdmin.store.update({
      where: { id: storeId },
      data: { verifiedStatus: "revoked", verifiedExpiresAt: null, reReviewFlaggedAt: null, reReviewReason: null },
    });

    await this.auditLog.record({
      adminUserId,
      action: "verification.store.revoke",
      targetType: "store",
      targetId: storeId,
      beforeValue: { verifiedStatus: store.verifiedStatus },
      afterValue: { verifiedStatus: "revoked", notes },
    });
  }

  /** Resolves a drift-triggered re-review flag with no action - the store returns to `verified` unchanged. */
  async clearReReview(adminUserId: string, storeId: string, notes?: string) {
    const store = await this.prismaAdmin.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException("Store not found.");
    if (store.verifiedStatus !== "pending_re_review") {
      throw new BadRequestException("This store is not currently flagged for re-review.");
    }

    await this.prismaAdmin.store.update({
      where: { id: storeId },
      data: { verifiedStatus: "verified", reReviewFlaggedAt: null, reReviewReason: null },
    });

    await this.auditLog.record({
      adminUserId,
      action: "verification.store.clear_re_review",
      targetType: "store",
      targetId: storeId,
      beforeValue: { verifiedStatus: "pending_re_review", reason: store.reReviewReason },
      afterValue: { verifiedStatus: "verified", notes },
    });
  }

  async listPendingReReview() {
    return this.prismaAdmin.store.findMany({
      where: { verifiedStatus: "pending_re_review" },
      select: { id: true, name: true, slug: true, reReviewFlaggedAt: true, reReviewReason: true },
      orderBy: { reReviewFlaggedAt: "asc" },
    });
  }
}
