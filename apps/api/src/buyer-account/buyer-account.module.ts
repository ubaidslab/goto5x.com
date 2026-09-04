import { Module } from "@nestjs/common";
import { BuyerAccountController } from "./buyer-account.controller";
import { BuyerAccountService } from "./buyer-account.service";

@Module({
  controllers: [BuyerAccountController],
  providers: [BuyerAccountService],
})
export class BuyerAccountModule {}
