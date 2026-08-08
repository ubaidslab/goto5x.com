import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { LedgerService } from "../billing/ledger.service";
import { WalletGraceLadderService } from "../billing/wallet-grace-ladder.service";
import { CustomersService } from "../customers/customers.service";
import { EventsService } from "../events/events.service";
import { EmailService } from "../notifications/email.service";
import { OrderVerificationService } from "../order-verification/order-verification.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { StorefrontService } from "../storefront/storefront.service";
import { PrintifyAdapter } from "../suppliers/printify/printify.adapter";
import { ChangeOrderStatusDto } from "./dto/change-order-status.dto";
import { EditOrderDto } from "./dto/edit-order.dto";
import { OrderListQueryDto } from "./dto/order-list-query.dto";
import { round2 } from "./money.util";
import { isOrderStatusTransitionAllowed } from "./order-status-transitions.util";
import { computeOrderTimeline } from "./order-timeline.util";
import { computeOrderTotals } from "./order-totals.util";
import { OrderBucket, orderBucketWhereClause } from "./orders-overview.service";

const EDITABLE_STATUSES: OrderStatus[] = ["pending", "confirmed"];
const DEFAULT_ORDER_PAGE_LIMIT = 20;
const MAX_ORDER_PAGE_LIMIT = 100;

