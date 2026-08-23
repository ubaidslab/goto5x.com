import { Controller, Get, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { BlockStaffSessions } from "../common/decorators/block-staff-sessions.decorator";
import { BlockStaffSessionsGuard } from "../common/guards/block-staff-sessions.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { SubscriptionInvoiceService } from "./subscription-invoice.service";

/** SRS §5.6k/FR-6.47 (Module 70) - the seller's own downloadable UZEYN subscription invoice. Owner-only. */
@Controller("sellers/me/subscription-invoice")
@UseGuards(JwtAuthGuard, BlockStaffSessionsGuard)
@BlockStaffSessions()
export class SubscriptionInvoiceController {
  constructor(private readonly subscriptionInvoice: SubscriptionInvoiceService) {}

  @Get()
  async download(@CurrentSellerId() sellerId: string, @Query("month") month: string, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.subscriptionInvoice.generate(sellerId, month);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="uzeyn-subscription-invoice-${month}.pdf"`,
    });
    return new StreamableFile(buffer);
  }
}
