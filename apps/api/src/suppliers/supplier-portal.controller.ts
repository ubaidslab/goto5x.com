import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentSupplierId } from "../common/decorators/current-supplier.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RequestStoreLinkDto } from "./dto/request-store-link.dto";
import { SubmitListingReviewDto } from "./dto/submit-listing-review.dto";
import { SupplierUploadTrackingDto } from "./dto/supplier-upload-tracking.dto";
import { SupplierListingsService } from "./supplier-listings.service";
import { SupplierOrdersService } from "./supplier-orders.service";
import { SupplierPortalService } from "./supplier-portal.service";

@Controller("supplier")
@UseGuards(JwtAuthGuard)
export class SupplierPortalController {
  constructor(
    private readonly supplierPortal: SupplierPortalService,
    private readonly supplierListings: SupplierListingsService,
    private readonly supplierOrders: SupplierOrdersService,
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

  /** FR-3.3 - every order item this supplier fulfills, across every connected store (Premium-gated, FR-7.10). */
  @Get("orders")
  listOwnOrderItems(@CurrentSupplierId() supplierId: string, @Query("storeId") storeId?: string) {
    return this.supplierOrders.listOwnOrderItems(supplierId, storeId);
  }

  /** FR-3.4 - "supplier uploads tracking ID; system relays it to the buyer." */
  @Post("order-items/:orderItemId/tracking")
  uploadTracking(
    @CurrentSupplierId() supplierId: string,
    @Param("orderItemId") orderItemId: string,
    @Body() dto: SupplierUploadTrackingDto,
  ) {
    return this.supplierOrders.uploadTracking(supplierId, orderItemId, dto);
  }
}
