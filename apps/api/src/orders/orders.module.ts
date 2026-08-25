import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { CustomersModule } from "../customers/customers.module";
import { EventsModule } from "../events/events.module";
import { GiftCardsModule } from "../gift-cards/gift-cards.module";
import { InventoryModule } from "../inventory/inventory.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { OrderVerificationModule } from "../order-verification/order-verification.module";
import { SellerNotificationsModule } from "../seller-notifications/seller-notifications.module";
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
import { MissingTrackingAlertScheduler } from "./missing-tracking-alert.scheduler";
import { MissingTrackingAlertService } from "./missing-tracking-alert.service";
import { OrderPricingService } from "./order-pricing.service";
import { OrderStatusLookupController } from "./order-status-lookup.controller";
import { OrderStatusLookupService } from "./order-status-lookup.service";
import { OrdersOverviewService } from "./orders-overview.service";
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
    GiftCardsModule,
    InventoryModule,
    SellerNotificationsModule,
  ],
  controllers: [CartController, CheckoutController, OrderStatusLookupController, OrdersController],
  providers: [
    CartService,
    CheckoutService,
    OrderPricingService,
    OrderStatusLookupService,
    OrdersService,
    OrdersOverviewService,
    CartAbandonmentScheduler,
    RateLimitService,
    MissingTrackingAlertService,
    MissingTrackingAlertScheduler,
  ],
  exports: [CartService, CheckoutService, OrdersService, MissingTrackingAlertService],
})
export class OrdersModule {}
