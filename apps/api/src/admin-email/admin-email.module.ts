import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsModule } from "../settings-registry/settings.module";
import { AdminEmailAccountsService } from "./admin-email-accounts.service";
import { AdminEmailController } from "./admin-email.controller";
import { AdminMailService } from "./admin-mail.service";

@Module({
  imports: [AdminModule, SettingsModule],
  controllers: [AdminEmailController],
  providers: [AdminEmailAccountsService, AdminMailService, RateLimitService],
})
export class AdminEmailModule {}
