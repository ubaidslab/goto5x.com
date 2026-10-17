/**
 * Thin wrapper over Printify's real v1 REST API surface
 * (https://developers.printify.com/) - kept behind an interface so
 * `PrintifyAdapter` never talks to `fetch()`/HTTP directly, and so e2e
 * tests can inject a fake client for the one call that would otherwise
 * need Printify's real network (same pattern as `IDriveClient`, Module 2).
 */
export interface PrintifyRawProduct {
  id: string;
  title: string;
  variants: { id: number; price: number; is_enabled: boolean }[];
}

export const PRINTIFY_CLIENT = Symbol("PRINTIFY_CLIENT");

export interface IPrintifyClient {
  /** D126 - true only when PRINTIFY_API_KEY is set; every other method assumes this was already checked by the caller. */
  isConfigured(): boolean;
  /** GET /v1/shops/{shop_id}/products.json */
  listShopProducts(shopId: string): Promise<PrintifyRawProduct[]>;
  /** POST /v1/shops/{shop_id}/orders.json */
  submitOrder(shopId: string, input: { lineItems: { productId: string; quantity: number }[] }): Promise<{
    id: string;
  }>;
  /** GET /v1/shops/{shop_id}/orders/{order_id}.json */
  getOrder(shopId: string, orderId: string): Promise<{ status: string; carrier?: string; tracking_number?: string } | null>;
}
