# goto5x.com — v1.0 MVP Cut-List (updated for SRS v0.7 — build-phase amendment)

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
- goto5x.com's own marketing/signup site, built to the premium visual bar (FR-0.1)
- Legal/content pages (ToS, Privacy, Refund, About, Contact) — admin-editable and
  versioned (FR-12.1); `docs/legal/` drafts flagged for human legal review

**Store builder**
- 3 hand-built premium templates, basic customizer (colors/fonts/logo/images/
  section show-hide/reorder — FR-1.2 v1.0 scope), live preview, mobile-responsive,
  free subdomain, custom domain attachment
- **Template Store showcase + Install/License API** (FR-1.8, FR-24.1–24.7) —
  built-in free templates always ship regardless of the Template Store's
  existence; the showcase is a link-out only; the Install API is goto5x.com's
  side of the hook (import-only, signed, entitlement-based, no downloadable files)

**Catalog & storefront commerce**
- Manual product entry, Google Drive media import (into self-hosted MinIO)
- Store shipping settings (flat rate + free threshold, FR-2.10)
- Basic tax settings (FR-19.3): one rate per store, inclusive/exclusive toggle
- Basic discount codes (FR-2.11/FR-5.5)

**Storefront discovery & merchandising**
- Collections (FR-16.1) · storefront search & filters (FR-16.2) · navigation
  editor with footer text/social-link blocks (FR-16.3) · announcement bar
  (FR-16.4) · coming-soon/password mode (FR-16.5) · SEO structured data + sitemap/
  robots (FR-16.6) · WhatsApp chat/order button (FR-16.7) · **social media links**
  (FR-16.8, new in v0.6) · **FAQ accordion section type** (FR-16.9, new in v0.6)

**Customers, reviews & carts**
- Customers/CRM: auto-created records (including from manual orders — clarified
  in v0.6), list + detail view (FR-13.1–13.3)
- Product reviews & ratings with seller moderation (FR-14.1–14.4)
- **Email-first checkout** (locked UX decision, FR-15.1) → cart persistence once
  email is captured + abandoned-cart **flagging** (FR-15.2) — recovery emails are
  v1.1

**Supplier (proves the differentiator, with real buyer-facing transparency)**
- Supplier Adapter interface as the real internal contract from day one; **one
  adapter implemented: Printify**
- Listing transparency (FR-4.6), checkout country-blocking (FR-4.7), live price
  re-validation (FR-4.8), admin adapter registry (FR-4.9)
- Basic order forwarding + tracking pull-back

**Orders & checkout**
- Cart + checkout, payment via **Safepay only** (COD deferred/gated, §5.6a)
- Order dashboard: list, filter by status, manual tracking entry
- Buyer email notifications; buyer order-status lookup via secure link (FR-5.4)
- Mixed-cart shipping calculation (FR-5.6)
- **Manual/draft orders — mark-as-paid only** (FR-17.1, bounded per founder
  decision)
- Order notes, tags, timeline, and basic pre-fulfillment editing — including
  correct inventory adjustment on edit (FR-17.2–17.5, clarified in v0.6)

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

**Payments, commission & payout**
- 3% default commission (post-discount amount), append-only ledger with
  `reserved` bucket, fixed 22-day hold, rolling reserve mechanism (default 0%)
- Payout request → admin approval queue with risk summary → **manual
  Disbursement Adapter** → full status visibility to seller
- Daily reconciliation job (correctly excluding `manual`-type payments, clarified
  in v0.6); currency-ready schema throughout

**Pricing & plans**
- **Free Plan** as a first-class tier: no billing cycle, tight limits, one store
  per identity, higher default commission (FR-7.3)
- **Inverse commission laddering** — higher plans, lower commission (FR-7.4)
- Plan changes take effect next billing cycle, no proration (FR-7.5)
- Yearly billing with admin-configurable discount (FR-7.6)
- Launch-campaign pricing as Settings Registry config (FR-7.7)

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
  SSO handoff/API call carries a verifiable "came from goto5x.com" signal
  (audit-logged, no new table), and a small signed endpoint lets either SaaS
  check a seller's plan-based discount eligibility without goto5x.com knowing
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
| Hold graduation logic | Needs real transaction data to calibrate thresholds |
| Scheduled payout mode (FR-6.8) | Automation on top of the v1.0 request flow |
| API-based Disbursement Adapter (FR-6.11) | Manual adapter proves the queue/ledger first |
| Advanced sales-velocity anomaly detection (FR-6.9) | v1.0 uses a simple threshold check |
| Optional buyer accounts (FR-22.1) | Schema-ready: `orders.buyer_id` nullable-FK since v0.4 |
| Abandoned-cart recovery emails (FR-22.2) | Sends against the v1.0 `carts.status='abandoned'` flag |
| Returns/refunds seller-side workflow (FR-22.3) | Reuses the existing refund/ledger mechanism |
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
