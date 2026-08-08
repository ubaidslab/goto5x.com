import { isOrderStatusTransitionAllowed, REFUND_ELIGIBLE_ORDER_STATUSES } from "./order-status-transitions.util";

describe("isOrderStatusTransitionAllowed", () => {
  it("allows pending -> cancelled", () => {
    expect(isOrderStatusTransitionAllowed("pending", "cancelled")).toBe(true);
  });

  it("allows confirmed -> cancelled and confirmed -> disputed", () => {
    expect(isOrderStatusTransitionAllowed("confirmed", "cancelled")).toBe(true);
    expect(isOrderStatusTransitionAllowed("confirmed", "disputed")).toBe(true);
  });

  it("allows shipped -> disputed only (plus refund targets, covered separately below)", () => {
    expect(isOrderStatusTransitionAllowed("shipped", "disputed")).toBe(true);
    expect(isOrderStatusTransitionAllowed("shipped", "cancelled")).toBe(false);
  });

  it("allows delivered -> completed and delivered -> disputed", () => {
    expect(isOrderStatusTransitionAllowed("delivered", "completed")).toBe(true);
    expect(isOrderStatusTransitionAllowed("delivered", "disputed")).toBe(true);
  });

  it("never allows confirmed/shipped/delivered as a target - those go through markAsPaid()/tracking/markItemDelivered() instead", () => {
    expect(isOrderStatusTransitionAllowed("pending", "confirmed")).toBe(false);
    expect(isOrderStatusTransitionAllowed("confirmed", "shipped")).toBe(false);
    expect(isOrderStatusTransitionAllowed("shipped", "delivered")).toBe(false);
  });

  it("treats cancelled/disputed as fully terminal - no outgoing transitions at all", () => {
    expect(isOrderStatusTransitionAllowed("cancelled", "confirmed")).toBe(false);
    expect(isOrderStatusTransitionAllowed("disputed", "confirmed")).toBe(false);
  });

  it("rejects a no-op same-status transition (the caller should skip, not call, for an order already at the target)", () => {
    expect(isOrderStatusTransitionAllowed("cancelled", "cancelled")).toBe(false);
    expect(isOrderStatusTransitionAllowed("pending", "pending")).toBe(false);
  });

  // Module 53 (SRS §5.60/FR-60.4) - the refunded/partially_refunded extension.
  it("allows refunded/partially_refunded from every CONFIRMED_OR_BEYOND-style status, including completed", () => {
    expect(isOrderStatusTransitionAllowed("confirmed", "refunded")).toBe(true);
    expect(isOrderStatusTransitionAllowed("confirmed", "partially_refunded")).toBe(true);
    expect(isOrderStatusTransitionAllowed("shipped", "refunded")).toBe(true);
    expect(isOrderStatusTransitionAllowed("delivered", "refunded")).toBe(true);
    expect(isOrderStatusTransitionAllowed("completed", "refunded")).toBe(true);
    expect(isOrderStatusTransitionAllowed("completed", "partially_refunded")).toBe(true);
    // still no disputed target from completed, unlike the four above
    expect(isOrderStatusTransitionAllowed("completed", "disputed")).toBe(false);
  });

  it("never allows a refund from pending, cancelled, or disputed - never a real, paid sale to reverse", () => {
    expect(isOrderStatusTransitionAllowed("pending", "refunded")).toBe(false);
    expect(isOrderStatusTransitionAllowed("cancelled", "refunded")).toBe(false);
    expect(isOrderStatusTransitionAllowed("disputed", "refunded")).toBe(false);
  });

  it("allows a second partial-refund round: partially_refunded -> partially_refunded or -> refunded", () => {
    expect(isOrderStatusTransitionAllowed("partially_refunded", "partially_refunded")).toBe(true);
    expect(isOrderStatusTransitionAllowed("partially_refunded", "refunded")).toBe(true);
  });

  it("treats refunded as fully terminal", () => {
    expect(isOrderStatusTransitionAllowed("refunded", "partially_refunded")).toBe(false);
    expect(isOrderStatusTransitionAllowed("refunded", "refunded")).toBe(false);
  });
});

describe("REFUND_ELIGIBLE_ORDER_STATUSES", () => {
  it("matches exactly the statuses a return request can be submitted against", () => {
    expect(REFUND_ELIGIBLE_ORDER_STATUSES.sort()).toEqual(
      ["confirmed", "shipped", "delivered", "completed", "partially_refunded"].sort(),
    );
  });
});
