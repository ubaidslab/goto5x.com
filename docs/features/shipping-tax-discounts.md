# Shipping, Tax & Discounts

## What it does

The three levers a seller uses to price an order beyond a product's base
price.

## How it works

- **Shipping.** A seller configures their own flat or rule-based shipping
  costs per store — self-fulfilled shipping only in v1.0, no live carrier
  rate lookup.
- **Tax.** A store-level tax rate, either inclusive (already baked into the
  displayed price) or exclusive (added at checkout) — this choice is what
  every other money calculation in the platform (commission base, invoice
  itemization) is built around, so it's consistent everywhere an order total
  shows up.
- **Discount codes.** Store-level codes a buyer enters at checkout — a
  completely separate mechanism from the platform-level subscription promo
  codes covered in `plans-and-pricing.md`.

## Settings keys

None — these are all per-store settings a seller configures directly, not
platform-wide Settings Registry entries.
