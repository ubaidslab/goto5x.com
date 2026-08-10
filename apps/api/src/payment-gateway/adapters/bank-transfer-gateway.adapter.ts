import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentGatewayProvider } from "@prisma/client";
import { GatewayVerifyContext, GatewayVerifyResult, SellerPaymentGatewayAdapter } from "../seller-payment-gateway-adapter.interface";

const DEFAULT_API_BASE = "https://bank-gateway-aggregator.example.com/v1";

/**
 * Generic bank-transfer adapter (SRS §5.6h/FR-6.36) - shaped as a
 * transaction-inquiry call against a bank-account-verification API
 * gateway/aggregator, since "any Pakistani bank" has no single common
 * merchant-verification API the way Raast/Easypaisa/JazzCash each publish
 * one. **The most structurally speculative of the four adapters and
 * unverified against any live sandbox** - flagged explicitly beyond the
 * disclosed-limitation note the other three carry, since this one has no
 * single real provider to shape the request/response contract from. A
 * seller with no gateway connected at all keeps using the pre-existing
 * manual mark-as-paid flow regardless (FR-6.38's fallback, unaffected by
 * this adapter's real-world readiness).
 */
@Injectable()
export class BankTransferGatewayAdapter implements SellerPaymentGatewayAdapter {
  readonly provider: PaymentGatewayProvider = "bank";

  constructor(private readonly config: ConfigService) {}

  async verifyPayment(context: GatewayVerifyContext): Promise<GatewayVerifyResult> {
    const apiBase = this.config.get<string>("PAYMENT_GATEWAY_BANK_API_BASE") ?? DEFAULT_API_BASE;
    const path = context.testMode ? "/accounts/verify" : "/transactions/inquire";
    const res = await fetch(`${apiBase}${path}`, {
      method: context.testMode ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${context.connection.apiKey}`,
        "Content-Type": "application/json",
      },
      body: context.testMode
        ? undefined
        : JSON.stringify({
            accountId: context.connection.merchantId,
            reference: context.orderId,
            expectedAmount: context.amount,
            currency: context.currency,
            transactionReference: context.reference,
          }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { verified: false };
    if (context.testMode) return { verified: true };

    const body = (await res.json()) as { status: string; transactionId?: string };
    return { verified: body.status === "matched", providerReference: body.transactionId };
  }
}
