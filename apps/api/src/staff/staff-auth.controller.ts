import { Controller, ForbiddenException, HttpCode, Ip, Post, Body, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { RefreshCookieCsrfGuard } from "../common/guards/refresh-cookie-csrf.guard";
import { CompleteStaffPasswordResetDto } from "./dto/complete-staff-password-reset.dto";
import { StaffLoginDto } from "./dto/staff-login.dto";
import { clearStaffRefreshCookie, parseStaffRefreshCookie, setStaffRefreshCookie } from "./staff-refresh-cookie.util";
import { StaffAuthService } from "./staff-auth.service";

/**
 * Public, unauthenticated - a staff account's own login, separate from the
 * owner's (SRS §5.52/FR-52.3).
 *
 * D82 - mirrors AdminAuthController's own comment: the refresh token
 * travels only as the __Host-staff_refresh_token cookie
 * (staff-refresh-cookie.util.ts), never in a response body.
 * RefreshCookieCsrfGuard is the same shared guard D108/D110 already use -
 * it only checks headers/Origin, nothing cookie-name-specific.
 */
@Controller("staff/auth")
export class StaffAuthController {
  constructor(
    private readonly staffAuth: StaffAuthService,
    private readonly config: ConfigService,
  ) {}

  private refreshCookieMaxAgeMs(): number {
    return this.config.getOrThrow<number>("JWT_REFRESH_TTL_DAYS") * 24 * 60 * 60 * 1000;
  }

  @Post("login")
  async login(@Body() dto: StaffLoginDto, @Ip() ip: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.staffAuth.login(dto, ip);
    setStaffRefreshCookie(res, result.sessionId, result.refreshToken, this.refreshCookieMaxAgeMs());
    return { accessToken: result.accessToken, sessionId: result.sessionId };
  }

  @Post("refresh")
  @HttpCode(200)
  @UseGuards(RefreshCookieCsrfGuard)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const parsed = parseStaffRefreshCookie(req);
    if (!parsed) throw new ForbiddenException("Missing or malformed session cookie.");
    const result = await this.staffAuth.refresh(parsed.sessionId, parsed.refreshToken);
    setStaffRefreshCookie(res, result.sessionId, result.refreshToken, this.refreshCookieMaxAgeMs());
    return { accessToken: result.accessToken, sessionId: result.sessionId };
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(RefreshCookieCsrfGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const parsed = parseStaffRefreshCookie(req);
    clearStaffRefreshCookie(res);
    if (!parsed) return;
    return this.staffAuth.logout(parsed.sessionId);
  }

  /** FR-52.15 - the only way a staff account's password can ever change other than at creation; reachable only via an admin-triggered emailed link. */
  @Post("password-reset/complete")
  @HttpCode(200)
  completePasswordReset(@Body() dto: CompleteStaffPasswordResetDto) {
    return this.staffAuth.completePasswordReset(dto);
  }
}
