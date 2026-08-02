import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { SubmitOtpDto } from "./dto/submit-otp.dto";
import { OrderVerificationService } from "./order-verification.service";

/** FR-37.7 - public, unauthenticated; `token` is the same unguessable statusLookupToken used by /storefront/order-status. */
@Controller("storefront/order-verification/:token")
export class BuyerOrderVerificationController {
  constructor(private readonly orderVerification: OrderVerificationService) {}

  @Get()
  getStatus(@Param("token") token: string) {
    return this.orderVerification.getStatusByToken(token);
  }

  @Post("verify")
  verify(@Param("token") token: string, @Body() dto: SubmitOtpDto) {
    return this.orderVerification.verifyByToken(token, dto.code);
  }

  @Post("resend")
  resend(@Param("token") token: string) {
    return this.orderVerification.resendByToken(token);
  }
}
