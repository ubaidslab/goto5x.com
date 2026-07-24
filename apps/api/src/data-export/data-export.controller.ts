import { Controller, Get, Param, Post, Res, StreamableFile, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { DataExportService } from "./data-export.service";

/** SRS §5.36, FR-36.1(b) - the seller's own on-demand export trigger + history. */
@Controller("sellers/me/data-export")
@UseGuards(JwtAuthGuard)
export class DataExportController {
  constructor(private readonly dataExport: DataExportService) {}

  @Get()
  list(@CurrentSellerId() sellerId: string) {
    return this.dataExport.listOwn(sellerId);
  }

  @Post()
  request(@CurrentSellerId() sellerId: string) {
    return this.dataExport.requestOnDemandExport(sellerId);
  }

  /**
   * v0.28 security fix (FR-36.3, revised) - the sole read path for export
   * bytes. Ownership-checked in the service (a different seller's ID gets
   * a 404, not the file); never returns or redirects to a raw
   * object-storage URL.
   */
  @Get(":exportId/download/:file")
  async download(
    @CurrentSellerId() sellerId: string,
    @Param("exportId") exportId: string,
    @Param("file") file: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename, contentType } = await this.dataExport.downloadFile(sellerId, exportId, file);
    res.set({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }
}
