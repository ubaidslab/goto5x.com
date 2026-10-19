import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Paddle } from "@paddle/paddle-node-sdk";
import { PrismaAdminService } from "../../prisma/prisma-admin.service";
import { AuditLogService } from "../../admin/audit-log.service";
import { SettingsService } from "../../settings-registry/settings.service";
import { addInterval } from "../../plans/subscriptions.service";
import { WalletGraceLadderService } from "../wallet-grace-ladder.service";
import { FoundingMembersService } from "./founding-members.service";
import { PADDLE_CLIENT } from "./paddle-client.provider";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * D135/B3 (Paddle) - the Paddle-rail counterpart to WalletService.
 * verifyTopUp()'s plan-fee branch: both are "a payment just got
 * confirmed, advance currentPeriodEnd" - this one driven by a signature-
 * verified Paddle webhook instead of an admin clicking "verify."
 * `Subscription.currentPeriodEnd`/`planId`/`status` stay the one source
 * of truth either way (D10/D134) - Paddle's own `next_billed_at` is only
 * ever pushed to match ours (applySixMonthBonusDays), never consulted
 * for access.
 */
@Injectable()
export class PaddleSubscriptionLifecycleService {
  private readonly logger = new Logger(PaddleSubscriptionLifecycleService.name);

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly auditLog: AuditLogService,
    private readonly settings: SettingsService,
    private readonly walletGraceLadder: WalletGraceLadderService,
    private readonly foundingMembers: FoundingMembersService,
    @Inject(PADDLE_CLIENT) private readonly paddle: Paddle | null,
  ) {}

  /**
   * `transaction.completed` is the trigger - not `subscription.updated`,
   * which fires for many reasons unrelated to a successful charge (item
   * changes, discount changes, schedule edits). This is the unambiguous
   * "Paddle was just paid" signal, the same role `checkout.session.
   * completed` played for Stripe (B2) and the admin-verify click plays
   * for the manual rail.
   *
   * `isRenewal` is "does this subscription already have a
   * paddleSubscriptionId" - the Paddle-rail equivalent of WalletService.
   * verifyTopUp()'s "does a prior verified plan-fee payment exist."
   */
  async confirmCharge(params: {
    sellerId: string;
    paddleSubscriptionId: string;
    paddleCustomerId: string;
    paddleTransactionId: string;
  }): Promise<void> {
    await this.prismaAdmin.$transaction(async (tx) => {
      const subscription = await tx.subscription.findUniqueOrThrow({ where: { sellerId: params.sellerId } });
      const isRenewal = subscription.paddleSubscriptionId === params.paddleSubscriptionId;
      // "none" (the sponsored-team-member/free case) never reaches a real
      // Paddle charge - a webhook naming one here is a real inconsistency
      // worth failing loudly on rather than silently miscomputing a date.
      if (subscription.billingInterval === "none") {
        throw new BadRequestException(`Subscription for seller ${params.sellerId} has billingInterval "none" but received a Paddle charge.`);
      }
      const interval = subscription.billingInterval;
      const nextPeriodEnd = isRenewal && subscription.currentPeriodEnd
        ? addInterval(subscription.currentPeriodEnd, interval)
        : addInterval(new Date(), interval);

      await tx.subscription.update({
        where: { sellerId: params.sellerId },
        data: {
          currentPeriodEnd: nextPeriodEnd,
          paddleSubscriptionId: params.paddleSubscriptionId,
          paddleCustomerId: params.paddleCustomerId,
          lastPaddleTransactionId: params.paddleTransactionId,
          lastPaddleChargedAt: new Date(),
          status: "active",
          // Module 65 (FR-6.42) - same reset WalletService.verifyTopUp()
          // does on every advance, so the pre-expiry reminder ladder
          // fires fresh for the new cycle rather than staying silent
          // forever after its first firing.
          renewalReminderDay7SentAt: null,
          renewalReminderDay3SentAt: null,
          renewalReminderDay1SentAt: null,
          renewalReminderExpiryDaySentAt: null,
        },
      });

      // D17/D134 - only this seller's genuinely first-ever payment
      // (either rail) can claim a Founding Member ordinal.
      if (!isRenewal) {
        const ordinal = await this.foundingMembers.claimOrdinalIfEligible(tx);
        if (ordinal !== null) {
          await tx.subscription.update({
            where: { sellerId: params.sellerId },
            data: { isFoundingMember: true, foundingMemberOrdinal: ordinal },
          });
        }
      }
    });

    this.logger.log(`Paddle charge confirmed for seller ${params.sellerId} (transaction ${params.paddleTransactionId}).`);

    const subscription = await this.prismaAdmin.subscription.findUniqueOrThrow({ where: { sellerId: params.sellerId } });
    if (subscription.billingInterval === "six_month") {
      await this.applySixMonthBonusDays(params.sellerId);
    }
  }

  /**
   * D10's 15-bonus-days rule, Paddle side. `addInterval()` has already
   * computed `currentPeriodEnd` as +6 calendar months + 15 days - this
   * call only tells Paddle to bill again on that same date, so Paddle's
   * OWN schedule doesn't quietly charge the card 15 days before our
   * entitlement actually ends. `proration_billing_mode: "do_not_bill"`
   * - a pure date move, never a charge.
   *
   * Founder's explicit rule (D10's "Implementation note"): if this call
   * fails for any reason, drop the bonus for this cycle rather than fake
   * Paddle's own schedule - our own currentPeriodEnd/access is already
   * correct regardless of whether this succeeds, so a failure here is
   * logged and swallowed, never retried in a loop, never surfaced to
   * the seller as an error.
   */
  async applySixMonthBonusDays(sellerId: string): Promise<void> {
    if (!this.paddle) return;
    const subscription = await this.prismaAdmin.subscription.findUniqueOrThrow({ where: { sellerId } });
    if (!subscription.paddleSubscriptionId || !subscription.currentPeriodEnd) return;

    try {
      await this.paddle.subscriptions.update(subscription.paddleSubscriptionId, {
        nextBilledAt: subscription.currentPeriodEnd.toISOString(),
        prorationBillingMode: "do_not_bill",
      });
    } catch (err) {
      this.logger.warn(
        `Paddle change-billing-dates failed for seller ${sellerId} - dropping the 15-day bonus-day Paddle-side sync for this cycle per D10's explicit rule. Our own currentPeriodEnd is unaffected. ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** `subscription.canceled` - Paddle's own object reached a terminal state (dunning exhausted, or a prior cancel-at-period-end finally took effect). */
  async markCanceled(paddleSubscriptionId: string): Promise<void> {
    const subscription = await this.prismaAdmin.subscription.findUnique({ where: { paddleSubscriptionId } });
    if (!subscription) return;
    await this.prismaAdmin.subscription.update({ where: { id: subscription.id }, data: { status: "cancelled" } });
  }

  /**
   * Seller-initiated, from the billing page (D134/D11): 100% refund of
   * ANY paid charge within 14 days, not just the first cycle. Auto-
   * approve only when within the window AND this is the account's first
   * money-back refund in a trailing 12 months (the refund-hopping
   * guard) - otherwise routed to admin review, never auto-rejected.
   */
  async requestRefund(sellerId: string): Promise<{ status: "approved" | "pending"; refundRequestId: string }> {
    const subscription = await this.prismaAdmin.subscription.findUnique({ where: { sellerId } });
    if (!subscription?.lastPaddleTransactionId || !subscription.lastPaddleChargedAt) {
      throw new NotFoundException("No Paddle charge found for this seller to refund.");
    }

    const windowDays = await this.settings.resolve<number>("billing.subscription_refund_window_days").catch(() => 14);
    const deadline = new Date(subscription.lastPaddleChargedAt.getTime() + windowDays * DAY_MS);
    if (new Date() > deadline) {
      throw new BadRequestException("The 14-day refund window for your most recent charge has closed.");
    }

    const twelveMonthsAgo = new Date(Date.now() - 365 * DAY_MS);
    const priorApprovedRefund = await this.prismaAdmin.paddleRefundRequest.findFirst({
      where: { sellerId, status: "approved", decidedAt: { gte: twelveMonthsAgo } },
    });
    const autoApprove = !priorApprovedRefund;

    const planFee = await this.resolveChargedAmount(sellerId);
    const refundRequest = await this.prismaAdmin.paddleRefundRequest.create({
      data: {
        sellerId,
        paddleTransactionId: subscription.lastPaddleTransactionId,
        amount: planFee.amount,
        currency: planFee.currency,
        status: autoApprove ? "approved" : "pending",
        autoApproved: autoApprove,
        decidedAt: autoApprove ? new Date() : null,
      },
    });

    if (autoApprove) {
      await this.executeApprovedRefund(refundRequest.id, null);
      return { status: "approved", refundRequestId: refundRequest.id };
    }

    await this.auditLog.record({
      adminUserId: null,
      action: "billing.paddle_refund_requested",
      targetType: "paddle_refund_request",
      targetId: refundRequest.id,
      afterValue: { sellerId, status: "pending" },
    });
    return { status: "pending", refundRequestId: refundRequest.id };
  }

  /** Admin-review path - the counterpart to requestRefund()'s auto-approve branch, same end state either way. */
  async adminApproveRefund(refundRequestId: string, adminUserId: string): Promise<void> {
    const request = await this.prismaAdmin.paddleRefundRequest.findUnique({ where: { id: refundRequestId } });
    if (!request) throw new NotFoundException("Refund request not found.");
    if (request.status !== "pending") throw new BadRequestException("This refund request has already been decided.");

    await this.prismaAdmin.paddleRefundRequest.update({
      where: { id: refundRequestId },
      data: { status: "approved", decidedAt: new Date(), decidedByAdminId: adminUserId },
    });
    await this.executeApprovedRefund(refundRequestId, adminUserId);
  }

  async adminRejectRefund(refundRequestId: string, adminUserId: string): Promise<void> {
    const request = await this.prismaAdmin.paddleRefundRequest.findUnique({ where: { id: refundRequestId } });
    if (!request) throw new NotFoundException("Refund request not found.");
    if (request.status !== "pending") throw new BadRequestException("This refund request has already been decided.");

    await this.prismaAdmin.paddleRefundRequest.update({
      where: { id: refundRequestId },
      data: { status: "rejected", decidedAt: new Date(), decidedByAdminId: adminUserId },
    });
    await this.auditLog.record({
      adminUserId,
      action: "billing.paddle_refund_rejected",
      targetType: "paddle_refund_request",
      targetId: refundRequestId,
    });
  }

  /**
   * Calls Paddle's real adjustment API (never a wallet-ledger credit -
   * that's FR-6.49's own mechanism, D134 explicitly keeps it only for
   * the manual rail) then ends entitlement IMMEDIATELY: forces
   * currentPeriodEnd to now and pauses the seller's store(s) through the
   * same WalletGraceLadderService method the regular overdue-sweep
   * already uses, called directly and synchronously here rather than
   * waiting for that sweep's own next tick - "immediately" per D134,
   * not "within one sweep interval."
   */
  private async executeApprovedRefund(refundRequestId: string, adminUserId: string | null): Promise<void> {
    const request = await this.prismaAdmin.paddleRefundRequest.findUniqueOrThrow({ where: { id: refundRequestId } });

    let paddleAdjustmentId: string | null = null;
    if (this.paddle) {
      try {
        const adjustment = await this.paddle.adjustments.create({
          action: "refund",
          reason: "14-day money-back guarantee (D11)",
          transactionId: request.paddleTransactionId,
          type: "full",
        });
        paddleAdjustmentId = adjustment.id;
      } catch (err) {
        this.logger.error(
          `Paddle refund API call failed for request ${refundRequestId} - entitlement will still be ended per D134's "entitlement ends immediately" rule; the Paddle-side money movement needs manual follow-up. ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    await this.prismaAdmin.subscription.update({
      where: { sellerId: request.sellerId },
      data: { status: "cancelled", currentPeriodEnd: new Date() },
    });
    if (paddleAdjustmentId) {
      await this.prismaAdmin.paddleRefundRequest.update({ where: { id: refundRequestId }, data: { paddleAdjustmentId } });
    }
    await this.walletGraceLadder.pauseActiveStoresForNonPayment(request.sellerId);

    await this.auditLog.record({
      adminUserId,
      action: "billing.paddle_refund_executed",
      targetType: "paddle_refund_request",
      targetId: refundRequestId,
      afterValue: { sellerId: request.sellerId, amount: Number(request.amount), currency: request.currency, paddleAdjustmentId },
    });
  }

  private async resolveChargedAmount(sellerId: string): Promise<{ amount: number; currency: string }> {
    const subscription = await this.prismaAdmin.subscription.findUniqueOrThrow({ where: { sellerId }, include: { plan: true } });
    return { amount: Number(subscription.plan.price), currency: subscription.plan.currency };
  }
}
