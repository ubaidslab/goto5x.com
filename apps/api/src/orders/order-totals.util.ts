import { round2 } from "./money.util";

export interface OrderTotalsLineItem {
  unitPrice: number;
  quantity: number;
  /** The line's total shipping cost (already unitShipping * quantity) - 0 for a self-fulfilled item. */
  lineShippingCost: number;
  isSupplierItem: boolean;
}

export interface OrderTotalsInput {
  items: OrderTotalsLineItem[];
  discountAmount: number;
  shippingFlatRate: number;
  shippingFreeThreshold: number | null;
  taxRate: number;
  taxInclusive: boolean;
}

export interface OrderTotals {
  subtotal: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
}

/**
 * FR-5.6 (mixed-cart shipping per fulfillment source) + tax computation,
 * shared by CheckoutService.placeOrder() (new orders) and
 * OrdersService.editOrder() (FR-17.5, recomputing after a line-item
 * change) - the two must never independently drift on how a total is
 * derived. Pure - no I/O, easy to unit-test exhaustively.
 */
export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const subtotal = round2(input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));

  const supplierShipping = round2(
    input.items.filter((i) => i.isSupplierItem).reduce((sum, i) => sum + i.lineShippingCost, 0),
  );
  const hasSelfItems = input.items.some((i) => !i.isSupplierItem);
  let selfShipping = 0;
  if (hasSelfItems) {
    selfShipping =
      input.shippingFreeThreshold !== null && subtotal - input.discountAmount >= input.shippingFreeThreshold
        ? 0
        : input.shippingFlatRate;
  }
  const shippingAmount = round2(selfShipping + supplierShipping);

  const taxableAmount = subtotal - input.discountAmount;
  let taxAmount: number;
  let totalAmount: number;
  if (input.taxInclusive) {
    // Prices already include tax - taxAmount is the informational portion
    // of the subtotal, not an addition to the total.
    taxAmount = round2(taxableAmount - taxableAmount / (1 + input.taxRate / 100));
    totalAmount = round2(taxableAmount + shippingAmount);
  } else {
    taxAmount = round2(taxableAmount * (input.taxRate / 100));
    totalAmount = round2(taxableAmount + shippingAmount + taxAmount);
  }

  return { subtotal, shippingAmount, taxAmount, totalAmount };
}
