import { Module } from "@nestjs/common";
import { GuardrailsModule } from "../guardrails/guardrails.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { AdminFinanceTerminalController } from "./finance-terminal.controller";
import { FinanceTerminalService } from "./finance-terminal.service";

@Module({
  imports: [SettingsModule, GuardrailsModule, InvoicesModule],
  controllers: [AdminFinanceTerminalController],
  providers: [FinanceTerminalService],
})
export class FinanceTerminalModule {}
