import Stripe from "stripe";

/**
 * D117/B2 (founder decision) - the real wire-format counterpart to
 * stripe-gateway.adapter.spec.ts's mocked-SDK-client unit tests, same
 * relationship aws-kms.provider.spec.ts has to
 * scripts/verify-kms-localstack.ts. Only ever run by CI's
 * stripe-mock-test job (.github/workflows/ci.yml), against Stripe's own
 * open-source stripe-mock fake API server - a real HTTP round trip with
 * the real Stripe SDK's request signing/wire format, not a mocked
 * client.
 *
 * Deliberately not a Jest test, for the identical reason verify-kms-
 * localstack.ts isn't one - no safe Jest root/pattern in this repo
 * would pick this up ONLY in that one CI job and nowhere else.
 *
 * Usage: npx ts-node scripts/verify-stripe-mock.ts
 */

async function main() {
  const hostAndPort = process.env.STRIPE_API_HOST;
  if (!hostAndPort) throw new Error("STRIPE_API_HOST must be set - this script only runs against stripe-mock, never real Stripe.");
  // Stripe's StripeConfig takes `host`/`port` as separate fields, not a
  // combined "host:port" string (confirmed against the SDK's own lib.d.ts
  // - passing the combined form to `host` alone fails to connect at all).
  const [host, port] = hostAndPort.split(":");

  // stripe-mock DOES validate the key's shape despite not checking its
  // authenticity: it requires the exact sk_/rk_ + test_/live_ prefix and
  // rejects a key whose body contains underscores (confirmed empirically
  // against a live stripe-mock container - a key like the older
  // "..._accepts_any_key" 401s) - alphanumeric body only, no minimum
  // length (also confirmed empirically). Kept deliberately short and
  // low-entropy, not just alphanumeric - GitHub's own secret-scanning
  // push protection flags a longer alphanumeric sk_test_/rk_test_-shaped
  // string as a real Stripe key regardless of whether it actually is one.
  const stripe = new Stripe("rk_test_ci", {
    apiVersion: "2026-09-30.endive",
    host,
    ...(port ? { port } : {}),
    protocol: "http",
  });

  // eslint-disable-next-line no-console
  console.log(`Creating a Checkout Session against stripe-mock (${host})...`);
  const created = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price_data: { currency: "usd", product_data: { name: "stripe-mock verification" }, unit_amount: 1500 }, quantity: 1 }],
    success_url: "https://example.com/success",
    client_reference_id: "verify-stripe-mock-order",
  });
  if (!created.id.startsWith("cs_")) {
    throw new Error(`Expected a Checkout Session ID (cs_...), got "${created.id}".`);
  }
  // eslint-disable-next-line no-console
  console.log(`Created session ${created.id}. Retrieving it back...`);

  const retrieved = await stripe.checkout.sessions.retrieve(created.id);
  if (retrieved.id !== created.id) {
    throw new Error(`Round trip FAILED: retrieved session id "${retrieved.id}" does not match created "${created.id}".`);
  }

  // eslint-disable-next-line no-console
  console.log("Verifying Stripe.webhooks.constructEvent() against a real generateTestHeaderString() signature...");
  const secret = "whsec_stripe_mock_verification_secret";
  const payload = JSON.stringify({ id: "evt_verify_stripe_mock", type: "checkout.session.completed", data: { object: { id: created.id } } });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  const event = Stripe.webhooks.constructEvent(payload, header, secret);
  if (event.id !== "evt_verify_stripe_mock") {
    throw new Error("Signature verification round trip FAILED: constructEvent() did not return the expected event.");
  }

  // eslint-disable-next-line no-console
  console.log("OK - create -> retrieve round trip and webhook signature verification both work end-to-end against the real Stripe SDK wire format.");
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("stripe-mock verification FAILED:", e);
  process.exit(1);
});
