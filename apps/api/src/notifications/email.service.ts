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

  async send(to: string, subject: string, body: string): Promise<void> {
    const provider = this.config.get<string>("EMAIL_PROVIDER", "console");

    if (provider === "console") {
      // Local dev / test default: no real email provider required to run
      // the app or its test suite.
      this.logger.log(`[console email] to=${to} subject="${subject}"\n${body}`);
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
   * platform never touches the money in any v1.0 flow.
   */
  async sendOrderConfirmationEmail(
    to: string,
    storeName: string,
    statusUrl: string,
    paymentInstructions: PaymentInstructionsLike,
  ): Promise<void> {
    const howToPay = formatPaymentInstructions(paymentInstructions);
    await this.send(
      to,
      `Your order from ${storeName}`,
      `Thanks for your order! Pay ${storeName} directly using one of the methods below - once they confirm receipt, your order moves to confirmed.\n\n${howToPay}\n\nTrack its status any time here: ${statusUrl}`,
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
}
