import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { hashToken } from "../auth/token.util";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { SettingsService } from "../settings-registry/settings.service";
import { StorefrontService } from "../storefront/storefront.service";

/**
 * FR-24.9-24.11 - a seller-scoped, revocable bearer token IS the
 * authentication here (FR-24.10), unlike the Template Install/License API
 * (FR-24.6), which needs a client-level HMAC signature because it has no
 * pre-existing per-seller credential to check - a second signature layer on
 * top of an already-unguessable, single-purpose, individually-revocable
 * token would be redundant complexity, not additional security (§6.5 is
 * satisfied by the token itself being the "authenticated request").
 *
 * Exposes only fields already public on the seller's own storefront (FR-24.9)
 * - title, price, images, storefront URL - nothing a buyer couldn't already see.
 */
@Injectable()
export class ProductFeedService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly storefront: StorefrontService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /** Shared by both feed endpoints - resolves and validates the bearer token exactly once. */
  private async resolveToken(bearerToken: string | undefined) {
    if (!bearerToken) throw new UnauthorizedException("Missing bearer token.");
    const tokenHash = hashToken(bearerToken);

    // Resolving *which* seller a presented token belongs to necessarily
    // precedes any tenant session existing to scope a query by - same
    // BYPASSRLS reasoning as every other public/pre-tenant-context lookup
    // in this codebase (StorefrontService.resolveStoreIdByHostname).
    const tokenRow = await this.prismaAdmin.sellerApiToken.findUnique({
      where: { tokenHash },
      include: { client: true },
    });
    if (!tokenRow || tokenRow.revokedAt) {
      throw new UnauthorizedException("Invalid or revoked token.");
    }
    // FR-8.14 - disabling the client immediately rejects every token issued under it.
    if (!tokenRow.client.isEnabled) {
      throw new UnauthorizedException("This integration has been disabled.");
    }
    return tokenRow;
  }

  async getFeed(bearerToken: string | undefined) {
    const tokenRow = await this.resolveToken(bearerToken);

    const limit = await this.settings.resolve<number>("external_api.product_feed_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`product-feed:${tokenRow.id}`, limit);

    // RLS does the tenant-isolation work here: no storeId filter is ever
    // written by hand - `tenantPrisma.run(sellerId, ...)` sets the session
    // variable every `stores`-scoped table's policy already keys off, so
    // this can only ever return rows for stores this seller owns (FR-24.11).
    const [products, stores] = await this.tenantPrisma.run(tokenRow.sellerId, async (tx) => {
      const productRows = await tx.product.findMany({
        where: { status: "active" },
        include: { variants: { take: 1, orderBy: { price: "asc" } }, media: { take: 1, orderBy: { sortOrder: "asc" } } },
      });
      const storeRows = await tx.store.findMany({ include: { domains: true } });
      return [productRows, storeRows];
    });

    const storesById = new Map(stores.map((s) => [s.id, s]));
    const feed = [];
    for (const product of products) {
      const store = storesById.get(product.storeId);
      if (!store) continue;
      const hostname = await this.storefront.canonicalHostnameFor(store);
      feed.push({
        productId: product.id,
        title: product.title,
        price: product.variants[0]?.price ?? null,
        imageUrl: product.media[0]?.url ?? null,
        storefrontUrl: `https://${hostname}/products/${product.id}`,
      });
    }
    return feed;
  }

  /**
   * FR-55.1-55.3 (Module 48) - a new endpoint alongside `getFeed()` above,
   * not a reshape of it (that one already serves a different, founder-owned
   * Social Media SaaS product with its own consumer). Same bearer-token
   * auth and RLS tenant-isolation (FR-55.3), plus a Growth+ plan gate
   * (FR-55.2) neither needs, and the extra Meta-Commerce-Catalog-required
   * fields: `id` (Meta's own field name for what the sibling feed calls
   * `productId`), `availability`/`condition` (derived - this schema has no
   * dedicated columns for either, since nothing else needed them yet),
   * `description`, `brand` (the store name - there is no separate
   * manufacturer-brand field on `Product`), and `currency` (the existing
   * feed leaves it implicit/PKR; Meta requires it explicit per item).
   */
  async getMetaCatalogFeed(bearerToken: string | undefined) {
    const tokenRow = await this.resolveToken(bearerToken);

    const planContext = await this.subscriptions.getPlanContext(tokenRow.sellerId);
    const enabled = await this.settings.resolve<boolean>("social_media.meta_catalog_feed_enabled", planContext);
    if (!enabled) {
      throw new ForbiddenException("The Meta Commerce Catalog feed is a Growth-plan feature - upgrade your plan to use it.");
    }

    const limit = await this.settings.resolve<number>("external_api.meta_catalog_feed_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`meta-catalog-feed:${tokenRow.id}`, limit);

    const [products, stores] = await this.tenantPrisma.run(tokenRow.sellerId, async (tx) => {
      const productRows = await tx.product.findMany({
        where: { status: "active" },
        include: { variants: { take: 1, orderBy: { price: "asc" } }, media: { take: 1, orderBy: { sortOrder: "asc" } } },
      });
      const storeRows = await tx.store.findMany({ include: { domains: true } });
      return [productRows, storeRows];
    });

    const storesById = new Map(stores.map((s) => [s.id, s]));
    const feed = [];
    for (const product of products) {
      const store = storesById.get(product.storeId);
      if (!store) continue;
      const hostname = await this.storefront.canonicalHostnameFor(store);
      const variant = product.variants[0];
      const inStock = variant ? variant.trackInventory === false || variant.stockQuantity > 0 : false;
      feed.push({
        id: product.id,
        title: product.title,
        description: product.description ?? product.title,
        availability: inStock ? "in stock" : "out of stock",
        condition: "new",
        price: variant?.price ?? null,
        currency: store.currency,
        brand: store.name,
        imageUrl: product.media[0]?.url ?? null,
        storefrontUrl: `https://${hostname}/products/${product.id}`,
      });
    }
    return feed;
  }
}
