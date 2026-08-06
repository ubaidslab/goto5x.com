# uzeyn.com — v1.0 MVP Cut-List (updated for SRS v0.15 — build-phase amendment)

Solo founder + AI build team. The goal of v1.0 is a **real, live, revenue-capable
platform** with genuine day-one commerce feature parity — not every SRS requirement
at once. Everything cut here is still in the SRS; it is sequenced into v1.1/Phase
2/Phase 4, not dropped.

**Process note (SRS §3.7, §14):** build order follows the SRS's per-module
Acceptance Checklists — no module below starts until the previous one's checklist
is 100% verified and approved. The IN/OUT calls below set *scope*; §14 of the SRS
sets *done*.

---

## The four v0.5 timeline flags — now resolved, bounded, and IN v1.0

The founder reviewed all four flags from v0.5 and kept them in v1.0, each with an
explicit, bounded scope rather than the open-ended version originally flagged:

| # | Feature | Bounded v1.0 scope (founder decision) | What moved to v1.1 |
|---|---|---|---|
| 9 | CSV import/export | Shopify-mapping for **core fields only**: title, description, price, variants/options, images, inventory. The import screen **explicitly lists unmapped fields per upload** — no silent data loss. | Metafields, complex/nested option combinations (FR-22.9) |
| 7 | Manual/draft orders | **Mark-as-paid only.** A manual order is created and marked paid directly; commission still applies. | The payment-link generation flow (FR-22.8) |
| 3 | Cart persistence | **Locked UX decision:** checkout is **email-first** — email is the first field/step, captured before any payment details. This *is* the cart's creation trigger, decided now, not discovered mid-build. | Abandoned-cart *recovery emails* (flagging ships in v1.0, FR-22.2) |
| 10 | PDF invoices | **Exactly ONE** well-designed, branded invoice template, meeting a "clean and professional, not generic" bar, verified by a **single founder sign-off** — not an open-ended polish loop. | Further visual iteration is an explicit, time-boxed backlog item, never a launch gate |

These bounds are now written directly into the relevant FRs (SRS §5.15, §5.17,
§5.18, §5.19) and their §14 checklists — the risk isn't just "flagged," it's closed.

---

## IN — v1.0

**Platform**
- uzeyn.com's own marketing/signup site, built to the premium visual bar (FR-0.1)
- Legal/content pages (ToS, Privacy, Refund, About, Contact) — admin-editable and
  versioned (FR-12.1); `docs/legal/` drafts flagged for human legal review

**Store builder**
- 3 hand-built premium templates, basic customizer (colors/fonts/logo/images/
  section show-hide/reorder — FR-1.2 v1.0 scope), live preview, mobile-responsive,
  free subdomain, custom domain attachment
- **Template Store showcase + Install/License API** (FR-1.8, FR-24.1–24.7) —
  built-in free templates always ship regardless of the Template Store's
  existence; the showcase is a link-out only; the Install API is uzeyn.com's
  side of the hook (import-only, signed, entitlement-based, no downloadable files)

**Catalog & storefront commerce**
- Manual product entry, Google Drive media import (into self-hosted MinIO)
- **Store shipping settings (flat rate + free threshold, FR-2.10) — Module 7 built**
- **Basic tax settings (FR-19.3): one rate per store, inclusive/exclusive toggle — Module 7 built**
- **Basic discount codes (FR-2.11) — Module 7 built the CRUD; FR-5.5's
  checkout-time validation (expiry/usage-limit, atomic usage increment) — Module 9 built**

**Seller Dashboard UI (new in v0.12)**
- The actual rendered screens for product/media management (Module 2),
  shipping/tax/discount-code settings (Module 7), and order management
  (Module 9) — a gap surfaced by reviewing the sequence after Module 7,
  since neither of those API-only modules had an owner for its UI (FR-28.1)
- Governed by the **SIMPLICITY INVARIANT** (§3.13): more readable and
  beginner-friendly than Shopify's, never more complex — glanceable
  screens, progressive disclosure, zero-documentation core tasks,
  consistent layout patterns, purposeful empty states (FR-28.2–28.3)
- Slotted immediately after Orders, Cart & Checkout (Module 9) and before
  Seller Onboarding Wizard, which needs real screens to link a new seller
  into rather than placeholders

