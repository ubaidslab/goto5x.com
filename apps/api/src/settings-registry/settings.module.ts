import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { SettingsAdminController } from "./settings-admin.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [AdminModule],
  controllers: [SettingsAdminController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
