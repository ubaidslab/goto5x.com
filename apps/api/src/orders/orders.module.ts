import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { EventsModule } from "../events/events.module";
import { EmailService } from "../notifications/email.service";
import { SettingsModule } from "../settings-registry/settings.module";
import { StorefrontModule } from "../storefront/storefront.module";
import { StoreSettingsModule } from "../store-settings/store-settings.module";
import { SuppliersModule } from "../suppliers/suppliers.module";
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
  imports: [SettingsModule, StorefrontModule, StoreSettingsModule, SuppliersModule, EventsModule, BillingModule],
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
