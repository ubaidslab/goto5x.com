import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UpdateShippingSettingsDto } from "./dto/update-shipping-settings.dto";
import { ShippingSettingsService } from "./shipping-settings.service";

@Controller("stores/:storeId/shipping-settings")
@UseGuards(JwtAuthGuard)
export class ShippingSettingsController {
  constructor(private readonly shippingSettings: ShippingSettingsService) {}

  @Get()
  get(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.shippingSettings.getForStore(sellerId, storeId);
  }

  @Patch()
  update(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Body() dto: UpdateShippingSettingsDto,
  ) {
    return this.shippingSettings.update(sellerId, storeId, dto);
  }
}
