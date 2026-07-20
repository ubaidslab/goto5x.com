import { Injectable } from "@nestjs/common";

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
  instructionsFor(amount: number, currency: string): string;
}

@Injectable()
export class ManualBankTransferTopUpAdapter implements TopUpAdapter {
  readonly method = "bank_transfer";

  instructionsFor(amount: number, currency: string): string {
    return `Transfer ${amount.toFixed(2)} ${currency} to the platform's business bank account, then submit this top-up request for admin verification. Your wallet is credited once an admin confirms the transfer.`;
  }
}
