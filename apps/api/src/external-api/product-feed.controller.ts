import { Controller, Get, Headers } from "@nestjs/common";
import { ProductFeedService } from "./product-feed.service";

function bearerFrom(authorization: string | undefined): string | undefined {
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;
}

/** FR-24.9 - public, but never unauthenticated: every call requires a valid, unrevoked seller-scoped bearer token. */
@Controller("external/social-media")
export class ProductFeedController {
  constructor(private readonly productFeed: ProductFeedService) {}

  @Get("product-feed")
  getFeed(@Headers("authorization") authorization: string | undefined) {
    return this.productFeed.getFeed(bearerFrom(authorization));
  }

  /** FR-55.1-55.3 (Module 48) - a new endpoint alongside product-feed above, not a breaking reshape of it. */
  @Get("meta-catalog-feed")
  getMetaCatalogFeed(@Headers("authorization") authorization: string | undefined) {
    return this.productFeed.getMetaCatalogFeed(bearerFrom(authorization));
  }
}
