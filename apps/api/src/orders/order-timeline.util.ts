import { OrderStatus } from "@prisma/client";

export interface OrderTimelineStage {
  stage: "placed" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded";
  label: string;
  completedAt: Date | null;
}

const HAPPY_PATH: { stage: OrderTimelineStage["stage"]; label: string; matchesStatus: string[] }[] = [
  { stage: "placed", label: "Order placed", matchesStatus: [] },
  { stage: "confirmed", label: "Payment confirmed", matchesStatus: ["confirmed"] },
  { stage: "shipped", label: "Shipped", matchesStatus: ["shipped"] },
  { stage: "delivered", label: "Delivered", matchesStatus: ["delivered", "completed"] },
];

/**
 * SRS §5.38/FR-38.5 - one computed timeline, called by both the public
 * order-status page (OrderStatusLookupService) and the seller's order-
 * detail view (OrdersService.getOne()) so the two can never drift. Never a
 * new table: every `completedAt` comes from the existing `status_changed`
 * OrderTimelineEvent rows that markAsPaid()/uploadTracking()/
 * markItemDelivered() already write - this function only reads and shapes
 * that history, never a second source of truth for order state.
 */
export function computeOrderTimeline(
  order: { status: OrderStatus; placedAt: Date },
  statusChangedEvents: { afterValue: unknown; createdAt: Date }[],
): OrderTimelineStage[] {
  const timestampFor = (status: string): Date | null => {
    const event = statusChangedEvents.find((e) => (e.afterValue as { status?: string } | null)?.status === status);
    return event?.createdAt ?? null;
  };

  if (order.status === "cancelled" || order.status === "disputed") {
    return [
      { stage: "placed", label: "Order placed", completedAt: order.placedAt },
      {
        stage: "cancelled",
        label: order.status === "cancelled" ? "Cancelled" : "Disputed",
        completedAt: timestampFor(order.status),
      },
    ];
  }

  const happyPath = HAPPY_PATH.map(({ stage, label, matchesStatus }) => ({
    stage,
    label,
    completedAt: stage === "placed" ? order.placedAt : (matchesStatus.map(timestampFor).find((d) => d !== null) ?? null),
  }));

  // Module 53 (SRS §5.60/FR-60.6) - a refund happens on top of the happy
  // path (the order was genuinely placed/confirmed/shipped/etc. before it
  // was refunded), so this appends rather than replaces - the buyer still
  // sees how far the order got before it was returned.
  if (order.status === "refunded" || order.status === "partially_refunded") {
    return [
      ...happyPath,
      {
        stage: "refunded",
        label: order.status === "refunded" ? "Refunded" : "Partially refunded",
        completedAt: timestampFor(order.status),
      },
    ];
  }

  return happyPath;
}

export type BuyerFacingTrackingState = "pending" | "submitted_to_courier" | "delivered" | "cancelled";

/**
 * SRS §5.38/FR-38.7 (founder batch, "Honest Delivery Tracking") - a pure
 * mapping of `Order.status` onto the 4 buyer-facing states, no new column.
 * Shared by the buyer order-status page and the seller Orders list (FR-
 * 38.10) so the two can never show two different buckets for one order -
 * same "one shared computation" discipline as computeOrderTimeline() above.
 * `disputed` maps to "cancelled" deliberately, mirroring computeOrderTimeline()'s
 * own existing treatment of `disputed` as a terminal, cancelled-shaped stage.
 */
export function buyerFacingTrackingState(status: OrderStatus): BuyerFacingTrackingState {
  switch (status) {
    case "pending":
    case "confirmed":
      return "pending";
    case "shipped":
      return "submitted_to_courier";
    case "delivered":
    case "completed":
    case "refunded":
    case "partially_refunded":
      return "delivered";
    case "cancelled":
    case "disputed":
      return "cancelled";
  }
}
