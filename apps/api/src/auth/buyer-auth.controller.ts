import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { BuyerAuthService } from "./buyer-auth.service";
import { BuyerSignupDto } from "./dto/buyer-signup.dto";
import { LoginDto } from "./dto/login.dto";

/**
 * FR-66.1 (Module 81) - a dedicated route prefix distinct from
 * /auth/* (seller/supplier) and /admin/auth/* (admin), matching that
 * same one-controller-per-role precedent. Called by the storefront's
 * Server Actions (never directly from browser JS - see checkout's own
 * note on why: a tenant's dynamic subdomain/custom domain can never be
 * pre-listed in the API's static CORS allowlist).
 */
@Controller("storefront/auth")
export class BuyerAuthController {
  constructor(private readonly buyerAuth: BuyerAuthService) {}

  @Post("signup")
  @HttpCode(HttpStatus.OK)
  signup(@Body() dto: BuyerSignupDto, @Req() req: Request) {
    return this.buyerAuth.signup(dto, req.ip ?? "unknown");
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.buyerAuth.login(dto, req.ip ?? "unknown");
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: { sessionId: string; refreshToken: string }) {
    return this.buyerAuth.refresh(body.sessionId, body.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() body: { sessionId: string }) {
    return this.buyerAuth.logout(body.sessionId);
  }
}
