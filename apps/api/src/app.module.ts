import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { CatalogModule } from "./catalog/catalog.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { PiiRedactionInterceptor } from "./common/logging/pii-redaction.interceptor";
import { RedisModule } from "./common/redis/redis.module";
import { validateEnv } from "./config/env.validation";
import { CustomersModule } from "./customers/customers.module";
import { DataPortabilityModule } from "./data-portability/data-portability.module";
import { DiscoveryModule } from "./discovery/discovery.module";
import { DomainsModule } from "./domains/domains.module";
import { EventsModule } from "./events/events.module";
import { GuardrailsModule } from "./guardrails/guardrails.module";
import { HealthModule } from "./health/health.module";
import { MediaModule } from "./media/media.module";
import { ModerationModule } from "./moderation/moderation.module";
import { OrdersModule } from "./orders/orders.module";
import { PlansModule } from "./plans/plans.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { SellersModule } from "./sellers/sellers.module";
import { SettingsModule } from "./settings-registry/settings.module";
import { StorefrontModule } from "./storefront/storefront.module";
import { StoreSettingsModule } from "./store-settings/store-settings.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { TeamsModule } from "./teams/teams.module";
import { TenancyModule } from "./tenancy/tenancy.module";
import { ThemeEngineModule } from "./theme-engine/theme-engine.module";
import { TrustSafetyModule } from "./trust-safety/trust-safety.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), // generic API-wide guard; auth-specific limits use RateLimitService
    PrismaModule,
    RedisModule,
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
    CustomersModule,
    ReviewsModule,
    DataPortabilityModule,
    SellersModule,
    BillingModule,
    TrustSafetyModule,
    PlansModule,
    TeamsModule,
    GuardrailsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: PiiRedactionInterceptor },
  ],
})
export class AppModule {}
