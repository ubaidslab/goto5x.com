import { Controller, Get, Post, UseGuards } from "@nestjs/common";
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
}
