# Orders, Cart & Checkout

## What it does

The buyer-facing purchase flow, and the seller's side of managing what
comes out of it — from an item landing in a cart through a confirmed,
shipped order.

## How it works

- **Cart & checkout.** A buyer adds items to a cart (persisted so it
  survives a page reload), then checks out email-first — the buyer's email
  is captured before payment details, matching an intentional, locked UX
  decision. An abandoned cart (email captured, never completed) is flagged
  after a configurable window for future win-back use.
- **Manual orders.** A seller can create an order by hand for a phone/
  WhatsApp sale, going through the exact same pricing/stock logic a real
  storefront checkout would.
- **The Financial Truth Invariant.** An order is created `pending` and stays
  that way — no dashboard, analytics figure, or event log entry ever counts
  it as a sale — until the seller explicitly marks it paid. That one action
  is the only door into "confirmed," and it's also the moment commission
  accrues and a wallet debit happens.
- **Fulfillment.** Order notes, tags, a full timeline of what happened and
  when, and a scoped edit capability on a confirmed order (never a rewrite
  of what already happened).
- **The buyer order-status page.** A public page reachable by a per-order
  token — no account needed — showing status, items, totals, payment
  instructions, an invoice download, and a review-submission form once the
  order arrives.

## Settings keys

| Key | What it tunes |
|---|---|
| `orders.cart_abandonment_window_hours` | How long before an inactive cart is flagged abandoned |
