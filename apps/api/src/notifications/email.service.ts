import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { formatPaymentInstructions, PaymentInstructionsLike } from "../store-settings/payment-instructions.service";

/**
 * Minimal email sending for Module 1's auth flows only (verification,
 * password reset). The full Notifications module (order/payout/listing
 * emails) is a later module, per docs/build-plan.md - this is deliberately
 * not that module.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

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
      "Verify your goto5x.com account",
      `Click to verify your email: ${verifyUrl}`,
    );
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.send(
      to,
      "Reset your goto5x.com password",
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
      `Your goto5x.com wallet balance has dropped below the recommended minimum. Top up within ${graceDays} day(s) to avoid your store(s) pausing new orders - your storefront stays visible, but checkout will be temporarily unavailable until you top up.`,
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
      "Your goto5x.com data export is ready",
      `Your latest data export (products, orders, customers, and a summary PDF) is ready to download. Log in here, then go to Settings -> Data export: ${dashboardLoginUrl}\n\nThis is a convenience export for your own records - it is not a substitute for our own platform backups, which run automatically regardless.`,
    );
  }
}
