import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { ListingReviewsService } from "./listing-reviews.service";

@Controller("stores/:storeId/listing-reviews")
@UseGuards(JwtAuthGuard)
export class ListingReviewsController {
  constructor(private readonly listingReviews: ListingReviewsService) {}

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.listingReviews.list(sellerId, storeId);
  }

  @Patch(":reviewId/approve")
  approve(
    @CurrentSellerId() sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @Param("reviewId") reviewId: string,
  ) {
    return this.listingReviews.approve(sellerId, storeId, reviewId, user.sub);
  }

  @Patch(":reviewId/reject")
  reject(
    @CurrentSellerId() sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @Param("reviewId") reviewId: string,
  ) {
    return this.listingReviews.reject(sellerId, storeId, reviewId, user.sub);
  }
}
