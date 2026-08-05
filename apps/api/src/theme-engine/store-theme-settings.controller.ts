import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { UpdateStoreThemeSettingsDto } from "./dto/update-store-theme-settings.dto";
import { StoreThemeSettingsService } from "./store-theme-settings.service";

/** A staff session needs the `design` scope to reach any route here (SRS §5.52/FR-52.2). */
@Controller("stores/:storeId/theme-settings")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
@RequireStaffScope("design")
export class StoreThemeSettingsController {
  constructor(private readonly themeSettings: StoreThemeSettingsService) {}

  @Get()
  get(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.themeSettings.getForStore(sellerId, storeId);
  }

  @Patch()
  update(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Body() dto: UpdateStoreThemeSettingsDto,
  ) {
    return this.themeSettings.update(sellerId, storeId, dto);
  }
}
