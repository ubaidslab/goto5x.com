import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { WaiveCommissionDto } from "./dto/waive-commission.dto";
import { InvoicesService } from "./invoices.service";

/** Seller-facing: their own commission invoices only. */
@Controller("sellers/me/invoices")
@UseGuards(JwtAuthGuard)
export class SellerInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(@CurrentSellerId() sellerId: string) {
    return this.invoices.listForSeller(sellerId);
  }
}

/** Admin-facing: every seller's invoices, manual payment verification, commission disputes. */
@Controller("admin/invoices")
@UseGuards(AdminAuthGuard)
export class AdminInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  listAll() {
    return this.invoices.listAllForAdmin();
  }

  @Post(":invoiceId/mark-paid")
  markPaid(@Param("invoiceId") invoiceId: string, @CurrentUser() user: JwtAccessPayload) {
    return this.invoices.markPaid(invoiceId, user.adminUserId!);
  }

  @Post("waive-commission")
  waiveCommission(@Body() dto: WaiveCommissionDto, @CurrentUser() user: JwtAccessPayload) {
    return this.invoices.waiveCommission(dto.sellerId, dto.orderId, dto.amount, user.adminUserId!);
  }
}
