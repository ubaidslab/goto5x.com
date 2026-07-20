import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AdminModule } from "../admin/admin.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { AdminImpersonationController } from "./impersonation.controller";
import { AdminImpersonationService } from "./impersonation.service";
import { ImpersonationAuditInterceptor } from "./impersonation-audit.interceptor";

/**
 * Its own module (not folded into AdminModule) specifically to avoid a
 * circular import: AdminModule already exports AuditLogService to
 * SettingsModule (settings writes are audit-logged), so AdminModule
 * cannot also depend on SettingsModule for AdminImpersonationService's
 * SettingsService use - this module sits above both instead.
 */
@Module({
  imports: [JwtModule.register({}), AdminModule, SettingsModule],
  controllers: [AdminImpersonationController],
  providers: [
    AdminImpersonationService,
    { provide: APP_INTERCEPTOR, useClass: ImpersonationAuditInterceptor },
  ],
  exports: [AdminImpersonationService],
})
export class ImpersonationModule {}
