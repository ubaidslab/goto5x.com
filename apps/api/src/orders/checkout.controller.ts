import { Body, Controller, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { CheckoutService } from "./checkout.service";
import { CheckoutDto } from "./dto/checkout.dto";

/** Public, unauthenticated - completes a cart into a `pending` order. */
@Controller("storefront/checkout")
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  checkout(@Body() dto: CheckoutDto, @Req() req: Request) {
    return this.checkoutService.checkout(dto, req.ip ?? "unknown");
  }
}
