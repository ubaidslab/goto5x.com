import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EmailService } from "../notifications/email.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { StorefrontService } from "../storefront/storefront.service";

/**
 * FR-3.3/FR-3.4 - the supplier-side half of order fulfillment, completing
 * what Module 8 disclosed as deferred ("FR-3.3/3.4 - deferred to Module 9,
 * once orders exist"). Same BYPASSRLS reasoning as SupplierPortalService
 * (a supplier's session legitimately spans multiple sellers' stores, no
 * single seller id to key RLS on) - filters explicitly on `supplierId`.
 *
 * Deliberately a separate, self-contained code path from
 * OrdersService.uploadTracking() (the seller-dashboard equivalent) rather
 * than a shared import - the two run under different isolation models
 * (RLS-scoped vs explicit-filter-scoped), the same "storefront reads are
 * their own code path, not a seller-CRUD reuse" precedent StorefrontService
 * already set.
 */
@Injectable()
export class SupplierOrdersService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly storefront: StorefrontService,
    private readonly email: EmailService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /**
   * FR-3.3 - every order item fulfilled by this supplier, across every
   * connected store. Module 20 (FR-7.10) closes the gate that was
   * previously missing: a free-tier supplier linked to more than one store
   * must filter to a single store (still "functions correctly per-store");
   * only the Premium tier (via suppliers.aggregated_dashboard_enabled)
   * unlocks the true cross-store merge below.
   */
  async listOwnOrderItems(supplierId: string, storeId?: string) {
    if (!storeId) {
      const context = await this.subscriptions.getSupplierPlanContext(supplierId);
      const aggregatedEnabled = await this.settings.resolve<boolean>("suppliers.aggregated_dashboard_enabled", context);
      if (!aggregatedEnabled) {
        const linkedStoreIds = await this.prismaAdmin.storeSupplierLink.findMany({
          where: { supplierId },
          select: { storeId: true },
          distinct: ["storeId"],
        });
        if (linkedStoreIds.length > 1) {
          throw new BadRequestException(
            "The aggregated multi-store view requires the Premium plan - filter by a single store (?storeId=) instead.",
          );
        }
      }
    }

    const items = await this.prismaAdmin.orderItem.findMany({
      where: { supplierId, ...(storeId ? { storeId } : {}) },
      orderBy: { createdAt: "desc" },
    });
    const orderIds = [...new Set(items.map((i) => i.orderId))];
    const orders = await this.prismaAdmin.order.findMany({ where: { id: { in: orderIds } } });
    const orderById = new Map(orders.map((o) => [o.id, o]));
    return items.map((item) => ({ ...item, order: orderById.get(item.orderId) ?? null }));
  }

  /** FR-3.4 - "supplier uploads tracking ID; system relays it to the buyer." */
  async uploadTracking(supplierId: string, orderItemId: string, input: { trackingId: string; carrier?: string; trackingUrl?: string }) {
    const item = await this.prismaAdmin.orderItem.findUnique({ where: { id: orderItemId } });
    if (!item || item.supplierId !== supplierId) throw new NotFoundException("Order item not found.");

    await this.prismaAdmin.trackingUpdate.create({
      data: {
        storeId: item.storeId,
        orderItemId,
        trackingId: input.trackingId,
        carrier: input.carrier,
        trackingUrl: input.trackingUrl,
        uploadedBy: supplierId,
      },
    });
    await this.prismaAdmin.orderItem.update({ where: { id: orderItemId }, data: { fulfillmentStatus: "shipped" } });
    await this.prismaAdmin.orderTimelineEvent.create({
      data: {
        storeId: item.storeId,
        orderId: item.orderId,
        eventType: "tracking_uploaded",
        afterValue: { orderItemId, trackingId: input.trackingId, uploadedBy: "supplier" },
      },
    });

    const siblings = await this.prismaAdmin.orderItem.findMany({ where: { orderId: item.orderId } });
    const allShippedOrBeyond = siblings.every((i) => ["shipped", "delivered", "completed"].includes(i.fulfillmentStatus));
    let order = await this.prismaAdmin.order.findUniqueOrThrow({ where: { id: item.orderId } });
    if (allShippedOrBeyond && order.status === "confirmed") {
      order = await this.prismaAdmin.order.update({ where: { id: item.orderId }, data: { status: "shipped" } });
      await this.prismaAdmin.orderTimelineEvent.create({
        data: {
          storeId: item.storeId,
          orderId: item.orderId,
          eventType: "status_changed",
          beforeValue: { status: "confirmed" },
          afterValue: { status: "shipped" },
        },
      });
      const store = await this.prismaAdmin.store.findUniqueOrThrow({ where: { id: item.storeId }, include: { domains: true } });
      const canonicalHostname = await this.storefront.canonicalHostnameFor(store);
      await this.email.sendOrderStatusEmail(
        order.buyerEmail,
        store.name,
        "shipped",
        `https://${canonicalHostname}/order-status/${order.statusLookupToken}`,
      );
    }
    return order;
  }
}
