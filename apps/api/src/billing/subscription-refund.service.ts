import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { AuditLogService } from "../admin/audit-log.service";
import { round2 } from "../orders/money.util";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SRS §5.6k/FR-6.49 (Module 72) - the 50% subscription refund policy. No
 * existing admin action cancels a subscription at all (SubscriptionStatus
 * only ever had two reachable values by schema, `active`/`cancelled`, but
 * nothing before this wrote `cancelled`) - this service is that
 * cancellation action too, since FR-6.49 frames the whole thing as "a
 * qualifying cancellation," one combined admin action, not a refund
 * bolted onto some other pre-existing cancel flow. Disclosed decision:
 * cancellation here only ever changes Subscription.status - it
 * deliberately never touches the seller's Store(s) (no pause, no
 * suspend), since FR-6.49 doesn't describe that and coupling it to
 * Module 64/66's own pause timers would be new, undisclosed scope.
 */
@Injectable()
export class SubscriptionRefundService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async cancelWithRefund(
    adminUserId: string,
    sellerId: string,
    reason: string,
  ): Promise<{ status: "cancelled"; refunded: boolean; refundAmount: number | null }> {
    if (!reason || !reason.trim()) {
      throw new BadRequestException("A reason is required to cancel a subscription.");
    }

    const subscription = await this.prismaAdmin.subscription.findUnique({ where: { sellerId } });
    if (!subscription) throw new NotFoundException("No subscription found for this seller.");
    if (subscription.status === "cancelled") {
      throw new BadRequestException("This subscription is already cancelled.");
    }

    const qualifyingPayment = await this.findQualifyingFirstCyclePayment(sellerId, subscription.firstCycleRefundedAt);

    await this.prismaAdmin.subscription.update({
      where: { sellerId },
      data: {
        status: "cancelled",
        ...(qualifyingPayment ? { firstCycleRefundedAt: new Date() } : {}),
      },
    });

    let refundAmount: number | null = null;
    if (qualifyingPayment) {
      refundAmount = await this.postRefund(sellerId, qualifyingPayment);
    }

    await this.auditLog.record({
      adminUserId,
      action: "billing.subscription_cancelled",
      targetType: "subscription",
      targetId: subscription.id,
      beforeValue: { status: subscription.status },
      afterValue: { status: "cancelled", reason, refunded: qualifyingPayment !== null, refundAmount },
    });

    return { status: "cancelled", refunded: qualifyingPayment !== null, refundAmount };
  }

  /**
   * Qualifies only when: no refund has ever been posted for this seller
   * (the durable, one-time marker); exactly one verified plan-fee payment
   * exists (i.e., the seller is still on their very first cycle - a
   * second verified payment means they already renewed, so this is no
   * longer "the first billing cycle" FR-6.49 scopes the policy to); and
   * that payment's verifiedAt is still within the admin-editable refund
   * window.
   */
  private async findQualifyingFirstCyclePayment(sellerId: string, firstCycleRefundedAt: Date | null) {
    if (firstCycleRefundedAt) return null;

    const payments = await this.prismaAdmin.walletTopUpRequest.findMany({
      where: { ownerType: "seller", ownerId: sellerId, planFeePortion: { not: null }, status: "verified" },
      orderBy: { verifiedAt: "asc" },
    });
    if (payments.length !== 1) return null;

    const firstPayment = payments[0];
    const windowDays = await this.settings.resolve<number>("billing.subscription_refund_window_days");
    const deadline = new Date(firstPayment.verifiedAt!.getTime() + windowDays * DAY_MS);
    if (new Date() > deadline) return null;

    return firstPayment;
  }

  /** A wallet credit, never an external gateway reversal - the same refund_adjustment entry type FR-8.8 already reserves, unchanged. */
  private async postRefund(sellerId: string, firstPayment: { planFeePortion: unknown | null; currency: string }): Promise<number> {
    const percent = await this.settings.resolve<number>("billing.subscription_refund_percent");
    const amount = round2(Number(firstPayment.planFeePortion) * (percent / 100));
    if (amount <= 0) return 0;

    await this.prismaAdmin.ledgerEntry.create({
      data: { sellerId, type: "refund_adjustment", amount: -amount, currency: firstPayment.currency },
    });
    return amount;
  }
}
