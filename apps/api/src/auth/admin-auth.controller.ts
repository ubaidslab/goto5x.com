import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { RefreshCookieCsrfGuard } from "../common/guards/refresh-cookie-csrf.guard";
import { clearAdminRefreshCookie, parseAdminRefreshCookie, setAdminRefreshCookie } from "./admin-refresh-cookie.util";
import { AdminAuthService, resolveAdminRefreshTtlDays } from "./admin-auth.service";
import { AdminLoginDto, AdminMfaEnrollDto, AdminMfaVerifyDto } from "./dto/admin-login.dto";

/**
 * D82 admin slice - mirrors AuthController's own comment exactly: the
 * refresh token travels only as the __Host-admin_refresh_token cookie
 * (admin-refresh-cookie.util.ts), set directly on the response here, never
 * in a response body. `RefreshCookieCsrfGuard` is the same guard the
 * seller dashboard uses (D108) - it only checks headers/Origin, nothing
 * cookie-name-specific, so it's safe to share as-is.
 */
@Controller("admin/auth")
export class AdminAuthController {
  constructor(
    private readonly adminAuth: AdminAuthService,
    private readonly config: ConfigService,
  ) {}

  // D82 - the admin refresh cookie's own maxAge, not the seller default:
  // resolveAdminRefreshTtlDays() is the same resolver AdminAuthService
  // uses for the Redis session TTL itself, so the cookie never claims to
  // outlive the session that actually backs it.
  private refreshCookieMaxAgeMs(): number {
    return resolveAdminRefreshTtlDays(this.config) * 24 * 60 * 60 * 1000;
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    return this.adminAuth.login(dto, req.ip ?? "unknown");
  }

  @Post("mfa/enroll")
  @HttpCode(HttpStatus.OK)
  beginMfaEnrollment(@Body() dto: AdminMfaEnrollDto) {
    return this.adminAuth.beginMfaEnrollment(dto.preAuthToken);
  }

  @Post("mfa/verify")
  @HttpCode(HttpStatus.OK)
  async verifyMfa(@Body() dto: AdminMfaVerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.adminAuth.verifyMfaAndIssueSession(dto.preAuthToken, dto.code, req.ip ?? "unknown");
    setAdminRefreshCookie(res, result.sessionId, result.refreshToken, this.refreshCookieMaxAgeMs());
    return { accessToken: result.accessToken, sessionId: result.sessionId };
  }

  /** Phase 0.5 founder-walkthrough fix - see AdminAuthService.refresh()'s own comment. */
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshCookieCsrfGuard)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const parsed = parseAdminRefreshCookie(req);
    if (!parsed) throw new ForbiddenException("Missing or malformed session cookie.");
    const result = await this.adminAuth.refresh(parsed.sessionId, parsed.refreshToken);
    setAdminRefreshCookie(res, result.sessionId, result.refreshToken, this.refreshCookieMaxAgeMs());
    return { accessToken: result.accessToken, sessionId: result.sessionId };
  }

  /** Mirrors AuthController.logout() exactly - the admin terminal had no logout endpoint at all until this. */
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RefreshCookieCsrfGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const parsed = parseAdminRefreshCookie(req);
    clearAdminRefreshCookie(res);
    if (!parsed) return;
    return this.adminAuth.logout(parsed.sessionId);
  }
}
