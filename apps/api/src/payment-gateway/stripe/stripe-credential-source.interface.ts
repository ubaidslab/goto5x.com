/**
 * B2 (founder decision) - "Build it Connect-ready: put the credential
 * model behind an interface so Stripe Connect ... can replace per-store
 * keys later without rewriting the adapter." Today, a store's Stripe
 * restricted key IS the full authentication - the adapter calls the
 * Stripe API directly as that key. Under Stripe Connect (Standard
 * accounts via OAuth), the platform instead holds ONE Stripe account/key
 * and acts on a connected account's behalf via a `Stripe-Account`
 * request option - a materially different shape, which is exactly why
 * this is a separate resolution step rather than something
 * StripeGatewayAdapter reads off `context.connection` directly. Adding
 * Connect later means adding a second StripeCredentialSource
 * implementation and swapping the DI registration in
 * payment-gateway.module.ts - zero changes to the adapter itself.
 */
export interface StripeApiCredentials {
  /** The Stripe API key to authenticate with - a restricted key today, the platform's own key once Connect replaces this. */
  apiKey: string;
  /** Only set under Stripe Connect - the connected account to act on behalf of. Always undefined today. */
  connectedAccountId?: string;
}

export const STRIPE_CREDENTIAL_SOURCE = Symbol("STRIPE_CREDENTIAL_SOURCE");

export interface StripeCredentialSource {
  resolve(connection: { apiKey: string; merchantId: string | null }): StripeApiCredentials;
}
