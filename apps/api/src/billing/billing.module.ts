import { forwardRef, Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { StepUpMfaGuard } from "../common/guards/step-up-mfa.guard";
import { InvoicesModule } from "../invoices/invoices.module";
import { PlansModule } from "../plans/plans.module";
import { PlatformGatewayModule } from "../platform-gateway/platform-gateway.module";
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
import { RetentionService } from "./retention.service";
import { RetentionScheduler } from "./retention.scheduler";
import { RenewalRemindersService } from "./renewal-reminders.service";
import { RenewalRemindersScheduler } from "./renewal-reminders.scheduler";
import { EmailTemplatesController } from "./email-templates.controller";
import { SubscriptionInvoiceController } from "./subscription-invoice.controller";
import { SubscriptionInvoiceService } from "./subscription-invoice.service";
import { AdminSubscriptionCancellationController } from "./admin-subscription-cancellation.controller";
import { SubscriptionRefundService } from "./subscription-refund.service";
import {
  AdminWalletController,
  SellerWalletController,
  StorePublishController,
  SupplierWalletController,
} from "./wallet.controller";
import { WebhookEventDedupeService } from "../payment-gateway/webhooks/webhook-event-dedupe.service";
import { BlockStaffSessionsGuard } from "../common/guards/block-staff-sessions.guard";
import { ImpersonationWriteGuard } from "../common/guards/impersonation-write.guard";
import { paddleClientProvider } from "./paddle/paddle-client.provider";
import { FoundingMembersService } from "./paddle/founding-members.service";
import { PaddleSubscriptionLifecycleService } from "./paddle/paddle-subscription-lifecycle.service";
import { PaddleWebhookController } from "./paddle/paddle-webhook.controller";
import { PaddleBillingController } from "./paddle/paddle-billing.controller";
import { AdminPaddleRefundController } from "./paddle/admin-paddle-refund.controller";

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
  // InvoicesModule wrapped in forwardRef() - it imports MediaModule, which
  // imports AuthModule, which (via GrowthProgramsModule) eventually imports
  // BillingModule itself; a plain import here would create a real circular
  // JS module-evaluation cycle (NestJS's scanner throws "imports array is
  // undefined" at the MediaModule step - not a DI-instantiation-order
  // issue forwardRef normally addresses, but the same fix defers module
  // resolution past the cycle either way).
  imports: [SettingsModule, AdminModule, PlansModule, TrustSafetyModule, PlatformGatewayModule, forwardRef(() => InvoicesModule)],
  controllers: [
    SellerInvoicesController,
    AdminInvoicesController,
    SellerWalletController,
    SupplierWalletController,
    AdminWalletController,
    StorePublishController,
    EmailTemplatesController,
    SubscriptionInvoiceController,
    AdminSubscriptionCancellationController,
    // D135/B3 (Paddle) - added directly here rather than a separate
    // PaddleBillingModule: the lifecycle service needs
    // WalletGraceLadderService (immediate access-end on refund), which
    // already lives in this module's own providers, not its exports-only
    // surface - a separate module importing this one back would recreate
    // the exact forwardRef cycle this file's own top comment already
    // documents for InvoicesModule. Paddle billing is billing; it joins
    // the existing flat module rather than adding a second one.
    PaddleWebhookController,
    PaddleBillingController,
    AdminPaddleRefundController,
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
    RetentionService,
    RetentionScheduler,
    RenewalRemindersService,
    RenewalRemindersScheduler,
    SubscriptionInvoiceService,
    SubscriptionRefundService,
    // D82 - TrustSafetyModule (already imported above) exports
    // StepUpMfaService, so this needed no new module imports; guards the
    // admin wallet-adjust route (wallet.controller.ts).
    StepUpMfaGuard,
    // D135/B3 (Paddle) - PaddleBillingController/AdminPaddleRefundController
    // need these two guards too; TrustSafetyModule (already imported)
    // exports SellerAgreementGuard itself, but these two are plain
    // common/guards classes no module here re-exports, so (same reasoning
    // as StepUpMfaGuard just above) they're listed explicitly.
    BlockStaffSessionsGuard,
    ImpersonationWriteGuard,
    paddleClientProvider,
    FoundingMembersService,
    PaddleSubscriptionLifecycleService,
    // D117/B2's WebhookEventDedupeService, reused as-is for Paddle events
    // (see webhook-event-dedupe.service.ts's own comment: no storeId/
    // tenant column, so nothing here is Paddle- or Stripe-specific).
    // PaymentGatewayModule already provides/constructs its own instance
    // for the Stripe webhook path; re-providing it here rather than
    // importing that module avoids reopening the InvoicesModule-style
    // cycle, for a class that is stateless beyond the globally-scoped
    // Prisma admin client both instances already share.
    WebhookEventDedupeService,
  ],
  exports: [LedgerService, InvoicesService, WalletService, SupplierWalletService, WalletGraceLadderService, PlanFeeDebitService, WalletReconciliationService, RetentionService, RenewalRemindersService, SubscriptionInvoiceService, SubscriptionRefundService],
})
export class BillingModule {}
