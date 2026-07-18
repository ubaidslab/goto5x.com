import { Module } from "@nestjs/common";
import { TrustSafetyModule } from "../trust-safety/trust-safety.module";
import { SellersController } from "./sellers.controller";
import { SellersService } from "./sellers.service";

@Module({
  imports: [TrustSafetyModule],
  controllers: [SellersController],
  providers: [SellersService],
})
export class SellersModule {}
