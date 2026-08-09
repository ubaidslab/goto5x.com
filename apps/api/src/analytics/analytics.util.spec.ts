import {
  bucketSalesOverTime,
  computeAOV,
  computeBestSalesTimes,
  computeRepeatCustomerRate,
  computeReturnRate,
  computeReturnRateByProduct,
  computeTopProducts,
} from "./analytics.util";

describe("analytics.util - SRS §5.61/FR-61.x", () => {
  describe("bucketSalesOverTime (FR-61.2)", () => {
    it("buckets orders by day and fills gaps with zero", () => {
      const orders = [
        { placedAt: new Date("2026-01-01T10:00:00Z"), totalAmount: 100 },
        { placedAt: new Date("2026-01-01T15:00:00Z"), totalAmount: 50 },
        { placedAt: new Date("2026-01-03T10:00:00Z"), totalAmount: 200 },
      ];
      const points = bucketSalesOverTime(orders, "day", new Date("2026-01-01T00:00:00Z"), new Date("2026-01-03T00:00:00Z"));
      expect(points).toHaveLength(3);
      expect(points[0]).toEqual({ bucketStart: "2026-01-01", orderCount: 2, revenue: 150 });
      expect(points[1]).toEqual({ bucketStart: "2026-01-02", orderCount: 0, revenue: 0 });
      expect(points[2]).toEqual({ bucketStart: "2026-01-03", orderCount: 1, revenue: 200 });
    });

    it("buckets by month, merging same-month orders", () => {
      const orders = [
        { placedAt: new Date("2026-01-05T00:00:00Z"), totalAmount: 100 },
        { placedAt: new Date("2026-01-25T00:00:00Z"), totalAmount: 300 },
      ];
      const points = bucketSalesOverTime(orders, "month", new Date("2026-01-01T00:00:00Z"), new Date("2026-01-31T00:00:00Z"));
      expect(points).toHaveLength(1);
      expect(points[0]).toEqual({ bucketStart: "2026-01-01", orderCount: 2, revenue: 400 });
    });

    it("returns an empty-but-present series for a range with no orders at all", () => {
      const points = bucketSalesOverTime([], "day", new Date("2026-01-01T00:00:00Z"), new Date("2026-01-02T00:00:00Z"));
      expect(points).toEqual([
        { bucketStart: "2026-01-01", orderCount: 0, revenue: 0 },
        { bucketStart: "2026-01-02", orderCount: 0, revenue: 0 },
      ]);
    });
  });

  describe("computeTopProducts (FR-61.1)", () => {
    const items = [
      { productId: "p1", productTitle: "Widget", quantity: 2, unitPrice: 50 },
      { productId: "p1", productTitle: "Widget", quantity: 1, unitPrice: 50 },
      { productId: "p2", productTitle: "Gadget", quantity: 5, unitPrice: 10 },
    ];

    it("ranks by revenue when requested", () => {
      const result = computeTopProducts(items, "revenue", 10);
      // p1: 3 units * 50 = 150; p2: 5 units * 10 = 50
      expect(result[0]).toEqual({ productId: "p1", productTitle: "Widget", units: 3, revenue: 150 });
      expect(result[1]).toEqual({ productId: "p2", productTitle: "Gadget", units: 5, revenue: 50 });
    });

    it("ranks by units when requested", () => {
      const result = computeTopProducts(items, "units", 10);
      expect(result[0].productId).toBe("p2"); // 5 units beats 3 units even though revenue is lower
    });

    it("respects the limit", () => {
      const result = computeTopProducts(items, "revenue", 1);
      expect(result).toHaveLength(1);
    });
  });

  describe("divide-by-zero guards (FR-61.3/61.4/61.5)", () => {
    it("computeRepeatCustomerRate returns 0 for a store with zero customers", () => {
      expect(computeRepeatCustomerRate(0, 0)).toBe(0);
    });

    it("computeRepeatCustomerRate computes a real percentage otherwise", () => {
      expect(computeRepeatCustomerRate(10, 3)).toBe(30);
    });

    it("computeReturnRate returns 0 for a store with zero eligible orders", () => {
      expect(computeReturnRate(0, 0)).toBe(0);
    });

    it("computeReturnRate computes a real percentage otherwise", () => {
      expect(computeReturnRate(20, 1)).toBe(5);
    });

    it("computeAOV returns 0 for a store with zero confirmed orders", () => {
      expect(computeAOV([])).toBe(0);
    });

    it("computeAOV averages totalAmount otherwise", () => {
      expect(computeAOV([{ totalAmount: 100 }, { totalAmount: 200 }])).toBe(150);
    });

    it("computeBestSalesTimes returns nulls for a store with zero orders", () => {
      expect(computeBestSalesTimes([])).toEqual({ bestDayOfWeek: null, bestHourOfDay: null });
    });

    it("computeBestSalesTimes picks the highest-revenue day/hour", () => {
      const orders = [
        { placedAt: new Date("2026-01-05T10:00:00Z"), totalAmount: 500 }, // Monday, 10:00
        { placedAt: new Date("2026-01-06T14:00:00Z"), totalAmount: 50 }, // Tuesday, 14:00
      ];
      const result = computeBestSalesTimes(orders);
      expect(result.bestDayOfWeek).toBe(1); // Monday
      expect(result.bestHourOfDay).toBe(10);
    });
  });

  describe("computeReturnRateByProduct (FR-61.4)", () => {
    it("attributes a return to every product in the returned order", () => {
      const pairs = [
        { productId: "p1", productTitle: "Widget", orderId: "o1" },
        { productId: "p2", productTitle: "Gadget", orderId: "o1" },
        { productId: "p1", productTitle: "Widget", orderId: "o2" },
      ];
      const returned = new Set(["o1"]);
      const result = computeReturnRateByProduct(pairs, returned);
      const p1 = result.find((r) => r.productId === "p1")!;
      const p2 = result.find((r) => r.productId === "p2")!;
      expect(p1.returnRate).toBe(50); // 1 of 2 orders containing p1 was returned
      expect(p2.returnRate).toBe(100); // 1 of 1 order containing p2 was returned
    });

    it("returns 0% for a product with no returns at all, not a divide-by-zero error", () => {
      const pairs = [{ productId: "p1", productTitle: "Widget", orderId: "o1" }];
      const result = computeReturnRateByProduct(pairs, new Set());
      expect(result[0].returnRate).toBe(0);
    });
  });
});
