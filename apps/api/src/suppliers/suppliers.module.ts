import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings-registry/settings.module";
import { ListingReviewsController } from "./listing-reviews.controller";
import { ListingReviewsService } from "./listing-reviews.service";
import { PRINTIFY_CLIENT } from "./printify/printify-client.interface";
import { PrintifyHttpClient } from "./printify/printify-http-client.service";
import { PrintifyAdapter } from "./printify/printify.adapter";
import { SupplierAdapterRegistryService } from "./supplier-adapter-registry.service";
import { SupplierAdaptersController } from "./supplier-adapters.controller";
import { SupplierLinksController } from "./supplier-links.controller";
import { SupplierLinksService } from "./supplier-links.service";
import { SupplierListingsService } from "./supplier-listings.service";
import { SupplierPortalController } from "./supplier-portal.controller";
import { SupplierPortalService } from "./supplier-portal.service";
import { SupplierSyncScheduler } from "./supplier-sync.scheduler";
import { SupplierSyncService } from "./supplier-sync.service";

@Module({
  imports: [SettingsModule],
  controllers: [
    SupplierLinksController,
    ListingReviewsController,
    SupplierPortalController,
    SupplierAdaptersController,
  ],
  providers: [
    SupplierLinksService,
    ListingReviewsService,
    SupplierPortalService,
    SupplierListingsService,
    SupplierAdapterRegistryService,
    SupplierSyncService,
    SupplierSyncScheduler,
    PrintifyAdapter,
    { provide: PRINTIFY_CLIENT, useClass: PrintifyHttpClient },
  ],
  exports: [SupplierListingsService, SupplierSyncService],
})
export class SuppliersModule {}
