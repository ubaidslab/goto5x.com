# Wallet & Billing

## What it does

Every seller has a prepaid wallet. Instead of the platform collecting money
from buyers, or billing a seller after the fact, a seller tops up their own
wallet in advance and the platform's commission and fees are deducted from
that balance as they're earned. This is the mechanism that lets uzeyn.com
never touch buyer money while still collecting its own revenue safely.

## How it works

- **Publishing a store.** A brand-new store is free to build (add products,
  pick a theme, connect a domain). Before it can accept a *real* order, the
  seller clicks "Publish store," which checks three things: a payment method
  is configured (bank/JazzCash/Easypaisa/COD), the seller's CNIC is on file,
  and the wallet has received at least one top-up meeting the minimum. All
  three must be true — this is a one-time gate, not something buyers see.
- **Topping up.** A seller picks a preset amount or types a custom one, then
  transfers that amount to the platform's own bank account exactly the same
  way a buyer would pay a seller directly. An admin verifies the transfer
  happened, and the credit lands in the wallet at that moment — never
  automatically, so there's no risk of crediting a payment that never
  arrived.
- **Commission.** The moment a seller marks a buyer's order as paid, 1% of
  that order's value (configurable, and lower for higher-tier plans) is
  deducted from the wallet immediately. An order that's still awaiting
  payment never touches the wallet.
- **Plan fees, Team seats, extra device slots.** A seller on a paid plan is
  charged that plan's monthly fee straight from the wallet. If the wallet
  doesn't have enough, the seller is quietly moved to the Free plan — their
  store keeps running, nothing about it changes except the plan. A Team
  leader's monthly bill (per active sponsored member) and a purchased
  extra-device-slot add-on work the same way.
- **Running low.** If the wallet balance drops below a warning line, the
  seller sees a dashboard warning and gets an email. If it's still low after
  a few days' grace period, the store stops accepting new orders — but stays
  fully visible to browse, with a polite "not accepting orders right now"
  message at checkout. The moment a top-up is verified, the store starts
  accepting orders again immediately, no extra steps.
- **Never a failed sale.** A commission deduction is never blocked or rolled
  back, even if it takes the wallet negative — a real, already-placed order
  is never undone by an accounting edge case.
- **The negative floor pauses immediately.** Unlike the gentler warning-then-
  grace-period path above, crossing the hard negative floor pauses the
  seller's stores right away — checked the instant a commission deduction
  lands, and again on every routine sweep. There's no grace window for this
  one: it's a hard line, not a warning. A verified top-up restores the store
  instantly either way.

## Settings keys

| Key | What it tunes |
|---|---|
| `billing.wallet_min_initial_topup` | Minimum top-up required before a store can be published (default Rs. 500) |
| `billing.wallet_low_balance_warning_threshold` | Balance below which the warning email/banner appears |
| `billing.wallet_grace_days` | Days after a warning before orders pause |
| `billing.wallet_negative_float_floor` | The most negative the wallet is ever allowed to go |
| `billing.wallet_topup_presets` | The quick-pick amounts shown on the top-up screen |
| `billing.commission_rate_percent` | Commission % deducted per confirmed sale |
| `auth.extra_device_slot_price` | Monthly price of the extra-device-slot add-on |
