import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ThemesService } from "./themes.service";

@Controller("themes")
@UseGuards(JwtAuthGuard)
export class ThemesController {
  constructor(private readonly themes: ThemesService) {}

  @Get()
  list(@CurrentSellerId() sellerId: string) {
    return this.themes.listSelectable(sellerId);
  }

  /** FR-24.1/24.2 - the premium-templates showcase link-out; null when not configured (v1.0 default). */
  @Get("template-store-showcase-url")
  getShowcaseUrl() {
    return this.themes.getTemplateStoreShowcaseUrl().then((url) => ({ url }));
  }
}
