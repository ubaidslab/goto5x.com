import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { DstudioPackService } from "./dstudio-pack.service";

/** FR-8.21 (Module 100) - D-Studio Pack, admin verification queue, same shape as admin/template-purchases. */
@Controller("admin/dstudio-pack-purchases")
@UseGuards(AdminAuthGuard)
export class AdminDstudioPackController {
  constructor(private readonly packs: DstudioPackService) {}

  @Get()
  listPending() {
    return this.packs.listPendingForAdmin();
  }

  @Post(":requestId/verify")
  verify(@Param("requestId") requestId: string, @CurrentUser() user: JwtAccessPayload) {
    return this.packs.verify(requestId, user.adminUserId!);
  }

  @Post(":requestId/reject")
  reject(@Param("requestId") requestId: string, @CurrentUser() user: JwtAccessPayload) {
    return this.packs.reject(requestId, user.adminUserId!);
  }
}
