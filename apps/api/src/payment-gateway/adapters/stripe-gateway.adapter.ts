import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentGatewayProvider } from "@prisma/client";
import Stripe from "stripe";
import { GatewayVerifyContext, GatewayVerifyResult, SellerPaymentGatewayAdapter } from "../seller-payment-gateway-adapter.interface";
import { STRIPE_CREDENTIAL_SOURCE, StripeCredentialSource } from "../stripe/stripe-credential-source.interface";
import { stripeAmountToDecimal } from "../stripe/stripe-amount.util";

/**
 * B2 (founder decision, sandbox only) - unlike the other four adapters,
 * this one is built against the official Stripe SDK rather than a hand-
 * rolled fetch() - webhook signature verification (stripe-webhook.
 * controller.ts) is security-critical and the SDK's own
 * stripe.webhooks.constructEvent() is the canonical, audited
 * implementation, the same reasoning that put @aws-sdk/client-kms behind
 * KmsProvider instead of hand-signing AWS requests.
 *
 * verifyPayment() retrieves the buyer-submitted Checkout Session by ID
 * (the reference) rather than polling a "payments/verify"-style endpoint
 * the way Raast/Easypaisa/JazzCash do - Stripe Checkout's own session is
 * already the record of what was paid, no separate verify call exists.
 * The webhook (checkout.session.completed) is the primary, reliable
 * confirmation path in production; this method is the synchronous
 * fallback/manual-check path FR-6.39's testConnection() and a buyer's
 * own submitted reference both need.
 *
 * **Unverified against a live Stripe sandbox** - no Stripe test-mode
 * restricted key exists in this build environment, same disclosed
 * limitation as the other four adapters. scripts/verify-stripe-mock.ts
 * (run only by CI's stripe-mock-test job) proves the real request/
 * response wire format against Stripe's own stripe-mock fake API
 * server; e2e tests inject a fake SellerPaymentGatewayAdapter instead of
 * exercising this class.
 */
@Injectable()
export class StripeGatewayAdapter implements SellerPaymentGatewayAdapter {
  readonly provider: PaymentGatewayProvider = "stripe";

  constructor(
    private readonly config: ConfigService,
    @Inject(STRIPE_CREDENTIAL_SOURCE) private readonly credentialSource: StripeCredentialSource,
  ) {}

  private buildClient(apiKey: string): Stripe {
    const hostAndPort = this.config.get<string>("STRIPE_API_HOST");
    const protocol: "http" | "https" = this.config.get<string>("STRIPE_API_PROTOCOL") === "https" ? "https" : "http";
    // Stripe's own StripeConfig takes `host` and `port` as separate fields
    // (confirmed against the installed SDK's lib.d.ts) - a combined
    // "host:port" string in `host` alone silently fails to connect, so
    // STRIPE_API_HOST (one override var, same shape as AWS_KMS_ENDPOINT)
    // is split here rather than introducing a second env var.
    const [host, port] = hostAndPort ? hostAndPort.split(":") : [undefined, undefined];
    return new Stripe(apiKey, {
      apiVersion: "2026-09-30.endive",
      // Only ever set in CI, to point this SDK at a stripe-mock fake API
      // server instead of real Stripe - same precedent as AwsKmsProvider's
      // AWS_KMS_ENDPOINT override. Unset in every real environment.
      ...(host ? { host, ...(port ? { port } : {}), protocol } : {}),
      timeout: 10_000,
    });
  }

  async verifyPayment(context: GatewayVerifyContext): Promise<GatewayVerifyResult> {
    const { apiKey, connectedAccountId } = this.credentialSource.resolve(context.connection);
    const stripe = this.buildClient(apiKey);
    const requestOptions = connectedAccountId ? { stripeAccount: connectedAccountId } : undefined;

    if (context.testMode) {
      // "Events: Read" is one of the exact permissions a connected
      // restricted key must carry (docs/stripe-seller-setup.md) - a
      // cheap, side-effect-free call that proves the key is valid using
      // only that grant, rather than a Balance/Account-level call this
      // key was never asked to have access to.
      await stripe.events.list({ limit: 1 }, requestOptions);
      return { verified: true };
    }

    if (!context.reference) return { verified: false };

    try {
      const session = await stripe.checkout.sessions.retrieve(context.reference, undefined, requestOptions);
      return {
        verified: session.payment_status === "paid",
        providerReference: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
        amount: session.amount_total !== null ? stripeAmountToDecimal(session.amount_total, session.currency ?? context.currency) : undefined,
      };
    } catch {
      return { verified: false };
    }
  }
}
