import { Injectable, InternalServerErrorException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IPrintifyClient, PrintifyRawProduct } from "./printify-client.interface";

const PRINTIFY_API_BASE = "https://api.printify.com/v1";

/**
 * Real implementation against Printify's documented v1 API
 * (https://developers.printify.com/). **Unverified against the real live
 * API** - no Printify test account/credentials exist in this environment
 * (same disclosure as Module 2's Google Drive OAuth client) - shaped from
 * Printify's public API documentation, not confirmed end-to-end. e2e tests
 * inject a fake `IPrintifyClient` instead of exercising this class.
 */
@Injectable()
export class PrintifyHttpClient implements IPrintifyClient {
  private readonly apiKey?: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>("PRINTIFY_API_KEY");
  }

  // D126 - request() below throws a 503 instead of reaching getOrThrow();
  // exposed so PrintifyAdapter's callers could check it too, though today
  // every caller just lets request()'s own check surface the 503.
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException("Printify integration isn't configured on this platform yet.");
    }
    const res = await fetch(`${PRINTIFY_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      // Module 9 hardening: forwardOrder() (FR-3.4) runs synchronously
      // inside OrdersService.markAsPaid() - an unresponsive third-party
      // network call must never be able to hang a payment confirmation
      // indefinitely. Caught the same way any other failure here is
      // (OrdersService.forwardSupplierItems() logs and continues).
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new InternalServerErrorException(`Printify API request failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  async listShopProducts(shopId: string): Promise<PrintifyRawProduct[]> {
    const page = await this.request<{ data: PrintifyRawProduct[] }>(`/shops/${shopId}/products.json`);
    return page.data;
  }

  async submitOrder(
    shopId: string,
    input: { lineItems: { productId: string; quantity: number }[] },
  ): Promise<{ id: string }> {
    return this.request<{ id: string }>(`/shops/${shopId}/orders.json`, {
      method: "POST",
      body: JSON.stringify({
        line_items: input.lineItems.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
      }),
    });
  }

  async getOrder(
    shopId: string,
    orderId: string,
  ): Promise<{ status: string; carrier?: string; tracking_number?: string } | null> {
    return this.request(`/shops/${shopId}/orders/${orderId}.json`);
  }
}
