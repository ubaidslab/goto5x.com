import { Module } from "@nestjs/common";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { CustomerSegmentsController } from "./customer-segments.controller";
import { CustomerSegmentsService } from "./customer-segments.service";

@Module({
  imports: [SettingsModule, PlansModule],
  controllers: [CustomerSegmentsController],
  providers: [CustomerSegmentsService],
  exports: [CustomerSegmentsService],
})
export class CustomerSegmentsModule {}
