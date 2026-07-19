import { Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { MarketingHandoffService } from "./marketing-handoff.service";

/** FR-24.8 - the "Marketing" dashboard section's entry point: mints the SSO handoff URL. */
@Controller("sellers/me/marketing-handoff")
@UseGuards(JwtAuthGuard)
export class MarketingHandoffController {
  constructor(private readonly handoff: MarketingHandoffService) {}

  @Post()
  create(@CurrentSellerId() sellerId: string) {
    return this.handoff.createHandoffUrl(sellerId);
  }
}
