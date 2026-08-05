import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PlansModule } from "../plans/plans.module";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsModule } from "../settings-registry/settings.module";
import { StaffAccountsController } from "./staff-accounts.controller";
import { StaffAccountsService } from "./staff-accounts.service";
import { StaffAuditInterceptor } from "./staff-audit.interceptor";
import { StaffAuthController } from "./staff-auth.controller";
import { StaffAuthService } from "./staff-auth.service";

@Module({
  imports: [JwtModule.register({}), SettingsModule, PlansModule],
  controllers: [StaffAccountsController, StaffAuthController],
  providers: [
    StaffAccountsService,
    StaffAuthService,
    RateLimitService,
    { provide: APP_INTERCEPTOR, useClass: StaffAuditInterceptor },
  ],
})
export class StaffModule {}
