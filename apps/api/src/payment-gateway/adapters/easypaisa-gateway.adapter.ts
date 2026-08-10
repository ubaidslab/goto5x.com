import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentGatewayProvider } from "@prisma/client";
import { GatewayVerifyContext, GatewayVerifyResult, SellerPaymentGatewayAdapter } from "../seller-payment-gateway-adapter.interface";

const DEFAULT_API_BASE = "https://easypay.easypaisa.com.pk/easypay/Confirm";

/**
 * Real implementation shaped from Easypaisa's publicly documented merchant
 * transaction-inquiry API - **unverified against a live sandbox**, same
 * disclosed limitation as RaastGatewayAdapter's own doc comment. e2e tests
 * inject a fake `SellerPaymentGatewayAdapter` instead of exercising this
 * class.
 */
@Injectable()
export class EasypaisaGatewayAdapter implements SellerPaymentGatewayAdapter {
  readonly provider: PaymentGatewayProvider = "easypaisa";

  constructor(private readonly config: ConfigService) {}

  async verifyPayment(context: GatewayVerifyContext): Promise<GatewayVerifyResult> {
    const apiBase = this.config.get<string>("PAYMENT_GATEWAY_EASYPAISA_API_BASE") ?? DEFAULT_API_BASE;
    const path = context.testMode ? "/account-info" : "/inquire";
    const res = await fetch(`${apiBase}${path}`, {
      method: context.testMode ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${context.connection.apiKey}`,
        "Content-Type": "application/json",
      },
      body: context.testMode
        ? undefined
        : JSON.stringify({
            storeId: context.connection.merchantId,
            orderRefNum: context.orderId,
            amount: context.amount,
            transactionRef: context.reference,
          }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { verified: false };
    if (context.testMode) return { verified: true };

    const body = (await res.json()) as { responseCode: string; transactionId?: string };
    return { verified: body.responseCode === "0000", providerReference: body.transactionId };
  }
}
