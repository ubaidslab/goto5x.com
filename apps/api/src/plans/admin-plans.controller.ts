import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAccessPayload } from "../common/types";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import { PlansService } from "./plans.service";

/** FR-8.2 (minimal, scoped to what Module 14 needs) - create/edit/retire a plan tier without a deploy. */
@Controller("admin/plans")
@UseGuards(AdminAuthGuard)
export class AdminPlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list(@Query("includeInactive") includeInactive?: string) {
    return this.plans.listGrouped(includeInactive === "true");
  }

  @Post()
  create(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreatePlanDto) {
    return this.plans.create(this.requireAdminUserId(user), dto);
  }

  @Patch(":planId")
  update(@CurrentUser() user: JwtAccessPayload, @Param("planId") planId: string, @Body() dto: UpdatePlanDto) {
    return this.plans.update(this.requireAdminUserId(user), planId, dto);
  }

  @Post(":planId/retire")
  retire(@CurrentUser() user: JwtAccessPayload, @Param("planId") planId: string) {
    return this.plans.retire(this.requireAdminUserId(user), planId);
  }

  private requireAdminUserId(user: JwtAccessPayload): string {
    if (!user.adminUserId) throw new ForbiddenException("This endpoint requires an authenticated admin session.");
    return user.adminUserId;
  }
}
