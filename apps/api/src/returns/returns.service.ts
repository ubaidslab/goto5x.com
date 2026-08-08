import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ReturnRequestStatus } from "@prisma/client";
import { AuditLogService } from "../admin/audit-log.service";
import { LedgerService } from "../billing/ledger.service";
import { CustomersService } from "../customers/customers.service";
import { EmailService } from "../notifications/email.service";
import { round2 } from "../orders/money.util";
import { isOrderStatusTransitionAllowed, REFUND_ELIGIBLE_ORDER_STATUSES } from "../orders/order-status-transitions.util";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { StorefrontService } from "../storefront/storefront.service";
import { CompleteReturnRequestDto } from "./dto/complete-return-request.dto";
import { DecideReturnRequestDto } from "./dto/decide-return-request.dto";
import { SubmitReturnRequestDto } from "./dto/submit-return-request.dto";

const ACTIVE_STATUSES: ReturnRequestStatus[] = ["requested", "approved"];
/** newTotal is compared to order.totalAmount at 2dp - this tolerance absorbs float rounding, not a business allowance for under-refunding. */
const FULL_REFUND_EPSILON = 0.005;

/**
 * SRS §5.60/FR-60.1-60.6 (Module 53) - Returns & Refunds Workflow, the
 * Financial Truth Invariant's reversal path. `applyRefund()` is the one
 * money-touching core both the seller's completeReturn() and the admin's
 * adminComplete() call - same "one shared write core, never two parallel
 * implementations" discipline Module 52 established for its three
 * tracking-entry paths.
 */
