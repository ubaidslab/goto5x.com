import { computeOrderTotals } from "./order-totals.util";

describe("computeOrderTotals", () => {
  it("charges the flat shipping rate for a self-fulfilled order under the free-shipping threshold", () => {
    const result = computeOrderTotals({
      items: [{ unitPrice: 1000, quantity: 2, lineShippingCost: 0, isSupplierItem: false }],
      discountAmount: 0,
      shippingFlatRate: 200,
      shippingFreeThreshold: 5000,
      taxRate: 0,
      taxInclusive: false,
    });
    expect(result.subtotal).toBe(2000);
    expect(result.shippingAmount).toBe(200);
    expect(result.taxAmount).toBe(0);
    expect(result.totalAmount).toBe(2200);
  });

  it("waives self-fulfilled shipping once the post-discount subtotal meets the free-shipping threshold", () => {
    const result = computeOrderTotals({
      items: [{ unitPrice: 3000, quantity: 2, lineShippingCost: 0, isSupplierItem: false }],
      discountAmount: 0,
      shippingFlatRate: 200,
      shippingFreeThreshold: 5000,
      taxRate: 0,
      taxInclusive: false,
    });
    expect(result.shippingAmount).toBe(0);
    expect(result.totalAmount).toBe(6000);
  });

  it("never waives supplier-item shipping regardless of the self-fulfilled free-shipping threshold", () => {
    const result = computeOrderTotals({
      items: [{ unitPrice: 3000, quantity: 2, lineShippingCost: 500, isSupplierItem: true }],
      discountAmount: 0,
      shippingFlatRate: 200,
      shippingFreeThreshold: 5000,
      taxRate: 0,
      taxInclusive: false,
    });
    expect(result.shippingAmount).toBe(500);
  });

  it("sums self-fulfilled flat shipping and supplier per-line shipping independently in a mixed cart (FR-5.6)", () => {
    const result = computeOrderTotals({
      items: [
        { unitPrice: 1000, quantity: 1, lineShippingCost: 0, isSupplierItem: false },
        { unitPrice: 2000, quantity: 1, lineShippingCost: 300, isSupplierItem: true },
      ],
      discountAmount: 0,
      shippingFlatRate: 200,
      shippingFreeThreshold: null,
      taxRate: 0,
      taxInclusive: false,
    });
    expect(result.subtotal).toBe(3000);
    expect(result.shippingAmount).toBe(500);
    expect(result.totalAmount).toBe(3500);
  });

  it("applies a discount before computing the free-shipping threshold and tax", () => {
    const result = computeOrderTotals({
      items: [{ unitPrice: 5000, quantity: 1, lineShippingCost: 0, isSupplierItem: false }],
      discountAmount: 1000,
      shippingFlatRate: 200,
      shippingFreeThreshold: 4500,
      taxRate: 10,
      taxInclusive: false,
    });
    // post-discount subtotal (4000) is under the 4500 threshold - shipping still charged.
    expect(result.shippingAmount).toBe(200);
    expect(result.taxAmount).toBe(400); // 10% of (5000-1000)
    expect(result.totalAmount).toBe(4600); // 4000 + 200 + 400
  });

  it("adds tax on top of the total when tax-exclusive", () => {
    const result = computeOrderTotals({
      items: [{ unitPrice: 1000, quantity: 1, lineShippingCost: 0, isSupplierItem: false }],
      discountAmount: 0,
      shippingFlatRate: 0,
      shippingFreeThreshold: null,
      taxRate: 15,
      taxInclusive: false,
    });
    expect(result.taxAmount).toBe(150);
    expect(result.totalAmount).toBe(1150);
  });

  it("extracts tax from the subtotal (informational only) when tax-inclusive, never adding it to the total", () => {
    const result = computeOrderTotals({
      items: [{ unitPrice: 1150, quantity: 1, lineShippingCost: 0, isSupplierItem: false }],
      discountAmount: 0,
      shippingFlatRate: 0,
      shippingFreeThreshold: null,
      taxRate: 15,
      taxInclusive: true,
    });
    expect(result.taxAmount).toBe(150);
    expect(result.totalAmount).toBe(1150);
  });

  it("charges no shipping at all when every item is supplier-fulfilled with zero listed shipping cost", () => {
    const result = computeOrderTotals({
      items: [{ unitPrice: 500, quantity: 3, lineShippingCost: 0, isSupplierItem: true }],
      discountAmount: 0,
      shippingFlatRate: 999,
      shippingFreeThreshold: null,
      taxRate: 0,
      taxInclusive: false,
    });
    expect(result.shippingAmount).toBe(0);
  });
});
