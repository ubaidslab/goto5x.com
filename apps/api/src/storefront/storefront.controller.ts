import { BadRequestException, Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { StorefrontService } from "./storefront.service";

/**
 * Public, unauthenticated - no JwtAuthGuard anywhere in this controller.
 * `hostname` is passed explicitly rather than read off this request's own
 * `Host` header because the API and the storefront are different
 * hostnames in production (e.g. `api.uzeyn.com` vs a seller's own
 * `mystore.uzeyn.com`/custom domain) - the caller (apps/web, itself
 * rendering under the storefront's real hostname) is the one place that
 * actually knows what hostname the buyer's browser is on.
 *
 * `unlockToken` (query param, optional) is the password-gate credential
 * (FR-16.5) - minted by POST /storefront/unlock, sent back on every
 * subsequent request while the store is in password_protected mode.
 */
@Controller("storefront")
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  @Get("store")
  getStore(@Query("hostname") hostname: string) {
    this.assertHostname(hostname);
    return this.storefront.getStorePublic(hostname);
  }

  @Post("unlock")
  unlock(@Body("hostname") hostname: string, @Body("password") password: string) {
    this.assertHostname(hostname);
    if (!password) throw new BadRequestException("A `password` is required.");
    return this.storefront.unlock(hostname, password);
  }

  @Get("products")
  listProducts(@Query("hostname") hostname: string, @Query("unlockToken") unlockToken?: string) {
    this.assertHostname(hostname);
    return this.storefront.listProducts(hostname, unlockToken);
  }

  @Get("products/:productId")
  getProduct(
    @Query("hostname") hostname: string,
    @Param("productId") productId: string,
    @Query("unlockToken") unlockToken?: string,
  ) {
    this.assertHostname(hostname);
    return this.storefront.getProduct(hostname, productId, unlockToken);
  }

  @Get("search")
  search(
    @Query("hostname") hostname: string,
    @Query("q") q?: string,
    @Query("minPrice") minPrice?: string,
    @Query("maxPrice") maxPrice?: string,
    @Query("categoryId") categoryId?: string,
    @Query("collectionId") collectionId?: string,
    @Query("unlockToken") unlockToken?: string,
  ) {
    this.assertHostname(hostname);
    return this.storefront.search(
      hostname,
      {
        q,
        minPrice: minPrice !== undefined ? Number(minPrice) : undefined,
        maxPrice: maxPrice !== undefined ? Number(maxPrice) : undefined,
        categoryId,
        collectionId,
      },
      unlockToken,
    );
  }

  @Get("collections")
  listCollections(@Query("hostname") hostname: string, @Query("unlockToken") unlockToken?: string) {
    this.assertHostname(hostname);
    return this.storefront.listCollections(hostname, unlockToken);
  }

  @Get("collections/:collectionId")
  getCollection(
    @Query("hostname") hostname: string,
    @Param("collectionId") collectionId: string,
    @Query("unlockToken") unlockToken?: string,
  ) {
    this.assertHostname(hostname);
    return this.storefront.getCollection(hostname, collectionId, unlockToken);
  }

  @Get("navigation")
  getNavigation(@Query("hostname") hostname: string) {
    this.assertHostname(hostname);
    return this.storefront.getNavigation(hostname);
  }

  @Get("categories")
  listCategories(@Query("hostname") hostname: string) {
    this.assertHostname(hostname);
    return this.storefront.listCategories(hostname);
  }

  private assertHostname(hostname: string | undefined): asserts hostname is string {
    if (!hostname || !hostname.trim()) {
      throw new BadRequestException("A `hostname` query parameter is required.");
    }
  }
}
