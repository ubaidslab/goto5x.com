import { Body, Controller, Post } from "@nestjs/common";
import { UnsubscribeCampaignDto } from "./dto/unsubscribe-campaign.dto";
import { EmailCampaignsService } from "./email-campaigns.service";

/** Public, unauthenticated - the buyer clicking a campaign email's unsubscribe link never had a session (FR-51.3). */
@Controller("storefront/campaigns")
export class StorefrontCampaignsController {
  constructor(private readonly campaigns: EmailCampaignsService) {}

  @Post("unsubscribe")
  unsubscribe(@Body() dto: UnsubscribeCampaignDto) {
    return this.campaigns.unsubscribe(dto.token);
  }
}
