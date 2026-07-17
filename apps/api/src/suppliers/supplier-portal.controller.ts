import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentSupplierId } from "../common/decorators/current-supplier.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RequestStoreLinkDto } from "./dto/request-store-link.dto";
import { SubmitListingReviewDto } from "./dto/submit-listing-review.dto";
import { SupplierListingsService } from "./supplier-listings.service";
import { SupplierPortalService } from "./supplier-portal.service";

@Controller("supplier")
@UseGuards(JwtAuthGuard)
export class SupplierPortalController {
  constructor(
    private readonly supplierPortal: SupplierPortalService,
    private readonly supplierListings: SupplierListingsService,
  ) {}

  @Post("store-links")
  requestLink(@CurrentSupplierId() supplierId: string, @Body() dto: RequestStoreLinkDto) {
    return this.supplierPortal.requestLink(supplierId, dto);
  }

  /** FR-3.3 - every store this supplier is linked to, scoped strictly to their own links. */
  @Get("store-links")
  listOwnLinks(@CurrentSupplierId() supplierId: string) {
    return this.supplierPortal.listOwnLinks(supplierId);
  }

  @Get("listings")
  listOwnListings(@CurrentSupplierId() supplierId: string) {
    return this.supplierListings.listOwn(supplierId);
  }

  @Get("listings/:listingId")
  getOwnListing(@CurrentSupplierId() supplierId: string, @Param("listingId") listingId: string) {
    return this.supplierListings.getOwn(supplierId, listingId);
  }

  @Post("listings/submit-review")
  submitForReview(@CurrentSupplierId() supplierId: string, @Body() dto: SubmitListingReviewDto) {
    return this.supplierPortal.submitForReview(supplierId, dto);
  }
}
