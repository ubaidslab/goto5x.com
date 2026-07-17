import { BadRequestException, Controller, Get, Param, Query } from "@nestjs/common";
import { StorefrontService } from "./storefront.service";

/**
 * Public, unauthenticated - no JwtAuthGuard anywhere in this controller.
 * `hostname` is passed explicitly rather than read off this request's own
 * `Host` header because the API and the storefront are different
 * hostnames in production (e.g. `api.goto5x.com` vs a seller's own
 * `mystore.goto5x.com`/custom domain) - the caller (apps/web, itself
 * rendering under the storefront's real hostname) is the one place that
 * actually knows what hostname the buyer's browser is on.
 */
@Controller("storefront")
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  @Get("store")
  getStore(@Query("hostname") hostname: string) {
    this.assertHostname(hostname);
    return this.storefront.getStorePublic(hostname);
  }

  @Get("products")
  listProducts(@Query("hostname") hostname: string) {
    this.assertHostname(hostname);
    return this.storefront.listProducts(hostname);
  }

  @Get("products/:productId")
  getProduct(@Query("hostname") hostname: string, @Param("productId") productId: string) {
    this.assertHostname(hostname);
    return this.storefront.getProduct(hostname, productId);
  }

  private assertHostname(hostname: string | undefined): asserts hostname is string {
    if (!hostname || !hostname.trim()) {
      throw new BadRequestException("A `hostname` query parameter is required.");
    }
  }
}
