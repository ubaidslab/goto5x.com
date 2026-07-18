import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { AdminInvoicesController, SellerInvoicesController } from "./invoices.controller";
import { InvoiceGenerationScheduler } from "./invoice-generation.scheduler";
import { InvoiceOverdueScheduler } from "./invoice-overdue.scheduler";
import { InvoicesService } from "./invoices.service";
import { LedgerService } from "./ledger.service";

@Module({
  imports: [SettingsModule, AdminModule, PlansModule],
  controllers: [SellerInvoicesController, AdminInvoicesController],
  providers: [LedgerService, InvoicesService, InvoiceGenerationScheduler, InvoiceOverdueScheduler],
  exports: [LedgerService, InvoicesService],
})
export class BillingModule {}
