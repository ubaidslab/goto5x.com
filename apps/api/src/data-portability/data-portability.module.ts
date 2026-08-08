import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { MediaModule } from "../media/media.module";
import { OrdersModule } from "../orders/orders.module";
import { CsvExportService } from "./csv-export.service";
import { DataPortabilityController } from "./data-portability.controller";
import { ImportJobsService } from "./import-jobs.service";
import { ProductImportService } from "./product-import.service";

@Module({
  // Module 52 (SRS §5.59/FR-59.3(a)) - OrdersModule, so the CSV tracking-
  // import worker can call OrdersService.uploadTrackingForOrder() directly.
  imports: [MediaModule, CatalogModule, OrdersModule],
  controllers: [DataPortabilityController],
  providers: [ImportJobsService, ProductImportService, CsvExportService],
  exports: [ProductImportService],
})
export class DataPortabilityModule {}
