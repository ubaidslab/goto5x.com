import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { EmailCampaignsService } from "./email-campaigns.service";

/** SRS §5.52/FR-52.7-52.8 (Module 97) - a staff session needs the `marketing` scope. */
@Controller("stores/:storeId/campaigns")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
export class EmailCampaignsController {
  constructor(private readonly campaigns: EmailCampaignsService) {}

  @Post()
  @RequireStaffScope("marketing")
  create(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(sellerId, storeId, dto);
  }

  @Get()
  @RequireStaffScope("marketing", "read")
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.campaigns.list(sellerId, storeId);
  }

  /** Phase 4 UI/UX audit fix (FR-51.2) - the monthly quota, previously only discoverable via a rejected-send error. Declared before :campaignId so "quota" doesn't get swallowed by the dynamic param route. */
  @Get("quota")
  @RequireStaffScope("marketing", "read")
  getQuota(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.campaigns.getQuota(sellerId, storeId);
  }

  @Get(":campaignId")
  @RequireStaffScope("marketing", "read")
  getOne(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("campaignId") campaignId: string) {
    return this.campaigns.getOne(sellerId, storeId, campaignId);
  }
}
