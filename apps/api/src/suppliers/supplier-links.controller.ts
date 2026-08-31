import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { InviteSupplierDto } from "./dto/create-store-supplier-link.dto";
import { SupplierLinksService } from "./supplier-links.service";

/** SRS §5.52/FR-52.7-52.8 (Module 97) - a staff session needs the `suppliers` scope. */
@Controller("stores/:storeId/supplier-links")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
export class SupplierLinksController {
  constructor(private readonly supplierLinks: SupplierLinksService) {}

  @Post()
  @RequireStaffScope("suppliers")
  invite(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Body() dto: InviteSupplierDto,
  ) {
    return this.supplierLinks.invite(sellerId, storeId, dto);
  }

  @Get()
  @RequireStaffScope("suppliers", "read")
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.supplierLinks.list(sellerId, storeId);
  }

  /** Module 96 (SRS §5.4/FR-4.12) - the Suppliers page's mini-dashboard summary strip. */
  @Get("dashboard")
  @RequireStaffScope("suppliers", "read")
  dashboard(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.supplierLinks.dashboard(sellerId, storeId);
  }

  @Patch(":linkId/approve")
  @RequireStaffScope("suppliers")
  approve(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("linkId") linkId: string,
  ) {
    return this.supplierLinks.approve(sellerId, storeId, linkId);
  }

  @Patch(":linkId/revoke")
  @RequireStaffScope("suppliers")
  revoke(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("linkId") linkId: string,
  ) {
    return this.supplierLinks.revoke(sellerId, storeId, linkId);
  }
}
