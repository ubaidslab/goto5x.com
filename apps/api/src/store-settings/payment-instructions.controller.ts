import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UpdatePaymentInstructionsDto } from "./dto/update-payment-instructions.dto";
import { PaymentInstructionsService } from "./payment-instructions.service";

@Controller("stores/:storeId/payment-instructions")
@UseGuards(JwtAuthGuard)
export class PaymentInstructionsController {
  constructor(private readonly paymentInstructions: PaymentInstructionsService) {}

  @Get()
  get(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.paymentInstructions.getForStore(sellerId, storeId);
  }

  @Patch()
  update(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Body() dto: UpdatePaymentInstructionsDto,
  ) {
    return this.paymentInstructions.update(sellerId, storeId, dto);
  }
}
