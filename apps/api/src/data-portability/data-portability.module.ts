import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { MediaModule } from "../media/media.module";
import { CsvExportService } from "./csv-export.service";
import { DataPortabilityController } from "./data-portability.controller";
import { ImportJobsService } from "./import-jobs.service";
import { ProductImportService } from "./product-import.service";

@Module({
  imports: [MediaModule, CatalogModule],
  controllers: [DataPortabilityController],
  providers: [ImportJobsService, ProductImportService, CsvExportService],
  exports: [ProductImportService],
})
export class DataPortabilityModule {}
