import { Module } from "@nestjs/common";
import { OrderPricingService } from "../orders/order-pricing.service";
import { SettingsModule } from "../settings-registry/settings.module";
import { StorefrontModule } from "../storefront/storefront.module";
import { WhatsAppMessagingController } from "./whatsapp-messaging.controller";
import { WhatsAppMessagingService } from "./whatsapp-messaging.service";

@Module({
  imports: [SettingsModule, StorefrontModule],
  controllers: [WhatsAppMessagingController],
  providers: [WhatsAppMessagingService, OrderPricingService],
})
export class WhatsAppMessagingModule {}
