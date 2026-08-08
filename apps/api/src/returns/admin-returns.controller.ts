import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ReturnRequestStatus } from "@prisma/client";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAccessPayload } from "../common/types";
import { CompleteReturnRequestDto } from "./dto/complete-return-request.dto";
import { DecideReturnRequestDto } from "./dto/decide-return-request.dto";
import { ReturnsService } from "./returns.service";

/** FR-60.5 - admin override, every store, regardless of the seller's own decision (or lack of one). */
@Controller("admin/returns")
@UseGuards(AdminAuthGuard)
export class AdminReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  list(@Query("status") status?: ReturnRequestStatus) {
    return this.returns.listForAdmin(status);
  }

  @Patch(":returnId")
  decide(@Param("returnId") returnId: string, @Body() dto: DecideReturnRequestDto, @CurrentUser() user: JwtAccessPayload) {
    return this.returns.adminDecide(user.adminUserId!, returnId, dto);
  }

  @Post(":returnId/complete")
  complete(@Param("returnId") returnId: string, @Body() dto: CompleteReturnRequestDto, @CurrentUser() user: JwtAccessPayload) {
    return this.returns.adminComplete(user.adminUserId!, returnId, dto);
  }
}
