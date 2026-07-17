import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UpdateTaxSettingsDto } from "./dto/update-tax-settings.dto";
import { TaxSettingsService } from "./tax-settings.service";

@Controller("stores/:storeId/tax-settings")
@UseGuards(JwtAuthGuard)
export class TaxSettingsController {
  constructor(private readonly taxSettings: TaxSettingsService) {}

  @Get()
  get(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.taxSettings.getForStore(sellerId, storeId);
  }

  @Patch()
  update(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: UpdateTaxSettingsDto) {
    return this.taxSettings.update(sellerId, storeId, dto);
  }
}
