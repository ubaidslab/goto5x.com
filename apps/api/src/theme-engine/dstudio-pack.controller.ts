import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { BlockDuringImpersonation } from "../common/decorators/block-during-impersonation.decorator";
import { BlockStaffSessions } from "../common/decorators/block-staff-sessions.decorator";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { BlockStaffSessionsGuard } from "../common/guards/block-staff-sessions.guard";
import { ImpersonationWriteGuard } from "../common/guards/impersonation-write.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { DstudioPackService } from "./dstudio-pack.service";
import { RequestDstudioPackPurchaseDto } from "./dto/request-dstudio-pack-purchase.dto";

/** FR-8.21 (Module 100) - D-Studio Pack, seller-facing purchase-request flow. Owner-only always, same discipline as template-purchases/wallet top-ups. */
@Controller("sellers/me/dstudio-pack-purchases")
@UseGuards(JwtAuthGuard, BlockStaffSessionsGuard)
@BlockStaffSessions()
export class DstudioPackController {
  constructor(private readonly packs: DstudioPackService) {}

  @Get()
  listOwn(@CurrentSellerId() sellerId: string) {
    return this.packs.listOwn(sellerId);
  }

  @Post()
  @UseGuards(ImpersonationWriteGuard)
  @BlockDuringImpersonation()
  requestPurchase(@CurrentSellerId() sellerId: string, @Body() dto: RequestDstudioPackPurchaseDto) {
    return this.packs.requestPurchase(sellerId, dto.reference);
  }
}
