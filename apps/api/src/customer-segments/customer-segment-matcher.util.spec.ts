import { matchesSegmentCriteria } from "./customer-segment-matcher.util";

const baseCustomer = { ordersCount: 3, totalSpent: 1500, lastOrderAt: new Date("2026-06-01T00:00:00Z") };

describe("matchesSegmentCriteria", () => {
  it("matches a customer with no criteria set (empty segment matches everyone)", () => {
    expect(matchesSegmentCriteria(baseCustomer, null, {})).toBe(true);
  });

  it("rejects a customer below minOrders and accepts one at or above it", () => {
    expect(matchesSegmentCriteria(baseCustomer, null, { minOrders: 4 })).toBe(false);
    expect(matchesSegmentCriteria(baseCustomer, null, { minOrders: 3 })).toBe(true);
  });

  it("rejects a customer above maxOrders and accepts one at or below it", () => {
    expect(matchesSegmentCriteria(baseCustomer, null, { maxOrders: 2 })).toBe(false);
    expect(matchesSegmentCriteria(baseCustomer, null, { maxOrders: 3 })).toBe(true);
  });

  it("applies minTotalSpent/maxTotalSpent as an inclusive range", () => {
    expect(matchesSegmentCriteria(baseCustomer, null, { minTotalSpent: 1600 })).toBe(false);
    expect(matchesSegmentCriteria(baseCustomer, null, { minTotalSpent: 1500 })).toBe(true);
    expect(matchesSegmentCriteria(baseCustomer, null, { maxTotalSpent: 1000 })).toBe(false);
    expect(matchesSegmentCriteria(baseCustomer, null, { maxTotalSpent: 1500 })).toBe(true);
  });

  it("rejects a customer with no lastOrderAt when a last-order-date bound is set", () => {
    const noOrders = { ordersCount: 0, totalSpent: 0, lastOrderAt: null };
    expect(matchesSegmentCriteria(noOrders, null, { lastOrderAfter: new Date("2026-01-01T00:00:00Z") })).toBe(false);
  });

  it("applies lastOrderAfter/lastOrderBefore as a date range", () => {
    expect(matchesSegmentCriteria(baseCustomer, null, { lastOrderAfter: new Date("2026-07-01T00:00:00Z") })).toBe(false);
    expect(matchesSegmentCriteria(baseCustomer, null, { lastOrderAfter: new Date("2026-05-01T00:00:00Z") })).toBe(true);
    expect(matchesSegmentCriteria(baseCustomer, null, { lastOrderBefore: new Date("2026-05-01T00:00:00Z") })).toBe(false);
    expect(matchesSegmentCriteria(baseCustomer, null, { lastOrderBefore: new Date("2026-07-01T00:00:00Z") })).toBe(true);
  });

  it("rejects a customer with no known location when a location filter is set", () => {
    expect(matchesSegmentCriteria(baseCustomer, null, { locationCity: "Lahore" })).toBe(false);
  });

  it("matches location case-insensitively, and rejects a mismatch", () => {
    const location = { city: "Lahore", country: "PK" };
    expect(matchesSegmentCriteria(baseCustomer, location, { locationCity: "lahore" })).toBe(true);
    expect(matchesSegmentCriteria(baseCustomer, location, { locationCity: "Karachi" })).toBe(false);
    expect(matchesSegmentCriteria(baseCustomer, location, { locationCountry: "pk" })).toBe(true);
    expect(matchesSegmentCriteria(baseCustomer, location, { locationCountry: "IN" })).toBe(false);
  });

  it("requires every set criterion to pass (AND, not OR)", () => {
    const location = { city: "Lahore", country: "PK" };
    expect(matchesSegmentCriteria(baseCustomer, location, { minOrders: 3, locationCity: "Lahore" })).toBe(true);
    expect(matchesSegmentCriteria(baseCustomer, location, { minOrders: 10, locationCity: "Lahore" })).toBe(false);
  });
});
