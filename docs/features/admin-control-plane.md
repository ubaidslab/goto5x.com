# Admin Control Plane

## What it does

The admin terminal is how the founder/team operates the platform day to day
without ever needing an engineer to ship a code change. Almost everything
that can vary — a fee, a limit, a message, a page of content — is stored
data an admin edits, not a constant buried in code.

## How it works

- **Settings Registry.** The single mechanism behind almost every other
  feature on this page: a named setting (e.g. "commission rate") can have a
  global default, and be overridden for a specific plan, seller, supplier,
  store, or category. The most specific override always wins. Changing a
  value takes effect immediately, everywhere, with no deploy.
- **Feature flags & plan editor.** Turn any gated feature on/off globally or
  per plan; create, edit, and retire plans and their tiers directly.
- **Content pages & brand assets.** Legal/help pages and the platform's own
  logo/favicon/hero images are versioned rows in the database — publishing a
  new version is a data change, with full revision history.
- **In-app messaging & maintenance mode.** Send a targeted banner/popup to
  all sellers, one seller, or everyone on a specific plan, with an optional
  time window. A single kill-switch takes the whole platform down for
  maintenance except for allowlisted admin IPs.
- **Real-time analytics.** GMV, active-store count, commission collected, and
  the top sellers by revenue — computed live from real orders, never
  counting an order that hasn't actually been paid for.
- **Moderation queue.** Where flagged listings wait for a human decision
  (approve/reject with notes) before they can go public.
- **Seller impersonation.** A time-boxed, reason-required "log in as this
  seller" mode for support, fully audited: a banner tells the seller support
  is active, every action taken is tagged in the audit log, and money-moving
  actions (marking an order paid, changing payout details) are blocked
  outright — support can fix settings, never move money.
- **Wallet top-up verification.** See `wallet-and-billing.md` — the same
  screen that used to verify commission invoices now verifies wallet
  top-ups.

## Settings keys

Nearly every feature above is itself one or more Settings Registry entries —
too many to list individually here. Search the admin settings screen by
feature area (`billing.*`, `catalog.*`, `theme.*`, `auth.*`, `suppliers.*`,
`platform.*`) rather than looking for one master list.
