import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { DesignTokensAdminController } from "./design-tokens-admin.controller";
import { DesignTokensController } from "./design-tokens.controller";

@Module({
  imports: [AdminModule, SettingsModule],
  controllers: [DesignTokensController, DesignTokensAdminController],
})
export class DesignTokensModule {}
