import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { AdminAuthService } from "./admin-auth.service";
import { AdminLoginDto, AdminMfaEnrollDto, AdminMfaVerifyDto } from "./dto/admin-login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

@Controller("admin/auth")
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

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
  verifyMfa(@Body() dto: AdminMfaVerifyDto, @Req() req: Request) {
    return this.adminAuth.verifyMfaAndIssueSession(dto.preAuthToken, dto.code, req.ip ?? "unknown");
  }

  /** Phase 0.5 founder-walkthrough fix - see AdminAuthService.refresh()'s own comment. */
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.adminAuth.refresh(dto.sessionId, dto.refreshToken);
  }
}
