import { Body, Controller, ForbiddenException, Param, Post, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAccessPayload } from "../common/types";
import { CancelSubscriptionDto } from "./dto/cancel-subscription.dto";
import { SubscriptionRefundService } from "./subscription-refund.service";

/** SRS §5.6k/FR-6.49 (Module 72) - admin-actioned cancellation, with a required reason, posting the one-time first-cycle refund when the seller still qualifies. */
@Controller("admin/sellers/:sellerId/subscription")
@UseGuards(AdminAuthGuard)
export class AdminSubscriptionCancellationController {
  constructor(private readonly subscriptionRefund: SubscriptionRefundService) {}

  @Post("cancel")
  cancel(@CurrentUser() user: JwtAccessPayload, @Param("sellerId") sellerId: string, @Body() dto: CancelSubscriptionDto) {
    if (!user.adminUserId) throw new ForbiddenException("This endpoint requires an authenticated admin session.");
    return this.subscriptionRefund.cancelWithRefund(user.adminUserId, sellerId, dto.reason);
  }
}
