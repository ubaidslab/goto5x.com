import { isOrderStatusTransitionAllowed } from "./order-status-transitions.util";

describe("isOrderStatusTransitionAllowed", () => {
  it("allows pending -> cancelled", () => {
    expect(isOrderStatusTransitionAllowed("pending", "cancelled")).toBe(true);
  });

  it("allows confirmed -> cancelled and confirmed -> disputed", () => {
    expect(isOrderStatusTransitionAllowed("confirmed", "cancelled")).toBe(true);
    expect(isOrderStatusTransitionAllowed("confirmed", "disputed")).toBe(true);
  });

  it("allows shipped -> disputed only", () => {
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

  it("treats cancelled/disputed/completed as terminal - no outgoing transitions", () => {
    expect(isOrderStatusTransitionAllowed("cancelled", "confirmed")).toBe(false);
    expect(isOrderStatusTransitionAllowed("disputed", "confirmed")).toBe(false);
    expect(isOrderStatusTransitionAllowed("completed", "disputed")).toBe(false);
  });

  it("rejects a no-op same-status transition (the caller should skip, not call, for an order already at the target)", () => {
    expect(isOrderStatusTransitionAllowed("cancelled", "cancelled")).toBe(false);
    expect(isOrderStatusTransitionAllowed("pending", "pending")).toBe(false);
  });
});