**Storefront discovery & merchandising — Module 5 built**
- Collections (FR-16.1) · storefront search & filters (FR-16.2) · navigation
  editor with footer text/social-link blocks (FR-16.3) · announcement bar
  (FR-16.4) · coming-soon/password mode (FR-16.5) · SEO structured data + sitemap/
  robots (FR-16.6) · WhatsApp chat/order button (FR-16.7) · **social media links**
  (FR-16.8, new in v0.6) · **FAQ accordion section type** (FR-16.9, new in v0.6)
- All of the above are real and functional as of Module 5 - the coming-soon/
  password gate is enforced by the API itself (not only the storefront UI).
  The moderation-status filter these queries needed was the disclosed
  Module 5 follow-up, and it is now live as of Module 6 below.

**Listing Moderation Engine (new in v0.10, launch-blocking legal safety) — Module 6 built**
- Zero-cost, rule-based: admin-managed banned/restricted keyword lists +
  restricted-category rules, new-seller probation, admin-granted
  trusted-seller bypass (FR-27.1–27.4)
- Moderation queue + a narrow **REVIEWER** admin sub-role (moderation-queue
  access only) — every decision audit-logged (FR-27.5–27.6)
- Products under review are not publicly visible on the storefront or in
  Discovery search/collections (FR-27.5)
- **Supplier-sourced listings run through the same engine (new in v0.13,
  FR-27.8)** — a seller's approval of a supplier's listing (Module 8) is a
  fulfillment-quality decision, not a substitute for this legal-safety
  check; probation stays scoped to self-fulfilled listings only

**Customers, reviews & carts**
- Customers/CRM: auto-created records (including from manual orders — clarified
  in v0.6), list + detail view (FR-13.1–13.3)
- Product reviews & ratings with seller moderation (FR-14.1–14.4)
- **Email-first checkout** (locked UX decision, FR-15.1) → cart persistence once
  email is captured + abandoned-cart **flagging** (FR-15.2) — recovery emails are
  v1.1

**Supplier (proves the differentiator, with real buyer-facing transparency) — Module 8 built**
- Supplier Adapter interface as the real internal contract from day one; **one
  adapter implemented: Printify**
- Supplier Portal: registration, seller-invite/supplier-request links, and
  the listing-review approval queue (FR-2.6/FR-2.7/FR-3.1/FR-3.2)
- Listing transparency (FR-4.6) and the admin adapter registry (FR-4.9) —
  Module 8 built. Checkout country-blocking (FR-4.7), live price
  re-validation (FR-4.8), oversell protection wired into a live checkout
  (FR-4.5), and multi-store order/fulfillment tracking + tracking upload
  (FR-3.3/FR-3.4/FR-5.2) — **Module 9 built**, now that checkout exists
- **Corrected in v0.13:** supplier-sourced listings run through the
  Listing Moderation Engine at the moment of seller approval (FR-27.8) -
  the seller's own approval is a fulfillment-quality gate, not a
  legal-safety one
- **Completeness fix in v0.14 (found while building Module 9):** approving
  a supplier listing now also creates the one `product_variants` row every
  cart/order line needs — previously the product existed but had no
  variant, so it was silently unpurchasable
- **New in v0.15:** the multi-store aggregated dashboard (FR-3.3, above) is
  now gated to the paid Supplier Premium Plan tier — a free-tier supplier
  connected to multiple stores still works correctly per-store, just
  without the unified cross-store view (FR-7.10, see "Pricing & plans"
  below)

**Orders & checkout — Module 9 built**
- Email-first cart persistence (FR-15.1, locked UX decision) and checkout,
  creating a `pending` order; abandoned-cart **flagging** (FR-15.2,
  recovery emails are v1.1). **Payment model, updated v0.15: Direct Seller
  Collection** (§5.6c) — the buyer pays the seller directly (bank transfer/
  JazzCash/Easypaisa/COD, seller-configured), and Module 9's existing
  mark-as-paid (FR-17.1) is the universal payment-confirmation path for
  *every* order, not just manual ones. No gateway integration ships in
  v1.0 — see "Payments, commission & invoicing" below
- Order dashboard: list, filter by status/tag, manual tracking entry;
  supplier-side order view + tracking upload (FR-3.3/FR-3.4)
