import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentSupplierId } from "../common/decorators/current-supplier.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ChangePlanDto } from "./dto/change-plan.dto";
import { SubscriptionsService } from "./subscriptions.service";

/** Module 20 (SRS FR-7.10 supplement) - a supplier's own plan self-service, mirroring SubscriptionsController's seller-side shape. */
@Controller("suppliers/me/subscription")
@UseGuards(JwtAuthGuard)
export class SupplierSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  get(@CurrentSupplierId() supplierId: string) {
    return this.subscriptions.getSupplierSubscription(supplierId);
  }

  @Post("change")
  change(@CurrentSupplierId() supplierId: string, @Body() dto: ChangePlanDto) {
    return this.subscriptions.requestSupplierPlanChange(supplierId, dto.planId);
  }
}
