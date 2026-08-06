import { Body, Controller, ForbiddenException, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { ForceRemoveProductDto } from "./dto/force-remove-product.dto";
import { RestoreProductDto } from "./dto/restore-product.dto";
import { ModerationService } from "./moderation.service";

/**
 * SRS §5.54/FR-54.2 - instant single-product takedown, for ANY product
 * regardless of its current moderation status (not just the pending
 * queue). Deliberately NOT decorated with `@AllowReviewer()` - unlike the
 * ordinary approve/reject queue, this is a stronger action than the
 * REVIEWER sub-role is scoped to (SRS §4/FR-27.6 limits REVIEWER to the
 * moderation queue only).
 */
@Controller("admin/products")
@UseGuards(AdminAuthGuard)
export class AdminProductModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post(":productId/remove")
  remove(
    @CurrentUser() user: JwtAccessPayload,
    @Param("productId") productId: string,
    @Body() dto: ForceRemoveProductDto,
  ) {
    this.assertAdminUserId(user);
    return this.moderation.forceRemove(user.adminUserId, productId, dto.notes);
  }

  @Post(":productId/restore")
  restore(
    @CurrentUser() user: JwtAccessPayload,
    @Param("productId") productId: string,
    @Body() dto: RestoreProductDto,
  ) {
    this.assertAdminUserId(user);
    return this.moderation.restore(user.adminUserId, productId, dto.notes);
  }

  private assertAdminUserId(user: JwtAccessPayload): asserts user is JwtAccessPayload & { adminUserId: string } {
    if (!user.adminUserId) {
      throw new ForbiddenException("This endpoint requires an authenticated admin session.");
    }
  }
}
