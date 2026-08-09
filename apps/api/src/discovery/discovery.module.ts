import { Module } from "@nestjs/common";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { CollectionsController } from "./collections.controller";
import { CollectionsService } from "./collections.service";
import { NavigationController } from "./navigation.controller";
import { NavigationService } from "./navigation.service";

@Module({
  imports: [PlansModule, SettingsModule],
  controllers: [CollectionsController, NavigationController],
  providers: [CollectionsService, NavigationService],
  exports: [CollectionsService, NavigationService],
})
export class DiscoveryModule {}
