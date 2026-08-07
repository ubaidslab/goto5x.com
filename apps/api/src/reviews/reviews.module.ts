import { Module } from "@nestjs/common";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsModule } from "../settings-registry/settings.module";
import { ReviewSubmissionController } from "./review-submission.controller";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [SettingsModule],
  controllers: [ReviewSubmissionController, ReviewsController],
  providers: [ReviewsService, RateLimitService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
