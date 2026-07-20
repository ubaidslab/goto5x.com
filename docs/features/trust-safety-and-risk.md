# Trust & Safety and Risk

## What it does

Since the platform never sees buyer payments directly (see
`wallet-and-billing.md`), it has to earn trust a different way: verifying
who a seller really is, watching for signs a seller is dodging commission,
and having a graduated response instead of an instant ban.

## How it works

- **Identity at activation.** A seller provides a CNIC (Pakistani national
  ID) when their account is activated. It's encrypted at rest and only ever
  shown back to the seller as a masked "last 4 digits" view.
- **Name-consistency checks.** When a seller adds a bank/JazzCash/Easypaisa
  account, the name on that account is checked against their declared
  identity — a mismatch doesn't block them, but it raises their risk score.
- **Risk score.** A simple, rule-based weighted score computed at signup and
  recomputed whenever an input changes (CNIC added, a payment instrument
  checked). It feeds the enforcement ladder below and an admin risk-review
  screen — never an automatic ban by itself.
- **The enforcement ladder.** Warn → restrict → suspend → ban — the same
  lifecycle control an admin already has (Admin Control Plane's seller
  lifecycle actions), just with lighter-weight rungs added below "suspend."
- **Anti-underreporting monitors.** Because a seller could theoretically
  collect payment directly and just never mark the order paid, two signals
  are tracked per seller: how often they cancel orders instead of confirming
  them, and how often orders sit unconfirmed past a reasonable age. Crossing
  either threshold surfaces the seller on an admin risk view — never an
  automatic penalty.

## Settings keys

| Key | What it tunes |
|---|---|
| `trust_safety.cancellation_rate_threshold` | Cancellation-rate monitor's trigger point |
| `trust_safety.pending_forever_age_days` | How long an order can sit unconfirmed before it's flagged |
