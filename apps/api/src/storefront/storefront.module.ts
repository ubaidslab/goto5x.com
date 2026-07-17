import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { SettingsModule } from "../settings-registry/settings.module";
import { StorefrontController } from "./storefront.controller";
import { StorefrontService } from "./storefront.service";

@Module({
  imports: [SettingsModule, JwtModule.register({})],
  controllers: [StorefrontController],
  providers: [StorefrontService],
  exports: [StorefrontService],
})
export class StorefrontModule {}
