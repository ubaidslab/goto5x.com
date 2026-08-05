import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { JwtAccessPayload } from "../common/types";
import { BrandingService } from "./branding.service";
import { UpdateBrandingDto } from "./dto/update-branding.dto";

/**
 * The seller's own view/control of their store's "Powered by eyosto" mark.
 * A staff session needs the `design` scope to reach this - storefront
 * branding is part of store design (SRS §5.52/FR-52.2).
 */
@Controller("stores/:storeId/branding")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
@RequireStaffScope("design")
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Get()
  get(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.branding.getForStore(sellerId, storeId);
  }

  @Patch()
  update(
    @CurrentSellerId() sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.branding.setHiddenForStore(sellerId, storeId, user.sub, dto.hidden);
  }
}
