import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UpdateStoreThemeSettingsDto } from "./dto/update-store-theme-settings.dto";
import { StoreThemeSettingsService } from "./store-theme-settings.service";

@Controller("stores/:storeId/theme-settings")
@UseGuards(JwtAuthGuard)
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
