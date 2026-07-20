# Plans & Pricing

## What it does

Sellers, Team leaders, and suppliers each pick from a small, founder-defined
set of paid tiers. Plans are pure data — adding or re-pricing a tier is an
admin edit, never a deploy.

## How it works

- **Groups and tiers.** Every plan belongs to one of three groups —
  Individual (a normal seller's Free → Starter → Standard → Pro ladder),
  Team (a leader's sponsorship tiers), Supplier (Free → Premium) — and has a
  position within that group. Every plan-gated check in the codebase
  resolves against a seller/supplier's `(group, tier)`, never a hard-coded
  plan name.
- **Inverse commission laddering.** The Free plan carries the platform's
  highest commission rate; each paid tier up carries a lower one — an
  incentive to upgrade that's expressed the same way any other plan-gated
  Settings Registry value is.
- **How a fee actually gets collected.** See `wallet-and-billing.md` — plan
  fees, Team seat totals, and device-slot add-ons all debit a wallet, not an
  invoice.
- **Changing plans.** A change takes effect at the start of the next billing
  cycle — no prorated mid-cycle billing. An admin can also grant any plan
  directly to a seller, bypassing checkout entirely (always audit-logged).
- **Promo codes.** A platform-level discount code for subscription billing —
  distinct from a seller's own store-level discount codes, which apply to
  buyer checkout, not the seller's own bill.
- **Teams.** A "leader" sponsors a group of sellers onto a shared plan tier;
  every sponsored seat bills at that tier's flat seat price, not whatever
  plan the member would have individually chosen.

## Settings keys

| Key | What it tunes |
|---|---|
| `catalog.product_limit` / `catalog.storage_quota_bytes` | Per-plan product/storage caps |
| `teams.leader_eligible` | Which plan tiers may create a Team |
| `billing.launch_campaign_discount_percent` | Time-limited/first-N-sellers commission discount |
