import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { ModerationQueueController } from "./moderation-queue.controller";
import { ModerationService } from "./moderation.service";

@Module({
  imports: [SettingsModule, AdminModule],
  controllers: [ModerationQueueController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
