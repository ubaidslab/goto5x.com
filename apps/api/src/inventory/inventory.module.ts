import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings-registry/settings.module";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";

/** Module 28 (SRS §5.39). */
@Module({
  imports: [SettingsModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
