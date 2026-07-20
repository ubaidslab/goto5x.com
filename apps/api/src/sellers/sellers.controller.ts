import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SkipAgreementCheck } from "../common/decorators/skip-agreement-check.decorator";
import { AuthenticatedRequest, JwtAccessPayload } from "../common/types";
import { AdminImpersonationService } from "../impersonation/impersonation.service";
import { AuthService } from "../auth/auth.service";
import { SessionService } from "../auth/session.service";
import { SellerAgreementGuard } from "../trust-safety/seller-agreement.guard";
import { SellerAgreementService } from "../trust-safety/seller-agreement.service";
import { SellerIdentityService } from "../trust-safety/seller-identity.service";
import { MfaVerifyCodeDto } from "./dto/mfa-verify-code.dto";
import { UpdateDashboardThemeDto } from "./dto/update-dashboard-theme.dto";
import { SetCnicDto } from "./dto/set-cnic.dto";
import { SellersService } from "./sellers.service";

// SRS §5.29/FR-29.1 - SellerAgreementGuard subsumes JwtAuthGuard's own
// verification (it extends AuthGuard("jwt") itself) and additionally
// blocks a seller who hasn't re-accepted a newly-published agreement
// version, except the two routes marked @SkipAgreementCheck() below.
@Controller("sellers/me")
@UseGuards(SellerAgreementGuard)
export class SellersController {
  constructor(
    private readonly sellers: SellersService,
    private readonly identity: SellerIdentityService,
    private readonly agreements: SellerAgreementService,
    private readonly sessions: SessionService,
    private readonly auth: AuthService,
    private readonly impersonation: AdminImpersonationService,
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
  // this seller has accepted it, without needing admin access. Must stay
  // reachable even when SellerAgreementGuard would otherwise block this
  // seller - otherwise they could never see why, or get unstuck.
  @Get("agreement")
  @SkipAgreementCheck()
  async getAgreementStatus(@CurrentSellerId() sellerId: string) {
    const [current, accepted] = await Promise.all([
      this.agreements.getCurrentVersion(),
      this.agreements.hasAcceptedCurrentVersion(sellerId),
    ]);
    return { currentVersion: current.version, accepted };
  }

  @Post("agreement/accept")
  @SkipAgreementCheck()
  acceptAgreement(@CurrentSellerId() sellerId: string, @Req() req: AuthenticatedRequest) {
    return this.agreements.accept(sellerId, req.ip ?? "unknown");
  }

  // SRS §5.25/FR-25.7 - the seller's own session/device list. @CurrentSellerId()
  // enforces this is a seller session (FR-25.7's literal scope); sessions
  // themselves are keyed by userId (user.sub), not sellerId.
  @Get("sessions")
  listSessions(@CurrentSellerId() _sellerId: string, @CurrentUser() user: JwtAccessPayload) {
    return this.sessions.listSessions(user.sub);
  }

  @Delete("sessions/:sessionId")
  async revokeSession(
    @CurrentSellerId() _sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("sessionId") sessionId: string,
  ) {
    const revoked = await this.sessions.revokeOwnSession(user.sub, sessionId);
    if (!revoked) {
      throw new ForbiddenException("This session doesn't exist or doesn't belong to you.");
    }
    return { revoked: true };
  }

  // SRS §5.25/FR-25.6 - voluntary 2FA opt-in for an already-logged-in
  // seller (relevant under the default `optional` enforcement mode, where
  // nothing forces this at login time).
  @Post("mfa/enroll")
  enrollMfa(@CurrentSellerId() _sellerId: string, @CurrentUser() user: JwtAccessPayload) {
    return this.auth.enrollMfaForAuthenticatedUser(user.sub);
  }

  @Post("mfa/verify")
  verifyMfaEnrollment(@CurrentSellerId() _sellerId: string, @CurrentUser() user: JwtAccessPayload, @Body() dto: MfaVerifyCodeDto) {
    return this.auth.confirmMfaEnrollmentForAuthenticatedUser(user.sub, dto.code);
  }

  // v0.23 impersonation-transparency amendment (FR-8.4) - when it happened
  // and for how long, never which admin.
  @Get("support-access-history")
  getSupportAccessHistory(@CurrentSellerId() sellerId: string) {
    return this.impersonation.historyForSeller(sellerId);
  }
}
