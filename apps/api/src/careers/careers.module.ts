import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { MediaModule } from "../media/media.module";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsModule } from "../settings-registry/settings.module";
import { AdminCareersController } from "./admin-careers.controller";
import { CareersController } from "./careers.controller";
import { JobApplicationService } from "./job-application.service";
import { JobPostingService } from "./job-posting.service";

/** Module 22 Phase B (SRS §5.33, FR-33.8) - Careers. Fully independent of Phase A's referral engine. */
@Module({
  imports: [SettingsModule, AdminModule, MediaModule],
  controllers: [CareersController, AdminCareersController],
  providers: [JobPostingService, JobApplicationService, RateLimitService],
})
export class CareersModule {}
