import { Module } from "@nestjs/common";
import { PnLController } from "./pnl.controller";
import { PnLService } from "./pnl.service";

@Module({
  controllers: [PnLController],
  providers: [PnLService],
})
export class PnLModule {}
