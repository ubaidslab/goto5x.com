import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { EmailService } from "../notifications/email.service";
import { orderBucketWhereClause } from "./orders-overview.service";

/**
 * Phase 5 (founder-requested "missing tracking" alert) - the Shipping &
 * Tracking hub's whole reason to exist as more than a redesigned settings
 * page. Reuses orderBucketWhereClause("awaitingTracking") - the EXACT same
 * predicate the Orders Command Center's own bucket tile counts - so this
 * sweep's "overdue" definition can never drift from what a seller sees as
 * "awaiting tracking" on the Orders page itself.
 *
 * One alert per order, ever (Order.missingTrackingAlertedAt dedupes it) -
 * once an order leaves the awaitingTracking bucket (ships, gets
 * cancelled, etc.) it naturally stops matching the sweep's query, so no
 * reset/expiry logic is needed.
 */
@Injectable()
export class MissingTrackingAlertService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly email: EmailService,
  ) {}

  async runSweep(now = new Date()): Promise<{ checked: number; alerted: number }> {
    const alertHours = await this.settings.resolve<number>("orders.missing_tracking_alert_hours");
    const cutoff = new Date(now.getTime() - alertHours * 60 * 60 * 1000);

    const candidates = await this.prismaAdmin.order.findMany({
      where: { ...orderBucketWhereClause("awaitingTracking"), missingTrackingAlertedAt: null, placedAt: { lte: cutoff } },
      include: {
        store: { include: { seller: { include: { user: { select: { email: true } } } } } },
        items: true,
      },
    });

    // OrderItem.supplierId has no declared Prisma relation to Supplier (a
    // bare scalar FK) - resolved as a manual lookup map, same pattern
    // OrderPricingService.priceItems() already uses for productById/
    // variantById.
    const allSupplierIds = [...new Set(candidates.flatMap((o) => o.items.map((i) => i.supplierId).filter((id): id is string => !!id)))];
    const suppliers = await this.prismaAdmin.supplier.findMany({
      where: { id: { in: allSupplierIds } },
      include: { user: { select: { email: true } } },
    });
    const supplierById = new Map(suppliers.map((s) => [s.id, s]));

    let alerted = 0;
    for (const order of candidates) {
      // placedAt is a safe upper-bound filter (an order can't be
      // "confirmed" before it's placed) but the real "entered confirmed"
      // moment is this order's most recent status_changed event - since
      // the order is still in the confirmed status right now, no later
      // transition has happened, so that event's timestamp IS the moment
      // it became overdue-eligible.
      const confirmedEvent = await this.prismaAdmin.orderTimelineEvent.findFirst({
        where: { orderId: order.id, eventType: "status_changed" },
        orderBy: { createdAt: "desc" },
      });
      const confirmedAt = confirmedEvent?.createdAt ?? order.placedAt;
      if (confirmedAt > cutoff) continue;

      const hoursOverdue = Math.floor((now.getTime() - confirmedAt.getTime()) / (60 * 60 * 1000));
      const orderUrl = `${process.env.APP_BASE_URL ?? ""}/stores/${order.storeId}/orders/${order.id}`;

      const supplierIds = new Set(order.items.filter((i) => i.supplierId).map((i) => i.supplierId as string));
      const hasSelfFulfilledItems = order.items.some((i) => !i.supplierId);

      if (hasSelfFulfilledItems) {
        await this.email
          .sendMissingTrackingAlertToSellerEmail(order.store.seller.user.email, order.store.name, order.orderNumber, orderUrl, hoursOverdue)
          .catch(() => {});
      }
      for (const supplierId of supplierIds) {
        const supplier = supplierById.get(supplierId);
        if (!supplier) continue;
        await this.email
          .sendMissingTrackingAlertToSupplierEmail(supplier.user.email, order.store.name, order.orderNumber, hoursOverdue)
          .catch(() => {});
      }

      await this.prismaAdmin.order.update({ where: { id: order.id }, data: { missingTrackingAlertedAt: now } });
      alerted += 1;
    }

    return { checked: candidates.length, alerted };
  }
}
