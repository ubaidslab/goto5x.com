import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ReviewStatus } from "@prisma/client";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { ModerateReviewDto } from "./dto/moderate-review.dto";
import { ReviewsService } from "./reviews.service";

/**
 * FR-14.3 - seller's own moderation queue, tenant-scoped exactly like
 * every other dashboard surface. SRS §5.52/FR-52.7-52.8 (Module 97) - a
 * staff session needs the `reviews` scope, `write` to moderate.
 */
@Controller("stores/:storeId/reviews")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @RequireStaffScope("reviews", "read")
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Query("status") status?: ReviewStatus) {
    return this.reviews.listForModeration(sellerId, storeId, status);
  }

  @Patch(":reviewId")
  @RequireStaffScope("reviews")
  moderate(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("reviewId") reviewId: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.reviews.moderate(sellerId, storeId, reviewId, dto.status, dto.reason);
  }
}
