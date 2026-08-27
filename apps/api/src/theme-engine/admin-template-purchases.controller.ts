import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { TemplatePurchaseService } from "./template-purchase.service";

/** Premium Motion Templates - admin verification queue, same shape as admin/wallet-topups. */
@Controller("admin/template-purchases")
@UseGuards(AdminAuthGuard)
export class AdminTemplatePurchasesController {
  constructor(private readonly purchases: TemplatePurchaseService) {}

  @Get()
  listPending() {
    return this.purchases.listPendingForAdmin();
  }

  @Post(":requestId/verify")
  verify(@Param("requestId") requestId: string, @CurrentUser() user: JwtAccessPayload) {
    return this.purchases.verify(requestId, user.adminUserId!);
  }

  @Post(":requestId/reject")
  reject(@Param("requestId") requestId: string, @CurrentUser() user: JwtAccessPayload) {
    return this.purchases.reject(requestId, user.adminUserId!);
  }
}
