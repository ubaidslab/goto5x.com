import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { JwtAccessPayload } from "../common/types";
import { ListingReviewsService } from "./listing-reviews.service";

/** SRS §5.52/FR-52.7-52.8 (Module 97) - a supplier's submitted listing is part of the supplier relationship, gated under `suppliers` (not the customer-review `reviews` scope). */
@Controller("stores/:storeId/listing-reviews")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
export class ListingReviewsController {
  constructor(private readonly listingReviews: ListingReviewsService) {}

  @Get()
  @RequireStaffScope("suppliers", "read")
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.listingReviews.list(sellerId, storeId);
  }

  @Patch(":reviewId/approve")
  @RequireStaffScope("suppliers")
  approve(
    @CurrentSellerId() sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @Param("reviewId") reviewId: string,
  ) {
    return this.listingReviews.approve(sellerId, storeId, reviewId, user.sub);
  }

  @Patch(":reviewId/reject")
  @RequireStaffScope("suppliers")
  reject(
    @CurrentSellerId() sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @Param("reviewId") reviewId: string,
  ) {
    return this.listingReviews.reject(sellerId, storeId, reviewId, user.sub);
  }
}
