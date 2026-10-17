import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { BlockStaffSessions } from "../common/decorators/block-staff-sessions.decorator";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { BlockStaffSessionsGuard } from "../common/guards/block-staff-sessions.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UpdateShippingSettingsDto } from "./dto/update-shipping-settings.dto";
import { ShippingSettingsService } from "./shipping-settings.service";

/**
 * D116 item 3 (Stage 0 IDOR/BOLA sweep) - owner-only, same as payment-
 * instructions/staff-accounts/wallet. Found with no staff-scope gate at
 * all (a staff account with ANY scope could read+write this exactly like
 * the owner) - there's no existing StaffScope value this cleanly maps to
 * (orders/catalog/discounts/customers/design/analytics/marketing/
 * reviews/suppliers - none are "store settings"), so owner-only is the
 * safe default rather than inventing a new scope's name/granularity
 * unilaterally. Revisit if the founder wants a delegable scope instead.
 */
@Controller("stores/:storeId/shipping-settings")
@UseGuards(JwtAuthGuard, BlockStaffSessionsGuard)
@BlockStaffSessions()
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
