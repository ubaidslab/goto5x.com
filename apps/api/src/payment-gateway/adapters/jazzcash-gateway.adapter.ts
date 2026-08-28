import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentGatewayProvider } from "@prisma/client";
import { GatewayVerifyContext, GatewayVerifyResult, SellerPaymentGatewayAdapter } from "../seller-payment-gateway-adapter.interface";

const DEFAULT_API_BASE = "https://payments.jazzcash.com.pk/ApplicationAPI/API";

/**
 * Real implementation shaped from JazzCash's publicly documented merchant
 * status-inquiry API - **unverified against a live sandbox**, same
 * disclosed limitation as RaastGatewayAdapter's own doc comment. e2e tests
 * inject a fake `SellerPaymentGatewayAdapter` instead of exercising this
 * class.
 */
@Injectable()
export class JazzCashGatewayAdapter implements SellerPaymentGatewayAdapter {
  readonly provider: PaymentGatewayProvider = "jazzcash";

  constructor(private readonly config: ConfigService) {}

  async verifyPayment(context: GatewayVerifyContext): Promise<GatewayVerifyResult> {
    const apiBase = this.config.get<string>("PAYMENT_GATEWAY_JAZZCASH_API_BASE") ?? DEFAULT_API_BASE;
    if (!apiBase.startsWith("https://")) {
      throw new Error("JazzCash gateway API base must be https:// - refusing to send credentials over an insecure connection.");
    }
    const path = context.testMode ? "/Merchant/AccountInfo" : "/Payments/StatusInquiry";
    const res = await fetch(`${apiBase}${path}`, {
      method: context.testMode ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${context.connection.apiKey}`,
        "Content-Type": "application/json",
      },
      body: context.testMode
        ? undefined
        : JSON.stringify({
            pp_MerchantID: context.connection.merchantId,
            pp_TxnRefNo: context.orderId,
            pp_Amount: context.amount,
            pp_SecureHash: context.reference,
          }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { verified: false };
    if (context.testMode) return { verified: true };

    const body = (await res.json()) as { pp_ResponseCode: string; pp_RetreivalReferenceNo?: string; pp_Amount?: number };
    return { verified: body.pp_ResponseCode === "000", providerReference: body.pp_RetreivalReferenceNo, amount: body.pp_Amount !== undefined ? Number(body.pp_Amount) : undefined };
  }
}
