import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { BlockDuringImpersonation } from "../common/decorators/block-during-impersonation.decorator";
import { BlockStaffSessions } from "../common/decorators/block-staff-sessions.decorator";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { BlockStaffSessionsGuard } from "../common/guards/block-staff-sessions.guard";
import { ImpersonationWriteGuard } from "../common/guards/impersonation-write.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RequestTemplatePurchaseDto } from "./dto/request-template-purchase.dto";
import { TemplatePurchaseService } from "./template-purchase.service";

/** Premium Motion Templates - seller-facing purchase-request flow. Owner-only always, same discipline as the wallet's own top-up requests. */
@Controller("sellers/me/template-purchases")
@UseGuards(JwtAuthGuard, BlockStaffSessionsGuard)
@BlockStaffSessions()
export class TemplatePurchaseController {
  constructor(private readonly purchases: TemplatePurchaseService) {}

  @Get()
  listOwn(@CurrentSellerId() sellerId: string) {
    return this.purchases.listOwn(sellerId);
  }

  @Post()
  @UseGuards(ImpersonationWriteGuard)
  @BlockDuringImpersonation()
  requestPurchase(@CurrentSellerId() sellerId: string, @Body() dto: RequestTemplatePurchaseDto) {
    return this.purchases.requestPurchase(sellerId, dto.themeId);
  }
}
