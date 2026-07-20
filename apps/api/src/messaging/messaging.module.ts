import { Module } from "@nestjs/common";
import { PlansModule } from "../plans/plans.module";
import { AdminPlatformMessagesController, SellerPlatformMessagesController } from "./platform-messages.controller";
import { PlatformMessagesService } from "./platform-messages.service";

@Module({
  imports: [PlansModule],
  controllers: [AdminPlatformMessagesController, SellerPlatformMessagesController],
  providers: [PlatformMessagesService],
  exports: [PlatformMessagesService],
})
export class MessagingModule {}
