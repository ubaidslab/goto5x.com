import { Controller, Get, Headers } from "@nestjs/common";
import { ProductFeedService } from "./product-feed.service";

/** FR-24.9 - public, but never unauthenticated: every call requires a valid, unrevoked seller-scoped bearer token. */
@Controller("external/social-media/product-feed")
export class ProductFeedController {
  constructor(private readonly productFeed: ProductFeedService) {}

  @Get()
  getFeed(@Headers("authorization") authorization: string | undefined) {
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;
    return this.productFeed.getFeed(token);
  }
}
