import { PrintifyAdapter } from "./printify.adapter";
import { IPrintifyClient } from "./printify-client.interface";

/**
 * Unit tests using in-memory fakes for Prisma/Settings/the Printify client
 * itself (same pattern as settings.service.spec.ts) - the e2e suite
 * (test/e2e/suppliers.e2e-spec.ts) covers the real HTTP-reachable supplier
 * portal flows against a real DB; this file covers the adapter's own
 * mapping/business logic in isolation, since there is no real Printify
 * test account/credentials in this environment.
 */
describe("PrintifyAdapter", () => {
  const settingsValues: Record<string, unknown> = {
    "suppliers.printify_default_shipping_cost": 500,
    "suppliers.printify_default_delivery_min_days": 7,
    "suppliers.printify_default_delivery_max_days": 14,
    "suppliers.printify_default_supported_countries": ["PK"],
    "suppliers.printify_default_shop_id": "shop-1",
  };

  function buildAdapter(client: Partial<IPrintifyClient>, supplier: { id: string; printifyShopId: string | null }) {
    const prismaAdmin = {
      supplier: { findUniqueOrThrow: jest.fn().mockResolvedValue(supplier) },
      storeSupplierLink: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "link-1", storeId: "store-1" }) },
      listingReview: { create: jest.fn().mockResolvedValue({ id: "review-1" }) },
    };
    const settings = { resolve: jest.fn((key: string) => Promise.resolve(settingsValues[key])) };
    const adapter = new PrintifyAdapter(client as IPrintifyClient, prismaAdmin as any, settings as any);
    return { adapter, prismaAdmin, settings };
  }

  it("maps Printify's raw product shape to AdapterProduct, converting cents to currency and using enabled-variant minimum price", async () => {
    const client: Partial<IPrintifyClient> = {
      listShopProducts: jest.fn().mockResolvedValue([
        {
          id: "ext-1",
          title: "Mug",
          variants: [
            { id: 1, price: 1999, is_enabled: true },
            { id: 2, price: 999, is_enabled: true },
            { id: 3, price: 1, is_enabled: false }, // disabled variant's price must be ignored
          ],
        },
      ]),
    };
    const { adapter } = buildAdapter(client, { id: "supplier-1", printifyShopId: "shop-1" });

    const products = await adapter.listProducts("supplier-1");
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      externalProductId: "ext-1",
      title: "Mug",
      price: 9.99,
      shippingCost: 500,
      estimatedDeliveryMinDays: 7,
      estimatedDeliveryMaxDays: 14,
      supportedCountries: ["PK"],
    });
  });

  it("returns no products for a supplier with no configured Printify shop", async () => {
    const client: Partial<IPrintifyClient> = { listShopProducts: jest.fn() };
    const { adapter } = buildAdapter(client, { id: "supplier-2", printifyShopId: null });

    const products = await adapter.listProducts("supplier-2");
    expect(products).toEqual([]);
    expect(client.listShopProducts).not.toHaveBeenCalled();
  });

  it("syncStock() calls the same client method as listProducts() - Printify has no separate stock endpoint", async () => {
    const client: Partial<IPrintifyClient> = {
      listShopProducts: jest.fn().mockResolvedValue([{ id: "ext-2", title: "Tee", variants: [{ id: 1, price: 500, is_enabled: true }] }]),
    };
    const { adapter } = buildAdapter(client, { id: "supplier-1", printifyShopId: "shop-1" });

    const products = await adapter.syncStock("supplier-1");
    expect(products).toHaveLength(1);
    expect(client.listShopProducts).toHaveBeenCalledWith("shop-1");
  });

  it("forwardOrder() submits an order via the client and returns the external order id", async () => {
    const client: Partial<IPrintifyClient> = {
      submitOrder: jest.fn().mockResolvedValue({ id: "printify-order-1" }),
    };
    const { adapter } = buildAdapter(client, { id: "supplier-1", printifyShopId: "shop-1" });

    const result = await adapter.forwardOrder({ externalProductId: "ext-1", quantity: 2, orderId: "order-1" });
    expect(result).toEqual({ externalOrderId: "printify-order-1" });
    expect(client.submitOrder).toHaveBeenCalledWith("shop-1", { lineItems: [{ productId: "ext-1", quantity: 2 }] });
  });

  it("pullTrackingUpdate() returns null when the client has no order data", async () => {
    const client: Partial<IPrintifyClient> = { getOrder: jest.fn().mockResolvedValue(null) };
    const { adapter } = buildAdapter(client, { id: "supplier-1", printifyShopId: "shop-1" });

    const result = await adapter.pullTrackingUpdate("printify-order-1");
    expect(result).toBeNull();
  });

  it("pullTrackingUpdate() maps a real order status to AdapterTrackingUpdate", async () => {
    const client: Partial<IPrintifyClient> = {
      getOrder: jest.fn().mockResolvedValue({ status: "shipped", carrier: "TCS", tracking_number: "TRACK123" }),
    };
    const { adapter } = buildAdapter(client, { id: "supplier-1", printifyShopId: "shop-1" });

    const result = await adapter.pullTrackingUpdate("printify-order-1");
    expect(result).toEqual({
      externalOrderId: "printify-order-1",
      trackingNumber: "TRACK123",
      carrier: "TCS",
      status: "shipped",
    });
  });

  it("submitListingForReview() creates a listing_reviews row scoped to the given store link", async () => {
    const { adapter, prismaAdmin } = buildAdapter({}, { id: "supplier-1", printifyShopId: "shop-1" });

    const result = await adapter.submitListingForReview({
      supplierId: "supplier-1",
      storeSupplierLinkId: "link-1",
      supplierListingId: "listing-1",
    });
    expect(result).toEqual({ id: "review-1" });
    expect(prismaAdmin.listingReview.create).toHaveBeenCalledWith({
      data: { storeId: "store-1", storeSupplierLinkId: "link-1", supplierListingId: "listing-1" },
    });
  });
});
