# External SaaS Hooks

## What it does

Two integration points that let uzeyn.com plug into companion products
without becoming those products itself: a premium theme marketplace, and a
social-media marketing tool.

## How it works

- **Template Store hook.** Free themes always ship built-in. A premium-theme
  showcase links out to where a seller buys one; a signed Template Install/
  License API imports a purchased template directly into the seller's
  account — import-only, no downloadable files, license-checked on import.
- **Marketing SaaS hook.** A "Marketing" entry point in the seller dashboard
  uses the platform's existing single-sign-on, so a seller never logs in
  twice. A seller-scoped, rate-limited, revocable Product Feed API lets that
  external tool read a seller's catalog.
- **The registry.** Both hooks' external client credentials/config live in
  an admin-editable registry — enabling or disabling an integration is a
  data change, not a deploy.
- **Referral & eligibility.** Cross-SaaS discount eligibility and referral
  attribution (e.g. a domain-purchase referral) are tracked the same way
  everywhere they show up.

## Settings keys

| Key | What it tunes |
|---|---|
| `external_api.client_registry` | Which external SaaS clients are enabled and their config |
