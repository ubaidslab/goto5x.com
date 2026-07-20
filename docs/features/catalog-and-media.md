# Catalog & Media

## What it does

Product management: titles, prices, variants, images, and where those
images come from.

## How it works

- **Products & variants.** A product can have multiple purchasable variants
  (size/color/etc.), each with its own price and stock count.
- **Image management.** Multiple images per product, one marked primary, a
  defined sort order — reflected exactly on the storefront product page.
- **Google Drive import.** A seller connects their Drive account once
  (OAuth); the platform stores only an encrypted refresh token, never a
  plaintext one, and the short-lived access token used during an active
  import job lives in Redis only, never in the database. Revoking the
  connection is one click, and it's logged.
- **Moderation status.** Every product carries a moderation status the
  storefront and search always filter on — see `listing-moderation.md`.

## Settings keys

None specific to this feature area — product/storage limits are plan-scoped
Settings Registry keys documented in `plans-and-pricing.md`.
