import { OrderStatus } from "@prisma/client";

/**
 * SRS §5.59/FR-59.5 - the first centralized allowed-transitions structure
 * for `Order.status`. Before this module, transitions were ad hoc per-method
 * preconditions (`markAsPaid()` only proceeds from `pending`, tracking's
 * auto-bump only proceeds from `confirmed`, etc.) - those methods keep their
 * own narrower checks unchanged; this map exists for the transitions this
 * module is the FIRST writer of: `OrdersService.changeStatus()`, the target
 * of FR-59.2's bulk status-change action.
 *
 * Deliberately excludes `confirmed` (reached only via `markAsPaid()`, which
 * also accrues commission/customer stats - see FR-59.2's own warning) and
 * `shipped`/`delivered` (reached only via the tracking-entry paths /
 * `markItemDelivered()`, which keep per-item fulfillment status in sync) as
 * *targets* here - a plain status flip to either would desynchronize
 * `OrderItem.fulfillmentStatus` from `Order.status`. `cancelled`/`disputed`/
 * `completed` have no such per-item side effects, so this map is their only
 * gate. §5.60 (Returns & Refunds) extends this map with `refunded`/
 * `partially_refunded` once those enum values exist.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["cancelled"],
  confirmed: ["cancelled", "disputed"],
  shipped: ["disputed"],
  delivered: ["completed", "disputed"],
  completed: [],
  cancelled: [],
  disputed: [],
};

export function isOrderStatusTransitionAllowed(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}
