# Order Verification Channel Adapter

## What it does

Lets a seller require a buyer to confirm a real, intended purchase before
the order counts as a sale — Shopify has no equivalent, and fake/return
orders are Pakistani sellers' #1 pain point. A store opts in per its own
choice of channel; a store that never opts in behaves exactly as before.

## How it works

- **Three v1.0 channels, one adapter interface.** A seller picks, per
  store: **WhatsApp OTP** (manual/link-assisted in v1.0 — the seller taps
  a generated `wa.me` link to send the code themselves; an automated
  WhatsApp Business API adapter is a documented future upgrade behind the
  same interface), **Email OTP** (sent through the seller's own connected
  SMTP account, never this platform's — the platform's own email
  reputation is never spent on this), or **Prepaid Confirmation** (a small
  advance the seller collects directly and manually marks received, the
  same human-in-the-loop shape as marking any order paid).
- **Extends the Financial Truth Invariant.** A store with verification
  enabled gates its orders' `pending` → `confirmed` transition on
  verification succeeding, exactly the same way it already gates on
  payment — never a second, looser definition of "confirmed."
- **OTP rules.** 6-digit codes, hashed (never stored in plaintext),
  time-limited, retry-capped, single-use, with a rate-limited resend.
  Sellers on the Email OTP channel connect up to 5 sender accounts; once
  one hits its daily send cap, sends rotate to another connected sender
  automatically, or the checkout is blocked if all are capped.
- **Seller vs. buyer resend.** A buyer-triggered resend is cooldown-gated
  (abuse prevention). The seller's own "resend" action on their order
  bypasses that cooldown — it's a trusted dashboard action, and for
  WhatsApp OTP it's the only way to retrieve a usable link at all, since
  the OTP is never persisted in plaintext.
- **Store readiness gate.** Checkout hard-blocks (same style as the
  existing payment-instructions/CNIC/publish checks) if a store's Email
  OTP channel has no connected sender — never silently accepts an order it
  can never verify.

## Settings keys

| Key | Scope | What it tunes |
|---|---|---|
| `orders.verification_channel` | store, global | `none` / `whatsapp_otp` / `email_otp` / `prepaid_confirmation` |
| `orders.verification_otp_ttl_minutes` | store, global | How long an OTP stays valid |
| `orders.verification_otp_resend_cooldown_seconds` | store, global | Minimum time between buyer-triggered resends |
| `orders.verification_otp_max_attempts` | store, global | Wrong-code submissions allowed before the attempt fails |
| `orders.verification_email_daily_send_cap` | store, global | Per-sender daily OTP-send cap before rotating |
| `orders.verification_message_template` | store, global | Seller-editable OTP message; `{{otp}}` is interpolated |
