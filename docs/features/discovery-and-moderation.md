# Discovery, Merchandising & Listing Moderation

## What it does

How buyers find products on a storefront (search, collections), and the
content-safety layer every product passes through before it can be public.

## How it works

- **Search & collections.** Full-text search over product titles/
  descriptions; sellers group products into collections with their own
  navigation entries.
- **Listing moderation.** Every new product is checked against admin-managed
  banned-keyword and restricted-keyword/category lists. A banned keyword
  blocks the listing outright; a restricted one still lets it through to a
  human moderation queue before it's public. A brand-new seller's first N
  products are always manually reviewed regardless of keywords; an
  admin-marked "trusted" seller skips the queue entirely.
- **Supplier-sourced listings get the same check** — a seller approving a
  supplier's listing is judging fulfillment quality, not legal safety, so
  the platform's own keyword/category check still runs at that approval
  moment, independent of the seller's own decision.
- **The moderation queue.** A REVIEWER admin sub-role sees only this queue —
  approve or reject with notes, every decision audit-logged.

## Settings keys

| Key | What it tunes |
|---|---|
| `moderation.new_seller_probation_count` | How many of a new seller's products are always manually reviewed |
| `moderation.banned_keywords` / `moderation.restricted_keywords` | The keyword lists themselves |
