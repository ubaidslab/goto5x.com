import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { MilestonesService } from "./milestones.service";

/** SRS §5.47/FR-47.2 - the dashboard banner's read side. Bare functional endpoint (no design pass needed - one field-shape response). */
@Controller("stores/:storeId/milestones")
@UseGuards(JwtAuthGuard)
export class MilestonesController {
  constructor(private readonly milestones: MilestonesService) {}

  @Get("recent")
  getRecent(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.milestones.getRecent(sellerId, storeId);
  }
}
