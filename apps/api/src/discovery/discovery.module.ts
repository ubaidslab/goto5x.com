import { Module } from "@nestjs/common";
import { CollectionsController } from "./collections.controller";
import { CollectionsService } from "./collections.service";
import { NavigationController } from "./navigation.controller";
import { NavigationService } from "./navigation.service";

@Module({
  controllers: [CollectionsController, NavigationController],
  providers: [CollectionsService, NavigationService],
  exports: [CollectionsService, NavigationService],
})
export class DiscoveryModule {}
