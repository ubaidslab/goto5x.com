import { Inject, Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../../prisma/prisma-admin.service";
import { SettingsService } from "../../settings-registry/settings.service";
import {
  AdapterProduct,
  AdapterTrackingUpdate,
  SupplierAdapter,
} from "../supplier-adapter.interface";
import { IPrintifyClient, PRINTIFY_CLIENT, PrintifyRawProduct } from "./printify-client.interface";

/**
 * v1.0's only Supplier Adapter implementation (FR-4.1) - chosen first for
 * its documented API and print-on-demand model, which needs no separate
 * stock-sync complexity (no real finite stock to track, unlike CJ
 * Dropshipping, Phase 1.1, FR-4.2).
 *
 * Printify's product API doesn't expose shipping cost / delivery estimate /
 * supported countries per product (that lives behind separate shipping/
 * print-provider endpoints) - v1.0 uses configured platform-wide defaults
 * for these (Settings Registry, `suppliers.printify_default_*`) rather than
 * a second, more complex API integration. Disclosed simplification, not a
 * silent gap - see docs/build-plan.md's Module 8 section.
 */
@Injectable()
export class PrintifyAdapter implements SupplierAdapter {
  readonly adapterType = "printify";

  constructor(
    @Inject(PRINTIFY_CLIENT) private readonly client: IPrintifyClient,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
  ) {}

  private async toAdapterProduct(raw: PrintifyRawProduct): Promise<AdapterProduct> {
    const [shippingCost, minDays, maxDays, countries] = await Promise.all([
      this.settings.resolve<number>("suppliers.printify_default_shipping_cost"),
      this.settings.resolve<number>("suppliers.printify_default_delivery_min_days"),
      this.settings.resolve<number>("suppliers.printify_default_delivery_max_days"),
      this.settings.resolve<string[]>("suppliers.printify_default_supported_countries"),
    ]);
    const enabledPrices = raw.variants.filter((v) => v.is_enabled).map((v) => v.price);
    // Printify variant prices are in cents (per their documented API shape).
    const priceCents = enabledPrices.length > 0 ? Math.min(...enabledPrices) : 0;

    return {
      externalProductId: raw.id,
      title: raw.title,
      price: priceCents / 100,
      shippingCost,
      estimatedDeliveryMinDays: minDays,
      estimatedDeliveryMaxDays: maxDays,
      supportedCountries: countries,
      rawPayload: raw as unknown as Record<string, unknown>,
    };
  }

  async listProducts(supplierId: string): Promise<AdapterProduct[]> {
    const supplier = await this.prismaAdmin.supplier.findUniqueOrThrow({ where: { id: supplierId } });
    if (!supplier.printifyShopId) return [];
    const raw = await this.client.listShopProducts(supplier.printifyShopId);
    return Promise.all(raw.map((product) => this.toAdapterProduct(product)));
  }

  /** Printify is print-on-demand - no separate stock endpoint, same call as listProducts(). */
  async syncStock(supplierId: string): Promise<AdapterProduct[]> {
    return this.listProducts(supplierId);
  }

  async submitListingForReview(input: {
    supplierId: string;
    storeSupplierLinkId: string;
    supplierListingId: string;
  }): Promise<{ id: string }> {
    // Generic across every adapter (only touches this platform's own DB,
    // never Printify's network) - see supplier-adapter.interface.ts's note.
    const link = await this.prismaAdmin.storeSupplierLink.findUniqueOrThrow({
      where: { id: input.storeSupplierLinkId },
    });
    const review = await this.prismaAdmin.listingReview.create({
      data: {
        storeId: link.storeId,
        storeSupplierLinkId: input.storeSupplierLinkId,
        supplierListingId: input.supplierListingId,
      },
    });
    return { id: review.id };
  }

  /**
   * FR-3.4/FR-4.x - implemented and unit-tested now; no live caller until
   * Module 9 (Orders, Cart & Checkout) can place a real order to forward.
   */
  async forwardOrder(input: {
    externalProductId: string;
    quantity: number;
    orderId: string;
  }): Promise<{ externalOrderId: string }> {
    // Module 9 will supply the real shop id alongside a real order - using
    // the platform default here is a placeholder for that future call site.
    const shopId = await this.settings.resolve<string>("suppliers.printify_default_shop_id");
    const result = await this.client.submitOrder(shopId, {
      lineItems: [{ productId: input.externalProductId, quantity: input.quantity }],
    });
    return { externalOrderId: result.id };
  }

  async pullTrackingUpdate(externalOrderId: string): Promise<AdapterTrackingUpdate | null> {
    const shopId = await this.settings.resolve<string>("suppliers.printify_default_shop_id");
    const order = await this.client.getOrder(shopId, externalOrderId);
    if (!order) return null;
    return {
      externalOrderId,
      trackingNumber: order.tracking_number ?? "",
      carrier: order.carrier,
      status: order.status,
    };
  }
}
