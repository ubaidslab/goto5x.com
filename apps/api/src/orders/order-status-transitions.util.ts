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
 * gate.
 *
 * Module 53 (SRS §5.60/FR-60.4) extends this map with `refunded`/
 * `partially_refunded` as new targets from every CONFIRMED_OR_BEYOND-style
 * status (the same set REFUND_ELIGIBLE_ORDER_STATUSES below names) - same
 * reasoning as above: reaching them via a bare `changeStatus()` flip would
 * skip the ledger reversal/customer-stats decrement a refund requires, so
 * they're reached ONLY through `ReturnsService`'s own dedicated method,
 * never `OrdersService.changeStatus()` (whose DTO's `@IsIn` never lists
 * them). `isOrderStatusTransitionAllowed()` is reused there purely as a
 * second, centralized guard - the same map, a different caller.
 * `partially_refunded` can reach itself/`refunded` again, since a second
 * partial-refund round on the same order is a normal case (ReturnsService
 * tracks the running total refunded so far, this map only says a further
 * refund is structurally reachable from that state).
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["cancelled"],
  confirmed: ["cancelled", "disputed", "refunded", "partially_refunded"],
  shipped: ["disputed", "refunded", "partially_refunded"],
  delivered: ["completed", "disputed", "refunded", "partially_refunded"],
  completed: ["refunded", "partially_refunded"],
  cancelled: [],
  disputed: [],
  partially_refunded: ["refunded", "partially_refunded"],
  refunded: [],
};

export function isOrderStatusTransitionAllowed(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * SRS §5.60/FR-60.2 - "only a confirmed (actually paid) order can have a
 * return requested against it," the same Financial Truth Invariant gate
 * PnLService's CONFIRMED_OR_BEYOND already enforces for revenue - kept as
 * its own named export (not imported from pnl.service.ts, to avoid a
 * cross-module dependency for one constant) but intentionally the same
 * status set, plus `partially_refunded` so a second refund round on an
 * already-partially-refunded order is reachable.
 */
export const REFUND_ELIGIBLE_ORDER_STATUSES: OrderStatus[] = [
  "confirmed",
  "shipped",
  "delivered",
  "completed",
  "partially_refunded",
];
