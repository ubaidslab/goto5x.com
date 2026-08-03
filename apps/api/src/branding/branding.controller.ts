import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { BrandingService } from "./branding.service";
import { UpdateBrandingDto } from "./dto/update-branding.dto";

/** The seller's own view/control of their store's "Powered by eyosto" mark. */
@Controller("stores/:storeId/branding")
@UseGuards(JwtAuthGuard)
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
