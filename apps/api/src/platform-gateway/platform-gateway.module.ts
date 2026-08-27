import { Module } from "@nestjs/common";
import { BankTransferGatewayAdapter } from "../payment-gateway/adapters/bank-transfer-gateway.adapter";
import { EasypaisaGatewayAdapter } from "../payment-gateway/adapters/easypaisa-gateway.adapter";
import { JazzCashGatewayAdapter } from "../payment-gateway/adapters/jazzcash-gateway.adapter";
import { RaastGatewayAdapter } from "../payment-gateway/adapters/raast-gateway.adapter";
import { AdminPlatformGatewayController } from "./admin-platform-gateway.controller";
import { PlatformGatewayService } from "./platform-gateway.service";

/**
 * Deliberately separate from PaymentGatewayModule (Module 62, the
 * seller-merchant version) - that module imports OrdersModule, which
 * imports BillingModule, which needs PlatformGatewayService injected into
 * WalletService for the plan-fee auto-verify attempt. Importing
 * PaymentGatewayModule into BillingModule would create a cycle; this
 * module has no such dependency, so BillingModule and ThemeEngineModule
 * can both import it directly and acyclically. The four adapter classes
 * are re-declared as providers here (stateless besides ConfigService, so
 * a second instance alongside PaymentGatewayModule's is correct, not
 * duplicated state).
 */
@Module({
  controllers: [AdminPlatformGatewayController],
  providers: [RaastGatewayAdapter, EasypaisaGatewayAdapter, JazzCashGatewayAdapter, BankTransferGatewayAdapter, PlatformGatewayService],
  exports: [PlatformGatewayService],
})
export class PlatformGatewayModule {}
