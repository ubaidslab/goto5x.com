import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { PaymentGatewayProvider } from "@prisma/client";
import { BlockDuringImpersonation } from "../common/decorators/block-during-impersonation.decorator";
import { BlockStaffSessions } from "../common/decorators/block-staff-sessions.decorator";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { BlockStaffSessionsGuard } from "../common/guards/block-staff-sessions.guard";
import { ImpersonationWriteGuard } from "../common/guards/impersonation-write.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ConnectPaymentGatewayDto } from "./dto/connect-payment-gateway.dto";
import { SetGatewayActiveDto } from "./dto/set-gateway-active.dto";
import { PaymentGatewayService } from "./payment-gateway.service";

/**
 * FR-6.39 - owner-only always (same discipline as PaymentInstructionsController -
 * a connected payment gateway is money-adjacent). Every write is blocked
 * during impersonation (FR-8.4's "mark-as-paid, payment-instruction
 * changes... are blocked outright while impersonating" - a gateway
 * connection is the same category of action).
 */
@Controller("stores/:storeId/payment-gateway")
@UseGuards(JwtAuthGuard, BlockStaffSessionsGuard)
@BlockStaffSessions()
export class PaymentGatewayController {
  constructor(private readonly paymentGateway: PaymentGatewayService) {}

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.paymentGateway.list(sellerId, storeId);
  }

  @Post()
  @UseGuards(ImpersonationWriteGuard)
  @BlockDuringImpersonation()
  connect(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Body() dto: ConnectPaymentGatewayDto,
  ) {
    return this.paymentGateway.connect(sellerId, storeId, dto);
  }

  @Patch(":provider/active")
  @UseGuards(ImpersonationWriteGuard)
  @BlockDuringImpersonation()
  setActive(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("provider") provider: PaymentGatewayProvider,
    @Body() dto: SetGatewayActiveDto,
  ) {
    return this.paymentGateway.setActive(sellerId, storeId, provider, dto.isActive);
  }

  @Post(":provider/test")
  testConnection(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("provider") provider: PaymentGatewayProvider,
  ) {
    return this.paymentGateway.testConnection(sellerId, storeId, provider);
  }

  @Delete(":provider")
  @UseGuards(ImpersonationWriteGuard)
  @BlockDuringImpersonation()
  remove(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("provider") provider: PaymentGatewayProvider,
  ) {
    return this.paymentGateway.remove(sellerId, storeId, provider);
  }
}
