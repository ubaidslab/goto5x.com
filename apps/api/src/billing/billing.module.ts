import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { TrustSafetyModule } from "../trust-safety/trust-safety.module";
import { AdminInvoicesController, SellerInvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { LedgerService } from "./ledger.service";
import { ManualBankTransferTopUpAdapter } from "./top-up-adapter.interface";
import { WalletService } from "./wallet.service";
import { SupplierWalletService } from "./supplier-wallet.service";
import { WalletGraceLadderService } from "./wallet-grace-ladder.service";
import { PlanFeeDebitService } from "./plan-fee-debit.service";
import { PlanFeeDebitScheduler } from "./plan-fee-debit.scheduler";
import { ProgramCommissionService } from "./program-commission.service";
import { WalletReconciliationService } from "./wallet-reconciliation.service";
import { WalletReconciliationScheduler } from "./wallet-reconciliation.scheduler";
import { PlanFeeRenewalExportTrigger } from "./plan-fee-renewal-export.service";
import {
  AdminWalletController,
  SellerWalletController,
  StorePublishController,
  SupplierWalletController,
} from "./wallet.controller";

/**
 * Module 20 (SRS §5.6e) - FR-6.28: InvoiceGenerationScheduler/
 * InvoiceOverdueScheduler are gone from providers here (no repeating
 * BullMQ job gets scheduled), and their worker.main.ts consumers are
 * removed too - but InvoicesService's generateMonthlyInvoices()/
 * generateMonthlyGroupInvoices()/sweepOverdueInvoicesAndSuspend() methods
 * are untouched, still fully present and callable. "Unscheduled, not
 * deleted" - a future enterprise/post-paid mode re-adds a scheduler+worker
 * pair pointing at this same, still-working code.
 *
 * Module 73 (v0.38) applies the exact same "unscheduled, not deleted"
 * treatment to WalletLowBalanceSweepScheduler: removed from providers here
 * (and its worker.main.ts consumer removed too) since it would otherwise
 * actively harm every seller - with wallet hidden and commission at 0%,
 * every balance sits at 0 forever, which is BELOW any positive warning
 * threshold, so a still-scheduled sweep would eventually pause every
 * seller's stores for a "low balance" that was never really a debt. The
 * service/scheduler/queue files themselves are untouched and still unit-
 * tested - only the recurring registration is gone. The publish gate's own
 * wallet-balance precondition is dropped for the same reason (see
 * WalletGraceLadderService.publish()); plan-fee non-payment is enforced
 * entirely by PlanFeeDebitService's grace-day sweep now.
 */
@Module({
  imports: [SettingsModule, AdminModule, PlansModule, TrustSafetyModule],
  controllers: [
    SellerInvoicesController,
    AdminInvoicesController,
    SellerWalletController,
    SupplierWalletController,
    AdminWalletController,
    StorePublishController,
  ],
  providers: [
    LedgerService,
    InvoicesService,
    ManualBankTransferTopUpAdapter,
    WalletService,
    SupplierWalletService,
    WalletGraceLadderService,
    PlanFeeDebitService,
    PlanFeeDebitScheduler,
    PlanFeeRenewalExportTrigger,
    ProgramCommissionService,
    WalletReconciliationService,
    WalletReconciliationScheduler,
  ],
  exports: [LedgerService, InvoicesService, WalletService, SupplierWalletService, WalletGraceLadderService, PlanFeeDebitService, WalletReconciliationService],
})
export class BillingModule {}