- Buyer email notifications on confirmed/shipped/delivered (FR-5.2); buyer
  order-status lookup via secure link (FR-5.4)
- Mixed-cart shipping calculation (FR-5.6); checkout-time discount
  validation (FR-5.5); supplier country-blocking, live price
  re-validation, and oversell protection wired in (FR-4.5/4.7/4.8)
- **Manual/draft orders — mark-as-paid only** (FR-17.1, bounded per founder
  decision)
- Order notes, tags, timeline, and basic pre-fulfillment editing — including
  correct inventory adjustment on edit (FR-17.2–17.5, clarified in v0.6).
  **FR-17.5's compensating-ledger-entry clause is deferred to Module
  10/11** (`ledger_entries` doesn't exist yet) — the order's own totals and
  stock are still correctly recomputed
- **Financial Truth Invariant (§3.12, new in v0.10):** an order counts as a
  sale — in dashboards, analytics, or `platform_events` — only once payment
  is verified via signed gateway webhook or explicit mark-as-paid; `pending`
  is the only status before that, and `order.placed` fires only at
  confirmation, never at submission

**Data portability**
- **CSV product import — core fields only, unmapped fields listed explicitly per
  upload** + product/order export (FR-18.1–18.3, bounded per founder decision)

**Receipts & tax**
- **One** self-hosted, branded PDF invoice template — "clean and professional"
  bar, single founder sign-off (FR-19.1–19.2, bounded per founder decision)

**Seller onboarding**
- Guided post-signup wizard: template → logo → first product → domain (FR-20.1)
- **Regional launch gating (new in v0.7):** seller signup is Pakistan-only,
  gated by an admin-managed Settings Registry allowed-countries list; a blocked
  non-PK attempt shows a "launching soon" message and captures email+country to
  a waitlist (FR-25.5). Buyer-side access is never region-gated.

**Seller account security (new in v0.10)**
- **TOTP 2FA for sellers** (FR-25.6), reusing Module 1's admin MFA machinery
  — enrollment optional by default, with a Settings Registry enforcement mode
  escalating to required-for-payout-actions or required-always
- **Session/device management** (FR-25.7): sellers see and can revoke active
  sessions/devices; a Settings-Registry-tunable concurrent-device limit
  (default 3), with a seller-scoped override as the mechanism for a future
  paid extra-device-slot add-on (monetization decision deferred to launch)

**Payments, commission & invoicing (rewritten v0.15 — Direct Seller Collection)**
- **The platform never touches buyer money in v1.0.** No gateway
  integration, no per-transaction hold, no rolling reserve, no payout/
  disbursement engine — all dormant, not deleted (SRS §5.6d, reactivated
  only on a future international/regulatory/scale trigger)
- **Invoice-based commission, default 1% (down from the dormant mode's 3%)**
  of the post-discount amount, accrued per confirmed sale as a
  `commission_accrued` ledger entry — the append-only ledger structure is
  retained, only its direction changes (receivable from the seller)
- **Monthly commission invoice** per seller; v1.0 verification is a manual
  admin action (mark paid, audit-logged); non-payment past a configurable
  grace period **automatically suspends the store**, reusing Module 9's
  existing suspended-store mechanism (FR-5.3) — the platform's only
  enforcement lever without held funds
- **Anti-underreporting guard-rails:** every storefront order is recorded
  regardless of later status; per-seller cancellation-rate and
  pending-forever-rate monitors feed the new Trust & Safety system, below
  (FR-6.19)
- Currency-ready schema throughout, unchanged

**Pricing & plans**
- **No Free Plan, no free trial (v0.33)** — new sellers start on **First
  Month**, a discounted paid entry tier carrying Starter's full feature
  set, auto-transitioning to Starter after one billing cycle; every tier
  carries its own plan-scoped commission override (FR-7.3)
- **Inverse commission laddering** — higher plans, lower commission (FR-7.4)
- Plan changes take effect next billing cycle, no proration (FR-7.5)
- Yearly billing with admin-configurable discount (FR-7.6)
- Launch-campaign pricing as Settings Registry config (FR-7.7)
- **Supplier Premium Plan (new, v0.15):** a `supplier` plan type reusing the
  same plan editor; the multi-store aggregated dashboard (FR-3.3, already
  built) is the paid tier's flagship feature, free tier covers
  single-seller basics (FR-7.10)

**Trust & Safety System (new, v0.15)**
- **Versioned Seller Agreement:** accepted at signup (timestamp + IP
  recorded), forced re-acceptance on version change (FR-29.1); the
  facilitation-workspace/seller-responsibility/indemnification legal
  grounding is drafted in `docs/legal/terms-of-service.md`, flagged for
  counsel review same as every other legal draft (FR-29.2)
- **Zero-cost, rule-based T&S engine** — extends existing mechanisms
  rather than duplicating them: Module 6's moderation history, the
  existing signup-velocity limiting (FR-23.5), the new cancellation-rate/
  pending-forever-rate monitors, and new bypass-attempt detection (repeated
  banned/restricted-keyword retries) (FR-29.3)
- **Enforcement ladder** (warning → restriction → suspension → permanent
  ban), built entirely on the existing seller-lifecycle admin controls
  (FR-8.4) — no parallel permissions system; every action audit-logged
  (FR-29.4)

**Seller Dashboard UI — personalization (new, v0.15)**
- Plan-gated dashboard themes/wallpapers (FR-28.4), reusing the same
  Settings-Registry plan-gating mechanism template tiers already use
  (FR-7.1) — cheap, still governed by the SIMPLICITY INVARIANT (§3.13)

**Business Guard-Rails**
- Free-plan enforcement at creation time (FR-23.1)
- Dormant-store lifecycle: warning → suspend → archive (FR-23.2)
- No trial-of-paid-features (FR-23.3)
- Unit-economics admin dashboard (FR-23.4)
- Velocity/abuse limits (FR-23.5)

**External-SaaS integration hooks (new in v0.6, extended in v0.7)**
- **Marketing entry point** in the seller dashboard (FR-24.8), SSO handoff to the
  Social Media SaaS, no second login
- **Product Feed API**: seller-scoped, rate-limited, tenant-isolated, revocable
  token (FR-24.9–24.11)
- Both hooks gated by an admin-manageable **external-API client registry**
  (FR-8.14), mirroring the supplier adapter registry
- **Referral attribution + cross-SaaS discount eligibility (new in v0.7):** every
  SSO handoff/API call carries a verifiable "came from uzeyn.com" signal
  (audit-logged, no new table), and a small signed endpoint lets either SaaS
  check a seller's plan-based discount eligibility without uzeyn.com knowing
  that SaaS's own discount terms (FR-24.13–24.14)

**Admin terminal — Control Plane**
- Settings Registry as the underlying mechanism for everything above
- Feature flags, plans & pricing editor, commission/hold/reserve settings, seller
  lifecycle (approve/suspend/ban/force-disable/view-any-store), template
  management, maintenance mode, payout freeze/release, manually-assisted refunds,
  immutable audit log, live platform analytics (incl. unit-economics view),
  mandatory admin MFA, content-page editor, **external-API client registry**
- **Admin-granted plans & platform subscription promo codes (new in v0.7):** an
  admin can grant any plan (incl. Free) to a specific seller, and issue one-time,
  optionally user-targeted subscription discount codes — a separate mechanism
  from a seller's own store-level discount codes (FR-7.8–7.9)
- **In-app messaging (new in v0.7, supersedes the v1.1-deferred item below):**
  banners, popups, and in-app notifications, each independently targetable
  (all/plan/seller) and scheduled, extending the existing announcements/
  maintenance-mode mechanism (FR-8.15)
- **Platform brand-asset management (new in v0.7):** logo/favicon/hero image
  swaps are admin-editable and versioned like content pages (FR-12.3); confirmed
  no gap in existing per-plan template-tier gating (FR-7.1/FR-8.6)
- **Listing Moderation Engine queue page (new in v0.11):** a bare functional
  page — list the queue, view a product, approve/reject with notes — the one
  surface a REVIEWER account (Module 6) can reach (FR-27.6)

**Infrastructure & security foundations (non-negotiable)**
- Tenant-scoping middleware + Postgres RLS across **every** tenant table
- Cross-tenant automated test suite as a release gate
- Stateless app servers, Redis-backed sessions, PgBouncer
- Self-hosted MinIO + Cloudflare free CDN tier
- Staging as a same-VPS Compose stack
- Webhook signature verification on all payment/supplier webhooks, **and signed-
  request verification on both external-SaaS API hooks** (new in v0.6)
- i18n-readiness discipline (SRS §3.9)
- **Platform Event Log** (SRS §3.11, new in v0.8): lean, business-lifecycle-only
  append-only event recording, starting with Module 1 (backfilled) — zero
  dashboard work now, the substrate the already-specified analytics/unit-
  economics dashboards (FR-8.10/FR-23.4) read from later
- **SEO controls + sitemap/robots pulled forward into Module 4** (SRS FR-1.5,
  new in v0.9): originally grouped under Storefront Discovery's FR-16.6 above,
  now built alongside the Theme Engine instead of deferred — Module 5 only
  extends the same generator with collection pages once those exist.

**Store builder, build-phase note (Module 4 built):** the "3 hand-built
premium templates" line above ships in v1.0 as three *structurally* distinct
built-in themes (different default section order/color scheme) — a real,
functional, componentized storefront + customizer, not a placeholder. The
bespoke, hand-designed premium visual bar the line originally promised is
blocked on branding assets not yet delivered (same founder-acknowledged gate
as the platform's own site, `docs/build-plan.md`'s "Known sequencing risk"),
and is a founder sign-off item before launch, not a v1.1 cut.

---

## v1.1 — documented ahead of time, not built now

| Feature | Note |
|---|---|
| **Manual-order payment-link flow** (FR-22.8) | Deferred from v1.0's mark-as-paid-only scope |
| **CSV metafields/complex option combinations** (FR-22.9) | Deferred from v1.0's core-fields-only scope |
| CJ Dropshipping adapter | Proves the Supplier Adapter interface is genuinely generic |
| Self-serve supplier registration + full multi-store dashboard UI | v1.0 supplier connections are admin-assisted |
| Listing review/approval self-serve UI | Ships with self-serve supplier onboarding |
| **Platform-Collected Payments mode in full (v0.15)** — Safepay integration, per-transaction hold, hold graduation, rolling reserve, payout request/approval, disbursement (manual then API-based) | Dormant, not v1.1 — reactivated only on an international/regulatory/scale trigger (SRS §5.6d); fully specified already, zero redesign needed |
| Advanced sales-velocity anomaly detection (dormant mode's FR-6.9) | v1.0's Trust & Safety engine (§5.29) uses simple configurable thresholds instead |
| Optional buyer accounts (FR-22.1) | Schema-ready: `orders.buyer_id` nullable-FK since v0.4 |
| Abandoned-cart recovery emails (FR-22.2) | Sends against the v1.0 `carts.status='abandoned'` flag |
| Returns/refunds seller-side workflow (FR-22.3) | Handled directly between buyer/seller under Direct Seller Collection; a disputed commission uses the new `commission_waived` entry (FR-6.20), not the dormant mode's refund/ledger mechanism |
| Per-store content pages + blog (FR-22.4) | Mirrors the v1.0 platform-level content-page pattern |
| Support/ticket system (FR-22.5) | Self-hosted, no third-party helpdesk SaaS |
| Referral program (FR-22.6) | Reward terms are Settings Registry config |
| Low-stock alerts + newsletter capture (FR-22.7) | Threshold check + one small new table |
| Listing/content moderation automation | v1.0's admin-assisted catalog is small enough to eyeball manually |
| "Login as seller" impersonation (full secure flow) | `admin_impersonation_sessions` table already exists in v1.0 schema |
| Supplier lifecycle self-serve controls | Matches suppliers being admin-assisted in v1.0 |
| ~~Scheduled/multi-banner announcements~~ | **Corrected in v0.7 — this was already stale.** v0.6's own FR-8.7 specified *scheduled* banners for v1.0, contradicting this row. FR-8.15 (new in v0.7) goes further and moves targeted, scheduled, multi-channel messaging (banner/popup/in-app notification) into v1.0 outright — see the Admin terminal section above. Nothing about messaging remains deferred to v1.1. |
| Suspicious-order flagging queue (`order_flags` UI) | Admin reviews orders directly at launch volume |
| Automated one-click refunds via Payment Adapter | Manual-assisted refund is sufficient at launch volume |
| `platform_metrics_snapshots` (pre-aggregated analytics) | Live queries are fast enough at v1.0 volume |

---

## Phase 2+ — roadmap entries only

| Item | Note |
|---|---|
| **RTL/Urdu storefront support** | Content + CSS-direction work only, because the i18n-readiness principle (SRS §3.9) is binding from v1.0 |
| **Markaz supplier-adapter evaluation** (FR-4.10) | Named research item — verify public API availability before any build commitment |
| Tiered plan proration | v1.0 ships the simple next-cycle rule (FR-7.5) |
| Coded-theme escape hatch, dispute workflow, SMS/WhatsApp notifications, second payment gateway, gated per-seller COD, shipping zones/weight rates, advanced discounts | Unchanged — see SRS §10 |
| **Admin sub-roles / seller staff accounts** | **Reaffirmed Phase 3, not pulled forward** (per the founder's explicit confirmation in this revision) — a single admin role is fine until there's more than one admin/support person to scope a role for |
| Multi-VPS scale-out, international payment gateways, mobile apps (API-first NFR is binding from v1.0, SRS §6/§2.5, so this is a new client, not a rewrite), region-sharded deployments (architecture note only, SRS §3.6) | Unchanged/extended — see SRS §10 |

---

## Zero added infrastructure cost — reconfirmed for v0.6

Every IN item across v0.4, v0.5, and v0.6 is Postgres tables + application code +
(for the two new hooks) a small authenticated API surface, reusing the Redis
instance, the BullMQ worker, and the self-hosted MinIO already budgeted for v1.0:
- The **Template Install/License API** and the **Product Feed API** are new
  routes in the existing app + two small tables (`template_entitlements`,
  `external_api_clients`, `seller_api_tokens`) — no new service, no new server.
- **PDF generation** uses a self-hosted headless-browser renderer as a Worker job
  (`docs/tech-stack.md`) — the only cost is compute already on the VPS. Worth
  flagging as an *operational*, not infrastructural, note: this renderer is
  heavier on CPU/RAM per job than the rest of the stack and is worth monitoring
  under real load, even though it introduces no new billed infrastructure.
- **CSV import/export** uses a streaming parser as a Worker job — no new service.
- Search uses Postgres full-text search — no dedicated search service.
- Every guard-rail (free-plan limits, dormant lifecycle) is a Settings Registry
  entry + a scheduled job on the existing worker.

**Nothing in this document set, across v0.4/v0.5/v0.6/v0.7, requires a new billed
service, a new server, or infrastructure beyond the single VPS** — the seven
v0.7 additions are three new Postgres tables (`seller_signup_waitlist`,
`platform_promo_codes`, `platform_brand_assets`/`platform_brand_asset_revisions`),
a handful of new columns/values on existing tables (`users.country`,
`announcements.channel`/`target_type`/`target_id`), and application code — no
new infrastructure.

---

## Definition of "v1.0 done"

A seller signs up, works through the onboarding wizard, sets a shipping rate, tax
rate, and a discount code, imports a CSV of products (Shopify core-field mapping,
with unmapped fields listed) alongside a few Printify items (shipping/delivery/
country shown to buyers), organizes products into a collection, configures
navigation (including a footer social-links row and an FAQ accordion), and
optionally connects a purchased premium template from the Template Store (import-
only, entitlement-gated) and links their Social Media SaaS account via the
Marketing section (SSO, no second login, revocable). A buyer finds a product via
search, enters their email first at checkout (cart persisted from that point),
leaves and later returns to complete the purchase with a discount code applied —
blocked if any cart item's supplier can't ship to their country — receives the one
branded PDF invoice, and later checks order status via a secure emailed link with
no account, leaving a review after delivery that the seller moderates. The seller
also takes a phone order and marks it paid manually. The seller sees a 3%
(or plan-adjusted) commission deducted on the post-discount amount, their payout
sitting in a 22-day hold, and — once available — requests a payout an admin
reviews and pays out manually, visible through the full status flow. A free-plan
seller who exceeds their product limit is blocked at creation, not warned after
the fact; one who goes dormant for the configured period is warned, then
suspended, then archived. Every step of that sentence is a shipped, testable
feature, verified against its module's Acceptance Checklist (SRS §14) — not a demo
path through unfinished code.
