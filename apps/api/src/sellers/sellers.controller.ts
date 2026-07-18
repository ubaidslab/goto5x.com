import { Body, Controller, Get, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthenticatedRequest } from "../common/types";
import { SellerAgreementService } from "../trust-safety/seller-agreement.service";
import { SellerIdentityService } from "../trust-safety/seller-identity.service";
import { UpdateDashboardThemeDto } from "./dto/update-dashboard-theme.dto";
import { SetCnicDto } from "./dto/set-cnic.dto";
import { SellersService } from "./sellers.service";

@Controller("sellers/me")
@UseGuards(JwtAuthGuard)
export class SellersController {
  constructor(
    private readonly sellers: SellersService,
    private readonly identity: SellerIdentityService,
    private readonly agreements: SellerAgreementService,
  ) {}

  @Get()
  getProfile(@CurrentSellerId() sellerId: string) {
    return this.sellers.getProfile(sellerId);
  }

  @Patch("dashboard-theme")
  updateDashboardTheme(@CurrentSellerId() sellerId: string, @Body() dto: UpdateDashboardThemeDto) {
    return this.sellers.updateDashboardTheme(sellerId, dto.dashboardTheme);
  }

  // SRS §5.30/FR-30.1 - CNIC can be added/changed any time after signup;
  // FR-6.14-style checkout readiness gate enforces its presence.
  @Patch("cnic")
  setCnic(@CurrentSellerId() sellerId: string, @Body() dto: SetCnicDto) {
    return this.identity.setCnic(sellerId, dto.cnic);
  }

  // SRS §5.29/FR-29.1 - lets the dashboard show "current version" + whether
  // this seller has accepted it, without needing admin access.
  @Get("agreement")
  async getAgreementStatus(@CurrentSellerId() sellerId: string) {
    const [current, accepted] = await Promise.all([
      this.agreements.getCurrentVersion(),
      this.agreements.hasAcceptedCurrentVersion(sellerId),
    ]);
    return { currentVersion: current.version, accepted };
  }

  @Post("agreement/accept")
  acceptAgreement(@CurrentSellerId() sellerId: string, @Req() req: AuthenticatedRequest) {
    return this.agreements.accept(sellerId, req.ip ?? "unknown");
  }
}
