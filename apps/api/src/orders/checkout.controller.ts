import { Body, Controller, Post, Req } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { JwtAccessPayload } from "../common/types";
import { CheckoutService } from "./checkout.service";
import { CheckoutDto } from "./dto/checkout.dto";

/**
 * Public, unauthenticated - completes a cart into a `pending` order. Guest
 * checkout is the unchanged default (FR-66.1): a buyer isn't required to
 * be logged in, so this never guards on a JWT - it only best-effort reads
 * one if the buyer happens to be logged into an optional buyer account,
 * so their order can be linked to their account/order-history. Anything
 * wrong with the token (missing, expired, not a buyer token) is silently
 * treated as "guest," never a checkout failure.
 */
@Controller("storefront/checkout")
export class CheckoutController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  checkout(@Body() dto: CheckoutDto, @Req() req: Request) {
    return this.checkoutService.checkout(dto, req.ip ?? "unknown", this.tryExtractBuyerId(req));
  }

  private tryExtractBuyerId(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return undefined;
    try {
      const payload = this.jwt.verify<JwtAccessPayload>(header.slice("Bearer ".length), {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
      return payload.buyerId ? payload.sub : undefined;
    } catch {
      return undefined;
    }
  }
}
