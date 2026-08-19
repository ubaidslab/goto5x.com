import { Controller, Get } from "@nestjs/common";
import { PlansService } from "./plans.service";

/**
 * FR-7.17 - public, unauthenticated: the pricing page and in-dashboard
 * upgrade prompts render entirely from this data, never a hard-coded tier
 * list (SRS §5.7).
 */
@Controller("plans")
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list() {
    return this.plans.listGrouped();
  }

  /** Module 61 (FR-7.21) - the pricing page's headline benefit block and Shopify comparison, Settings-Registry-driven. */
  @Get("pricing-copy")
  getPricingCopy() {
    return this.plans.getPricingCopy();
  }
}
