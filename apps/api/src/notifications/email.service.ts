import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { formatPaymentInstructions, PaymentInstructionsLike } from "../store-settings/payment-instructions.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";

/**
 * Minimal email sending for Module 1's auth flows only (verification,
 * password reset). The full Notifications module (order/payout/listing
 * emails) is a later module, per docs/build-plan.md - this is deliberately
 * not that module.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prismaAdmin: PrismaAdminService,
  ) {}

  async send(to: string, subject: string, body: string, attachmentUrl?: string | null): Promise<void> {
    const provider = this.config.get<string>("EMAIL_PROVIDER", "console");

    if (provider === "console") {
      // Local dev / test default: no real email provider required to run
      // the app or its test suite.
      const attachmentLine = attachmentUrl ? `\n[attachment] ${attachmentUrl}` : "";
      this.logger.log(`[console email] to=${to} subject="${subject}"\n${body}${attachmentLine}`);
      return;
    }

    // Real providers (Resend/SES-class, per docs/tech-stack.md) plug in here
    // in a later module once EMAIL_PROVIDER_API_KEY is configured for a real
    // environment. Not implemented in Module 1 beyond the console fallback.
    throw new Error(`Email provider "${provider}" is not yet implemented.`);
  }

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    await this.send(
      to,
      "Verify your uzeyn.com account",
      `Click to verify your email: ${verifyUrl}`,
    );
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.send(
      to,
      "Reset your uzeyn.com password",
      `Click to reset your password (this link expires soon): ${resetUrl}`,
    );
  }

  /**
   * FR-5.4 - the order confirmation email is what actually delivers the
   * buyer's unguessable status-lookup link (Module 9, CheckoutService).
   * FR-6.14 (Module 11) - also carries the seller's payment instructions,
   * framed as "pay the seller directly, then they confirm" since the
   * platform never touches the money in any v1.0 flow. FR-19.1 (Module 15)
   * - carries the generated PDF invoice as an attachment when rendering
   * succeeded; `invoicePdfUrl` is null if it failed (best-effort, never
   * blocks the order itself).
   */
  async sendOrderConfirmationEmail(
    to: string,
    storeName: string,
    statusUrl: string,
    paymentInstructions: PaymentInstructionsLike,
    invoicePdfUrl?: string | null,
  ): Promise<void> {
    const howToPay = formatPaymentInstructions(paymentInstructions);
    await this.send(
      to,
      `Your order from ${storeName}`,
      `Thanks for your order! Pay ${storeName} directly using one of the methods below - once they confirm receipt, your order moves to confirmed.\n\n${howToPay}\n\nTrack its status any time here: ${statusUrl}`,
      invoicePdfUrl,
    );
  }

  /** FR-5.2 - fires on confirmed/shipped/delivered status changes only (Module 9, OrdersService). */
  async sendOrderStatusEmail(to: string, storeName: string, statusLabel: string, statusUrl: string): Promise<void> {
    await this.send(
      to,
      `Your order from ${storeName} is ${statusLabel}`,
      `Your order status has been updated to "${statusLabel}". Track it here: ${statusUrl}`,
    );
  }

  /** SRS §5.23/FR-23.2 - the dormant-store lifecycle job's warning stage. */
  async sendDormantStoreWarning(to: string, storeName: string): Promise<void> {
    await this.send(
      to,
      `Your store "${storeName}" has been inactive`,
      `We haven't seen any activity on "${storeName}" in a while. If it stays inactive, it will be suspended and eventually archived. Log in and make any change to keep it active.`,
    );
  }

  /** Module 20 (SRS §5.6e, FR-6.25) - the wallet grace ladder's warning stage. */
  async sendWalletLowBalanceWarning(to: string, graceDays: number): Promise<void> {
    await this.send(
      to,
      "Your wallet balance is running low",
      `Your uzeyn.com wallet balance has dropped below the recommended minimum. Top up within ${graceDays} day(s) to avoid your store(s) pausing new orders - your storefront stays visible, but checkout will be temporarily unavailable until you top up.`,
    );
  }

  /**
   * Module 24 (SRS §5.36, FR-36.3, revised v0.28) - the fallback path when
   * a seller has no active Google Drive connection with upload access.
   * `dashboardLoginUrl` is deliberately a login link, never a raw
   * object-storage link - the export contains customer PII, so the email
   * itself must not be a viable path to the files without authenticating.
   */
  async sendDataExportReadyEmail(to: string, dashboardLoginUrl: string): Promise<void> {
    await this.send(
      to,
      "Your uzeyn.com data export is ready",
      `Your latest data export (products, orders, customers, and a summary PDF) is ready to download. Log in here, then go to Settings -> Data export: ${dashboardLoginUrl}\n\nThis is a convenience export for your own records - it is not a substitute for our own platform backups, which run automatically regardless.`,
    );
  }

  /** Module 55 (SRS §5.62/FR-62.1) - immediate, to the seller, on every new order (order emails before this module only ever went to the buyer). */
  async sendNewOrderAlertEmail(to: string, storeName: string, orderNumber: number, orderUrl: string, totalAmount: string, currency: string): Promise<void> {
    await this.send(
      to,
      `New order #${orderNumber} on ${storeName}`,
      `You've got a new order! Order #${orderNumber} for ${currency} ${totalAmount} just came in on ${storeName}. View it here: ${orderUrl}`,
    );
  }

  /** Module 55 (FR-62.1) - built on Module 54's new time-bucketed analytics queries. Only sent to a store with at least one confirmed order that day. */
  async sendDailySalesSummaryEmail(to: string, storeName: string, dateLabel: string, orderCount: number, revenue: string, currency: string, dashboardUrl: string): Promise<void> {
    await this.send(
      to,
      `${storeName}: your sales summary for ${dateLabel}`,
      `${orderCount} order${orderCount === 1 ? "" : "s"} confirmed on ${storeName} for ${dateLabel}, totaling ${currency} ${revenue} in revenue. See the full breakdown: ${dashboardUrl}`,
    );
  }

  /** Module 55 (FR-62.1) - wires Module 28's isLowStock computation to an actual email trigger; debounced by ProductVariant.lowStockAlertSentAt so a seller gets one alert per dip, not one per subsequent sale. */
  async sendLowStockAlertEmail(to: string, storeName: string, productTitle: string, sku: string, stockQuantity: number, threshold: number, inventoryUrl: string): Promise<void> {
    await this.send(
      to,
      `Low stock: ${productTitle} on ${storeName}`,
      `"${productTitle}" (SKU ${sku}) is down to ${stockQuantity} unit${stockQuantity === 1 ? "" : "s"} on ${storeName}, at or below your low-stock threshold of ${threshold}. Restock it here: ${inventoryUrl}`,
    );
  }

  /** Module 55 (FR-62.1) - the order-verification-specific counterpart to sendDormantStoreWarning/sendWalletLowBalanceWarning above; fires when a buyer exhausts their OTP attempts, since the order can't confirm until the seller or buyer acts. */
  async sendOrderVerificationFailedEmail(to: string, storeName: string, orderUrl: string): Promise<void> {
    await this.send(
      to,
      `Order verification failed on ${storeName}`,
      `A buyer's order verification on ${storeName} failed after too many incorrect attempts. The order can't be confirmed until a fresh verification code is sent and completed. View it here: ${orderUrl}`,
    );
  }

  /**
   * Phase 5 (founder-requested "missing tracking" alert) - fires once per
   * order from MissingTrackingAlertService's sweep (Order.
   * missingTrackingAlertedAt dedupes it), never per-sweep-run. Two near-
   * identical variants for the two possible responsible parties (self-
   * fulfilled seller vs. supplier-fulfilled item) - same reasoning as
   * sendOrderStatusEmail's own separate buyer/seller copy, not a shared
   * template with branching inside it.
   */
  async sendMissingTrackingAlertToSellerEmail(to: string, storeName: string, orderNumber: number, orderUrl: string, hoursOverdue: number): Promise<void> {
    await this.send(
      to,
      `Order #${orderNumber} on ${storeName} still has no tracking`,
      `Order #${orderNumber} on ${storeName} was confirmed ${hoursOverdue} hour${hoursOverdue === 1 ? "" : "s"} ago and still has no tracking uploaded. Add tracking (or mark it shipped) here: ${orderUrl}`,
    );
  }

  async sendMissingTrackingAlertToSupplierEmail(to: string, storeName: string, orderNumber: number, hoursOverdue: number): Promise<void> {
    await this.send(
      to,
      `Order #${orderNumber} for ${storeName} still has no tracking`,
      `An order (#${orderNumber}) you're fulfilling for ${storeName} was confirmed ${hoursOverdue} hour${hoursOverdue === 1 ? "" : "s"} ago and still has no tracking uploaded. Upload tracking from your supplier portal as soon as it ships.`,
    );
  }

  /**
   * SRS §5.6k/FR-6.41 (Module 64) - the 14-day retention window's three
   * warning emails (day 0/7/13, `daysRemaining` computed by the caller).
   * Deliberately hardcoded copy, not the admin-editable EmailTemplate
   * mechanism Module 65 uses - the exact deletion scope stated here is
   * legally/operationally load-bearing and must never drift from what the
   * job actually deletes, so it is not left open to admin editing. This
   * warning is never gated by the seller notification opt-out (unlike
   * every other email in this file) - a seller cannot suppress the one
   * notice that their data is about to be permanently deleted.
   */
  async sendDataRetentionWarningEmail(to: string, storeName: string, daysRemaining: number): Promise<void> {
    const urgency = daysRemaining <= 0 ? "today" : `in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
    await this.send(
      to,
      `Action needed: "${storeName}" data will be deleted ${urgency}`,
      `"${storeName}" has been paused for non-payment. Unless you complete a plan-fee payment, all of its products, orders, customers, and store-specific settings (theme, domain, discount codes, gift cards, campaigns, segments) and analytics history will be permanently deleted ${urgency}.\n\n` +
        `Your own seller account, billing history, and audit records are never deleted - you can always log back in and start a new store. But this store's data cannot be recovered once deleted.\n\n` +
        `If you haven't already, export your data now from Settings -> Data export (delivered to your own Google Drive) as a backup before it's gone.`,
    );
  }

  /**
   * SRS §5.6k/FR-6.44 (Module 67) - fires from the 6-hourly health-check
   * sweep only (never per-checkout-failure, which would spam a seller
   * every time one buyer's payment failed to verify), gated by
   * PaymentGatewayHealthAlert's sticky alertedAt so it never re-sends
   * while a provider stays degraded.
   */
  async sendGatewayHealthAlertEmail(to: string, providerLabel: string): Promise<void> {
    await this.send(
      to,
      `${providerLabel} payments are experiencing issues`,
      `We're seeing a higher-than-normal verification failure rate for ${providerLabel} right now. Your store's checkout automatically falls back to manual/COD confirmation when this happens, so buyers can still order - you may just see more orders awaiting manual confirmation than usual until this clears. No action is needed on your end.`,
    );
  }

  /**
   * SRS §5.6k/FR-6.47 (Module 70a) - the monthly summary email. Unconditional
   * (see MonthlySellerReportService's own doc comment) - no seller
   * notification opt-out gates it, same as `sendDailySalesSummaryEmail`.
   */
  async sendMonthlySellerReportEmail(to: string, monthLabel: string, orderCount: number, revenue: number, subscriptionPaid: number, currency: string): Promise<void> {
    await this.send(
      to,
      `Your uzeyn.com summary for ${monthLabel}`,
      `Here's your summary for ${monthLabel}: ${orderCount} order${orderCount === 1 ? "" : "s"} confirmed, totaling ${currency} ${revenue.toFixed(2)} in revenue. You paid ${currency} ${subscriptionPaid.toFixed(2)} in subscription plan fees this period (commission is 0% platform-wide). Download your UZEYN subscription invoice any time from Settings -> Billing.`,
    );
  }

  /** SRS §5.6k/FR-8.18 (Module 90) - the near-breach sweep's one email to the admin queue (every admin account - no per-ticket routing exists). */
  async sendTicketNearBreachEmail(to: string, ticketSubject: string, storeName: string): Promise<void> {
    await this.send(
      to,
      `SLA near breach: "${ticketSubject}" (${storeName})`,
      `Support ticket "${ticketSubject}" from ${storeName} has crossed 80% of its SLA response window and is still open. Respond soon to stay within the committed response time.`,
    );
  }

  /**
   * Module 65 (SRS §5.6k, FR-6.42) - the one send path that reads its
   * copy from the admin-editable EmailTemplate table instead of a
   * hardcoded string, substituting `{{key}}` placeholders. Logs and skips
   * (never throws) when a template key is missing, since this is always
   * called from an unattended scheduled sweep, not a user-facing action -
   * one missing/renamed template must not crash the whole sweep for every
   * other seller in it.
   */
  async sendTemplatedEmail(templateKey: string, to: string, placeholders: Record<string, string>): Promise<void> {
    const template = await this.prismaAdmin.emailTemplate.findUnique({ where: { key: templateKey } });
    if (!template) {
      this.logger.error(`No EmailTemplate found for key "${templateKey}" - skipping send to ${to}.`);
      return;
    }
    const fill = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, name) => placeholders[name] ?? "");
    await this.send(to, fill(template.subject), fill(template.body));
  }
}
