import { Module } from "@nestjs/common";
import { StorefrontModule } from "../storefront/storefront.module";
import { PlansModule } from "../plans/plans.module";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsModule } from "../settings-registry/settings.module";
import { BuyerChatController } from "./buyer-chat.controller";
import { BuyerChatService } from "./buyer-chat.service";
import { SellerBuyerChatController } from "./seller-buyer-chat.controller";

@Module({
  imports: [StorefrontModule, SettingsModule, PlansModule],
  controllers: [BuyerChatController, SellerBuyerChatController],
  providers: [BuyerChatService, RateLimitService],
})
export class BuyerChatModule {}
