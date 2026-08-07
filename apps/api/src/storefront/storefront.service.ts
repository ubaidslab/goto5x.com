import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { BrandingService } from "../branding/branding.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { resolveSeoFallback } from "./seo-fallback.util";

const UNLOCK_TOKEN_TYPE = "storefront_unlock";
const UNLOCK_TOKEN_TTL = "24h";

/**
 * Module 6 (SRS §5.27/FR-27.5) - "not_required" (trusted seller, or no rule
 * matched) and "approved" (cleared the queue) are the only two statuses a
 * buyer may ever see. "pending"/"rejected" must leak nowhere on any public
 * surface - list, detail, search, or collection contents.
 */
/** Exported for OrderPricingService (Module 9) - checkout must never let a buyer complete a purchase of a not-yet-publicly-visible product, same gate as every storefront read. */
export const PUBLIC_MODERATION_STATUSES = ["not_required", "approved"] as const;

interface UnlockTokenPayload {
  storeId: string;
  type: typeof UNLOCK_TOKEN_TYPE;
}

/**
 * Public, unauthenticated storefront read API - every method here runs
 * *before* any tenant/seller session exists (an anonymous buyer's browser
 * hitting a storefront hostname), so PrismaAdminService (BYPASSRLS) is the
 * correct tool, same reasoning as DomainsService.resolveStoreIdByHostname
 * (Module 3) - see PrismaAdminService's doc comment for the two legitimate
 * BYPASSRLS use cases.
 *
 * SRS's mobile-app-readiness NFR (v0.7): the coming-soon/password gate
 * (FR-16.5) is enforced here, not left to apps/web - a future mobile app
 * consuming this same API must see the same gate, not a web-only check.
 */
