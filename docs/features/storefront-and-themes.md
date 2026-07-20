# Storefront & Themes

## What it does

Renders a seller's actual public-facing store, and lets a seller pick and
personalize how it looks.

## How it works

- **Themes.** A seller picks a built-in theme; higher plan tiers unlock a
  coded/custom-theme mode. Theme settings are stored per store, applied at
  render time — never a copy-and-fork of theme code per store.
- **SEO.** Every store, product, and collection has its own optional SEO
  title/description; a missing one falls back to the entity's own name/
  description, then to the store-level default — one predictable chain,
  never a second parallel SEO system.
- **Sitemap & robots.txt.** Generated dynamically per request (not a static
  file) against whatever domain is currently active for that store. A store
  in coming-soon or password-protected mode serves `noindex` and no sitemap
  at all.
- **Access modes.** A store can be fully public, in a coming-soon state (buyers
  can never unlock it), or password-protected (a short-lived, store-scoped
  token unlocks it for that visitor).
- **Branding.** A seller's own logo appears on the storefront header,
  invoices, and confirmation emails, reusing the same media pipeline as
  product images.

## Settings keys

| Key | What it tunes |
|---|---|
| `theme.coded_mode_enabled` | Whether a plan/seller can use custom theme code |
| `domains.platform_root_domain` | The free-subdomain suffix every store gets by default |
