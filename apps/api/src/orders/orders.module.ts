import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { CustomersModule } from "../customers/customers.module";
import { EventsModule } from "../events/events.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { EmailService } from "../notifications/email.service";
import { OrderVerificationModule } from "../order-verification/order-verification.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { StorefrontModule } from "../storefront/storefront.module";
import { StoreSettingsModule } from "../store-settings/store-settings.module";
import { SuppliersModule } from "../suppliers/suppliers.module";
import { TrustSafetyModule } from "../trust-safety/trust-safety.module";
import { CartAbandonmentScheduler } from "./cart-abandonment.scheduler";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";
import { OrderPricingService } from "./order-pricing.service";
import { OrderStatusLookupController } from "./order-status-lookup.controller";
import { OrderStatusLookupService } from "./order-status-lookup.service";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [
    SettingsModule,
    StorefrontModule,
    StoreSettingsModule,
    SuppliersModule,
    EventsModule,
    BillingModule,
    TrustSafetyModule,
    CustomersModule,
    InvoicesModule,
    OrderVerificationModule,
  ],
  controllers: [CartController, CheckoutController, OrderStatusLookupController, OrdersController],
  providers: [
    CartService,
    CheckoutService,
    OrderPricingService,
    OrderStatusLookupService,
    OrdersService,
    CartAbandonmentScheduler,
    EmailService,
  ],
  exports: [CartService, CheckoutService],
})
export class OrdersModule {}
