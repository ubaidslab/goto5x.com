import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ImportJobType } from "@prisma/client";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { JwtAccessPayload } from "../common/types";
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

  /** FR-39.3 - stock-only bulk edit (SKU + new Quantity columns), same job/error-report machinery as above. */
  @Post("stock-import-jobs")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async createStockImportJob(
    @CurrentSellerId() sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded (expected multipart field "file").');
    return this.importJobs.createStockImportJob(sellerId, storeId, user.sub, {
      buffer: file.buffer,
      originalname: file.originalname,
    });
  }

  /** Module 31 (SRS §5.42/FR-42.1) - ad-spend-only import (PeriodStart/PeriodEnd/Amount columns), same job/error-report machinery as above. */
  @Post("ad-spend-import-jobs")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async createAdSpendImportJob(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded (expected multipart field "file").');
    return this.importJobs.createAdSpendImportJob(sellerId, storeId, {
      buffer: file.buffer,
      originalname: file.originalname,
    });
  }

  /** SRS §5.59/FR-59.3(a) - tracking-only import (OrderNumber/Courier/TrackingId columns), same job/error-report machinery as above. */
  @Post("tracking-import-jobs")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async createTrackingImportJob(
    @CurrentSellerId() sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded (expected multipart field "file").');
    return this.importJobs.createTrackingImportJob(sellerId, storeId, user.sub, {
      buffer: file.buffer,
      originalname: file.originalname,
    });
  }

  @Get("import-jobs")
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Query("type") type?: ImportJobType) {
    return this.importJobs.list(sellerId, storeId, type);
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
