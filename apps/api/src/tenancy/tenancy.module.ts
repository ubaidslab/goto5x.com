import { Module } from "@nestjs/common";
import { GuardrailsModule } from "../guardrails/guardrails.module";
import { StoresController } from "./stores.controller";
import { StoresService } from "./stores.service";

@Module({
  imports: [GuardrailsModule],
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class TenancyModule {}
