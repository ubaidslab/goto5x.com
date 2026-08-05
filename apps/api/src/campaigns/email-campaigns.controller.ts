import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { EmailCampaignsService } from "./email-campaigns.service";

@Controller("stores/:storeId/campaigns")
@UseGuards(JwtAuthGuard)
export class EmailCampaignsController {
  constructor(private readonly campaigns: EmailCampaignsService) {}

  @Post()
  create(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(sellerId, storeId, dto);
  }

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.campaigns.list(sellerId, storeId);
  }

  @Get(":campaignId")
  getOne(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("campaignId") campaignId: string) {
    return this.campaigns.getOne(sellerId, storeId, campaignId);
  }
}
