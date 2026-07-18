import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UpdateDashboardThemeDto } from "./dto/update-dashboard-theme.dto";
import { SellersService } from "./sellers.service";

@Controller("sellers/me")
@UseGuards(JwtAuthGuard)
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  @Get()
  getProfile(@CurrentSellerId() sellerId: string) {
    return this.sellers.getProfile(sellerId);
  }

  @Patch("dashboard-theme")
  updateDashboardTheme(@CurrentSellerId() sellerId: string, @Body() dto: UpdateDashboardThemeDto) {
    return this.sellers.updateDashboardTheme(sellerId, dto.dashboardTheme);
  }
}
