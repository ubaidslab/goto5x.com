import { aggregatePeriodProfit, computeOrderProfit } from "./pnl.util";

describe("computeOrderProfit", () => {
  it("computes true net profit correctly for a mixed cart (self + supplier items), a partial discount, and a non-zero tax rate", () => {
    // Hand-computed via computeOrderTotals()'s actual formula:
    // item A (self): unitPrice 500 x qty 2 = 1000, baseCost 200
    // item B (supplier): unitPrice 300 x qty 1 = 300, baseCost 150, lineShippingCost 50
    // subtotal = 1300; discountAmount = 100
    // selfShipping (flat) = 80; supplierShipping = 50 -> shippingAmount = 130
    // taxRate 10%, not inclusive: taxableAmount = 1300 - 100 = 1200
    // taxAmount = 1200 * 0.10 = 120; totalAmount = 1200 + 130 + 120 = 1450
    // (totalAmount is already net of the 100 discount - see pnl.util.ts's comment)
    const result = computeOrderProfit({
      totalAmount: 1450,
      taxAmount: 120,
      commissionAmount: 100,
      courierCost: 20,
      handlingCost: 10,
      items: [
        { quantity: 2, baseCost: 200 }, // 400
        { quantity: 1, baseCost: 150 }, // 150
      ],
    });

    expect(result.revenue).toBe(1330); // 1450 - 120
    expect(result.cogs).toBe(550); // 400 + 150
    expect(result.netProfit).toBe(650); // 1330 - 100 - 550 - 20 - 10
    expect(result.incomplete).toBe(false);
  });

  it("never double-counts the discount already netted into totalAmount", () => {
    // A naive "totalAmount - taxAmount - commission - discountAmount - cogs"
    // formula would understate revenue by the discount a second time.
    const withoutDoubleCounting = computeOrderProfit({
      totalAmount: 1450,
      taxAmount: 120,
      commissionAmount: 0,
      courierCost: null,
      handlingCost: null,
      items: [{ quantity: 1, baseCost: 0 }],
    });
    expect(withoutDoubleCounting.revenue).toBe(1330);
  });

  it("flags an order as incomplete (never silently zero) when any item's variant has no base cost entered", () => {
    const result = computeOrderProfit({
      totalAmount: 1000,
      taxAmount: 0,
      commissionAmount: 50,
      courierCost: null,
      handlingCost: null,
      items: [
        { quantity: 1, baseCost: 100 },
        { quantity: 1, baseCost: null },
      ],
    });
    expect(result.incomplete).toBe(true);
    expect(result.cogs).toBe(100); // the null-cost item contributes 0, not excluded from the sum entirely
  });

  it("treats a missing courier/handling cost as genuinely zero, not incomplete", () => {
    const result = computeOrderProfit({
      totalAmount: 500,
      taxAmount: 0,
      commissionAmount: 20,
      courierCost: null,
      handlingCost: null,
      items: [{ quantity: 1, baseCost: 50 }],
    });
    expect(result.incomplete).toBe(false);
    expect(result.courierCost).toBe(0);
    expect(result.handlingCost).toBe(0);
    expect(result.netProfit).toBe(430); // 500 - 20 - 50
  });
});

describe("aggregatePeriodProfit", () => {
  it("sums per-order figures across a period and subtracts ad spend", () => {
    const orderA = computeOrderProfit({
      totalAmount: 1000,
      taxAmount: 0,
      commissionAmount: 50,
      courierCost: null,
      handlingCost: null,
      items: [{ quantity: 1, baseCost: 200 }],
    });
    const orderB = computeOrderProfit({
      totalAmount: 500,
      taxAmount: 0,
      commissionAmount: 25,
      courierCost: 10,
      handlingCost: null,
      items: [{ quantity: 1, baseCost: 100 }],
    });

    const result = aggregatePeriodProfit({ orders: [orderA, orderB], adSpendTotal: 150 });
    expect(result.orderCount).toBe(2);
    expect(result.revenue).toBe(1500);
    expect(result.commission).toBe(75);
    expect(result.cogs).toBe(300);
    expect(result.adSpend).toBe(150);
    // netProfit = 1500 - 75 - 300 - 10 (courier) - 0 (handling) - 150 (ad spend) = 965
    expect(result.netProfit).toBe(965);
    expect(result.incomplete).toBe(false);
  });

  it("marks the period incomplete if any included order is individually incomplete", () => {
    const incompleteOrder = computeOrderProfit({
      totalAmount: 100,
      taxAmount: 0,
      commissionAmount: 0,
      courierCost: null,
      handlingCost: null,
      items: [{ quantity: 1, baseCost: null }],
    });
    const result = aggregatePeriodProfit({ orders: [incompleteOrder], adSpendTotal: 0 });
    expect(result.incomplete).toBe(true);
  });
});
