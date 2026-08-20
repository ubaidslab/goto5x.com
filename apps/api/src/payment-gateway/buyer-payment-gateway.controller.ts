import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { VerifyGatewayPaymentDto } from "./dto/verify-gateway-payment.dto";
import { PaymentGatewayService } from "./payment-gateway.service";

/**
 * FR-6.38 - public, unauthenticated; `token` is the same unguessable
 * statusLookupToken used by /storefront/order-status and
 * /storefront/order-verification.
 */
@Controller("storefront/gateway-payment/:token")
export class BuyerPaymentGatewayController {
  constructor(private readonly paymentGateway: PaymentGatewayService) {}

  @Get()
  getOptions(@Param("token") token: string) {
    return this.paymentGateway.getCheckoutOptionsByToken(token);
  }

  @Post("verify")
  verify(@Param("token") token: string, @Body() dto: VerifyGatewayPaymentDto) {
    return this.paymentGateway.verifyByToken(token, dto.provider, dto.reference);
  }

  /** FR-6.52 (Module 76) - the partial-advance amount due + this store's active gateway options. */
  @Get("partial-advance")
  getPartialAdvanceOptions(@Param("token") token: string) {
    return this.paymentGateway.getPartialAdvanceOptionsByToken(token);
  }

  @Post("partial-advance/verify")
  verifyPartialAdvance(@Param("token") token: string, @Body() dto: VerifyGatewayPaymentDto) {
    return this.paymentGateway.verifyPartialAdvanceByToken(token, dto.provider, dto.reference);
  }
}
