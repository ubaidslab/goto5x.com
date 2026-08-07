import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { EmailService } from "../notifications/email.service";
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
import { WalletLowBalanceSweepScheduler } from "./wallet-low-balance-sweep.scheduler";
import { WalletReconciliationService } from "./wallet-reconciliation.service";
import { WalletReconciliationScheduler } from "./wallet-reconciliation.scheduler";
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
    EmailService,
    ManualBankTransferTopUpAdapter,
    WalletService,
    SupplierWalletService,
    WalletGraceLadderService,
    PlanFeeDebitService,
    PlanFeeDebitScheduler,
    WalletLowBalanceSweepScheduler,
    ProgramCommissionService,
    WalletReconciliationService,
    WalletReconciliationScheduler,
  ],
  exports: [LedgerService, InvoicesService, WalletService, SupplierWalletService, WalletGraceLadderService, PlanFeeDebitService, WalletReconciliationService],
})
export class BillingModule {}
