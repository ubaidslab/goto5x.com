import { OrderStatus } from "@prisma/client";

export interface OrderTimelineStage {
  stage: "placed" | "confirmed" | "shipped" | "delivered" | "cancelled";
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

  return HAPPY_PATH.map(({ stage, label, matchesStatus }) => ({
    stage,
    label,
    completedAt: stage === "placed" ? order.placedAt : (matchesStatus.map(timestampFor).find((d) => d !== null) ?? null),
  }));
}
