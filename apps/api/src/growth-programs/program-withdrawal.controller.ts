import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { BlockDuringImpersonation } from "../common/decorators/block-during-impersonation.decorator";
import { ImpersonationWriteGuard } from "../common/guards/impersonation-write.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { ClawbackDto } from "./dto/clawback.dto";
import { DecidePayoutDto, MarkPayoutPaidDto } from "./dto/decide-payout.dto";
import { RequestPayoutDto } from "./dto/request-payout.dto";
import { ProgramWithdrawalService } from "./program-withdrawal.service";

/** SRS §5.6b, reactivated by Module 22 (FR-33.9) - a program participant's own withdrawal requests. */
@Controller("sellers/me/growth-programs/withdrawals")
@UseGuards(JwtAuthGuard)
export class SellerProgramWithdrawalController {
  constructor(private readonly withdrawals: ProgramWithdrawalService) {}

  @Post()
  @UseGuards(ImpersonationWriteGuard)
  @BlockDuringImpersonation()
  request(@CurrentSellerId() sellerId: string, @Body() dto: RequestPayoutDto) {
    return this.withdrawals.requestPayout(sellerId, dto.amount);
  }

  @Get()
  listOwn(@CurrentSellerId() sellerId: string) {
    return this.withdrawals.listOwn(sellerId);
  }
}

/**
 * FR-33.11 - the withdrawal approval queue. Deliberately NOT
 * `@AllowReviewer()`, same discipline as AdminTrustSafetyController/
 * AdminSellerLifecycleController: this moves real money, more sensitive
 * than a content-approval or application queue.
 */
@Controller("admin/growth-programs/withdrawals")
@UseGuards(AdminAuthGuard)
export class AdminProgramWithdrawalController {
  constructor(private readonly withdrawals: ProgramWithdrawalService) {}

  @Get("queue")
  listQueue() {
    return this.withdrawals.listQueue();
  }

  @Post(":payoutId/approve")
  approve(@CurrentUser() user: JwtAccessPayload, @Param("payoutId") payoutId: string, @Body() dto: DecidePayoutDto) {
    this.assertAdminUserId(user);
    return this.withdrawals.approve(user.adminUserId, payoutId, dto.notes);
  }

  @Post(":payoutId/processing")
  processing(@CurrentUser() user: JwtAccessPayload, @Param("payoutId") payoutId: string) {
    this.assertAdminUserId(user);
    return this.withdrawals.markProcessing(user.adminUserId, payoutId);
  }

  @Post(":payoutId/paid")
  paid(@CurrentUser() user: JwtAccessPayload, @Param("payoutId") payoutId: string, @Body() dto: MarkPayoutPaidDto) {
    this.assertAdminUserId(user);
    return this.withdrawals.markPaid(user.adminUserId, payoutId, dto.paymentReference);
  }

  @Post(":payoutId/reject")
  reject(@CurrentUser() user: JwtAccessPayload, @Param("payoutId") payoutId: string, @Body() dto: DecidePayoutDto) {
    this.assertAdminUserId(user);
    return this.withdrawals.reject(user.adminUserId, payoutId, dto.notes);
  }

  /** FR-33.10 - a confirmed fraud finding's clawback against a program participant's own wallet. */
  @Post("sellers/:sellerId/clawback")
  clawback(@CurrentUser() user: JwtAccessPayload, @Param("sellerId") sellerId: string, @Body() dto: ClawbackDto) {
    this.assertAdminUserId(user);
    return this.withdrawals.clawback(user.adminUserId, sellerId, dto.amount, dto.notes);
  }

  private assertAdminUserId(user: JwtAccessPayload): asserts user is JwtAccessPayload & { adminUserId: string } {
    if (!user.adminUserId) {
      throw new ForbiddenException("This endpoint requires an authenticated admin session.");
    }
  }
}
