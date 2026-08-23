import { Injectable } from "@nestjs/common";
import { SettingsService } from "../settings-registry/settings.service";

/**
 * Module 20 (SRS §5.6e, FR-6.23). Mirrors §3.5's Payment Adapter pattern:
 * v1.0 ships exactly one implementation (manual bank-transfer, the same
 * direct-collection trust model §5.6c already proved for invoices), so a
 * future gateway-based auto-top-up can plug in later as a second adapter
 * without touching WalletService/ledger logic at all.
 */
export interface TopUpAdapter {
  readonly method: string;
  /** Instructions shown to the seller/supplier for where/how to send the top-up amount. */
  instructionsFor(amount: number, currency: string): Promise<string>;
}

interface PlatformPaymentInstructions {
  bank: { enabled: boolean; accountTitle: string; accountNumber: string; iban: string; bankName: string };
  easypaisa: { enabled: boolean; accountTitle: string; number: string };
  jazzcash: { enabled: boolean; accountTitle: string; number: string };
}

@Injectable()
export class ManualBankTransferTopUpAdapter implements TopUpAdapter {
  readonly method = "bank_transfer";

  constructor(private readonly settings: SettingsService) {}

  /**
   * v0.41 audit fix - previously a hardcoded placeholder sentence with no
   * real account details. Now lists only the methods the founder has
   * actually enabled in `billing.platform_payment_instructions`, so this
   * can change/add receiving accounts without a deploy (the whole point
   * of the fix). Never fabricates a detail for a method that's disabled
   * or has no value entered - falls back to a clear "not configured yet"
   * message instead of pretending a real account exists.
   */
  async instructionsFor(amount: number, currency: string): Promise<string> {
    const config = await this.settings.resolve<PlatformPaymentInstructions>("billing.platform_payment_instructions");
    const lines: string[] = [];

    if (config.bank?.enabled && config.bank.accountNumber) {
      const parts = [
        config.bank.bankName && `Bank: ${config.bank.bankName}`,
        config.bank.accountTitle && `Account title: ${config.bank.accountTitle}`,
        `Account number: ${config.bank.accountNumber}`,
        config.bank.iban && `IBAN: ${config.bank.iban}`,
      ].filter(Boolean);
      lines.push(parts.join(" - "));
    }
    if (config.easypaisa?.enabled && config.easypaisa.number) {
      const parts = [config.easypaisa.accountTitle && `Account title: ${config.easypaisa.accountTitle}`, `Easypaisa: ${config.easypaisa.number}`].filter(
        Boolean,
      );
      lines.push(parts.join(" - "));
    }
    if (config.jazzcash?.enabled && config.jazzcash.number) {
      const parts = [config.jazzcash.accountTitle && `Account title: ${config.jazzcash.accountTitle}`, `JazzCash: ${config.jazzcash.number}`].filter(
        Boolean,
      );
      lines.push(parts.join(" - "));
    }

    if (lines.length === 0) {
      return "Payment instructions haven't been configured yet - contact support before sending a payment.";
    }

    return `Transfer ${amount.toFixed(2)} ${currency} to one of the following, then submit this request for admin verification (your account is credited once an admin confirms the transfer):\n${lines.map((l) => `- ${l}`).join("\n")}`;
  }
}
