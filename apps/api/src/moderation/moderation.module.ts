import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { AdminProductModerationController } from "./admin-product-moderation.controller";
import { ModerationQueueController } from "./moderation-queue.controller";
import { ModerationService } from "./moderation.service";

@Module({
  imports: [SettingsModule, AdminModule],
  controllers: [ModerationQueueController, AdminProductModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
