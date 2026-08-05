import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { BlockDuringImpersonation } from "../common/decorators/block-during-impersonation.decorator";
import { BlockStaffSessions } from "../common/decorators/block-staff-sessions.decorator";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { BlockStaffSessionsGuard } from "../common/guards/block-staff-sessions.guard";
import { ImpersonationWriteGuard } from "../common/guards/impersonation-write.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UpdatePaymentInstructionsDto } from "./dto/update-payment-instructions.dto";
import { PaymentInstructionsService } from "./payment-instructions.service";

/** Owner-only always (SRS §5.52/FR-52.2) - payment instructions are money-adjacent. */
@Controller("stores/:storeId/payment-instructions")
@UseGuards(JwtAuthGuard, BlockStaffSessionsGuard)
@BlockStaffSessions()
export class PaymentInstructionsController {
  constructor(private readonly paymentInstructions: PaymentInstructionsService) {}

  @Get()
  get(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.paymentInstructions.getForStore(sellerId, storeId);
  }

  /** Blocked during impersonation (v0.23) - a payment-instruction change is money-adjacent, seller-only. */
  @Patch()
  @UseGuards(ImpersonationWriteGuard)
  @BlockDuringImpersonation()
  update(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Body() dto: UpdatePaymentInstructionsDto,
  ) {
    return this.paymentInstructions.update(sellerId, storeId, dto);
  }
}
