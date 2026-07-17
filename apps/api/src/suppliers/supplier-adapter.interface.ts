/**
 * SRS §3.5 - implemented by Printify, CJ Dropshipping, etc. The orchestrating
 * module (this one) never branches on which adapter is active; adding a new
 * supplier network is "write one more adapter," never "modify this module."
 */
export interface AdapterProduct {
  externalProductId: string;
  title: string;
  price: number;
  shippingCost: number;
  estimatedDeliveryMinDays: number;
  estimatedDeliveryMaxDays: number;
  supportedCountries: string[];
  rawPayload: Record<string, unknown>;
}

export interface AdapterTrackingUpdate {
  externalOrderId: string;
  trackingNumber: string;
  carrier?: string;
  status: string;
}

export interface SupplierAdapter {
  readonly adapterType: string;

  /** FR-3.2/FR-4.1 - fetch this supplier's current catalog from the adapter's network. */
  listProducts(supplierId: string): Promise<AdapterProduct[]>;

  /**
   * FR-4.3 - refresh price/stock for already-imported listings. For a
   * print-on-demand adapter (Printify, v1.0's only implementation) this is
   * the same call as listProducts() - there is no separate finite-stock
   * endpoint to poll.
   */
  syncStock(supplierId: string): Promise<AdapterProduct[]>;

  /**
   * FR-2.7/FR-3.2 - creates the `listing_reviews` row a seller approves/
   * rejects. Generic across every adapter (it only touches this platform's
   * own DB, never the supplier network), so `BaseSupplierAdapter` provides
   * one shared implementation rather than each adapter reimplementing it.
   */
  submitListingForReview(input: {
    supplierId: string;
    storeSupplierLinkId: string;
    supplierListingId: string;
  }): Promise<{ id: string }>;

  /**
   * FR-3.4/FR-4.x - forwards a placed order to the supplier for
   * fulfillment. Implemented and unit-tested now; there is no live caller
   * until Module 9 (Orders, Cart & Checkout) exists to place a real order.
   */
  forwardOrder(input: { externalProductId: string; quantity: number; orderId: string }): Promise<{
    externalOrderId: string;
  }>;

  /**
   * FR-3.4/FR-5.2 - pulls a tracking/status update for a previously
   * forwarded order. Same "implemented now, wired to a live order in
   * Module 9" note as forwardOrder().
   */
  pullTrackingUpdate(externalOrderId: string): Promise<AdapterTrackingUpdate | null>;
}
