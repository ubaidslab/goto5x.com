import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentGatewayProvider } from "@prisma/client";
import { GatewayVerifyContext, GatewayVerifyResult, SellerPaymentGatewayAdapter } from "../seller-payment-gateway-adapter.interface";

const DEFAULT_API_BASE = "https://raast-participant.example.com/v1";

/**
 * Real implementation shaped from the State Bank of Pakistan's published
 * Raast participant-bank integration model (a merchant authenticates
 * against its own bank's Raast gateway, not a single central SBP REST
 * API) - **unverified against a live sandbox**, since no Raast merchant
 * credentials exist in this build environment. Same disclosed limitation
 * already carried by Module 8's PrintifyHttpClient and the Safepay/COD
 * adapters (see that class's own doc comment). e2e tests inject a fake
 * `SellerPaymentGatewayAdapter` instead of exercising this class.
 *
 * Raast is the first-priority provider (FR-6.36) - zero merchant fee,
 * offered first in both the connect flow and the checkout provider list.
 */
@Injectable()
export class RaastGatewayAdapter implements SellerPaymentGatewayAdapter {
  readonly provider: PaymentGatewayProvider = "raast";

  constructor(private readonly config: ConfigService) {}

  async verifyPayment(context: GatewayVerifyContext): Promise<GatewayVerifyResult> {
    const apiBase = this.config.get<string>("PAYMENT_GATEWAY_RAAST_API_BASE") ?? DEFAULT_API_BASE;
    const path = context.testMode ? "/merchant/account" : "/payments/verify";
    const res = await fetch(`${apiBase}${path}`, {
      method: context.testMode ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${context.connection.apiKey}`,
        "Content-Type": "application/json",
      },
      body: context.testMode
        ? undefined
        : JSON.stringify({
            merchantId: context.connection.merchantId,
            orderId: context.orderId,
            amount: context.amount,
            currency: context.currency,
            reference: context.reference,
          }),
      // Module 9 hardening precedent (checkout.service.ts) - a checkout-path
      // network call must never be able to hang indefinitely.
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { verified: false };
    if (context.testMode) return { verified: true };

    const body = (await res.json()) as { status: string; reference?: string };
    return { verified: body.status === "completed", providerReference: body.reference };
  }
}
