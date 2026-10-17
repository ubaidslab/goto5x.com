import { BadRequestException } from "@nestjs/common";

/**
 * B2 (founder decision) - "Restricted keys, not secret keys: sellers
 * connect with a Stripe restricted API key (rk_...) ... Reject sk_ keys
 * in validation with a clear message." A full secret key (sk_...) can do
 * anything on the seller's Stripe account; a restricted key scoped to
 * only the permissions this adapter actually calls (Checkout Sessions/
 * PaymentIntents write, Charges/Events read - see
 * docs/stripe-seller-setup.md) limits the blast radius of this
 * credential leaking from our side to exactly those operations, never
 * the seller's whole account (payouts, refunds, account settings, ...).
 *
 * Deliberately does not try to introspect which permissions a given
 * restricted key actually carries - Stripe has no API for that, only its
 * Dashboard. This is a shape check only; an under-scoped restricted key
 * still surfaces naturally as a 403 the first time it's actually used
 * (testMode's account.retrieve() call, or a real verify/checkout call),
 * which is the honest signal rather than a guess at introspection.
 */
export function assertStripeRestrictedKey(apiKey: string): void {
  if (apiKey.startsWith("sk_")) {
    throw new BadRequestException(
      "Stripe secret keys (sk_...) are not accepted here - connect a restricted key (rk_...) instead, scoped to Checkout Sessions/PaymentIntents write and Charges/Events read. See the seller setup guide for exactly how to create one.",
    );
  }
  if (!apiKey.startsWith("rk_")) {
    throw new BadRequestException("This doesn't look like a Stripe restricted key - it should start with rk_.");
  }
}
