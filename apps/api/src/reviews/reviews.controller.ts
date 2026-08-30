import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ReviewStatus } from "@prisma/client";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ModerateReviewDto } from "./dto/moderate-review.dto";
import { ReviewsService } from "./reviews.service";

/** FR-14.3 - seller's own moderation queue, tenant-scoped exactly like every other dashboard surface. */
@Controller("stores/:storeId/reviews")
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Query("status") status?: ReviewStatus) {
    return this.reviews.listForModeration(sellerId, storeId, status);
  }

  @Patch(":reviewId")
  moderate(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("reviewId") reviewId: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.reviews.moderate(sellerId, storeId, reviewId, dto.status, dto.reason);
  }
}
