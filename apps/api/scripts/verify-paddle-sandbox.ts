import { Environment, Paddle } from "@paddle/paddle-node-sdk";

/**
 * D135/B3 (Paddle) - the real wire-format counterpart to
 * paddle-subscription-lifecycle.service.spec.ts/paddle-webhook.controller.
 * spec.ts's mocked-SDK-client unit tests, same relationship verify-
 * stripe-mock.ts has to stripe-gateway.adapter.spec.ts. Only ever run by
 * CI's paddle-sandbox-test job (.github/workflows/ci.yml).
 *
 * Unlike Stripe, Paddle publishes no local fake-API-server equivalent of
 * stripe-mock, and a Paddle subscription can only ever be created via
 * Paddle's own hosted/overlay checkout (Paddle.js), never a direct backend
 * API call (confirmed from the SDK's own SubscriptionsResource - no
 * `create` method exists) - so this script talks to Paddle's REAL
 * sandbox REST API instead of a mock, using the founder's own sandbox
 * credentials (GitHub Actions environment secret, sandbox-only, per
 * D134). It creates a throwaway Product + Price (proving the real SDK's
 * request signing/response parsing and the `.list().next()` pagination
 * shape all work against Paddle's actual API, not just mocks), archives
 * them again afterward, then - mirroring verify-stripe-mock.ts's own
 * inclusion of a local signature check alongside its API round trip -
 * exercises webhooks.unmarshal() against a hand-signed payload too (pure
 * local HMAC, no network call, so a throwaway secret is fine here; the
 * real PADDLE_WEBHOOK_SECRET doesn't need to exist as a CI secret for
 * this part).
 *
 * This script HARD-REFUSES anything but PADDLE_ENVIRONMENT=sandbox - a
 * second, code-level enforcement of D134's "live keys never go to CI"
 * rule, not just trust in what the secret happens to contain.
 *
 * Deliberately not a Jest test, for the identical reason verify-stripe-
 * mock.ts/verify-kms-localstack.ts aren't ones - no safe Jest root/
 * pattern in this repo would pick this up ONLY in that one CI job.
 *
 * Usage: PADDLE_API_KEY=... PADDLE_ENVIRONMENT=sandbox npx ts-node scripts/verify-paddle-sandbox.ts
 */

async function main() {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new Error("PADDLE_API_KEY must be set - this script only runs against Paddle's real sandbox, never live.");
  if (process.env.PADDLE_ENVIRONMENT !== "sandbox") {
    throw new Error(`PADDLE_ENVIRONMENT must be "sandbox" for this script (got "${process.env.PADDLE_ENVIRONMENT}") - refusing to run against live Paddle from CI (D134).`);
  }

  const paddle = new Paddle(apiKey, { environment: Environment.sandbox });
  const marker = `ci-verify-paddle-sandbox-${Date.now()}`;

  // eslint-disable-next-line no-console
  console.log("Creating a throwaway Product against Paddle's real sandbox API...");
  const product = await paddle.products.create({
    name: `goto5x CI verification ${marker}`,
    taxCategory: "saas",
    customData: { verification: marker },
  });
  if (!product.id.startsWith("pro_")) {
    throw new Error(`Expected a Product ID (pro_...), got "${product.id}".`);
  }

  // eslint-disable-next-line no-console
  console.log(`Created product ${product.id}. Retrieving it back...`);
  const retrievedProduct = await paddle.products.get(product.id);
  if (retrievedProduct.id !== product.id) {
    throw new Error(`Round trip FAILED: retrieved product id "${retrievedProduct.id}" does not match created "${product.id}".`);
  }

  // eslint-disable-next-line no-console
  console.log("Creating a throwaway Price under it...");
  const price = await paddle.prices.create({
    description: `CI verification price ${marker}`,
    productId: product.id,
    unitPrice: { amount: "100", currencyCode: "USD" },
    billingCycle: { interval: "month", frequency: 1 },
    customData: { verification: marker },
  });
  if (!price.id.startsWith("pri_")) {
    throw new Error(`Expected a Price ID (pri_...), got "${price.id}".`);
  }

  // eslint-disable-next-line no-console
  console.log("Confirming the real list()/.next() pagination shape against the sandbox API...");
  const firstPage = await paddle.products.list({ perPage: 1 }).next();
  if (!Array.isArray(firstPage) || firstPage.length === 0) {
    throw new Error("Expected products.list({perPage: 1}).next() to resolve to a non-empty array.");
  }

  // eslint-disable-next-line no-console
  console.log("Archiving the throwaway price and product...");
  await paddle.prices.update(price.id, { status: "archived" });
  await paddle.products.update(product.id, { status: "archived" });

  // eslint-disable-next-line no-console
  console.log("Verifying webhooks.unmarshal() against a hand-signed payload (pure local HMAC - no network call, no real webhook secret needed)...");
  const secret = "whsec_paddle_sandbox_verification_secret";
  const payload = JSON.stringify({
    event_id: "evt_verify_paddle_sandbox",
    event_type: "subscription.canceled",
    occurred_at: new Date().toISOString(),
    data: { id: "sub_verify", items: [], billing_cycle: { interval: "month", frequency: 1 } },
  });
  const ts = Math.floor(Date.now() / 1000);
  const { createHmac } = await import("crypto");
  const h1 = createHmac("sha256", secret).update(`${ts}:${payload}`).digest("hex");
  const event = await paddle.webhooks.unmarshal(payload, secret, `ts=${ts};h1=${h1}`);
  if (event.eventId !== "evt_verify_paddle_sandbox") {
    throw new Error("Signature verification round trip FAILED: unmarshal() did not return the expected event.");
  }

  // eslint-disable-next-line no-console
  console.log("OK - create -> retrieve -> list -> archive round trip and webhook signature verification both work end-to-end against Paddle's real sandbox SDK wire format.");
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("verify-paddle-sandbox FAILED:", e);
  process.exit(1);
});
