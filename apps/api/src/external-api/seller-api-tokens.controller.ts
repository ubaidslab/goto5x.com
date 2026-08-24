import { Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { SellerApiTokensService } from "./seller-api-tokens.service";

/** FR-24.8/24.10 - the dashboard's "Marketing" section: connect/revoke the Social Media SaaS's Product Feed access. */
@Controller("sellers/me/api-tokens")
@UseGuards(JwtAuthGuard)
export class SellerApiTokensController {
  constructor(private readonly tokens: SellerApiTokensService) {}

  @Get()
  list(@CurrentSellerId() sellerId: string) {
    return this.tokens.list(sellerId);
  }

  /** Phase 4 close-out - lets the Marketing hub's FB/IG Shop feed tab render a real locked-vs-unlocked state. */
  @Get("social-media-feed-status")
  getSocialMediaFeedStatus(@CurrentSellerId() sellerId: string) {
    return this.tokens.getSocialMediaFeedStatus(sellerId);
  }

  @Post()
  create(@CurrentSellerId() sellerId: string) {
    return this.tokens.create(sellerId);
  }

  @Delete(":id")
  revoke(@CurrentSellerId() sellerId: string, @Param("id") id: string) {
    return this.tokens.revoke(sellerId, id);
  }
}
