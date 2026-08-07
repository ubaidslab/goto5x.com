import { Module } from "@nestjs/common";
import { GuardrailsModule } from "../guardrails/guardrails.module";
import { MediaModule } from "../media/media.module";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { StoresController } from "./stores.controller";
import { StoresService } from "./stores.service";

@Module({
  imports: [GuardrailsModule, MediaModule, PlansModule, SettingsModule],
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class TenancyModule {}