export interface OrderListPage {
  items: unknown[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * The seller dashboard's half of Orders/Cart/Checkout (FR-5.1, FR-17.x).
 * Every method runs through TenantPrismaService (RLS) - a seller only ever
 * sees their own store's orders, including supplier-fulfilled ones (FR-5.1,
 * "unified... spanning both self-fulfilled and supplier-fulfilled orders" -
 * true automatically, since order_items.supplier_id is just one more column
 * on a row already scoped by store_id/RLS, no separate query path needed).
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly events: EventsService,
    private readonly email: EmailService,
    private readonly storefront: StorefrontService,
    private readonly printifyAdapter: PrintifyAdapter,
    private readonly ledger: LedgerService,
    private readonly customers: CustomersService,
    private readonly walletGraceLadder: WalletGraceLadderService,
    private readonly orderVerification: OrderVerificationService,
  ) {}

  /**
   * SRS §5.59/FR-59.4 - date+time range, status, payment state, verification
   * state, courier, customer, and amount-range filters, all combinable, plus
   * pagination (same {items,page,limit,total,totalPages} envelope as
   * ProductsService.list()/FR-57.2). `bucket`/`tag` are the pre-existing
   * Command Center filters (FR-38.2/FR-17.3), kept unchanged and combinable
   * with the new ones.
   */
  async list(sellerId: string, storeId: string, query: OrderListQueryDto = {}): Promise<OrderListPage> {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      const page = query.page ?? 1;
      const limit = Math.min(query.limit ?? DEFAULT_ORDER_PAGE_LIMIT, MAX_ORDER_PAGE_LIMIT);

      const conditions: Prisma.OrderWhereInput[] = [{ storeId }];

      if (query.status) conditions.push({ status: query.status });
      if (query.bucket) conditions.push(orderBucketWhereClause(query.bucket));
      if (query.tag) conditions.push({ tags: { has: query.tag } });
      if (query.dateFrom || query.dateTo) {
        conditions.push({
          placedAt: {
            ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
          },
        });
      }
      if (query.paymentStatus) {
        conditions.push({ payments: { some: { status: query.paymentStatus } } });
      }
      if (query.verificationStatus) {
        conditions.push({ verification: { status: query.verificationStatus } });
      }
      if (query.courier) {
        conditions.push({
          items: { some: { trackingUpdates: { some: { carrier: { contains: query.courier, mode: "insensitive" } } } } },
        });
      }
      if (query.customer) {
        conditions.push({
          OR: [
            { buyerEmail: { contains: query.customer, mode: "insensitive" } },
            { customer: { name: { contains: query.customer, mode: "insensitive" } } },
          ],
        });
      }
      if (query.minAmount != null || query.maxAmount != null) {
        conditions.push({
          totalAmount: {
            ...(query.minAmount != null ? { gte: query.minAmount } : {}),
            ...(query.maxAmount != null ? { lte: query.maxAmount } : {}),
          },
        });
      }

      const where: Prisma.OrderWhereInput = { AND: conditions };

      const [items, total] = await Promise.all([
        tx.order.findMany({
          where,
          include: { items: true },
          orderBy: { placedAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        tx.order.count({ where }),
      ]);

      return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
    });
  }

  async getOne(sellerId: string, storeId: string, orderId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { trackingUpdates: true } },
          notes: { orderBy: { createdAt: "desc" } },
          timelineEvents: { orderBy: { createdAt: "asc" } },
          payments: true,
        },
      });
      if (!order || order.storeId !== storeId) throw new NotFoundException("Order not found.");
      // SRS §5.38/FR-38.5 - the same computed source the buyer's public
      // order-status page renders (OrderStatusLookupService.lookup()).
      const timeline = computeOrderTimeline(
        order,
        order.timelineEvents.filter((e) => e.eventType === "status_changed"),
      );
      return { ...order, timeline };
    });
  }

  /**
   * FR-17.1 - the only v1.0 payment path for every order regardless of
   * `source` (storefront or manual). This is the sole place the Financial
   * Truth Invariant's `pending -> confirmed` transition happens, and
   * correspondingly the sole place `order.placed` (SRS §3.11 - "means a
   * confirmed, paid order") is ever emitted.
   */
  async markAsPaid(sellerId: string, storeId: string, orderId: string) {
    // Module 26 (SRS §5.37/FR-37.7) - extends (never duplicates) the
    // Financial Truth Invariant: an order whose store requires verification
    // cannot be confirmed until that verification's status is "verified",
    // the exact same gate payment already is. Checked outside the
    // transaction below, same as the "not pending" check that follows it.
    if (!(await this.orderVerification.isClearedForConfirmation(orderId))) {
      throw new BadRequestException("This order is still awaiting buyer verification before it can be confirmed.");
    }

    const { order, storeName, domains, storeSlug } = await this.tenantPrisma.run(sellerId, async (tx) => {
      const before = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!before || before.storeId !== storeId) throw new NotFoundException("Order not found.");
      if (before.status !== "pending") {
        throw new BadRequestException("This order is not awaiting payment.");
      }

      await tx.payment.create({
        data: {
          storeId,
          orderId,
          gateway: "manual",
          amount: before.totalAmount,
          currency: before.currency,
          status: "succeeded",
        },
      });
      const updated = await tx.order.update({ where: { id: orderId }, data: { status: "confirmed" } });
      await tx.orderItem.updateMany({ where: { orderId }, data: { fulfillmentStatus: "confirmed" } });
      // Module 11 (FR-6.16) - accrued in the same transaction as the
      // confirmation itself: a commission_accrued entry must never exist
      // without the order that produced it actually being confirmed, and
      // vice versa (Financial Truth Invariant, §3.12).
      await this.ledger.accrueCommission(tx, sellerId, updated, before.currency);
      // FR-13.1 - order_count/total_spent must never count an order that
      // was never actually paid (Financial Truth Invariant, §3.12); this is
      // the sole place that transition happens. `customerId` is only ever
      // null for orders placed before Module 15 shipped.
      if (before.customerId) {
        await this.customers.recordCompletedOrder(tx, before.customerId, updated.totalAmount, updated.placedAt);
      }
      await tx.orderTimelineEvent.create({
        data: {
          storeId,
          orderId,
          eventType: "status_changed",
          beforeValue: { status: "pending" },
          afterValue: { status: "confirmed" },
        },
      });
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
      const domains = await tx.domain.findMany({ where: { storeId } });
      return { order: { ...updated, items: before.items }, storeName: store.name, domains, storeSlug: store.slug };
    });

    // Non-blocking, best-effort, same "the triggering action must never
    // fail because of a bookkeeping write" discipline as EventsService
    // itself (FR-26.3) - a seller marking an order paid must never be
    // blocked by an analytics-log or notification hiccup.
    await this.events.emit({
      eventType: "order.placed",
      actorType: "seller",
      actorId: sellerId,
      storeId,
      entityType: "order",
      entityId: orderId,
      metadata: { source: order.source },
    });

    await this.notifyBuyer({ storeName, domains, storeSlug }, order, "confirmed");
    await this.forwardSupplierItems(order);

    // FR-6.26 (fix) - the commission debit that just landed above must
    // never be blocked by this, but a debit that pushes the seller's
    // balance below the negative-float floor pauses their stores
    // immediately (bypassing the gentler grace ladder) - same non-blocking
    // discipline as forwardSupplierItems above.
    try {
      await this.walletGraceLadder.checkImmediateFloorPause(sellerId);
    } catch (err) {
      this.logger.error(
        `Failed to run the wallet negative-float floor check for seller ${sellerId} after order ${orderId} - payment confirmation is unaffected.`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return order;
  }

  /** FR-17.2 - never surfaced to the buyer on any endpoint. */
  async addNote(sellerId: string, storeId: string, orderId: string, authorUserId: string, body: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.storeId !== storeId) throw new NotFoundException("Order not found.");
      const note = await tx.orderNote.create({ data: { storeId, orderId, authorUserId, body } });
      await tx.orderTimelineEvent.create({
        data: { storeId, orderId, eventType: "note_added", afterValue: { noteId: note.id } },
      });
      return note;
    });
  }

  /** FR-17.3 - replaces the tag set wholesale. */
  async updateTags(sellerId: string, storeId: string, orderId: string, tags: string[]) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.storeId !== storeId) throw new NotFoundException("Order not found.");
      return tx.order.update({ where: { id: orderId }, data: { tags } });
    });
  }

  /**
   * SRS §5.59/FR-59.2/FR-59.5 - the first writer of `cancelled`/`disputed`/
   * `completed`, validated against order-status-transitions.util.ts's new
   * centralized map. This is also FR-59.2's bulk-status-change action's
   * single-order building block - the frontend fans a bulk change out into
   * one call per selected order (same client-side fan-out precedent as
   * Module 51's bulk product actions), never a bare `updateMany`.
   */
  async changeStatus(sellerId: string, storeId: string, orderId: string, dto: ChangeOrderStatusDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.storeId !== storeId) throw new NotFoundException("Order not found.");
      if (!isOrderStatusTransitionAllowed(order.status, dto.status)) {
        throw new BadRequestException(`An order with status "${order.status}" cannot be changed to "${dto.status}".`);
      }
      const updated = await tx.order.update({ where: { id: orderId }, data: { status: dto.status } });
      await tx.orderTimelineEvent.create({
        data: {
          storeId,
          orderId,
          eventType: "status_changed",
          beforeValue: { status: order.status },
          afterValue: { status: dto.status },
        },
      });
      return updated;
    });
  }

  /** Module 31 (SRS §5.42/FR-42.1) - optional per-order courier/handling cost inputs for the P&L engine; either field left undefined is untouched, not reset to null. */
  async updateCosts(sellerId: string, storeId: string, orderId: string, dto: { courierCost?: number; handlingCost?: number }) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.storeId !== storeId) throw new NotFoundException("Order not found.");
      return tx.order.update({
        where: { id: orderId },
        data: { courierCost: dto.courierCost, handlingCost: dto.handlingCost },
      });
    });
  }

  /**
   * FR-17.5 - "Basic order editing": existing line-item quantities and the
   * shipping address only, and only while `pending`/`confirmed`. Stock is
   * adjusted in both directions. **Disclosed gap (Module 10/11 boundary,
   * same pattern as Module 8's FR-4.5/4.7/4.8 deferral):** the FR text also
   * calls for a compensating *ledger* entry when an edit changes the total
   * after a ledger entry already exists - `ledger_entries` doesn't exist
   * until Module 10/11 (SRS's own build-plan boundary), so no ledger write
   * happens here. The order's own totals are still recomputed correctly
   * and the timeline event still records the before/after total - only the
   * ledger-side compensating entry is deferred.
   */
  async editOrder(sellerId: string, storeId: string, orderId: string, dto: EditOrderDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || order.storeId !== storeId) throw new NotFoundException("Order not found.");
      if (!EDITABLE_STATUSES.includes(order.status)) {
        throw new BadRequestException(`An order with status "${order.status}" can no longer be edited.`);
      }

      const before = {
        totalAmount: Number(order.totalAmount),
        shippingAmount: Number(order.shippingAmount),
        taxAmount: Number(order.taxAmount),
        items: order.items.map((i) => ({ id: i.id, quantity: i.quantity })),
      };

      if (dto.items) {
        for (const edit of dto.items) {
          const item = order.items.find((i) => i.id === edit.orderItemId);
          if (!item) throw new NotFoundException(`Order item ${edit.orderItemId} not found on this order.`);
          const quantityDelta = edit.quantity - item.quantity;
          if (quantityDelta === 0) continue;

          // Restores stock for a removed/reduced item, decrements it for an
          // added/increased one (clarified v0.6, FR-17.5) - never a ledger-
          // only operation that leaves inventory out of sync.
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { decrement: quantityDelta } },
          });

          if (edit.quantity === 0) {
            await tx.orderItem.delete({ where: { id: item.id } });
          } else {
            const perUnitShipping = item.quantity > 0 ? Number(item.shippingCost) / item.quantity : 0;
            await tx.orderItem.update({
              where: { id: item.id },
              data: { quantity: edit.quantity, shippingCost: round2(perUnitShipping * edit.quantity) },
            });
          }
        }
      }

      if (dto.shippingAddress) {
        await tx.order.update({ where: { id: orderId }, data: { shippingAddress: dto.shippingAddress as unknown as object } });
      }

      const remainingItems = await tx.orderItem.findMany({ where: { orderId } });
      const shippingSettings = await tx.storeShippingSettings.findUniqueOrThrow({ where: { storeId } });
      const taxSettings = await tx.storeTaxSettings.findUniqueOrThrow({ where: { storeId } });

      const { shippingAmount, taxAmount, totalAmount } = computeOrderTotals({
        items: remainingItems.map((i) => ({
          unitPrice: Number(i.unitPrice),
          quantity: i.quantity,
          lineShippingCost: Number(i.shippingCost),
          isSupplierItem: Boolean(i.supplierId),
        })),
        discountAmount: Number(order.discountAmount),
        shippingFlatRate: Number(shippingSettings.flatRate),
        shippingFreeThreshold:
          shippingSettings.freeShippingThreshold !== null ? Number(shippingSettings.freeShippingThreshold) : null,
        taxRate: Number(taxSettings.taxRate),
        taxInclusive: taxSettings.taxInclusive,
      });

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { shippingAmount, taxAmount, totalAmount },
        include: { items: true },
      });

      await tx.orderTimelineEvent.create({
        data: {
          storeId,
          orderId,
          eventType: "edited",
          beforeValue: before,
          afterValue: { totalAmount, shippingAmount, taxAmount, items: remainingItems.map((i) => ({ id: i.id, quantity: i.quantity })) },
        },
      });

      return updated;
    });
  }

  /** FR-3.4/FR-5.2 - seller-side tracking upload; SupplierPortalService exposes the equivalent supplier-side action. */
  async uploadTracking(
    sellerId: string,
    storeId: string,
    orderId: string,
    orderItemId: string,
    uploadedBy: string,
    input: { trackingId: string; carrier?: string },
  ) {
    const { order, storeName, domains, storeSlug } = await this.tenantPrisma.run(sellerId, async (tx) => {
      const item = await tx.orderItem.findUnique({ where: { id: orderItemId } });
      if (!item || item.storeId !== storeId || item.orderId !== orderId) {
        throw new NotFoundException("Order item not found.");
      }
      await this.writeTrackingForItem(tx, storeId, orderId, orderItemId, uploadedBy, input);
      return this.bumpOrderToShippedIfReady(tx, storeId, orderId);
    });

    if (order.status === "shipped") {
      await this.notifyBuyer({ storeName, domains, storeSlug }, order, "shipped");
    }
    return order;
  }

  /**
   * SRS §5.59/FR-59.3 (a)+(b) - the order-level tracking-entry path shared
   * by the orders-list inline quick-entry endpoint and the CSV tracking-
   * import worker: applies the SAME courier/tracking pair to every
   * not-yet-shipped item on the order (writes one `TrackingUpdate` row per
   * item, exactly as if the seller had entered each one individually via
   * `uploadTracking()`), then runs the same confirmed->shipped bump check
   * once. A seller who needs different couriers per item on one order still
   * uses the unchanged per-item path (c), `uploadTracking()` above.
   */
  async uploadTrackingForOrder(
    sellerId: string,
    storeId: string,
    orderId: string,
    uploadedBy: string,
    input: { trackingId: string; carrier?: string },
  ) {
    const { order, storeName, domains, storeSlug } = await this.tenantPrisma.run(sellerId, async (tx) => {
      const orderRow = await tx.order.findUnique({ where: { id: orderId } });
      if (!orderRow || orderRow.storeId !== storeId) throw new NotFoundException("Order not found.");

      const items = await tx.orderItem.findMany({
        where: { orderId, fulfillmentStatus: { notIn: ["shipped", "delivered", "completed"] } },
      });
      if (items.length === 0) {
        throw new BadRequestException("Every item on this order already has tracking.");
      }
      for (const item of items) {
        await this.writeTrackingForItem(tx, storeId, orderId, item.id, uploadedBy, input);
      }

      return this.bumpOrderToShippedIfReady(tx, storeId, orderId);
    });

    if (order.status === "shipped") {
      await this.notifyBuyer({ storeName, domains, storeSlug }, order, "shipped");
    }
    return order;
  }

  /** Writes one `TrackingUpdate` row and flips the item to `shipped` - the shared core both uploadTracking() and uploadTrackingForOrder() build on. */
  private async writeTrackingForItem(
    tx: Prisma.TransactionClient,
    storeId: string,
    orderId: string,
    orderItemId: string,
    uploadedBy: string,
    input: { trackingId: string; carrier?: string },
  ) {
    await tx.trackingUpdate.create({
      data: { storeId, orderItemId, trackingId: input.trackingId, carrier: input.carrier, uploadedBy },
    });
    await tx.orderItem.update({ where: { id: orderItemId }, data: { fulfillmentStatus: "shipped" } });
    await tx.orderTimelineEvent.create({
      data: { storeId, orderId, eventType: "tracking_uploaded", afterValue: { orderItemId, trackingId: input.trackingId } },
    });
  }

  /** Bumps `confirmed` -> `shipped` once every item has reached shipped-or-beyond; returns the (possibly unchanged) order plus the buyer-notification context. */
  private async bumpOrderToShippedIfReady(tx: Prisma.TransactionClient, storeId: string, orderId: string) {
    const siblings = await tx.orderItem.findMany({ where: { orderId } });
    const allShippedOrBeyond = siblings.every((i) => ["shipped", "delivered", "completed"].includes(i.fulfillmentStatus));
    let order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (allShippedOrBeyond && order.status === "confirmed") {
      order = await tx.order.update({ where: { id: orderId }, data: { status: "shipped" } });
      await tx.orderTimelineEvent.create({
        data: { storeId, orderId, eventType: "status_changed", beforeValue: { status: "confirmed" }, afterValue: { status: "shipped" } },
      });
    }
    const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
    const domains = await tx.domain.findMany({ where: { storeId } });
    return { order, storeName: store.name, domains, storeSlug: store.slug };
  }

  /** Marks a single item delivered; bumps the order to `delivered` once every item has reached that stage. */
  async markItemDelivered(sellerId: string, storeId: string, orderId: string, orderItemId: string) {
    const { order, storeName, domains, storeSlug } = await this.tenantPrisma.run(sellerId, async (tx) => {
      const item = await tx.orderItem.findUnique({ where: { id: orderItemId } });
      if (!item || item.storeId !== storeId || item.orderId !== orderId) {
        throw new NotFoundException("Order item not found.");
      }
      await tx.orderItem.update({ where: { id: orderItemId }, data: { fulfillmentStatus: "delivered" } });
      await tx.orderTimelineEvent.create({
        data: { storeId, orderId, eventType: "item_delivered", afterValue: { orderItemId } },
      });

      const siblings = await tx.orderItem.findMany({ where: { orderId } });
      const allDeliveredOrBeyond = siblings.every((i) => ["delivered", "completed"].includes(i.fulfillmentStatus));
      let order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (allDeliveredOrBeyond && order.status === "shipped") {
        order = await tx.order.update({ where: { id: orderId }, data: { status: "delivered" } });
        await tx.orderTimelineEvent.create({
          data: { storeId, orderId, eventType: "status_changed", beforeValue: { status: "shipped" }, afterValue: { status: "delivered" } },
        });
      }
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
      const domains = await tx.domain.findMany({ where: { storeId } });
      return { order, storeName: store.name, domains, storeSlug: store.slug };
    });

    if (order.status === "delivered") {
      await this.notifyBuyer({ storeName, domains, storeSlug }, order, "delivered");
    }
    return order;
  }

  private async notifyBuyer(
    store: { storeName: string; domains: { domainName: string; verificationStatus: string }[]; storeSlug: string },
    order: { buyerEmail: string; statusLookupToken: string },
    statusLabel: string,
  ) {
    const canonicalHostname = await this.storefront.canonicalHostnameFor({ slug: store.storeSlug, domains: store.domains });
    await this.email.sendOrderStatusEmail(
      order.buyerEmail,
      store.storeName,
      statusLabel,
      `https://${canonicalHostname}/order-status/${order.statusLookupToken}`,
    );
  }

  /**
   * FR-3.4 - once an order is confirmed/paid, forward each supplier-
   * fulfilled line to its supplier's adapter for fulfillment. v1.0 has only
   * one adapter (Printify), so this directly injects PrintifyAdapter -
   * same "no registry indirection until a second adapter exists" reasoning
   * as SupplierSyncService. Per-item failures are caught and logged, never
   * thrown - a supplier network hiccup must never undo a payment
   * confirmation that already succeeded.
   */
  private async forwardSupplierItems(order: { id: string; storeId: string; items: { id: string; productId: string; supplierId: string | null; quantity: number }[] }) {
    for (const item of order.items) {
      if (!item.supplierId) continue;
      try {
        const review = await this.prismaAdmin.listingReview.findFirst({
          where: { productId: item.productId, status: "approved" },
          include: { supplierListing: true },
        });
        if (!review) continue;
        const result = await this.printifyAdapter.forwardOrder({
          externalProductId: review.supplierListing.externalProductId,
          quantity: item.quantity,
          orderId: order.id,
        });
        await this.prismaAdmin.orderTimelineEvent.create({
          data: {
            storeId: order.storeId,
            orderId: order.id,
            eventType: "supplier_order_forwarded",
            metadata: { orderItemId: item.id, supplierId: item.supplierId, externalOrderId: result.externalOrderId },
          },
        });
      } catch (err) {
        this.logger.error(
          `Failed to forward order ${order.id} item ${item.id} to its supplier - payment confirmation is unaffected.`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }
}
