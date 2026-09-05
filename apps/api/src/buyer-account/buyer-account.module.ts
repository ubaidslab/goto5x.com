import { Module } from "@nestjs/common";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { BuyerAccountController } from "./buyer-account.controller";
import { BuyerAccountService } from "./buyer-account.service";

@Module({
  imports: [SettingsModule, PlansModule],
  controllers: [BuyerAccountController],
  providers: [BuyerAccountService],
})
export class BuyerAccountModule {}
