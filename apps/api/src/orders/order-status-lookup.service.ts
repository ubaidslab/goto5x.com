import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { computeOrderTimeline } from "./order-timeline.util";
import { REFUND_ELIGIBLE_ORDER_STATUSES } from "./order-status-transitions.util";

const ACTIVE_RETURN_STATUSES = ["requested", "approved"];

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
        // Module 53 (SRS §5.60/FR-60.2/60.6) - so the buyer sees an existing
        // request's state instead of the submission form once one exists.
        returnRequests: { orderBy: { requestedAt: "desc" } },
        // Launch-blocker fix (found while building Module 76's buyer UI) -
        // this page never surfaced verification.channel/status at all, so
        // there was nowhere for the buyer-facing OTP/partial-advance UI to
        // even mount. Absent entirely (null) means "this order never needed
        // verification" - same convention the schema's own comment on
        // Order.verification documents.
        verification: true,
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
      // Module 95 (SRS §5.6l/FR-6.66) - so the buyer-facing UI knows to
      // mount the Advance payment step, independent of `verification`.
      paymentModel: order.paymentModel,
      verification: order.verification ? { channel: order.verification.channel, status: order.verification.status } : null,
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
      // Module 53 (SRS §5.60/FR-60.2/60.6) - a buyer can submit a new return
      // only while eligible AND no request is already open; otherwise the
      // most recent request's own status is shown instead of the form.
      canRequestReturn:
        REFUND_ELIGIBLE_ORDER_STATUSES.includes(order.status) &&
        !order.returnRequests.some((r) => ACTIVE_RETURN_STATUSES.includes(r.status)),
      returnRequests: order.returnRequests.map((r) => ({
        id: r.id,
        status: r.status,
        buyerReason: r.buyerReason,
        sellerNote: r.sellerNote,
        refundAmount: r.refundAmount,
        requestedAt: r.requestedAt,
        resolvedAt: r.resolvedAt,
      })),
    };
  }
}
