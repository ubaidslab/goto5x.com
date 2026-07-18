import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AdminModule } from "../admin/admin.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { TrustSafetyModule } from "../trust-safety/trust-safety.module";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { EmailService } from "../notifications/email.service";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthService } from "./admin-auth.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SecurityEventService } from "./security-event.service";
import { SessionService } from "./session.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [PassportModule, JwtModule.register({}), SettingsModule, AdminModule, TrustSafetyModule],
  controllers: [AuthController, AdminAuthController],
  providers: [
    AuthService,
    AdminAuthService,
    SessionService,
    SecurityEventService,
    RateLimitService,
    EmailService,
    JwtStrategy,
  ],
  // SecurityEventService is also exported: Module 2's Google Drive connection
  // flow (FR-9.1) records the same per-account security trail (FR-25.3's
  // table) that password reset does, rather than inventing a second one.
  // SessionService is exported for Module 13's seller-facing session/device
  // list (SellersController, FR-25.7).
  exports: [AuthService, SecurityEventService, SessionService],
})
export class AuthModule {}
