import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { PiiRedactionInterceptor } from "./common/logging/pii-redaction.interceptor";
import { RedisModule } from "./common/redis/redis.module";
import { validateEnv } from "./config/env.validation";
import { HealthModule } from "./health/health.module";
import { MediaModule } from "./media/media.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SettingsModule } from "./settings-registry/settings.module";
import { TenancyModule } from "./tenancy/tenancy.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), // generic API-wide guard; auth-specific limits use RateLimitService
    PrismaModule,
    RedisModule,
    AdminModule,
    SettingsModule,
    AuthModule,
    TenancyModule,
    CatalogModule,
    MediaModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: PiiRedactionInterceptor },
  ],
})
export class AppModule {}
