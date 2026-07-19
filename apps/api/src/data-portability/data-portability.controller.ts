import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CsvExportService } from "./csv-export.service";
import { ImportJobsService } from "./import-jobs.service";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB - generous for a core-fields-only product CSV

@Controller("stores/:storeId")
@UseGuards(JwtAuthGuard)
export class DataPortabilityController {
  constructor(
    private readonly importJobs: ImportJobsService,
    private readonly csvExport: CsvExportService,
  ) {}

  /** FR-18.1/18.2 - returns immediately; processing happens in the background. */
  @Post("import-jobs")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async createImportJob(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded (expected multipart field "file").');
    return this.importJobs.createImportJob(sellerId, storeId, {
      buffer: file.buffer,
      originalname: file.originalname,
    });
  }

  @Get("import-jobs")
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.importJobs.list(sellerId, storeId);
  }

  @Get("import-jobs/:jobId")
  getOne(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("jobId") jobId: string) {
    return this.importJobs.getOne(sellerId, storeId, jobId);
  }

  /** FR-18.3 - a seller's own data, exported for their own records or to move platforms. */
  @Post("exports/products")
  async exportProducts(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    const fileUrl = await this.csvExport.exportProducts(sellerId, storeId);
    return { fileUrl };
  }

  @Post("exports/orders")
  async exportOrders(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    const fileUrl = await this.csvExport.exportOrders(sellerId, storeId);
    return { fileUrl };
  }
}
