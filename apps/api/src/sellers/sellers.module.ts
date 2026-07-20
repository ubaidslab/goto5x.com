import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ImpersonationModule } from "../impersonation/impersonation.module";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { TrustSafetyModule } from "../trust-safety/trust-safety.module";
import { SellersController } from "./sellers.controller";
import { SellersService } from "./sellers.service";

@Module({
  imports: [TrustSafetyModule, AuthModule, PlansModule, SettingsModule, ImpersonationModule],
  controllers: [SellersController],
  providers: [SellersService],
})
export class SellersModule {}
