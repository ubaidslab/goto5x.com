import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { AdminAuthService } from "./admin-auth.service";
import { AdminLoginDto, AdminMfaVerifyDto } from "./dto/admin-login.dto";

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
  beginMfaEnrollment(@Body() body: { preAuthToken: string }) {
    return this.adminAuth.beginMfaEnrollment(body.preAuthToken);
  }

  @Post("mfa/verify")
  @HttpCode(HttpStatus.OK)
  verifyMfa(@Body() dto: AdminMfaVerifyDto) {
    return this.adminAuth.verifyMfaAndIssueSession(dto.preAuthToken, dto.code);
  }
}
