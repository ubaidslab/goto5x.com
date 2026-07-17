import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";

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
      include: { items: { include: { trackingUpdates: true } } },
    });
    if (!order) throw new NotFoundException("Order not found.");

    // Buyer-safe projection only - no notes, no tags, no internal ids
    // beyond what the buyer already knows from their own order.
    return {
      status: order.status,
      placedAt: order.placedAt,
      currency: order.currency,
      totalAmount: order.totalAmount,
      shippingAmount: order.shippingAmount,
      taxAmount: order.taxAmount,
      discountAmount: order.discountAmount,
      shippingAddress: order.shippingAddress,
      items: order.items.map((item) => ({
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
