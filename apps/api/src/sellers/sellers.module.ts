import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TrustSafetyModule } from "../trust-safety/trust-safety.module";
import { SellersController } from "./sellers.controller";
import { SellersService } from "./sellers.service";

@Module({
  imports: [TrustSafetyModule, AuthModule],
  controllers: [SellersController],
  providers: [SellersService],
})
export class SellersModule {}
