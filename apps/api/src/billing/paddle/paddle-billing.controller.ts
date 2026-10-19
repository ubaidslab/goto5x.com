import { BadRequestException, Controller, Get, NotFoundException, Post, Query, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CurrentSellerId } from "../../common/decorators/current-seller.decorator";
import { BlockDuringImpersonation } from "../../common/decorators/block-during-impersonation.decorator";
import { BlockStaffSessions } from "../../common/decorators/block-staff-sessions.decorator";
import { BlockStaffSessionsGuard } from "../../common/guards/block-staff-sessions.guard";
import { ImpersonationWriteGuard } from "../../common/guards/impersonation-write.guard";
import { SellerAgreementGuard } from "../../trust-safety/seller-agreement.guard";
import { PrismaAdminService } from "../../prisma/prisma-admin.service";
import { PaddleSubscriptionLifecycleService } from "./paddle-subscription-lifecycle.service";

/**
 * D135/B3 (Paddle) - seller-facing self-service, same guard shape as
 * SubscriptionsController. Backend-only this pass (matching B2/D117's
 * own "backend-only this pass" precedent) - no frontend Paddle.js
 * checkout button exists yet; this is the data a future one calls.
 */
@Controller("sellers/me/subscription/paddle")
@UseGuards(SellerAgreementGuard, BlockStaffSessionsGuard)
@BlockStaffSessions()
export class PaddleBillingController {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly lifecycle: PaddleSubscriptionLifecycleService,
    private readonly config: ConfigService,
  ) {}

  /** What a future Paddle.js checkout call needs: the right pre-created Price for this seller's chosen plan+cycle, and the public client token. */
  @Get("checkout-price")
  async checkoutPrice(@Query("planId") planId: string, @Query("billingInterval") billingInterval: string) {
    if (!planId || !billingInterval) throw new BadRequestException("planId and billingInterval are required.");
    const mapping = await this.prismaAdmin.planCycleProviderPrice.findUnique({
      where: { uniq_plan_cycle_provider_price: { planId, billingInterval: billingInterval as never } },
    });
    if (!mapping?.paddlePriceId) throw new NotFoundException("No Paddle price is configured for this plan/cycle yet.");

    const clientToken = this.config.get<string>("PADDLE_CLIENT_TOKEN");
    if (!clientToken) throw new BadRequestException("Paddle billing is not configured.");

    return { paddlePriceId: mapping.paddlePriceId, paddleClientToken: clientToken };
  }

  /** D11/D134 - 100% refund within 14 days of any paid charge; auto-approve vs admin-review decided inside the service. */
  @Post("request-refund")
  @UseGuards(ImpersonationWriteGuard)
  @BlockDuringImpersonation()
  requestRefund(@CurrentSellerId() sellerId: string) {
    return this.lifecycle.requestRefund(sellerId);
  }
}
