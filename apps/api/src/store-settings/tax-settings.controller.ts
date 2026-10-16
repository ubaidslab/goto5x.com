import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { BlockStaffSessions } from "../common/decorators/block-staff-sessions.decorator";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { BlockStaffSessionsGuard } from "../common/guards/block-staff-sessions.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UpdateTaxSettingsDto } from "./dto/update-tax-settings.dto";
import { TaxSettingsService } from "./tax-settings.service";

/** D116 item 3 (Stage 0 IDOR/BOLA sweep) - owner-only; see shipping-settings.controller.ts's own comment for the full finding (same gap, same fix, no existing StaffScope fits). */
@Controller("stores/:storeId/tax-settings")
@UseGuards(JwtAuthGuard, BlockStaffSessionsGuard)
@BlockStaffSessions()
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
