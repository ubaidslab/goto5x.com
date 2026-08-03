import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { computeOrderTimeline } from "./order-timeline.util";

/**
 * FR-5.4 - buyers have no accounts (guest checkout), so this is their only
 * way to check an order's status: an unguessable, non-sequential token
 * (see CheckoutService - a random 24-byte hex, not a signed JWT and not the
 * row's own uuid, which would otherwise leak insertion order). Public/
 * pre-auth, same BYPASSRLS reasoning as StorefrontService - and
 * deliberately does NOT gate on the store's active/suspended status
 * (FR-5.3's "in-flight orders remain fulfillable" - a buyer must still be
 * able to check on an order they already placed even if the store is later
 * suspended).
 */
@Injectable()
export class OrderStatusLookupService {
  constructor(private readonly prismaAdmin: PrismaAdminService) {}

  async lookup(token: string) {
    const order = await this.prismaAdmin.order.findUnique({
      where: { statusLookupToken: token },
      include: {
        items: { include: { trackingUpdates: true, product: { select: { title: true } } } },
        timelineEvents: { where: { eventType: "status_changed" }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!order) throw new NotFoundException("Order not found.");

    // FR-6.14 (Module 11) - the buyer's persistent post-checkout reference
    // for how to actually pay the seller, shown only while the order is
    // still pending (once paid/confirmed there's nothing left to pay).
    const paymentInstructions =
      order.status === "pending"
        ? await this.prismaAdmin.storePaymentInstructions.findUnique({ where: { storeId: order.storeId } })
        : null;

    // Buyer-safe projection only - no notes, no tags, no internal ids
    // beyond what the buyer already knows from their own order.
    return {
      status: order.status,
      placedAt: order.placedAt,
      // SRS §5.38/FR-38.5 - the same computed source the seller's own
      // order-detail view renders (OrdersService.getOne()).
      timeline: computeOrderTimeline(order, order.timelineEvents),
      currency: order.currency,
      // FR-19.1 - available from the buyer order-status page; null if
      // rendering failed at placement time (best-effort, never blocks the order).
      invoicePdfUrl: order.invoicePdfUrl,
      totalAmount: order.totalAmount,
      shippingAmount: order.shippingAmount,
      taxAmount: order.taxAmount,
      discountAmount: order.discountAmount,
      shippingAddress: order.shippingAddress,
      paymentInstructions: paymentInstructions
        ? {
            bankAccountTitle: paymentInstructions.bankAccountTitle,
            bankAccountNumber: paymentInstructions.bankAccountNumber,
            bankName: paymentInstructions.bankName,
            jazzcashNumber: paymentInstructions.jazzcashNumber,
            easypaisaNumber: paymentInstructions.easypaisaNumber,
            codEnabled: paymentInstructions.codEnabled,
          }
        : null,
      items: order.items.map((item) => ({
        productId: item.productId,
        productTitle: item.product.title,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        fulfillmentStatus: item.fulfillmentStatus,
        trackingUpdates: item.trackingUpdates.map((t) => ({
          trackingId: t.trackingId,
          carrier: t.carrier,
          uploadedAt: t.uploadedAt,
        })),
      })),
    };
  }
}