@Injectable()
export class StorefrontService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly branding: BrandingService,
    private readonly rateLimit: RateLimitService,
  ) {}

  /**
   * A verified custom domain takes precedence (FR-11.2); the free
   * `<slug>.<platform_root_domain>` subdomain is the fallback every store
   * always has. An *unverified* custom domain never resolves here - Traefik
   * itself never routes traffic for one in production (Module 3 only
   * writes its dynamic-config router entry once verified), so treating an
   * unverified domain as unresolvable here matches what would actually
   * happen end-to-end, not just this method in isolation.
   */
  async resolveStoreIdByHostname(hostname: string): Promise<string | null> {
    const normalized = hostname.trim().toLowerCase();

    const domain = await this.prismaAdmin.domain.findFirst({
      where: { domainName: normalized, verificationStatus: "verified" },
    });
    if (domain) return domain.storeId;

    const rootDomain = await this.settings.resolve<string>("domains.platform_root_domain");
    const suffix = `.${rootDomain}`;
    if (normalized.endsWith(suffix)) {
      const slug = normalized.slice(0, -suffix.length);
      const store = await this.prismaAdmin.store.findUnique({ where: { slug } });
      if (store) return store.id;
    }

    return null;
  }

  /**
   * FR-5.3 (Module 9) - a `suspended` store is temporarily unavailable, not
   * gone: distinguished from a genuinely missing/banned/archived store (both
   * still a plain 404) so the frontend can render a clear "temporarily
   * unavailable" state rather than a broken/not-found page. This blocks new
   * carts/checkouts/browsing for a suspended store; a store's *existing*
   * orders remain fully fulfillable from the seller dashboard regardless -
   * OrdersService never checks store.status. Public (not private) because
   * CartService/CheckoutService/OrderStatusLookupService (Module 9) reuse
   * this same hostname-resolution + status gate rather than duplicating it.
   */
  async loadActiveStoreOrThrow(hostname: string) {
    const storeId = await this.resolveStoreIdByHostname(hostname);
    if (!storeId) throw new NotFoundException("No store found for this hostname.");
    const store = await this.prismaAdmin.store.findUnique({
      where: { id: storeId },
      include: { themeSettings: { include: { theme: true } }, domains: true, logoMedia: true },
    });
    if (!store) throw new NotFoundException("Store not found.");
    if (store.status === "suspended") {
      throw new ForbiddenException({ code: "store_suspended", message: "This store is temporarily unavailable." });
    }
    // Module 20 (SRS §5.6e, FR-6.25) - orders_paused behaves like active for
    // browsing (catalog/product pages/cart) - only CheckoutService blocks
    // it, at the point checkout would otherwise complete. `banned`/
    // `archived` fall through to the plain 404 below, same as before.
    if (store.status !== "active" && store.status !== "orders_paused") {
      throw new NotFoundException("Store not found.");
    }
    return store;
  }

  /** Public: reused by CheckoutService (Module 9) to build the buyer order-status link (FR-5.4) against this store's real hostname. */
  async canonicalHostnameFor(store: { slug: string; domains: { domainName: string; verificationStatus: string }[] }) {
    const verified = store.domains.find((d) => d.verificationStatus === "verified");
    if (verified) return verified.domainName;
    const rootDomain = await this.settings.resolve<string>("domains.platform_root_domain");
    return `${store.slug}.${rootDomain}`;
  }

  /**
   * FR-16.5 - `coming_soon` never unlocks (no mechanism given to buyers);
   * `password_protected` unlocks with a valid token for *this* store,
   * minted by `unlock()` below. `getStorePublic` never calls this - the
   * frontend needs store name/theme regardless of access mode to render
   * the coming-soon/password page itself.
   */
  private assertAccessGranted(store: { id: string; accessMode: string }, unlockToken: string | undefined): void {
    if (store.accessMode === "public") return;
    if (store.accessMode === "coming_soon") {
      throw new ForbiddenException("This store is not open to the public yet.");
    }
    // password_protected
    if (!unlockToken || !this.verifyUnlockToken(unlockToken, store.id)) {
      throw new ForbiddenException("This store is password-protected.");
    }
  }

  private verifyUnlockToken(token: string, storeId: string): boolean {
    try {
      const payload = this.jwt.verify<UnlockTokenPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
      return payload.type === UNLOCK_TOKEN_TYPE && payload.storeId === storeId;
    } catch {
      return false;
    }
  }

  async unlock(hostname: string, password: string, ip: string): Promise<{ unlockToken: string }> {
    const store = await this.loadActiveStoreOrThrow(hostname);
    if (store.accessMode !== "password_protected" || !store.accessPasswordHash) {
      throw new ForbiddenException("This store is not password-protected.");
    }

    // Phase B pre-launch audit finding - no attempt cap beyond the generic
    // 100/min IP throttle; dual-keyed (IP + store) before the bcrypt compare.
    const unlockLimit = await this.settings.resolve<number>("storefront.unlock_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`storefront-unlock-ip:${ip}`, unlockLimit);
    await this.rateLimit.enforcePerHour(`storefront-unlock-store:${store.id}`, unlockLimit);

    if (!(await bcrypt.compare(password, store.accessPasswordHash))) {
      throw new UnauthorizedException("Incorrect password.");
    }
    const unlockToken = this.jwt.sign(
      { storeId: store.id, type: UNLOCK_TOKEN_TYPE } satisfies UnlockTokenPayload,
      { secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"), expiresIn: UNLOCK_TOKEN_TTL },
    );
    return { unlockToken };
  }

  async getStorePublic(hostname: string) {
    const store = await this.loadActiveStoreOrThrow(hostname);
    const canonicalHostname = await this.canonicalHostnameFor(store);
    const seo = resolveSeoFallback({
      seoTitle: store.seoTitle,
      seoDescription: store.seoDescription,
      fallbackName: store.name,
    });
    // Templates module (v0.31 design phase) - resolved server-side, never
    // left to the client to decide, since this is a monetization/plan-tier
    // gate (FR: mandatory on Free, removable only once a paid plan grants
    // it), not a cosmetic preference.
    const poweredByVisible = await this.branding.getVisibleForStorefront(store.id);

    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      currency: store.currency,
      accessMode: store.accessMode,
      canonicalHostname,
      seoTitle: seo.title,
      seoDescription: seo.description,
      // FR-32.5 - null when no logo is set; every consuming surface falls
      // back to its typographic mark rather than treating this as an error.
      logoUrl: store.logoMedia?.url ?? null,
      // Module 23 (SRS §5.35, FR-35.4) - reads live off `Store.verifiedStatus`
      // on every request (this whole response is `cache: "no-store"` on the
      // web app's fetch), so a revocation/expiry disappears the badge with
      // no propagation delay beyond normal page-render freshness.
      verified: store.verifiedStatus === "verified",
      poweredByVisible,
      theme: store.themeSettings
        ? {
            name: store.themeSettings.theme.name,
            settings: store.themeSettings.settings,
          }
        : null,
    };
  }

  async listProducts(hostname: string, unlockToken?: string) {
    const store = await this.loadActiveStoreOrThrow(hostname);
    this.assertAccessGranted(store, unlockToken);
    const products = await this.prismaAdmin.product.findMany({
      where: { storeId: store.id, status: "active", moderationStatus: { in: [...PUBLIC_MODERATION_STATUSES] } },
      include: { variants: true, media: true },
      orderBy: { createdAt: "desc" },
    });
    const transparencyByProductId = await this.batchSupplierTransparency(products.map((p) => p.id));
    return products.map((product) => this.toPublicProduct(product, store, transparencyByProductId.get(product.id)));
  }

  async getProduct(hostname: string, productId: string, unlockToken?: string) {
    const store = await this.loadActiveStoreOrThrow(hostname);
    this.assertAccessGranted(store, unlockToken);
    const product = await this.prismaAdmin.product.findUnique({
      where: { id: productId },
      include: { variants: true, media: true },
    });
    if (
      !product ||
      product.storeId !== store.id ||
      product.status !== "active" ||
      !(PUBLIC_MODERATION_STATUSES as readonly string[]).includes(product.moderationStatus)
    ) {
      throw new NotFoundException("Product not found.");
    }
    const transparencyByProductId = await this.batchSupplierTransparency([product.id]);
    return this.toPublicProduct(product, store, transparencyByProductId.get(product.id));
  }

  /**
   * FR-4.6 (Module 8) - shipping cost, estimated delivery, and supported
   * countries for supplier-sourced products. `products` has no direct FK to
   * `supplier_listings`; the only documented path is
   * `listing_reviews.product_id` + `.supplier_listing_id` on the same
   * (approved) row - batched here to avoid an N+1 per product.
   */
  private async batchSupplierTransparency(productIds: string[]) {
    const reviews = await this.prismaAdmin.listingReview.findMany({
      where: { productId: { in: productIds }, status: "approved" },
      include: { supplierListing: true },
    });
    return new Map(
      reviews
        .filter((r) => r.productId !== null)
        .map((r) => [
          r.productId as string,
          {
            shippingCost: r.supplierListing.shippingCost,
            estimatedDeliveryMinDays: r.supplierListing.estimatedDeliveryMinDays,
            estimatedDeliveryMaxDays: r.supplierListing.estimatedDeliveryMaxDays,
            supportedCountries: r.supplierListing.supportedCountries,
          },
        ]),
    );
  }

  /**
   * FR-16.2 - Postgres full-text search (`search_vector`, a GENERATED
   * column Prisma can't query through its normal typed API) plus price/
   * category/collection filters. Runs the filter as raw SQL to get back
   * just the matching ids (in relevance order when `q` is given), then
   * loads the full rows through the normal typed client - keeps the JSON
   * shape identical to listProducts()/getProduct() rather than hand-
   * building a second response shape.
   */
  async search(
    hostname: string,
    params: { q?: string; minPrice?: number; maxPrice?: number; categoryId?: string; collectionId?: string },
    unlockToken?: string,
  ) {
    const store = await this.loadActiveStoreOrThrow(hostname);
    this.assertAccessGranted(store, unlockToken);

    const conditions: Prisma.Sql[] = [
      Prisma.sql`p.store_id = ${store.id}::uuid`,
      Prisma.sql`p.status = 'active'`,
      Prisma.sql`p.moderation_status IN ('not_required', 'approved')`,
    ];
    if (params.q?.trim()) {
      conditions.push(Prisma.sql`p.search_vector @@ plainto_tsquery('english', ${params.q.trim()})`);
    }
    if (params.categoryId) {
      conditions.push(Prisma.sql`p.category_id = ${params.categoryId}::uuid`);
    }
    if (params.collectionId) {
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM collection_products cp WHERE cp.product_id = p.id AND cp.collection_id = ${params.collectionId}::uuid)`,
      );
    }
    if (params.minPrice !== undefined) {
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.price >= ${params.minPrice})`,
      );
    }
    if (params.maxPrice !== undefined) {
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.price <= ${params.maxPrice})`,
      );
    }

    const where = Prisma.join(conditions, " AND ");
    const rankedIds = await this.prismaAdmin.$queryRaw<{ id: string }[]>(
      params.q?.trim()
        ? Prisma.sql`SELECT p.id FROM products p WHERE ${where} ORDER BY ts_rank(p.search_vector, plainto_tsquery('english', ${params.q.trim()})) DESC, p.created_at DESC`
        : Prisma.sql`SELECT p.id FROM products p WHERE ${where} ORDER BY p.created_at DESC`,
    );
    if (rankedIds.length === 0) return [];

    const products = await this.prismaAdmin.product.findMany({
      where: { id: { in: rankedIds.map((r) => r.id) } },
      include: { variants: true, media: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const transparencyByProductId = await this.batchSupplierTransparency(products.map((p) => p.id));
    // Preserve the ranked/ordered id list from the raw query - findMany()
    // does not guarantee result order matches `id: { in: [...] }`.
    return rankedIds
      .map((r) => byId.get(r.id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((product) => this.toPublicProduct(product, store, transparencyByProductId.get(product.id)));
  }

  async listCollections(hostname: string, unlockToken?: string) {
    const store = await this.loadActiveStoreOrThrow(hostname);
    this.assertAccessGranted(store, unlockToken);
    const collections = await this.prismaAdmin.collection.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    return collections.map((collection) => this.toPublicCollection(collection, store));
  }

  async getCollection(hostname: string, collectionId: string, unlockToken?: string) {
    const store = await this.loadActiveStoreOrThrow(hostname);
    this.assertAccessGranted(store, unlockToken);
    const collection = await this.prismaAdmin.collection.findUnique({
      where: { id: collectionId },
      include: {
        products: {
          orderBy: { sortOrder: "asc" },
          include: { product: { include: { variants: true, media: true } } },
        },
      },
    });
    if (!collection || collection.storeId !== store.id || !collection.isActive) {
      throw new NotFoundException("Collection not found.");
    }
    const visibleProducts = collection.products.filter(
      (cp) =>
        cp.product.status === "active" &&
        (PUBLIC_MODERATION_STATUSES as readonly string[]).includes(cp.product.moderationStatus),
    );
    const transparencyByProductId = await this.batchSupplierTransparency(visibleProducts.map((cp) => cp.product.id));
    return {
      ...this.toPublicCollection(collection, store),
      products: visibleProducts.map((cp) =>
        this.toPublicProduct(cp.product, store, transparencyByProductId.get(cp.product.id)),
      ),
    };
  }

  async getNavigation(hostname: string) {
    const store = await this.loadActiveStoreOrThrow(hostname);
    const menus = await this.prismaAdmin.storeNavigationMenu.findMany({ where: { storeId: store.id } });
    const header = menus.find((m) => m.location === "header");
    const footer = menus.find((m) => m.location === "footer");
    return { header: header?.items ?? [], footer: footer?.items ?? [] };
  }

  /**
   * FR-16.2's category filter needs a list of categories to filter *by* -
   * scoped to this store's own active products (a useful facet list), not
   * the platform's entire global category taxonomy (Module 2's
   * `/categories`, which stays seller-authed and untouched by this module).
   */
  async listCategories(hostname: string) {
    const store = await this.loadActiveStoreOrThrow(hostname);
    const products = await this.prismaAdmin.product.findMany({
      where: {
        storeId: store.id,
        status: "active",
        categoryId: { not: null },
        moderationStatus: { in: [...PUBLIC_MODERATION_STATUSES] },
      },
      distinct: ["categoryId"],
      select: { category: { select: { id: true, name: true, slug: true } } },
    });
    return products.map((p) => p.category).filter((c): c is NonNullable<typeof c> => Boolean(c));
  }

  private toPublicCollection(
    collection: {
      id: string;
      title: string;
      slug: string;
      description: string | null;
      seoTitle: string | null;
      seoDescription: string | null;
    },
    store: { seoTitle: string | null; seoDescription: string | null },
  ) {
    const seo = resolveSeoFallback({
      seoTitle: collection.seoTitle,
      seoDescription: collection.seoDescription,
      fallbackName: collection.title,
      fallbackDescription: collection.description,
      storeDefault: { seoDescription: store.seoDescription },
    });
    return {
      id: collection.id,
      title: collection.title,
      slug: collection.slug,
      description: collection.description,
      seoTitle: seo.title,
      seoDescription: seo.description,
    };
  }

  private toPublicProduct(
    product: {
      id: string;
      title: string;
      description: string | null;
      seoTitle: string | null;
      seoDescription: string | null;
      averageRating: unknown;
      reviewCount: number;
      variants: unknown[];
      media: unknown[];
    },
    store: { seoTitle: string | null; seoDescription: string | null },
    supplierTransparency?: {
      shippingCost: unknown;
      estimatedDeliveryMinDays: number;
      estimatedDeliveryMaxDays: number;
      supportedCountries: string[];
    },
  ) {
    const seo = resolveSeoFallback({
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      fallbackName: product.title,
      fallbackDescription: product.description,
      storeDefault: { seoDescription: store.seoDescription },
    });
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      averageRating: product.averageRating,
      reviewCount: product.reviewCount,
      variants: product.variants,
      media: product.media,
      seoTitle: seo.title,
      seoDescription: seo.description,
      // FR-4.6 (Module 8) - null for self-fulfilled products.
      supplierShipping: supplierTransparency ?? null,
    };
  }
}
