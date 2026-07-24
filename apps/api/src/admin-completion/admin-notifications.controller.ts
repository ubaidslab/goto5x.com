import { Controller, ForbiddenException, Get, Post, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAccessPayload } from "../common/types";
import { AdminNotificationsService } from "./admin-notifications.service";

@Controller("admin/notifications")
@UseGuards(AdminAuthGuard)
export class AdminNotificationsController {
  constructor(private readonly notifications: AdminNotificationsService) {}

  @Get()
  get(@CurrentUser() user: JwtAccessPayload) {
    return this.notifications.getNotifications(this.requireAdminUserId(user));
  }

  @Post("mark-seen")
  markSeen(@CurrentUser() user: JwtAccessPayload) {
    return this.notifications.markSeen(this.requireAdminUserId(user));
  }

  private requireAdminUserId(user: JwtAccessPayload): string {
    if (!user.adminUserId) throw new ForbiddenException("This endpoint requires an authenticated admin session.");
    return user.adminUserId;
  }
}
