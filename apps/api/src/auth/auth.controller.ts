import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { CompletePasswordResetDto, RequestPasswordResetDto } from "./dto/password-reset.dto";
import { LoginDto } from "./dto/login.dto";
import { MfaEnrollDto } from "./dto/mfa-enroll.dto";
import { MfaVerifyDto } from "./dto/mfa-verify.dto";
import { SignupDto } from "./dto/signup.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, req.ip ?? "unknown", req.headers["user-agent"]);
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
  verifyMfa(@Body() dto: MfaVerifyDto, @Req() req: Request) {
    return this.auth.verifyMfaAndIssueSession(dto.preAuthToken, dto.code, req.ip ?? "unknown", req.headers["user-agent"]);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: { sessionId: string; refreshToken: string }) {
    return this.auth.refresh(body.sessionId, body.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() body: { sessionId: string }) {
    return this.auth.logout(body.sessionId);
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
