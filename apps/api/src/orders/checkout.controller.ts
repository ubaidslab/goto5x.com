import { Body, Controller, Post } from "@nestjs/common";
import { CheckoutService } from "./checkout.service";
import { CheckoutDto } from "./dto/checkout.dto";

/** Public, unauthenticated - completes a cart into a `pending` order. */
@Controller("storefront/checkout")
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  checkout(@Body() dto: CheckoutDto) {
    return this.checkoutService.checkout(dto);
  }
}
