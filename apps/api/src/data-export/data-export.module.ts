import { Module } from "@nestjs/common";
import { InvoicesModule } from "../invoices/invoices.module";
import { MediaModule } from "../media/media.module";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { DataExportController } from "./data-export.controller";
import { DataExportService } from "./data-export.service";

/**
 * Module 24 (SRS §5.36). Imports MediaModule (ObjectStorageService, the
 * Drive connection/client) and InvoicesModule (the shared PDF renderer) -
 * both already export what this needs, so no new cross-module surface had
 * to be added beyond MediaModule's own export list. Module 56 (SRS §5.63)
 * adds PlansModule for SubscriptionsService.getPlanContext() - the
 * Pro-tier gate on the on-demand export path.
 */
@Module({
  imports: [SettingsModule, MediaModule, InvoicesModule, PlansModule],
  controllers: [DataExportController],
  providers: [DataExportService],
  exports: [DataExportService],
})
export class DataExportModule {}