@Injectable()
export class ReturnsService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly ledger: LedgerService,
    private readonly customers: CustomersService,
    private readonly email: EmailService,
    private readonly storefront: StorefrontService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * FR-60.2 - "only a confirmed (actually paid) order can have a return
   * requested against it," the same Financial Truth Invariant gate reviews
   * (FR-14.1) already use. Public/token-gated, same shape as
   * ReviewsService.submit() - dual-keyed rate limit before the write.
   */
  async submitRequest(token: string, dto: SubmitReturnRequestDto, ip: string) {
    const submissionLimit = await this.settings.resolve<number>("returns.submission_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`return-submit-token:${token}`, submissionLimit);
    await this.rateLimit.enforcePerHour(`return-submit-ip:${ip}`, submissionLimit);

    const order = await this.prismaAdmin.order.findUnique({ where: { statusLookupToken: token } });
    if (!order) throw new NotFoundException("Order not found.");
    if (!REFUND_ELIGIBLE_ORDER_STATUSES.includes(order.status)) {
      throw new BadRequestException("This order isn't eligible for a return request.");
    }

    const existingActive = await this.prismaAdmin.returnRequest.findFirst({
      where: { orderId: order.id, status: { in: ACTIVE_STATUSES } },
    });
    if (existingActive) {
      throw new BadRequestException("A return request is already open for this order.");
    }

    return this.prismaAdmin.returnRequest.create({
      data: { storeId: order.storeId, orderId: order.id, buyerReason: dto.reason },
    });
  }

  /** FR-60.3 - seller's own return queue. */
  async listForStore(sellerId: string, storeId: string, status?: ReturnRequestStatus) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.returnRequest.findMany({
        where: { storeId, ...(status ? { status } : {}) },
        include: { order: { select: { orderNumber: true, totalAmount: true, currency: true, buyerEmail: true } } },
        orderBy: { requestedAt: "desc" },
      });
    });
  }

  /** FR-60.3 - approve or reject; reject requires a reason (same discipline as the admin moderation queue's reject-reason requirement). */
  async sellerDecide(sellerId: string, storeId: string, returnId: string, dto: DecideReturnRequestDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const request = await tx.returnRequest.findUnique({ where: { id: returnId } });
      if (!request || request.storeId !== storeId) throw new NotFoundException("Return request not found.");
      return this.decide(tx, request, dto, "seller", null, false);
    });
  }

  /** FR-60.4 - completes an approved return: posts the ledger reversal, decrements customer stats, moves Order.status, notifies the buyer. */
  async completeReturn(sellerId: string, storeId: string, returnId: string, dto: CompleteReturnRequestDto) {
    const result = await this.tenantPrisma.run(sellerId, async (tx) => {
      const request = await tx.returnRequest.findUnique({ where: { id: returnId } });
      if (!request || request.storeId !== storeId) throw new NotFoundException("Return request not found.");
      return this.applyRefund(tx, request, dto, "seller", null, false);
    });
    await this.notifyBuyer(result);
    return result.order;
  }

  /** FR-60.5 - admin override list, every store. */
  async listForAdmin(status?: ReturnRequestStatus) {
    return this.prismaAdmin.returnRequest.findMany({
      where: status ? { status } : {},
      include: {
        order: { select: { orderNumber: true, totalAmount: true, currency: true, buyerEmail: true } },
        store: { select: { name: true } },
      },
      orderBy: { requestedAt: "desc" },
    });
  }

  /**
   * FR-60.5 - admin can approve/reject regardless of the seller's own
   * decision (or lack of one); audit-logged with before/after values, same
   * discipline as every other admin override in this SRS (e.g. FR-54.4).
   */
  async adminDecide(adminUserId: string, returnId: string, dto: DecideReturnRequestDto) {
    const request = await this.prismaAdmin.returnRequest.findUnique({ where: { id: returnId } });
    if (!request) throw new NotFoundException("Return request not found.");
    const updated = await this.decide(this.prismaAdmin, request, dto, "admin", adminUserId, true);
    await this.auditLog.record({
      adminUserId,
      action: "returns.admin_decide",
      targetType: "return_request",
      targetId: returnId,
      beforeValue: { status: request.status },
      afterValue: { status: updated.status, sellerNote: updated.sellerNote },
    });
    return updated;
  }

  /**
   * FR-60.5 - admin can complete (issue the refund) regardless of the
   * seller's own action; audit-logged with before/after values, same
   * discipline as every other admin override in this SRS (e.g. FR-54.4).
   */
  async adminComplete(adminUserId: string, returnId: string, dto: CompleteReturnRequestDto) {
    const request = await this.prismaAdmin.returnRequest.findUnique({ where: { id: returnId } });
    if (!request) throw new NotFoundException("Return request not found.");
    // No ambient transaction exists on the admin path (unlike the seller
    // path, where tenantPrisma.run() already handed completeReturn() an
    // open tx) - opened here, once, then handed to the same applyRefund()
    // core the seller path uses.
    const result = await this.prismaAdmin.$transaction((tx) => this.applyRefund(tx, request, dto, "admin", adminUserId, true));
    await this.auditLog.record({
      adminUserId,
      action: "returns.admin_complete",
      targetType: "return_request",
      targetId: returnId,
      beforeValue: { status: request.status },
      afterValue: { status: result.request.status, refundAmount: result.request.refundAmount, orderStatus: result.order.status },
    });
    await this.notifyBuyer(result);
    return result.order;
  }

  /** Shared by sellerDecide()/adminDecide() - approve/reject never touches money, only ReturnRequest.status. */
  private async decide(
    db: Prisma.TransactionClient | PrismaAdminService,
    request: { id: string; status: ReturnRequestStatus },
    dto: DecideReturnRequestDto,
    actorType: "seller" | "admin",
    actorUserId: string | null,
    adminOverride: boolean,
  ) {
    if (!adminOverride && request.status !== "requested") {
      throw new BadRequestException(`A return request with status "${request.status}" can no longer be decided on.`);
    }
    if (dto.status === "rejected" && !dto.sellerNote?.trim()) {
      throw new BadRequestException("A reason is required to reject a return request.");
    }
    return db.returnRequest.update({
      where: { id: request.id },
      data: {
        status: dto.status,
        resolvedAt: new Date(),
        resolvedByType: actorType,
        resolvedByUserId: actorUserId,
        sellerNote: dto.sellerNote ?? null,
        adminOverride,
      },
    });
  }

  /**
   * FR-60.4 - the money-touching core, shared by completeReturn() (seller)
   * and adminComplete() (admin). `tx` is always an already-open transaction
   * handed in by the caller (tenantPrisma.run() on the seller path,
   * prismaAdmin.$transaction() on the admin path, which is already gated by
   * AdminAuthGuard at the controller layer - the same "narrow, deliberately-
   * scoped BYPASSRLS" case documented on PrismaAdminService itself) - this
   * method never opens its own, so it stays composable inside either.
   */
  private async applyRefund(
    tx: Prisma.TransactionClient,
    request: { id: string; storeId: string; orderId: string; status: ReturnRequestStatus },
    dto: CompleteReturnRequestDto,
    actorType: "seller" | "admin",
    actorUserId: string | null,
    adminOverride: boolean,
  ) {
    if (!adminOverride && request.status !== "approved") {
      throw new BadRequestException("Only an approved return request can be completed.");
    }
    if (adminOverride && !["requested", "approved"].includes(request.status)) {
      throw new BadRequestException(`A return request with status "${request.status}" can no longer be completed.`);
    }

    const order = await tx.order.findUniqueOrThrow({ where: { id: request.orderId } });
    if (!isOrderStatusTransitionAllowed(order.status, "refunded") && !isOrderStatusTransitionAllowed(order.status, "partially_refunded")) {
      throw new BadRequestException(`An order with status "${order.status}" cannot be refunded.`);
    }

    const priorRefunds = await tx.returnRequest.aggregate({
      where: { orderId: order.id, status: "completed" },
      _sum: { refundAmount: true },
    });
    const alreadyRefunded = Number(priorRefunds._sum.refundAmount ?? 0);
    const remaining = round2(Number(order.totalAmount) - alreadyRefunded);
    const refundAmount = round2(dto.refundAmount);
    if (refundAmount > remaining + FULL_REFUND_EPSILON) {
      throw new BadRequestException(
        `Refund amount ${refundAmount} exceeds the ${remaining} still refundable on this order.`,
      );
    }
    if (dto.refundedItems) {
      const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
      for (const line of dto.refundedItems) {
        const item = items.find((i) => i.id === line.orderItemId);
        if (!item) throw new NotFoundException(`Order item ${line.orderItemId} not found on this order.`);
        if (line.quantity > item.quantity) {
          throw new BadRequestException(`Refunded quantity for ${line.orderItemId} exceeds the ordered quantity.`);
        }
      }
    }

    const newTotalRefunded = round2(alreadyRefunded + refundAmount);
    const targetStatus = Math.abs(newTotalRefunded - Number(order.totalAmount)) < FULL_REFUND_EPSILON ? "refunded" : "partially_refunded";
    if (!isOrderStatusTransitionAllowed(order.status, targetStatus)) {
      throw new BadRequestException(`An order with status "${order.status}" cannot be changed to "${targetStatus}".`);
    }

    // Proportional to this refund's share of the order total, against the
    // NET commission currently on the books for this order (accrued minus
    // any prior waiver/reversal) - never re-derived from the rate, so a
    // seller-specific discount/waiver already applied is respected.
    const commissionEntries = await tx.ledgerEntry.groupBy({
      by: ["orderId"],
      where: { orderId: order.id, type: { in: ["commission_accrued", "commission_waived", "refund_adjustment"] } },
      _sum: { amount: true },
    });
    const netCommission = Number(commissionEntries[0]?._sum.amount ?? 0);
    const commissionToReverse =
      Number(order.totalAmount) > 0 ? round2(netCommission * (refundAmount / Number(order.totalAmount))) : 0;

    const store = await tx.store.findUniqueOrThrow({ where: { id: order.storeId } });
    await this.ledger.reverseCommissionForRefund(tx, store.sellerId, order.id, commissionToReverse, order.currency);

    await tx.payment.create({
      data: { storeId: order.storeId, orderId: order.id, gateway: "manual", amount: refundAmount, currency: order.currency, status: "refunded" },
    });

    const updatedOrder = await tx.order.update({ where: { id: order.id }, data: { status: targetStatus } });

    if (order.customerId) {
      await this.customers.reverseCompletedOrder(tx, order.customerId, refundAmount, targetStatus === "refunded");
    }

    await tx.orderTimelineEvent.create({
      data: {
        storeId: order.storeId,
        orderId: order.id,
        eventType: "status_changed",
        beforeValue: { status: order.status },
        afterValue: { status: targetStatus, refundAmount },
      },
    });

    const updatedRequest = await tx.returnRequest.update({
      where: { id: request.id },
      data: {
        status: "completed",
        resolvedAt: new Date(),
        resolvedByType: actorType,
        resolvedByUserId: actorUserId,
        refundAmount,
        refundedItems: (dto.refundedItems as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        adminOverride,
      },
    });

    const domains = await tx.domain.findMany({ where: { storeId: order.storeId } });
    return { order: updatedOrder, request: updatedRequest, storeName: store.name, storeSlug: store.slug, domains };
  }

  private async notifyBuyer(result: {
    order: { buyerEmail: string; statusLookupToken: string; status: string };
    storeName: string;
    storeSlug: string;
    domains: { domainName: string; verificationStatus: string }[];
  }) {
    const canonicalHostname = await this.storefront.canonicalHostnameFor({ slug: result.storeSlug, domains: result.domains });
    const statusLabel = result.order.status === "refunded" ? "refunded" : "partially refunded";
    await this.email.sendOrderStatusEmail(
      result.order.buyerEmail,
      result.storeName,
      statusLabel,
      `https://${canonicalHostname}/order-status/${result.order.statusLookupToken}`,
    );
  }
}
