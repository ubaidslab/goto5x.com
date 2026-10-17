# Connecting Stripe (seller setup guide)

B2 (founder decision, D117) - written now, for the future seller-facing
connect UI to show (that UI doesn't exist yet; the backend this
describes is live today via `POST /stores/:storeId/payment-gateway`).
**Sandbox only** - use a Stripe *test-mode* restricted key and a
*test-mode* webhook endpoint. Do not use live-mode credentials; Stripe
is not yet promoted to "live" in this platform's own gateway registry
(`docs/gateway-verification/README.md`'s evidence gate), and real buyer
checkout never offers Stripe as an option until it is.

## 1. Create a restricted API key (never a secret key)

A full secret key (`sk_...`) can do anything on your Stripe account -
refunds, payouts, account settings, everything. This platform only ever
needs a **restricted key** (`rk_...`), scoped to exactly four
permissions. A key starting with `sk_` is rejected at connect time with
a clear error; only `rk_...` is accepted.

In your Stripe Dashboard:

1. Go to **Developers → API keys → Create restricted key**.
2. Give it a name (e.g. "uzeyn storefront - sandbox").
3. Grant exactly these permissions, nothing else:
   - **Checkout Sessions** - Write
   - **Payment Intents** - Write
   - **Charges** - Read
   - **Events** - Read
4. Leave every other permission at **None**.
5. Create the key and copy the `rk_test_...` value - Stripe only shows
   it once.

If this key's permissions are ever too narrow for something this
adapter actually calls, that call fails with a 403 from Stripe itself
the first time it's used (the connect-time "test connection" action, or
a real verify/checkout call) - a clear, honest signal, not a silent
failure. This platform never tries to introspect a key's permissions on
your behalf; Stripe has no API for that, only the Dashboard above.

## 2. Create a webhook endpoint

Stripe confirms a completed checkout via webhook, not by the buyer's
browser alone (a browser redirect can be interrupted; the webhook is
the reliable signal). Each store has its own webhook endpoint and its
own signing secret - connecting a different store's secret, or getting
the URL wrong, means that store's payments never confirm.

In your Stripe Dashboard:

1. Go to **Developers → Webhooks → Add endpoint**.
2. **Endpoint URL**: `https://<this platform's API domain>/payment-gateway/webhooks/stripe/<your store ID>`
   (the future connect UI will show you this exact URL, with your real
   store ID already filled in - you don't need to find your store ID
   yourself).
3. **Events to send** - subscribe to exactly:
   - `checkout.session.completed`
4. Create the endpoint, then open it and copy its **Signing secret**
   (`whsec_...`).

Only `checkout.session.completed` is listed because that's the only
event type this platform's webhook handler currently acts on - don't
subscribe to anything else, it would just be delivered and ignored.

## 3. Connect both to this platform

`POST /stores/:storeId/payment-gateway` with:

```json
{
  "provider": "stripe",
  "apiKey": "rk_test_...",
  "webhookSecret": "whsec_..."
}
```

Both are encrypted at rest (the same envelope-encryption vault every
other connected gateway's credentials use - see D117/D126) and never
returned by any API response once saved.

## 4. What happens at checkout

A buyer who pays via Stripe Checkout completes payment on Stripe's own
hosted page. When Stripe sends the `checkout.session.completed` webhook
(verified against your store's own signing secret above), this
platform checks that the session's reported amount and currency match
the order exactly, then confirms the order the same way a seller's own
"mark as paid" action does - recorded as a real Stripe-attributed
payment (gateway, transaction ID, and the raw webhook event, for the
reconciliation job), never the generic "manual" label.

A redelivered webhook (Stripe retries on anything other than a 2xx) is
recognized and skipped, never double-processed - every event's own ID
is permanently remembered the first time it's handled.
