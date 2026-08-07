import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { PUBLIC_MODERATION_STATUSES } from "../storefront/storefront.service";

export interface PricedItem {
  productId: string;
  variantId: string;
  quantity: number;
  title: string;
  /** Always the live price at the moment of pricing (FR-4.8) - never a cached/stale value. */
  unitPrice: number;
  /** Per-unit shipping cost for a supplier item; 0 for a self-fulfilled item (priced at the order level instead). */
  shippingCost: number;
  supplierId: string | null;
  supplierListingId: string | null;
  supportedCountries: string[] | null;
  /** Module 46 (FR-39.5) - null for a supplier-fulfilled item (checkout's oversell check for those runs on the supplier listing's own stock instead, see CheckoutService.reserveSupplierStock). */
  trackInventory: boolean | null;
}

/**
 * Shared by CartService (buyer-facing cart display) and CheckoutService
 * (order placement, both storefront and manual) so both read prices/
 * supplier-transparency data through the exact same lookup - a cart preview
 * and the order it converts to must never disagree.
 *
 * Pre-auth/cross-store by nature (an anonymous buyer's cart, or a seller
 * building an order for their own store) - uses PrismaAdminService
 * (BYPASSRLS) and filters explicitly on `storeId`, same reasoning as
 * StorefrontService (see PrismaAdminService's second documented legitimate
 * use).
 */
@Injectable()
export class OrderPricingService {
  constructor(private readonly prismaAdmin: PrismaAdminService) {}

  async priceItems(
    storeId: string,
    items: { productId: string; variantId: string; quantity: number }[],
  ): Promise<PricedItem[]> {
    const productIds = [...new Set(items.map((i) => i.productId))];
    const variantIds = [...new Set(items.map((i) => i.variantId))];

    const [products, variants, approvedReviews] = await Promise.all([
      this.prismaAdmin.product.findMany({
        where: { id: { in: productIds }, storeId, status: "active", moderationStatus: { in: [...PUBLIC_MODERATION_STATUSES] } },
      }),
      this.prismaAdmin.productVariant.findMany({ where: { id: { in: variantIds } } }),
      // FR-4.6/4.7/4.8 - the same product -> approved-listing-review join
      // StorefrontService.batchSupplierTransparency() uses, extended with
      // price/stock fields checkout needs that transparency display doesn't.
      this.prismaAdmin.listingReview.findMany({
        where: { productId: { in: productIds }, status: "approved" },
        include: { supplierListing: true },
      }),
    ]);

    const productById = new Map(products.map((p) => [p.id, p]));
    const variantById = new Map(variants.map((v) => [v.id, v]));
    const supplierListingByProductId = new Map(
      approvedReviews.filter((r) => r.productId !== null).map((r) => [r.productId as string, r.supplierListing]),
    );

    return items.map((item) => {
      const product = productById.get(item.productId);
      const variant = variantById.get(item.variantId);
      if (!product || !variant || variant.productId !== item.productId || variant.storeId !== storeId) {
        throw new NotFoundException(`Product or variant not found in this store: ${item.productId}/${item.variantId}`);
      }
      const supplierListing = supplierListingByProductId.get(item.productId);
      return {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        title: product.title,
        unitPrice: supplierListing ? Number(supplierListing.price) : Number(variant.price),
        shippingCost: supplierListing ? Number(supplierListing.shippingCost) : 0,
        supplierId: supplierListing?.supplierId ?? null,
        supplierListingId: supplierListing?.id ?? null,
        supportedCountries: supplierListing?.supportedCountries ?? null,
        trackInventory: supplierListing ? null : variant.trackInventory,
      };
    });
  }
}
