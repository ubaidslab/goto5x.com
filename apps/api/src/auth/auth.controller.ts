import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { RefreshCookieCsrfGuard } from "../common/guards/refresh-cookie-csrf.guard";
import { AuthService } from "./auth.service";
import { CompletePasswordResetDto, RequestPasswordResetDto } from "./dto/password-reset.dto";
import { LoginDto } from "./dto/login.dto";
import { MfaEnrollDto } from "./dto/mfa-enroll.dto";
import { MfaVerifyDto } from "./dto/mfa-verify.dto";
import { clearRefreshCookie, parseRefreshCookie, setRefreshCookie } from "./refresh-cookie.util";
import { SignupDto } from "./dto/signup.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";

/**
 * D82 - the refresh token no longer appears in any response body here: it
 * travels only as the __Host-refresh_token cookie (refresh-cookie.util.ts),
 * set directly on the response by this controller, never by AuthService -
 * the service layer's return shape (TokenPair) is unchanged, so this is
 * purely an HTTP-layer concern. `sessionId` stays in the JSON body (not a
 * secret on its own, and the dashboard needs it for the self-service
 * session list) - the "nothing in localStorage" rule is about where the
 * FRONTEND stores it (React state/memory now, never localStorage), not
 * about the API's response shape.
 */
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private refreshCookieMaxAgeMs(): number {
    return this.config.getOrThrow<number>("JWT_REFRESH_TTL_DAYS") * 24 * 60 * 60 * 1000;
  }

  @Post("signup")
  signup(@Body() dto: SignupDto, @Req() req: Request) {
    return this.auth.signup(dto, req.ip ?? "unknown");
  }

  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto, req.ip ?? "unknown", req.headers["user-agent"]);
    if (!("refreshToken" in result)) return result; // MFA step required - no session yet
    setRefreshCookie(res, result.sessionId, result.refreshToken, this.refreshCookieMaxAgeMs());
    return { accessToken: result.accessToken, sessionId: result.sessionId };
  }

  // SRS §5.25/FR-25.6 - reached only when login() returned a pre-auth step
  // (an unenrolled seller under required_always enforcement).
  @Post("mfa/enroll")
  @HttpCode(HttpStatus.OK)
  enrollMfa(@Body() dto: MfaEnrollDto) {
    return this.auth.beginMfaEnrollment(dto.preAuthToken);
  }

  @Post("mfa/verify")
  @HttpCode(HttpStatus.OK)
  async verifyMfa(@Body() dto: MfaVerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.verifyMfaAndIssueSession(dto.preAuthToken, dto.code, req.ip ?? "unknown", req.headers["user-agent"]);
    setRefreshCookie(res, result.sessionId, result.refreshToken, this.refreshCookieMaxAgeMs());
    return { accessToken: result.accessToken, sessionId: result.sessionId };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshCookieCsrfGuard)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const parsed = parseRefreshCookie(req);
    if (!parsed) throw new ForbiddenException("Missing or malformed session cookie.");
    const result = await this.auth.refresh(parsed.sessionId, parsed.refreshToken);
    setRefreshCookie(res, result.sessionId, result.refreshToken, this.refreshCookieMaxAgeMs());
    return { accessToken: result.accessToken, sessionId: result.sessionId };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RefreshCookieCsrfGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const parsed = parseRefreshCookie(req);
    clearRefreshCookie(res);
    if (!parsed) return;
    return this.auth.logout(parsed.sessionId);
  }

  @Post("password-reset/request")
  @HttpCode(HttpStatus.OK)
  requestPasswordReset(@Body() dto: RequestPasswordResetDto, @Req() req: Request) {
    return this.auth.requestPasswordReset(dto, req.ip ?? "unknown");
  }

  @Post("password-reset/complete")
  @HttpCode(HttpStatus.OK)
  completePasswordReset(@Body() dto: CompletePasswordResetDto, @Req() req: Request) {
    return this.auth.completePasswordReset(dto, req.ip ?? "unknown");
  }
}
