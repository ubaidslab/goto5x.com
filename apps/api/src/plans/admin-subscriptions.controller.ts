import { Body, Controller, ForbiddenException, Param, Post, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAccessPayload } from "../common/types";
import { AdminGrantPlanDto } from "./dto/admin-grant-plan.dto";
import { CreatePromoCodeDto } from "./dto/create-promo-code.dto";
import { PromoCodesService } from "./promo-codes.service";
import { SubscriptionsService } from "./subscriptions.service";

/** FR-7.8 (admin-granted plans) + FR-7.9 (platform promo code creation). */
@Controller("admin")
@UseGuards(AdminAuthGuard)
export class AdminSubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly promoCodes: PromoCodesService,
  ) {}

  @Post("sellers/:sellerId/plan")
  grantPlan(@CurrentUser() user: JwtAccessPayload, @Param("sellerId") sellerId: string, @Body() dto: AdminGrantPlanDto) {
    return this.subscriptions.adminGrantPlan(this.requireAdminUserId(user), sellerId, dto.planId);
  }

  @Post("promo-codes")
  createPromoCode(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreatePromoCodeDto) {
    return this.promoCodes.create(this.requireAdminUserId(user), dto);
  }

  private requireAdminUserId(user: JwtAccessPayload): string {
    if (!user.adminUserId) throw new ForbiddenException("This endpoint requires an authenticated admin session.");
    return user.adminUserId;
  }
}
