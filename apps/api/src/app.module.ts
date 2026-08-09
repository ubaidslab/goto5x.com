import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminCompletionModule } from "./admin-completion/admin-completion.module";
import { AdminEmailModule } from "./admin-email/admin-email.module";
import { AdminModule } from "./admin/admin.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { BrandingModule } from "./branding/branding.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { CareersModule } from "./careers/careers.module";
import { CatalogModule } from "./catalog/catalog.module";
import { ContentPagesModule } from "./content-pages/content-pages.module";
import { CustomerSegmentsModule } from "./customer-segments/customer-segments.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { PiiRedactionInterceptor } from "./common/logging/pii-redaction.interceptor";
import { RedisModule } from "./common/redis/redis.module";
import { validateEnv } from "./config/env.validation";
import { CustomersModule } from "./customers/customers.module";
import { DataExportModule } from "./data-export/data-export.module";
import { DataPortabilityModule } from "./data-portability/data-portability.module";
import { DiscoveryModule } from "./discovery/discovery.module";
import { DomainsModule } from "./domains/domains.module";
import { EventsModule } from "./events/events.module";
import { ExternalApiModule } from "./external-api/external-api.module";
import { GiftCardsModule } from "./gift-cards/gift-cards.module";
import { GrowthProgramsModule } from "./growth-programs/growth-programs.module";
import { GuardrailsModule } from "./guardrails/guardrails.module";
import { HealthModule } from "./health/health.module";
import { ImpersonationModule } from "./impersonation/impersonation.module";
import { InventoryModule } from "./inventory/inventory.module";
import { MaintenanceModeMiddleware } from "./messaging/maintenance-mode.middleware";
import { MediaModule } from "./media/media.module";
import { MessagingModule } from "./messaging/messaging.module";
import { ModerationModule } from "./moderation/moderation.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OrderVerificationModule } from "./order-verification/order-verification.module";
import { OrdersModule } from "./orders/orders.module";
import { PlansModule } from "./plans/plans.module";
import { PnLModule } from "./pnl/pnl.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReturnsModule } from "./returns/returns.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { SellersModule } from "./sellers/sellers.module";
import { SettingsModule } from "./settings-registry/settings.module";
import { StaffModule } from "./staff/staff.module";
import { StorefrontModule } from "./storefront/storefront.module";
import { StoreHealthModule } from "./store-health/store-health.module";
import { StoreSettingsModule } from "./store-settings/store-settings.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { TeamsModule } from "./teams/teams.module";
import { TenancyModule } from "./tenancy/tenancy.module";
import { ThemeEngineModule } from "./theme-engine/theme-engine.module";
import { TrustSafetyModule } from "./trust-safety/trust-safety.module";
import { VerificationModule } from "./verification/verification.module";
import { WhatsAppMessagingModule } from "./whatsapp-messaging/whatsapp-messaging.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Generic API-wide guard; auth-specific limits use RateLimitService.
    // `limit` is env-overridable (default 100/60s, unchanged) - found
    // necessary while running Module 21's load/soak simulation tool: real
    // load-test traffic all originates from one load-generator IP, so this
    // per-IP limit otherwise drowns the whole run in 429s before any real
    // latency/error data can be collected (see docs/launch-runbook.md's
    // simulation section for the override to use during that run only).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: Number(process.env.THROTTLE_LIMIT_PER_MINUTE) || 100 }]),
    PrismaModule,
    RedisModule,
    NotificationsModule,
    EventsModule,
    AdminModule,
    SettingsModule,
    AuthModule,
    TenancyModule,
    CatalogModule,
    MediaModule,
    ModerationModule,
    StoreSettingsModule,
    SuppliersModule,
    DomainsModule,
    ThemeEngineModule,
    DiscoveryModule,
    StorefrontModule,
    OrdersModule,
    OrderVerificationModule,
    CustomersModule,
    ReviewsModule,
    DataPortabilityModule,
    SellersModule,
    BillingModule,
    TrustSafetyModule,
    PlansModule,
    TeamsModule,
    GrowthProgramsModule,
    CareersModule,
    StoreHealthModule,
    VerificationModule,
    DataExportModule,
    AdminCompletionModule,
    GuardrailsModule,
    ExternalApiModule,
    HealthModule,
    ContentPagesModule,
    MessagingModule,
    ImpersonationModule,
    InventoryModule,
    WhatsAppMessagingModule,
    PnLModule,
    BrandingModule,
    GiftCardsModule,
    CustomerSegmentsModule,
    CampaignsModule,
    StaffModule,
    AdminEmailModule,
    ReturnsModule,
    AnalyticsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: PiiRedactionInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MaintenanceModeMiddleware).forRoutes("*");
  }
}
