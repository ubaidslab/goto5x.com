import { computeOrderTimeline } from "./order-timeline.util";

const placedAt = new Date("2026-01-01T00:00:00Z");
const confirmedAt = new Date("2026-01-02T00:00:00Z");
const shippedAt = new Date("2026-01-03T00:00:00Z");
const deliveredAt = new Date("2026-01-04T00:00:00Z");

describe("computeOrderTimeline", () => {
  it("marks only 'placed' complete for a pending order with no status_changed events", () => {
    const timeline = computeOrderTimeline({ status: "pending", placedAt }, []);
    expect(timeline.map((s) => s.stage)).toEqual(["placed", "confirmed", "shipped", "delivered"]);
    expect(timeline[0].completedAt).toEqual(placedAt);
    expect(timeline[1].completedAt).toBeNull();
    expect(timeline[2].completedAt).toBeNull();
    expect(timeline[3].completedAt).toBeNull();
  });

  it("fills in completedAt for every stage reached, using the matching status_changed event's timestamp", () => {
    const events = [
      { afterValue: { status: "confirmed" }, createdAt: confirmedAt },
      { afterValue: { status: "shipped" }, createdAt: shippedAt },
    ];
    const timeline = computeOrderTimeline({ status: "shipped", placedAt }, events);
    expect(timeline.find((s) => s.stage === "confirmed")?.completedAt).toEqual(confirmedAt);
    expect(timeline.find((s) => s.stage === "shipped")?.completedAt).toEqual(shippedAt);
    expect(timeline.find((s) => s.stage === "delivered")?.completedAt).toBeNull();
  });

  it("treats both 'delivered' and 'completed' status_changed events as completing the delivered stage", () => {
    const events = [{ afterValue: { status: "completed" }, createdAt: deliveredAt }];
    const timeline = computeOrderTimeline({ status: "completed", placedAt }, events);
    expect(timeline.find((s) => s.stage === "delivered")?.completedAt).toEqual(deliveredAt);
  });

  it("returns a placed + cancelled two-stage timeline for a cancelled order, never continuing the happy path", () => {
    const events = [{ afterValue: { status: "cancelled" }, createdAt: confirmedAt }];
    const timeline = computeOrderTimeline({ status: "cancelled", placedAt }, events);
    expect(timeline.map((s) => s.stage)).toEqual(["placed", "cancelled"]);
    expect(timeline[1].completedAt).toEqual(confirmedAt);
  });

  it("returns a placed + disputed two-stage timeline for a disputed order", () => {
    const timeline = computeOrderTimeline({ status: "disputed", placedAt }, []);
    expect(timeline.map((s) => s.stage)).toEqual(["placed", "cancelled"]);
    expect(timeline[1].label).toBe("Disputed");
  });
});
