# goto5x.com — Software Requirements Specification (SRS)

**Version:** 0.11 (Build-phase amendment)
**Date:** 2026-07-17
**Status:** v0.6 formally approved; documentation phase closed, build phase
underway. Modules 1–5 (Foundation; Catalog & Media; Custom Domain & TLS;
Theme Engine & Storefront Rendering; Discovery & Merchandising) and Module 6
(Listing Moderation Engine) built, tested, and approved. v0.7 pinned
the Settings Registry precedence, added password reset, regional launch
gating, admin plan grants/platform subscription promo codes, in-app
messaging, platform brand-asset management, a mobile-app-readiness NFR, a
region-sharded-deployment Phase 4+ note, and referral attribution/cross-SaaS
discount eligibility for the two external-SaaS hooks. v0.8 added the Platform
Event Log (§3.11, FR-26.x). v0.9 closed a schema gap found while planning
Module 4 (SEO field placement, sitemap/robots pulled forward). v0.10 (approved
before Module 5) added seller account security (§5.25), the Financial Truth
Invariant (§3.12), the zero-cost rule-based Listing Moderation Engine
(§5.27), and one reaffirming line on the premium-UI-bar dependency. **This
revision (v0.11), approved after Module 6:** one slotting confirmation — a
bare functional moderation-queue admin page (list, view a queued product,
approve/reject with notes; no design pass) is a launch-blocking requirement
of FR-27.6 and is explicitly slotted into Module 16 (Admin Control Plane
completion), since Module 6 itself was deliberately built API-only (SRS
§14.25 is entirely backend-behavioral and never required a UI, so the gap
went unnoticed until now). No FR from any prior version was removed or
weakened — every change below is additive.

**Changelog v0.1 → v0.2:** Added platform's-own-site design requirement, advanced/
custom theme code option for sellers, seller-initiated supplier invite flow, generic
supplier adapter/plugin interface, hold-graduation mechanism, shared-identity hook
for the future social SaaS, explicit tenant-isolation enforcement mechanism,
expanded security section, explicit statelessness/connection-pooling/session-
handling requirements for scaling, a Risk Register, content-moderation requirement,
and resolved open decisions (supplier integration order, payment gateway direction,
solo-founder pacing).

**Changelog v0.2 → v0.3:** Added the **Settings Registry** architectural pattern
and rebuilt the Admin Terminal section into a full **Admin Control Plane** — feature
flags, plan/pricing editing, commission & hold configuration, seller/supplier
lifecycle control with audited impersonation, template management, announcements/
maintenance mode, risk & fraud controls, an enforced-immutable audit log, and live
analytics — all as DB-backed configuration every module reads at runtime, so
day-to-day operational changes never require a code deployment.

**Changelog v0.3 → v0.4:** v1.0 became Safepay-only (prepaid); COD reclassified as a
deferred, per-seller, balance-gated Settings Registry feature. Added the **Payout
Request & Disbursement Engine**, supplier listing transparency + checkout country-
blocking + live price re-validation + an admin adapter registry, self-fulfilled
shipping settings, basic discount codes, a currency-ready schema, the
**self-host-first principle** (object storage moved to self-hosted MinIO), same-VPS
staging, the first **Acceptance Checklists** (§14) with a binding module-gating
process rule, admin-editable **Content Pages**, and `docs/legal/` drafts.

**Changelog v0.4 → v0.5:** Added 16 new v1.0 commerce features (Customers/CRM,
product reviews, cart persistence + abandoned-cart flagging, storefront discovery &
merchandising, manual/draft orders, order notes/tags/timeline + editing, CSV
import/export, self-hosted PDF invoices, tax settings, seller onboarding wizard);
documented 7 v1.1 features ahead of time; expanded the pricing/plan mechanism (Free
Plan, inverse commission laddering, yearly billing, launch campaigns); added
Business Guard-Rails; recorded Phase 2+ roadmap items (RTL/i18n-readiness, Markaz,
template-marketplace hook); added a cross-cutting buyer-facing "luxury" polish NFR;
and flagged four of the sixteen new features as timeline risks for the founder's
cut decision, without resolving them unilaterally.

**Changelog v0.5 → v0.6 (this revision):**
- **Fixed a documentation regression:** v0.5 replaced the full text of §3.1–§3.8,
  §4, §5.0–§5.12, §6.5, §9's v0.4 rows, §11, Risks 1–14, Open Questions 1–4, and
  Acceptance Checklists §14.0–§14.12 with "unchanged, see prior version" summaries.
  **All of that content is restored in full below** — the SRS is the living master
  document and no requirement may exist only in git history. The same regression was
  present in `docs/database-schema.md` (v0.4 table column definitions were
  summarized to a bare table-name list) and is fixed there too.
- **Resolved all four v0.5 timeline-risk flags** (Risks 15–18), each with bounded
  v1.0 scope per the founder's decision: CSV import maps core fields only, with
  unmapped fields listed explicitly per upload (FR-18.1); manual orders ship
  mark-as-paid only in v1.0, the payment-link path moves to v1.1 (FR-17.1); cart
  email-capture timing is now a **locked UX decision** — checkout is email-first
  (FR-15.1); PDF invoices ship exactly one template meeting a "clean and
  professional" bar with a single founder sign-off (FR-19.2).
- **Two external-SaaS integration hooks specified** (§5.24): a **Template Store**
  hook (built-in free templates always ship; a premium-template showcase links out;
  a signed Template Install/License API imports a purchased template directly into
  a seller's account — import-only, no downloadable files, license-validated) and a
  **Social Media SaaS** hook (a "Marketing" entry point in the seller dashboard
  using the existing SSO hook, no second login; a seller-scoped, rate-limited,
  revocable **Product Feed API**). goto5x.com builds only its own side of each hook.
- **Small v1.0 storefront additions** (§5.16 extended): social media links,
  an FAQ accordion section type, and richer footer content blocks.
- **Confirmed, not pulled forward:** seller staff sub-accounts / admin sub-roles
  remain Phase 3, exactly as already documented — reaffirmed, not expanded.
- **Two new risks** (19–20) for the SaaS hooks' license/entitlement and API-token
  attack surfaces; several small consistency fixes (see §12, and the completeness
  audit delivered alongside this revision).

**Changelog v0.6 → v0.7 (build-phase amendments, this revision):**
- **Pinned the Settings Registry precedence** (§3.8) to `seller > store > plan >
  category > global`, resolved during Module 1 planning (previously an open
  proposal in `docs/build-plan.md`).
- **Added §5.25 Authentication & Account Security** (FR-25.1–25.4): self-serve
  password reset, approved as a genuine gap found during Module 1 planning and
  built in Module 1 alongside signup/login.
- **Approved before Module 2 — seven further additions**, each slotted into the
  existing build sequence (see `docs/build-plan.md` for exact module numbers):
  regional launch gating with an admin-managed allowed-countries list and a
  waitlist for non-launched countries (FR-25.5); admin-granted plans and
  platform-level subscription promotion codes, distinct from store-level
  discount codes (FR-7.8–7.9); in-app messaging — banners, popups, and
  in-app notifications, each targetable and scheduled (FR-8.15, extends FR-8.7);
  platform brand-asset management (logo/favicon/hero images), plus a confirmation
  that per-plan template-tier gating already has no gap (FR-12.3); a mobile-app-
  readiness NFR making the API the single source of truth (§6); a Phase 4+
  region-sharded-deployment architecture note, not a v1.0 build item (§3.6); and
  referral attribution plus cross-SaaS discount eligibility for both external-SaaS
  hooks (FR-24.13–24.14).
- **One inconsistency found and fixed while amending:** `docs/mvp-v1-cutlist.md`
  listed "scheduled/multi-banner announcements" as deferred to v1.1, which had
  already been contradicted by v0.6's own FR-8.7 (which specified *scheduled*
  banners for v1.0). FR-8.15 supersedes both — targeted, scheduled messaging
  across three channels is now explicitly v1.0 scope, and the cutlist is
  corrected accordingly.
- **One genuine spec gap found and closed while planning Module 2, flagged to
  the founder before any code was written (per the binding "stop and flag"
  rule):** FR-9.1 (Google Drive import) always assumed an OAuth connection but
  no version of this SRS or `docs/database-schema.md` ever defined where those
  tokens live. Resolved: a new `google_drive_connections` table (seller-scoped)
  stores an **encrypted** refresh token only; the short-lived access token is
  never persisted to Postgres — Redis only, for an active import job's
  duration. Revocation is seller-initiated and audit-trailed. See FR-9.1, the
  new §6.5 bullet, and §14.2's new checklist items.

**Changelog v0.7 → v0.8 (build-phase amendment, approved before Module 4):**
- **Platform Event Log added** (§3.11, FR-26.1–26.5): an append-only
  `platform_events` table, same insert-only-grant immutability discipline as
  `admin_audit_logs`. Lean, business-lifecycle-only taxonomy (a new event
  type must pass the "would this appear on a growth or unit-economics
  report" test) — explicitly not page-view/click tracking. No PII in
  `metadata` (§6.5). Non-blocking emission — a failed event write never fails
  the user's action. Retention/archival threshold is a Settings Registry
  entry (`platform_events.retention_days`); no archival job exists yet.
- **Backfilled into Modules 1–3** (already-built, already-approved code):
  `seller.signup`, `store.created` (Module 1); `product.created`,
  `media.imported` (Module 2); `domain.attached`, `domain.verified`
  (Module 3) — a small addition, not a redesign of any of those modules.
  Every module from Module 4 onward emits its own lifecycle events as part
  of that module's build, and gains an "events emitted" line in its §14
  checklist.
- **Zero dashboard work in this revision:** FR-8.10 (real-time analytics) and
  FR-23.4 (unit-economics) are unchanged today — they read from live
  transactional tables exactly as before; `platform_events` is a substrate
  they read from *later*, per explicit founder instruction.

**Changelog v0.8 → v0.9 (build-phase amendment, mid-Module-4, genuine gap
closure — flagged before being silently improvised):**
- **FR-1.5 rewritten.** No version of this SRS through v0.8 ever specified
  where SEO meta title/description actually live in the schema, despite
  FR-16.6 already requiring structured-data/Open Graph tags to read from
  them. Resolved as nullable `seo_title`/`seo_description` columns directly
  on `stores` (storefront homepage default/fallback), `products` (product
  pages), and `collections` (once that table is built, Module 5); v1.1 store
  pages/blog posts (FR-22.4) get the same pair when that module ships. A
  binding fallback rule is now documented: null `seo_title` renders the
  entity's own name/title; null `seo_description` derives from the entity's
  own description (truncated), or the store-level default if the entity has
  neither. One source of truth — FR-16.6 never gets a second, parallel set of
  SEO data.
- **Sitemap/robots.txt scope pulled forward into Module 4** (previously
  unscheduled): per-store `sitemap.xml`/`robots.txt`, generated dynamically
  per request (no static file, no cron), covering whatever public pages exist
  as of Module 4 (storefront home + products) — Module 5 extends the same
  generator with collection pages once those exist, not a redesign. URLs use
  the store's verified custom domain (FR-11.2) when one exists, otherwise the
  free subdomain. A store in `coming_soon`/`password_protected` access mode
  (FR-16.5) serves a `noindex` robots.txt and no sitemap at all.
- **§14.1 gains three checklist items:** the SEO fallback chain renders
  correctly when fields are null; sitemap URLs match the store's active
  domain; a hidden store serves `noindex` with no sitemap.
- See `docs/database-schema.md`'s `stores`/`products`/`collections` table
  notes for the exact column definitions.

**Changelog v0.9 → v0.10 (build-phase amendment, approved before Module 5):**
- **Seller Account Security (§5.25, FR-25.6–25.7, new):** TOTP 2FA for
  sellers, reusing the exact `User.mfaSecret`/`mfaEnabled` fields and
  `otplib` machinery Module 1 already built for admin MFA — a second
  controller/flow, not new infrastructure. Enforcement mode
  (`auth.seller_mfa_enforcement`: `optional` / `required_for_payout_actions`
  / `required_always`) and the concurrent-device limit
  (`auth.max_concurrent_devices`, default 3) are both Settings Registry keys,
  the second usable at `global`/`plan`/`seller` scope so an individual
  seller's paid extra-device-slot add-on is just a seller-scoped override —
  no new scope type, no billing flow built now (mechanism now, monetization
  decision at launch, per founder instruction). Sellers see and can revoke
  their active sessions/devices from the dashboard; the underlying session
  store is Redis (§3.2a, already built), extended with device-label/IP/
  last-active metadata per entry. **Slotted as a new module inserted
  immediately before Payouts & Disbursement** (`docs/build-plan.md`) because
  `required_for_payout_actions` enforcement is meaningless unless 2FA already
  exists by the time a seller can request a payout.
- **Financial Truth Invariant (§3.12, new, binding NFR):** an order/sale
  exists in any seller-visible or admin-visible surface — dashboards,
  analytics, reports, `platform_events` — **only** after payment is verified
  via a signed gateway webhook, or an explicit mark-as-paid for a manual
  order. No pending/unconfirmed/failed order counts as a sale anywhere.
  Pinned now, **before Orders, Cart & Checkout and Payments & Ledger are
  designed**, specifically so their schemas are built around this
  rule rather than retrofitted to it. Every money-adjacent module's §14
  checklist (14.5, 14.6, 14.8, 14.21, 14.23) gains a line requiring a test
  that proves unpaid orders are excluded from every count.
- **Listing Moderation Engine (§5.27, FR-27.1–27.7, new):** admin-managed
  banned/restricted keyword lists and restricted-category rules (Settings
  Registry-backed, no new table), new-seller probation (first N products
  manually reviewed, N configurable), trusted-seller auto-approve
  (`sellers.is_trusted`), a moderation queue, and a new, narrowly-scoped
  **REVIEWER** admin sub-role (§4) that sees only the moderation queue —
  every decision audit-logged via the existing `admin_audit_logs` mechanism,
  no new audit table. Products under review are not publicly visible.
  **Slotted as a new module immediately after Discovery & Merchandising**
  (`docs/build-plan.md`) — zero-cost and rule-based by design, required live
  before public launch, not gated on anything Discovery-specific. Building it
  will require a small follow-up amendment adding a moderation-status filter
  to Module 4's public storefront product listing and Module 5's Discovery
  search/collection queries — flagged now, not a silent gap when that module
  starts.
- **FR-1.1 reaffirmed, one line:** the premium visual bar is **apple.com-level
  minimalism** and **horizonx.so-level motion**, including video hero banners
  in themes — still gated on founder-delivered branding assets (same
  Module 18/Module 4 dependency `docs/build-plan.md` already flagged).
- **§4 gains a narrow exception, not a reversal:** a full fine-grained
  admin-permission system stays Phase 3+ (unchanged), but REVIEWER is added
  now as one purpose-built sub-role scoped to exactly one surface (the
  moderation queue), required for the Listing Moderation Engine's launch-
  blocking legal-safety requirement.

**Changelog v0.10 → v0.11 (build-phase amendment, approved after Module 6):**
- **FR-27.6 amended, one slotting confirmation, no behavior change:** the
  REVIEWER sub-role's moderation queue needs a bare functional admin page
  (list the queue, view a queued product, approve/reject with notes — no
  design pass) before public launch. Module 6 itself was built API-only by
  design (the queue's four endpoints, no dashboard route) since §14.25 is
  entirely backend-behavioral and doesn't require rendering anything to
  pass; that meant no module currently on the books actually builds the
  page. Explicitly slotted into **Module 16 (Admin Control Plane
  completion)**, alongside that module's other bare-functional admin
  surfaces, rather than left implicit. §14.8 (Module 16's checklist) gains
  one line for it.

---

## 1. Introduction

### 1.1 Purpose
This document defines the requirements for **goto5x.com**, a multi-tenant e-commerce
platform (Shopify-class) that lets sellers launch premium-designed online stores,
connects them to dropshipping suppliers, and gives sellers deep control over store
design and operations through an advanced dashboard. It is the reference point for
all architecture and build decisions going forward — every phase of the product
should trace back to a requirement in this document, and every module has an
Acceptance Checklist (§14) that gates when it is considered done. **This document
is the single source of truth; no requirement is considered documented if it exists
only in a prior version's git history.**

### 1.2 Scope
In scope for goto5x.com (this SRS): goto5x.com's own premium public site; the
multi-tenant store builder (premium templates, customizer, coded-theme escape
hatch); storefront discovery & merchandising (collections, search, navigation,
announcement bar, coming-soon mode, SEO, social links, FAQ); the seller admin
dashboard (catalog, customers, reviews, shipping, tax, discounts, orders — including
manual/draft orders — CSV import/export, onboarding); the supplier portal and
adapter-based dropshipping integrations with buyer-facing delivery transparency; the
payments, commission, hold, reserve, and payout/disbursement engine; subscription
plans including a first-class Free Plan; Business Guard-Rails; the admin Control
Plane; custom domain attachment; and two external-SaaS integration hooks (§5.24).
Full detail is in §5.

Explicitly **out of scope** for this SRS (separate products the founder builds and
runs independently), each with a documented integration hook so goto5x.com doesn't
have to be rewritten to connect to them later:
- **Social media scheduling/management SaaS** — SSO hook via the Auth module
  (§3.2a) plus a Product Feed API (§5.24b). Monetization lives entirely in that
  product; goto5x.com is the bridge.
- **Template Store (premium template marketplace)** — a signed Template Install/
  License API (§5.24a). goto5x.com always ships its own built-in free templates
  regardless of whether the Template Store exists or is connected.

### 1.3 Definitions & Abbreviations
| Term | Meaning |
|---|---|
| Seller | A merchant who creates and owns a store on goto5x.com |
| Supplier | An entity that lists products for sellers to sell (dropship or own inventory) |
| Buyer | End customer purchasing from a seller's storefront |
| Tenant | A single seller's store instance within the shared platform |
| GMV | Gross Merchandise Value — total value of goods sold through the platform |
| Hold period | Time platform withholds a new seller's payout before releasing funds |
| Rolling reserve | An additional, ongoing holdback (percentage of sales) separate from the hold, used to cover future risk |
| Dormant store | A free-plan store inactive beyond a configurable threshold, subject to the lifecycle in §5.23 |
| Template entitlement | A record granting one specific seller the right to use one specific (typically marketplace-purchased) template — distinct from plan-based template-tier gating |
| VPS | Virtual Private Server |
| RLS | Row-Level Security (Postgres feature enforcing tenant scoping at the DB level) |

### 1.4 Vision Statement
Be the cheaper, Pakistan-first entry point into e-commerce for sellers who want a
**premium-feeling store** (advanced visuals, animation, AI-assisted design) without
Shopify's cost or complexity — with genuine day-one commerce feature parity
(customers, reviews, discounts, manual orders, receipts), built-in access to
dropship suppliers, a control panel simple enough that non-technical sellers can run
a professional-looking store, a free tier that is complete rather than a ticking
trial, and clean bridges into the founder's other products (premium templates,
social media marketing) without goto5x.com ever having to build those products
itself.

---

## 2. Overall Description

### 2.1 Product Perspective
Direct competitor: **Shopify**. Differentiation strategy:
1. **Cheaper entry plans**, including a genuinely usable **Free Plan** (§5.7,
   FR-7.3) — Pakistan-first pricing.
2. **Premium visual templates** as a standard offering — the aesthetic of
   horizonx.so — with the same visual bar applied to buyer-facing surfaces beyond
   the storefront (receipts, order-status pages, emails, §6) and to goto5x.com's own
   marketing site (§5.0, §13: apple.com-level polish + horizonx.so motion). A
   **Template Store** (a separate SaaS by the founder) extends this further with
   purchasable premium templates, bridged via a clean install API (§5.24a) — the
   built-in free tier never depends on that store existing.
3. **Built-in supplier network** with buyer-facing delivery transparency (§5.4).
4. **Genuine commerce parity from day one** — customers, reviews, carts, discovery/
   merchandising, manual orders, CSV data portability, receipts/tax — so switching
   from Shopify (or starting fresh) doesn't mean giving up features sellers expect.
5. **Simple, advanced control panel** with an admin-side Control Plane and Business
   Guard-Rails (§5.23) that protect the platform's own unit economics as it grows.
6. **A growth bridge, not a growth silo** — a "Marketing" entry point (§5.24b) hands
   a seller off to the founder's separate social-media SaaS with no second signup,
   so goto5x.com benefits from that product's existence without building it.

### 2.2 Product Functions (high level)
- Store creation, premium template selection (built-in free + Template Store
  showcase), and storefront discovery (collections, search, navigation, announcement
  bar, coming-soon mode, social links, FAQ, footer content)
- Product catalog, inventory, shipping-rate, tax, and discount-code management
- Customers/CRM, product reviews, cart persistence
- Supplier onboarding with delivery transparency, via a pluggable adapter interface
  with an admin-managed adapter registry
- Order management — storefront and manual/draft orders, notes/tags/timeline,
  supplier fulfillment tracking, and a no-account buyer order-status lookup
- Data portability (CSV import/export) and self-hosted branded PDF receipts/invoices
- Payments (prepaid at launch), commission (with plan-based laddering), hold,
  reserve, and payout/disbursement through an admin approval queue
- Subscription plans including a first-class Free Plan, yearly billing, and
  launch-campaign pricing
- Platform-wide administration, Business Guard-Rails, and admin-editable content
- Custom domain + Google Drive media connection per seller
- Bridges to the founder's Template Store (template install/license) and Social
  Media SaaS (product feed) — goto5x.com's side of each hook only

### 2.3 User Classes and Characteristics
| Role | Description |
|---|---|
| **Buyer** | Shops on a seller's storefront; needs no account (v1.0) — order status via a secure emailed link (FR-5.4); optional accounts are v1.1 (FR-22.1) |
| **Seller** | Owns a store; manages catalog, design, discovery, customers, orders (including manual/phone orders), shipping, discounts, tax, payouts, and connections to the Template Store/Social Media SaaS |
| **Supplier** | Lists products for one or more sellers; fulfills orders and provides tracking |
| **Platform Admin** | goto5x.com staff; manages sellers, suppliers, commissions/plans, payouts, disputes, platform health, content pages, business guard-rails, and the external-API client registry (§5.24) |

### 2.4 Operating Environment
Single VPS at Phase 1 (app, DB, Redis, MinIO, worker, same-VPS staging stack),
scaling out per §3.6 as load grows. Every feature added since v0.4 — including both
v0.6 SaaS integration hooks — is plain application code, Postgres tables, and (for
the hooks) a small, rate-limited API surface. **None of it changes the Phase 1
operating environment or adds infrastructure**, reconfirmed explicitly in this
revision per the founder's request (§9, §10).

### 2.5 Design & Implementation Constraints
- Payments **must** go through a licensed payment processor / gateway partner —
  goto5x.com must never custom-build raw card/payment handling (PCI-DSS liability).
  Commission, hold, reserve, and payout logic are custom and gateway-independent
  (§5.6).
- **Self-host-first (binding):** the default choice for any infrastructure
  component is to self-host on the platform's own VPS; a recurring paid third-party
  service is used only where self-hosting is genuinely infeasible (email
  deliverability, licensed payment processing) — each exception is justified in §9.
- Must support Pakistan-first payment rails from Phase 1 (§5.6a); international
  gateways are a later phase.
- Hosting/domain for each storefront is owned and attached by the seller.
- **Team constraint:** solo founder + AI pair-programming. Every phase ships in
  small, independently-releasable increments; no module begins until the previous
  module's Acceptance Checklist (§14) is verified.
- **i18n-readiness (binding, §3.9):** no template or dashboard string is
  hard-coded outside a translation-key layer, and all number/currency/date
  formatting is locale-aware from v1.0 — even though only one locale (English)
  ships at launch — specifically so RTL/Urdu (§10, Phase 2+) is a content and
  CSS-direction task later, not an architecture rewrite.
- **No trial-of-paid-features (binding, §5.23):** the Free Plan is a permanent,
  complete-but-limited tier, never a time-boxed trial of paid capability.
- **External-SaaS hooks are one-directional contracts, not shared builds (binding,
  new in v0.6):** goto5x.com implements and owns only its side of the Template
  Store and Social Media integration hooks (an inbound API each product calls, or
  is called by). It never depends on either product's own infrastructure,
  monetization, or roadmap to function — a seller with neither connected sees a
  fully working platform.
- **Regional launch gating (binding, new — founder decision):** seller account
  creation is Pakistan-only at launch (FR-25.5); buyer-side storefront access is
  never gated by country. The allowed-country list is a Settings Registry entry,
  not a hard-coded check, so opening a new region is an admin operation, never a
  deploy.
- **Region-sharding readiness (binding, Phase 4+ architecture note only, new):**
  no module may hard-code an assumption that all data lives in one region beyond
  the existing i18n/currency rules already binding above. This is a documentation
  constraint now, not a build requirement — the actual per-region DB/stack split
  is Phase 4+ (§3.6, §10) and is not being built in v1.0.
- **API-first / mobile-app readiness (binding, new):** the NestJS API is the
  single source of truth for every business rule; `apps/web` (Next.js) consumes
  it like any other client and must never hold logic the API doesn't also
  enforce. This is what makes future iOS/Android apps (Phase 4, §10) a new client
  against an existing API, not a rewrite — no app work ships now.

### 2.6 Assumptions & Dependencies
- Safepay's sole-proprietor-friendly onboarding (§5.6a, §11) is assumed sufficient
  to take goto5x.com's first live payment without waiting on a registered legal
  entity; a registered entity is still needed for Phase 1.x gateways and for
  hold-graduation identity verification (§13).
- Dropship supplier integrations depend on those suppliers exposing usable APIs.
  AliExpress has no official public dropship API — deferred, added later via the
  adapter interface once legally reviewed. Markaz's API viability is an open
  research item (§5.4, FR-4.10, §13).
- The Template Store and Social Media SaaS are assumed to exist as **separate**
  products built independently by the founder; this SRS assumes nothing about their
  timeline, and goto5x.com's hooks (§5.24) function correctly whether or not either
  product has launched yet.

---

## 3. System Architecture Overview

### 3.1 Architectural Style
**Modular monolith** — one deployable application composed of clearly bounded
modules (Auth/Identity, Store/Tenant, Catalog, Orders, Commerce Ops, Payments/
Ledger, Payouts, Suppliers, Theme Engine, Media, Notifications, Admin), each with
its own internal boundary (own folder/package, own DB schema namespace,
communicating through defined interfaces — not through shared global state). This
gets Phase 1 to market fast while keeping a clean seam to extract any module into
its own service later without a rewrite.

Microservices are explicitly **not** used at Phase 1 — the operational overhead
(service discovery, distributed tracing, network failure handling) is not justified
until traffic/team size demands it, and would be actively harmful to solo-founder
velocity.

**Statelessness principle (binding on every module):** application server processes
hold no persistent state of their own. All state that must survive a request lives
in Postgres, Redis, or object storage — never on local disk or in-process memory
beyond the lifetime of a single request/job. This one rule is what makes the
single-VPS → multi-VPS transition (§3.6) a pure infrastructure change instead of a
rewrite; it is treated as a code-review-blocking rule from the first commit, not an
aspiration.

### 3.2 Multi-Tenancy Model
Shared database, **row-level tenancy**: every tenant-scoped table carries a
`store_id`. This is simpler and cheaper to operate than schema-per-tenant or
database-per-tenant, and is sufficient until a single store's data volume genuinely
requires isolation — at which point that one store can be migrated out without
affecting the model for everyone else.

**Enforcement mechanism (not just convention):** tenant scoping is not left to
per-query discipline, because a single missed `WHERE store_id = ...` is a data-leak
bug between two sellers — the single most reputation-damaging bug class this
platform can ship.
- The data-access layer wraps every tenant-scoped query through a mandatory scoping
  helper/middleware that injects `store_id` from the authenticated session context
  — there is no code path that can query a tenant table without it.
- **Postgres Row-Level Security (RLS) is enabled as a hard backstop** on every
  tenant-scoped table, keyed to the session's `store_id`, so that even an
  application bug that forgets to scope a query still cannot return another
  tenant's rows.
- Automated tests explicitly assert cross-tenant access is impossible (e.g. "seller
  A's session cannot read seller B's orders/products/media/ledger no matter what
  endpoint is hit") — this test suite is a release gate, not optional coverage
  (§14). This rule applies uniformly to every tenant table added in v0.5/v0.6
  (customers, reviews, carts, collections, navigation menus, order notes/timeline,
  import jobs, tax settings) — new tables are never a special case.

### 3.2a Identity & Auth (shared-platform hook)
Auth is its own bounded module from day one, independent of the Store/Catalog/
Orders modules, specifically so that:
- The Social Media SaaS (§5.24b) can authenticate against the same identity service
  / user table via SSO instead of forcing a second signup — the contract for this
  is a stable `User` identity + token-issuance API, not a monolith merge.
- Sessions are **stateless** (signed JWT access tokens) or backed by Redis (shared,
  not in-process) — never held in a single app server's memory — so any app server
  behind a load balancer can serve any request (required for §3.6 Phase 3+).

### 3.3 Data & Storage Layer
- **Primary DB:** PostgreSQL (relational integrity for orders/payments/inventory),
  accessed through a **connection pooler (PgBouncer)** from Phase 1 onward — this is
  specified now, not deferred, because adding a pooler after multiple app-server
  instances already exist in production is a disruptive migration, not a config
  change.
- **Cache / queues:** Redis (session cache, rate limiting, job queue backend).
- **Object storage:** **self-hosted MinIO** (S3-compatible) running as a container
  on the same VPS, fronted by **Cloudflare's free-tier CDN** for bandwidth offload —
  per the self-host-first principle (§9), a paid object-storage service isn't
  justified when a self-hosted, S3-API-compatible alternative runs on
  infrastructure already paid for. Because MinIO speaks the S3 API, migrating to a
  managed provider (Cloudflare R2, AWS S3) later is a configuration change, not a
  rewrite. Google Drive remains a seller-side **import source**, never the runtime
  dependency.
- **Search:** Postgres full-text search (a generated `tsvector` column + GIN index,
  `docs/database-schema.md`) for storefront search (FR-16.2); move to a dedicated
  search engine only once catalog scale requires it.

### 3.4 Background Processing
A job queue (Redis + BullMQ or equivalent) handles: payout hold-release scheduling,
rolling-reserve release scheduling, scheduled-payout-request generation, supplier
order sync, tracking-status polling, notification dispatch, template asset
processing, **abandoned-cart flagging, the dormant-store lifecycle job, CSV
import/export processing, and self-hosted PDF invoice generation** (all new in
v0.5/v0.6). Workers are stateless processes that pull from the shared queue — any
number of worker instances can run concurrently across one or many VPS with no
coordination logic beyond the queue itself, by design.

### 3.5 Adapter Pattern (Supplier, Payment, Disbursement Integrations)
Per the founder's decision, every external integration point in the platform —
where suppliers connect, where money is charged, and where money is paid out — is
built the same way: never as a one-off, hard-coded connection.
- **Supplier Adapter:** `listProducts()`, `syncStock()`, `submitListingForReview()`,
  `forwardOrder()`, `pullTrackingUpdate()` — implemented by Printify, CJ
  Dropshipping, etc. (FR-4.1–4.2). Admin can register/enable/disable a supplier
  adapter from the admin terminal without a deploy (FR-4.9).
- **Payment Adapter:** a single interface each gateway (Safepay, later PayFast/
  JazzCash/Stripe, and the gated future COD flow) implements so `PaymentsM`'s
  commission/ledger logic never talks to a specific gateway's SDK directly (§5.6a).
- **Disbursement Adapter:** v1.0's manual adapter and a future API-based adapter
  both implement the same interface so the payout queue/ledger/notification logic
  never changes when the disbursement mechanism does (FR-6.11, §5.6b).

In every case, the orchestrating module (Suppliers, Payments, Payouts) contains zero
gateway/supplier-specific branching — that logic lives entirely inside the adapter
implementation. Adding a new integration of any of these three kinds is "write one
adapter," never "touch core order/ledger/catalog code." The two external-SaaS hooks
(§5.24) follow the same *spirit* — a documented, versioned contract rather than a
bespoke integration — though they are inbound/outbound API contracts rather than
pluggable adapters, since goto5x.com does not orchestrate across *multiple*
template stores or social-media platforms the way it orchestrates across multiple
suppliers.

### 3.6 Scaling Path (designed in from day one)
| Phase | Setup |
|---|---|
| 1 | Single VPS: app + DB + Redis + MinIO + worker, all containerized on one box |
| 2 | Move DB to its own VPS; add a read replica; app stays on original VPS |
| 3 | Separate worker/queue VPS; dedicated media/CDN edge (MinIO or migrated to R2/S3); app servers behind a load balancer (2+ VPS) |
| 4 | Multi-region app servers; DB read replicas per region; extract highest-load modules (e.g. Orders, Catalog) into standalone services |

Because tenancy is row-based, sessions are stateless, workers are stateless, media
lives in object storage (not local disk) behind an S3-compatible API, and DB access
already goes through a pooler, each phase transition above is an **infrastructure
change**, not an application rewrite — verified module-by-module.

**Phase 4+ architecture note — region-sharded deployments (roadmap only, not a
v1.0 build item):** beyond Phase 4's regional read replicas, a further evolution
is a full per-region deployment (its own DB + app/worker stack per region) with a
**global admin aggregation view** that queries across regions for platform-wide
analytics (FR-8.10/FR-23.4) and control-plane actions. This is documented here so
today's build avoids closing off the option — no v1.0 module may hard-code an
assumption that all tenants/data live in a single region beyond the existing
i18n/currency rules (§3.9, §2.5) that are already binding. No region-sharding code
is written until Phase 4.

### 3.7 Release & Versioning Strategy
- Environments: `dev` → `staging` → `production`. **Staging runs as a separate
  Docker Compose stack on the same single VPS**, under a staging subdomain (e.g.
  `staging.goto5x.com`) — separate containers, database, and Redis instance from
  production, so a staging bug cannot touch production data. Zero additional
  infrastructure cost at launch; moves to its own VPS once cashflow supports it.
- Database migrations are versioned, reversible, and **backward-compatible with the
  previous release** — this is what makes zero-downtime, rolling deploys possible
  on a single VPS.
- Deploys are rolling/blue-green even on a single VPS, with a documented rollback
  runbook as a release-gate requirement.
- Feature flags gate new functionality for staged rollout, rolled back instantly
  without a deploy.
- Platform releases are semantically versioned with a changelog.
- **Versioned releases are reserved for genuinely new capability.** Anything that
  is merely an operational tuning change belongs in the Settings Registry (§3.8),
  not a deploy.
- **Module-gated build process (binding):** during build, no module or phase starts
  until the previous module's Acceptance Checklist (§14) is 100% verified and
  explicitly approved — a process rule, not a suggestion, governing the roadmap
  (§10) at the module level.

### 3.8 Settings Registry (Config-as-Data — the Admin Control Plane's foundation)
The founder's requirement that "day-to-day operational changes must never require a
code deployment" is implemented as a single, reused mechanism rather than one-off
switches scattered per feature:

- **`settings_definitions`** is a catalog of every tunable key the platform
  recognizes, each declaring its value type, which scopes it may be set at, a
  default, and a validation rule (e.g. a percentage must be 0–100) — so a bad admin
  edit is rejected before it reaches the database, not after it breaks billing.
- **`settings_values`** holds the actual values, each row scoped to `global`,
  `plan`, `seller`, `category`, or `store`. Every module resolves a setting through
  one `SettingsService.resolve(key, context)` call that checks the most specific
  applicable scope first — modules never read a hard-coded constant for anything
  the admin terminal is meant to control.
- **Precedence order (pinned, resolved during Module 1 planning):**
  `seller > store > plan > category > global` — most-specific-wins. A given
  setting key only participates at the scopes listed in its
  `settings_definitions.allowed_scopes`; irrelevant scopes in the chain are
  skipped, never reordered. This is a single universal rule applied consistently
  by every module, rather than a per-key bespoke order: e.g. a per-category
  commission override (`category` scope) is meaningful for FR-6.1/FR-8.3 exactly
  where a seller or store hasn't set a more specific override, and falls back to
  the plan's rate, then the global default, if neither is set.
- **Cache layer:** resolved values are cached in the same Redis instance already
  used for sessions/queues (§3.3) — **no new infrastructure**. An admin write
  invalidates the specific cache key immediately, so a setting change is visible to
  every module on the very next request, with no restart and no deploy.
- **Binding rule:** if a behavior is something an admin should be able to tune
  operationally, it is registered as a setting, not a constant guarded by a flag
  that itself needs a deploy to introduce.
- Every write to `settings_values` is captured in `admin_audit_logs` with the old
  and new value — configuration changes are first-class audited actions.

This one pattern is what makes essentially all of §5.8 (Admin Control Plane) and
§5.6b (Payout & Disbursement) possible without a dedicated table and a dedicated
admin-UI screen per feature.

### 3.9 Internationalization Readiness (binding)
Every feature is built with the following non-negotiable rules, specifically so
that RTL/Urdu storefront support (§10, Phase 2+) is **content and CSS-direction
work later, not an architecture change now**:
- No UI copy (storefront, dashboard, emails, receipts) is hard-coded inline in
  template/component code — every string is sourced through a translation-key
  layer, even though v1.0 ships exactly one locale (English).
- All number, currency, and date formatting goes through a locale-aware formatting
  utility, never manual string concatenation — this also directly serves the
  Currency Strategy (`docs/database-schema.md`).
- Storefront CSS is written so that a direction switch (`dir="rtl"`) re-flows
  layout correctly using standard logical CSS properties — this costs nothing
  extra and is a discipline, not new infrastructure.
- This is a code-review-blocking rule from the first commit, the same way the
  statelessness principle (§3.1) is.

### 3.10 External-SaaS Integration Hooks — architectural summary (new in v0.6)
Full functional detail is in §5.24; this subsection states the shared architectural
shape both hooks follow, so they read as one coherent pattern rather than two
one-off integrations:
- Both hooks are **small, versioned, authenticated API surfaces** goto5x.com owns —
  never a shared database, shared session, or shared deploy with the external
  product.
- Both are gated by an `external_api_clients` registry (mirroring the Supplier
  Adapter registry, §3.5) so admin can see, enable, and disable each integration
  from the admin terminal without a deploy.
- Both are rate-limited and scoped exactly like every other public API surface
  (§6.5) — a compromised or misbehaving external client can be revoked/disabled
  without touching the rest of the platform.
- Neither hook introduces a new database, a new server, or a new paid service —
  they are new API routes plus two small tables (`docs/database-schema.md`).

---

### 3.11 Platform Event Log (Business Analytics Substrate — new)
The founder's growth/unit-economics reporting (FR-8.10, FR-23.4) needs a
history of *when things happened*, not just current-state tables — and that
history cannot be reconstructed retroactively once a signup or a sale has
already happened without being recorded. Recording starts with whichever
module is being built when this is approved (Modules 1–3, backfilled;
Module 4 onward, built in from the start), even though no dashboard reads
from it yet.

- **`platform_events`** (global, append-only): `event_type`, `actor_type`/
  `actor_id`, `store_id` (nullable — not every event is store-scoped),
  `entity_type`/`entity_id` (a generic reference to the row the event is
  about), a small `metadata` JSON object, `created_at`. Same immutability
  discipline as `admin_audit_logs`/`user_security_events`: the application's
  runtime role has `INSERT` only, no `UPDATE`/`DELETE`.
- **Lean taxonomy, binding rule:** only business-lifecycle events that would
  plausibly appear on a growth or unit-economics report qualify —
  `seller.signup`, `seller.verified`, `store.created`, `product.created`,
  `media.imported`, `domain.attached`, `domain.verified`, and the equivalent
  lifecycle events each future module introduces (`order.placed`,
  `payout.requested`, `plan.changed`, etc.). **No page-view/click tracking,
  no per-request noise.** A module proposing a new event type asks "would
  this appear on a growth or unit-economics report?" — if not, it doesn't
  get logged here.
- **No PII in `metadata`, ever:** IDs only (already-scoped by `actor_id`/
  `entity_id`/`store_id`) — never an email, name, phone number, or address.
  This is the same discipline §6.5's PII-handling rule already states for
  application logs, applied to this table specifically.
- **Non-blocking emission (binding):** a failed event write is logged and
  swallowed — it must never fail the user-facing action that triggered it.
  An event log that could break a signup or an order is worse than no event
  log.
- **Retention/archival threshold** is a Settings Registry entry
  (`platform_events.retention_days`), not hard-coded — no archival job exists
  yet (nothing needs one at launch volume), but the tunable is in place so
  adding one later is a worker job, not a schema change.
- **Zero new infrastructure, zero dashboard work now:** one Postgres table,
  reusing the exact insert-only-grant pattern already proven on
  `admin_audit_logs` (Module 1). The already-specified admin analytics
  (FR-8.10) and unit-economics (FR-23.4) dashboards read from this later;
  nothing about either FR changes today.
- **`order.placed` means a confirmed, paid order (binding, cross-referenced
  from §3.12):** the Financial Truth Invariant applies here too — this event
  fires only once a payment is verified (or a manual order is explicitly
  marked paid), never on cart/checkout submission. Whoever designs Orders,
  Cart & Checkout (Module 9 as of v0.10's renumbering, `docs/build-plan.md`)
  emits it at that point, not earlier.

### 3.12 Financial Truth Invariant (binding NFR, new — pinned before Orders/Cart/Checkout and Payments & Ledger are designed)
An order/sale **exists** — in a seller's own dashboard, in any analytics or
report view (seller-facing or admin-facing), and in `platform_events` — **only
after its payment has been verified**: a signed, verified gateway webhook
confirming payment (§5.6a), or an explicit seller mark-as-paid action for a
manual/offline order (§5.17). This is a binding constraint on every module
that touches orders, payments, ledger entries, payouts, or analytics, pinned
now specifically so Orders, Cart & Checkout and Payments & Ledger (Modules 9
and 10 as of v0.10's renumbering, `docs/build-plan.md`) are **designed
around it from their first schema draft**, not retrofitted afterward.

- **No pending/unconfirmed/failed order counts as a sale, anywhere,** even
  transiently. A cart that has been submitted but not yet paid is not an
  order in any seller-visible or admin-visible sense until the invariant
  above is satisfied — it may exist internally as a pending/draft row, but
  no count, total, dashboard figure, or `platform_events` row treats it as
  a sale.
- **Applies uniformly, not per-feature:** the seller order list, seller
  analytics, the admin unit-economics dashboard (FR-23.4), the admin
  real-time analytics (FR-8.10), commission/ledger entries (§5.6), and
  payout eligibility calculations (§5.6b) all read the same underlying
  "confirmed" state — there is exactly one signal for "this is a real sale,"
  never a second, looser definition computed differently by a different
  module.
- **Testable, cross-cutting §14 requirement:** every money-adjacent module's
  Acceptance Checklist (§14.5, §14.6, §14.8, §14.21, §14.23) includes a test
  proving an unpaid/pending/failed order is excluded from every count and
  total it could otherwise appear in — not assumed correct because the happy
  path was tested.

## 4. User Roles & Permissions (summary)

| Role | Key permissions |
|---|---|
| Buyer | Browse, checkout, and look up order status via a secure emailed link — no platform account required (FR-5.4); optional account in v1.1 (FR-22.1) |
| Seller | Full control of own store(s): design, catalog, discovery, customers, shipping, discounts, tax, orders (including manual), supplier links, payout requests, and revocable connections to the Template Store/Social Media SaaS |
| Supplier | Submit listings, view/fulfill orders **only** across stores they are explicitly linked to — never a global view of the platform's orders |
| Platform Admin | Full oversight: approve/suspend sellers & suppliers, configure commission/plans/reserves, approve payouts, resolve disputes, manage template & adapter registries (including the external-API client registry, §5.24), edit content pages, view platform analytics |
| Reviewer (new, v0.10) | **One narrow admin sub-role, not a general permissions system:** sees only the Listing Moderation Engine's queue (§5.27); can approve or reject a queued product with notes. No access to any other admin surface — commission/plans, payouts, seller/supplier lifecycle, settings, or the audit log itself |

Fine-grained permission scopes (e.g. seller staff sub-accounts, a general
admin sub-role/permissions system) remain a **Phase 3+ item — reaffirmed in
this revision, not pulled forward**: a single "platform admin" role with no
internal separation is itself a security concern at scale (§6.5), but
building a whole scoped-permissions framework is out of scope until the
platform has more than one admin/support person to actually scope roles for.
**Reviewer is a deliberate, narrow exception to that deferral, not a reversal
of it:** it exists because the Listing Moderation Engine (§5.27) is a
launch-blocking legal-safety requirement that specifically needs a
limited-access reviewer who cannot also touch payouts, settings, or the
audit log — one purpose-built role, not the start of a general framework.

---

## 5. Functional Requirements

### 5.0 goto5x.com's Own Site
- FR-0.1: The public marketing/signup site is held to the same premium visual bar
  as the seller storefront templates — specifically **apple.com-level minimal
  premium polish combined with the horizonx.so motion aesthetic** (§13) — it is the
  platform's own advertisement for what sellers will get, and ships as a
  first-class Phase 1 deliverable, not an afterthought once the app is done.

### 5.1 Store Builder & Theme Engine
- FR-1.1: Seller selects from a library of premium templates at store creation.
  Even before any AI-assisted generation ships, Phase 1 templates must be
  hand-built to the same "advanced/motion-rich" visual bar described in the
  vision — a generic theme does not satisfy this requirement. **Reaffirmed,
  v0.10:** the visual bar is concretely **apple.com-level minimalism** and
  **horizonx.so-level motion**, including video hero banners in themes — this
  remains gated on founder-delivered branding assets not yet received (the
  same Module 18/Module 4 dependency `docs/build-plan.md` already flags; the
  three built-in Module 4 themes are structurally, not yet visually, at this
  bar).
- FR-1.2: The visual customizer's **v1.0 scope** is: colors, fonts, logo/banner
  images, and section show/hide + reorder — no code required. **Animation/motion
  preset customization is Phase 3** (FR-1.7), not v1.0.
- FR-1.3: Live preview of changes before publishing.
- FR-1.4: All templates are mobile-responsive by default, and the seller dashboard
  itself is usable on mobile (not just the storefront).
- FR-1.5: **SEO controls per store/page** (schema gap found and closed while
  planning Module 4 — no version of this SRS ever specified where these
  fields live): `seo_title`/`seo_description` are nullable columns directly on
  `stores` (the storefront homepage default/fallback) and `products` (product
  pages); `collections` gets the same pair once that table is built (Module
  5); v1.1 store pages/blog posts (FR-22.4) get the same pair when that
  module ships. **Fallback rule (binding):** if `seo_title` is null, render
  the entity's own name/title; if `seo_description` is null, derive it from
  the entity's own description (truncated) or fall back to the store-level
  default. FR-16.6's structured-data/Open Graph tags read from these same
  fields — one source of truth, never a second set of SEO data. **Sitemap and
  robots.txt are built in Module 4**, generated dynamically per request (no
  static file, no cron job) covering whatever public pages exist as of that
  module (storefront home + products); Module 5 extends the same generator
  with collection pages once those exist — not a redesign. URLs use the
  store's verified custom domain (FR-11.2) when one exists, falling back to
  the free subdomain otherwise. A store in `coming_soon`/`password_protected`
  access mode (FR-16.5) serves a `noindex` robots.txt and no sitemap at all —
  this requires `stores.access_mode` to exist ahead of Module 5's originally
  planned introduction of it (see database-schema.md's note on this column).
- FR-1.6: **Advanced/self-coded mode** — a seller who wants full control can switch
  a store (or section) into a code-level theme editor (custom HTML/CSS/template
  overrides) instead of the visual customizer. This is an opt-in escape hatch for
  technical sellers, gated behind a plan tier (Phase 2).
- FR-1.7 (Phase 3+): Animation/motion preset customization and AI-assisted
  content/image suggestions inside the customizer.
- FR-1.8: **Template marketplace showcase & install hook** — the theme-selection UI
  always shows goto5x.com's own **built-in free templates** first and foremost, and
  additionally surfaces a **premium-templates showcase** linking out to the
  founder's separate Template Store SaaS. Full detail — including the Template
  Install/License API — is specified in §5.24a, since it's a full integration hook,
  not a one-line FR.

### 5.2 Seller Admin Dashboard
- FR-2.1: Product/catalog CRUD, variants, inventory tracking.
- FR-2.2: Order list with status, filtering, and fulfillment actions.
- FR-2.3: Store design panel (entry point to Theme Engine, §5.1).
- FR-2.4: **Sales/traffic analytics view** — v1.0 scope is basic: orders, revenue,
  and top products, computed via live queries, scoped strictly to that seller's own
  store.
- FR-2.5: Payout/commission breakdown view (available vs. pending vs. reserved
  balance, with the hold-release date visible per pending entry and the
  reserve-release date visible per reserved entry).
- FR-2.6: **Seller-initiated supplier connection** — a seller can invite/create a
  supplier link directly from their own dashboard (generating an invite a supplier
  accepts), in addition to a supplier independently registering and requesting a
  link. Either path lands in the same place: a `StoreSupplierLink` pending the
  seller's review.
- FR-2.7: Listing review/approval — every listing a linked supplier submits is
  queued for the seller's explicit approval before it can appear in that seller's
  store; no auto-publish path exists.
- FR-2.8: Google Drive connect (OAuth) for bulk media import.
- FR-2.9: Custom domain attachment (DNS instructions + verification status).
- FR-2.10: **Store shipping settings** — a seller configures a flat shipping rate
  and, optionally, a free-shipping threshold for **self-fulfilled** products.
  Shipping zones and weight-based rates are Phase 2. Supplier-fulfilled items use
  the rate provided by that supplier's adapter instead (FR-4.6, FR-5.6).
- FR-2.11: **Discount code management** — a seller creates percentage-off or
  fixed-amount codes for their store, each with an optional expiry date and usage
  limit (§5.5, FR-5.5). Advanced discount types (auto-apply, BOGO, scheduled sales)
  are Phase 2.
- FR-2.12: **Marketing entry point** — the dashboard includes a "Marketing" section
  serving as the polished handoff to the founder's Social Media SaaS. Full detail
  in §5.24b.

### 5.3 Supplier Portal
- FR-3.1: Supplier registration and verification workflow (independent
  self-registration, or acceptance of a seller-initiated invite per FR-2.6).
- FR-3.2: Supplier submits product listings — including shipping cost, estimated
  delivery time, and supported delivery countries (FR-4.6) — against the Supplier
  Adapter interface (§3.5); each seller reviews and approves before a listing goes
  live in their store (FR-2.7).
- FR-3.3: **Multi-store dashboard** — a supplier connected to multiple sellers'
  stores sees all their listings and orders across every connected store in one
  unified view, scoped strictly to the stores they are linked to (§4).
- FR-3.4: Fulfillment workflow per order, rendered as a literal per-order checklist
  in both the supplier's and the seller's dashboards: `Pending → Confirmed →
  Shipped (tracking added) → Delivered → Completed`. Supplier uploads tracking ID;
  system relays it to the buyer and ticks the corresponding checklist item in the
  seller's dashboard automatically.

### 5.4 Dropshipping Supplier Integrations
- FR-4.1: Phase 1 integration target: **Printify**, as the first Supplier Adapter
  implementation (§3.5) — chosen first for its well-documented, modern API and
  print-on-demand model that needs no separate stock-sync complexity.
- FR-4.2: Phase 1.1: **CJ Dropshipping**, as the second adapter — deliberately
  chosen second specifically to prove the adapter interface is genuinely generic.
- FR-4.3: Product price/stock sync from supplier catalogs on a scheduled interval,
  with a cached last-known catalog so a supplier API outage degrades gracefully
  (stale but available data) instead of breaking the live storefront.
- FR-4.4: AliExpress has no official dropship API; deferred, added later as a
  third-party-API-backed adapter once evaluated for API stability and legal/ToS
  risk — never as a special-cased core integration.
- FR-4.5: **Oversell protection** — when the same supplier product is listed by
  multiple sellers, stock sync (FR-4.3) must decrement a shared supplier-stock
  figure on order placement so two sellers cannot both sell the last unit.
- FR-4.6: **Supplier listing transparency** — every supplier-sourced listing
  displays to the buyer: shipping cost, estimated delivery time, and the countries
  the supplier can deliver to.
- FR-4.7: Checkout **blocks** placing an order when any item in the cart is a
  supplier listing that does not support delivery to the buyer's shipping country
  — a hard stop, not a warning.
- FR-4.8: Supplier price changes propagate through the existing sync mechanism
  (FR-4.3); checkout **re-validates** each item's price against the latest synced
  `supplier_listings.price` at the moment of order placement — a storefront page is
  never allowed to complete a sale at a stale cached price.
- FR-4.9: **Supplier adapter registry** — admin can register, enable, or disable a
  supplier adapter from the admin terminal without a deploy; disabling an adapter
  stops new listing syncs and order forwarding through it but does not affect
  orders already placed.
- FR-4.10: **Markaz — named research item (Phase 2+ roadmap)** — Markaz (a
  Pakistani dropship supplier) is recorded as a candidate for the Supplier Adapter
  interface, exactly like Printify/CJ. Before committing build time: verify public
  API availability and stability. If viable, it is added as a standard adapter with
  zero core-platform changes; if not, it stays a research note. AliExpress/Alibaba
  remain future adapter candidates under the same evaluate-first discipline (FR-4.4).

### 5.5 Order & Fulfillment Management
- FR-5.1: Unified order dashboard per seller, spanning both self-fulfilled and
  supplier-fulfilled orders.
- FR-5.2: Automated buyer notification on status change (order confirmed, shipped
  with tracking, delivered).
- FR-5.3: Defined suspended/banned-store behavior: if a store is suspended by admin
  (§5.8), its storefront shows a clear "temporarily unavailable" state to buyers
  rather than a broken page, and in-flight orders remain fulfillable so existing
  buyers aren't stranded.
- FR-5.4: **Buyer order-status lookup** — since buyers do not have accounts (guest
  checkout, §2.3), order confirmation emails include a secure, unguessable link to
  a status page for that order; the link uses a signed token, not a
  sequential/guessable order number.
- FR-5.5: **Discount code validation** — at checkout, a code is accepted only if it
  is active, not past its expiry date, and under its usage limit; an invalid code
  is rejected with a clear reason, never silently ignored. Commission (FR-6.1) is
  calculated on the post-discount amount.
- FR-5.6: Order shipping cost is computed **per fulfillment source** in a mixed
  cart: self-fulfilled items use the seller's shipping settings (FR-2.10);
  supplier-fulfilled items use their adapter-provided rate (FR-4.6); the order
  total is the sum of both.

### 5.6 Payments, Commission & Ledger Engine
- FR-6.1: Commission of 3% is deducted per completed sale, calculated on the
  **product + shipping subtotal actually charged to the buyer, net of any discount
  code applied (FR-5.5), before payment-gateway fees** (gateway fees are a
  separate, itemized deduction, and are recorded as **zero** for orders paid via
  the `manual` payment type, FR-17.1, since no real gateway fee is incurred) —
  configurable per plan/category/seller by admin via the Settings Registry, not
  hard-coded. All monetary amounts are expressed in the store's configured currency
  — no logic anywhere assumes PKR specifically.
- FR-6.2: New-seller payout hold: funds from a new seller's sales are held for a
  configurable period (default 21–22 days), applied **per transaction**, not as an
  account-wide lock.
- FR-6.3: **Hold graduation** — once a seller reaches a configurable trust
  threshold (e.g. N successfully completed, non-disputed orders, and identity
  verification per §6.5 complete), the hold period shortens or is removed for that
  seller going forward.
- FR-6.4: Internal ledger per seller: tracks `pending_balance`, `available_balance`,
  `reserved_balance`, `total_paid_out` as **computed sums over an append-only
  `LedgerEntry` table** — every commission, hold-release, reserve-hold,
  reserve-release, gateway fee, and payout is its own entry; no balance field is
  ever directly mutated.
- FR-6.5: Dispute/refund workflow that freezes a specific ledger entry without
  affecting the seller's other available funds; disputes are handled manually via
  the admin terminal in Phase 1.
- FR-6.6: A daily reconciliation job compares the ledger's computed totals against
  the payment gateway's settlement report and alerts admin on any mismatch. **Scope
  clarification (new in v0.6):** this job reconciles only against real external
  settlement reports (i.e. Safepay); `manual`-type payments (FR-17.1) and any
  future gated COD payments have no external settlement report to reconcile
  against and are excluded from this specific job — their correctness relies on the
  admin's own manual confirmation at the point of marking an order paid, which is
  itself an audited action (FR-8.9).

### 5.6a Payment Gateway Strategy (Pakistan-first, prepaid launch)
- **v1.0 launch: Safepay only.** A prepaid-only launch keeps commission capture
  clean: buyer pays → platform receives the full amount → 3% commission is
  deducted in the ledger (FR-6.1) → the remainder is credited to the seller's
  balance under the standard hold (FR-6.2).
- **Cash on Delivery (COD) — deferred, not deleted.** COD inverts commission
  collection: the seller (or courier) collects payment directly, so the platform
  never holds money to deduct 3% from. COD returns in a later phase as a
  **controlled, per-seller feature**: a Settings Registry flag
  (`payments.cod_enabled`, scope `seller`) enabled only for **verified sellers with
  sufficient available ledger balance** to cover the commission on outstanding COD
  orders. The schema/ledger already anticipates it (`payments.gateway` includes
  `cod`), switched off for every seller at launch.
- **Phase 1.x:** add a second aggregator (PayFast PK) and/or direct
  JazzCash/Easypaisa merchant APIs once a registered company + transaction volume
  justify their more enterprise-paced onboarding.
- **Phase 4:** Stripe via a foreign entity for international buyers.
- Commission, hold, reserve, and payout logic are implemented entirely in
  goto5x.com's own ledger and are **gateway-agnostic by construction** — switching
  or adding a gateway never touches that code, only a new Payment Adapter (§3.5).

### 5.6b Payout Request & Disbursement Engine
- FR-6.7: A seller can request a payout of any amount **up to their current
  `available_balance`** (post-hold, post-reserve); a request exceeding available
  balance is rejected before it reaches the approval queue.
- FR-6.8: An optional **scheduled payout mode** — a seller may opt into automatic
  payout requests generated on a fixed monthly date. Both the mode's availability
  and its parameters are Settings Registry entries.
- FR-6.9: Every payout request enters an **admin approval queue**. Each request
  displays an auto-generated **risk summary**: seller KYC status, dispute/refund
  rate, count of flagged orders/listings, account age, and an abnormal
  sales-velocity signal (v1.0: a simple threshold check). All thresholds are
  Settings Registry entries.
- FR-6.10: A seller with an active prohibited-goods flag has payouts **fully
  frozen** and is routed toward the store-suspension path — not a soft warning.
- FR-6.11: **Disbursement Adapter pattern** (§3.5): v1.0 ships the **manual
  adapter** — an approved request appears on an admin batch screen (payee, amount,
  bank/IBAN or Raast account, copy-ready); the admin transfers funds outside the
  platform and marks the request **Paid**, creating the corresponding
  `payout_debit` ledger entry and a seller notification. Phase 1.x adds an
  **API-based adapter** implementing the same interface, with zero changes to the
  queue/ledger/notification logic.
- FR-6.12: Payout status is visible to the seller through the full lifecycle:
  `requested → approved → processing → paid` (or `rejected`, with a reason).
- FR-6.13: **Rolling reserve** — an additional, ongoing holdback **on top of** the
  per-transaction hold (FR-6.2): a per-seller reserve percentage (default **0%**)
  admin-settable or auto-applied when risk-flagged. The reserved portion of each
  sale is its own ledger entry class (`reserve_hold`), released via
  `reserve_release` after a configurable period if undisputed. All parameters are
  Settings Registry entries.

### 5.7 Subscription Plans, Pricing & Billing
- FR-7.1: Tiered plans (e.g. Free / Starter / Growth / Premium) priced in the
  platform's configured currency (PKR at launch), gating features (product count,
  storage, template tiers, custom domain, coded-theme mode, analytics depth) via
  the Settings Registry.
- FR-7.2: Recurring billing cycle with invoicing and dunning (failed-payment
  retry) for paid plans.
- FR-7.3: **Free Plan (first-class)** — a plan tier with **no billing cycle**,
  bounded by tight Settings-Registry-tunable limits: product count, storage quota,
  access to the base template tier only, no custom domain, and one store per
  verified identity. The Free Plan carries a **higher default commission %** than
  paid plans (admin-configurable per FR-7.4).
- FR-7.4: **Inverse commission laddering** — the plan editor (FR-8.2) exposes a
  per-plan commission-rate override such that higher-tier plans carry a **lower**
  commission than the Free Plan, using the same Settings Registry mechanism
  already defined for per-plan/per-seller/per-category overrides (FR-6.1, FR-8.3).
- FR-7.5: **Plan change flow (v1.0 simple rule)** — a plan upgrade or downgrade
  takes effect at the start of the seller's **next billing cycle**; no prorated
  mid-cycle billing in v1.0 (Phase 2 item).
- FR-7.6: **Yearly billing option** — the plan editor supports an annual billing
  interval alongside monthly, with an admin-configurable discount relative to
  twelve months at the monthly rate.
- FR-7.7: **Launch-campaign pricing** — time-limited or first-N-sellers
  promotional pricing/commission rates, expressed as Settings Registry entries
  with an optional expiry timestamp or a counter condition.
- FR-7.8: **Admin-granted plans (new)** — an admin can directly grant any plan,
  including the Free Plan, to a specific seller from the plan editor (FR-8.2),
  bypassing normal checkout/billing for that one assignment. Recorded in
  `admin_audit_logs` like every other control-plane mutation (before/after plan).
- FR-7.9: **Platform-level subscription promotion codes (new)** — an admin can
  create a one-time discount code for **subscription billing** (a plan/billing
  discount), optionally targeted at a specific user, distinct from a seller's own
  store-level `discount_codes` (FR-2.11/FR-5.5), which discount products at
  checkout, not the seller's own subscription. A platform promo code is redeemed
  at most once (or up to an admin-set redemption limit) and can carry an expiry.

### 5.8 Platform Admin Terminal — the Control Plane
The admin terminal is not "a management screen" — it is the platform's control
plane. Every item below is implemented as Settings Registry entries (§3.8) and
small, purpose-built tables, so that operating the platform day to day never
requires the founder to ask an engineer for a deploy.

- FR-8.1: **Feature flags** — any feature-gated behavior can be enabled/disabled
  instantly at global, per-plan, or per-seller scope through the Settings Registry;
  precedence is seller > plan > global.
- FR-8.2: **Plans & pricing editor** — create, edit, and retire plans directly from
  the admin UI; each plan's limits are Settings Registry entries scoped to that
  plan.
- FR-8.3: **Commission & payout engine settings** — global commission %, category-
  and seller-level overrides, the default hold duration, hold-graduation
  thresholds, and rolling-reserve parameters are all editable via the Settings
  Registry. Changing a rate affects only *new* ledger entries going forward.
- FR-8.4: **Seller lifecycle control** — approve, suspend, ban, or limit a seller;
  read-only "view any store" access; a secure, time-boxed, reason-required
  **"login as seller" impersonation** mode, fully audit-logged; instant
  force-disable of a single store.
- FR-8.5: **Supplier lifecycle control** — the same approve/suspend/ban controls as
  FR-8.4, plus platform-level listing approve/reject for policy violations.
- FR-8.6: **Template management** — publish/unpublish a template, mark it free or
  premium, and assign which plans can access it — extended in v0.6 by the
  Template Store entitlement model (§5.24a).
- FR-8.7: **Announcements & maintenance mode** — scheduled, platform-wide banners,
  and a global maintenance-mode toggle checked by a lightweight middleware in
  front of every module, with an admin-IP allowlist.
- FR-8.8: **Risk & fraud controls** — flag a suspicious order for review; freeze or
  release a specific seller's payouts; initiate a refund, recorded as a
  `refund_adjustment` ledger entry.
- FR-8.9: **Immutable audit log** — every control-plane action is recorded with
  actor, action, target, before-value, after-value, and, where applicable, the
  impersonation session it occurred under. Immutability is enforced at the
  database level (no `UPDATE`/`DELETE` privilege for the application's runtime
  role).
- FR-8.10: **Real-time platform analytics** — GMV, revenue, commission earned,
  active store count, and top sellers, computed live against the transactional
  tables at launch volume; extended by the unit-economics view (FR-23.4). Both
  this and FR-23.4 are the intended eventual readers of `platform_events`
  (§3.11/FR-26.x) — recording starts now (Module 1 onward, backfilled), no
  dashboard work changes today.
- FR-8.11: System health dashboard (queue depth, error rates, VPS resource usage).
- FR-8.12: Admin accounts require mandatory MFA (not optional).
- FR-8.13: **Listing/content moderation queue** — supplier listings and store
  content can be flagged for prohibited/counterfeit goods, with a takedown action
  that also triggers the payout freeze in FR-6.10.
- FR-8.14: **External-API client registry (new in v0.6)** — admin can view,
  enable, or disable the Template Store and Social Media SaaS API clients from the
  admin terminal, mirroring the Supplier Adapter registry (FR-4.9). Disabling a
  client immediately rejects further calls from it without affecting any other
  integration.
- FR-8.15: **In-app messaging (extends FR-8.7, new)** — announcements are not
  limited to a single platform-wide banner. An admin can create a message on any
  of three channels — **banner**, **popup**, or **in-app notification** — each
  independently **targeted** (all sellers / a specific plan / a specific seller)
  and **scheduled** (start/end window, same mechanism as FR-8.7's existing
  scheduling). Maintenance mode (FR-8.7) remains the one global, non-targetable
  kill-switch — targeting only applies to the messaging channels, not to
  maintenance mode.

### 5.9 Media Management
- FR-9.1: Seller connects Google Drive via OAuth to bulk-import product
  images/video. The connection is **seller-scoped** (one Google account per
  seller, reused across all of that seller's stores), recorded in
  `google_drive_connections` (schema gap found and closed in v0.7 — see
  `docs/database-schema.md`): the seller's OAuth **refresh token is stored
  encrypted at rest** (app-level AES-256-GCM, key from env, never logged, never
  returned by any API response); the short-lived **access token is never
  persisted to Postgres at all** — it lives only in Redis for the duration of an
  active import job. A seller can **revoke** the connection at any time from the
  dashboard; revocation deletes the stored refresh token and makes a best-effort
  revocation call to Google, and is **audit-trailed** the same way a Product Feed
  API token revocation is (FR-24.10).
- FR-9.2: Imported media is copied into platform object storage (self-hosted
  MinIO, §3.3) fronted by the CDN for storefront delivery — Drive is a source, not
  the runtime dependency.

### 5.10 Notifications
- FR-10.1: Email notifications for order/payout/listing events at launch
  (including the buyer order-status link, FR-5.4, and payout status changes,
  FR-6.12); SMS/WhatsApp as a Phase 2+ addition.

### 5.11 Custom Domain
- FR-11.1: Every store gets a free subdomain (`storename.goto5x.com`) by default.
- FR-11.2: Seller can attach an owned custom domain via CNAME/A-record
  instructions with automated verification and TLS issuance.

### 5.12 Content Pages (legal, about, contact)
- FR-12.1: Platform content pages — Terms of Service, Privacy Policy, Refund
  Policy, About, Contact — are stored as **versioned, rich-text content in the
  database** and edited from the admin terminal; publishing a text change is a
  data operation, never a deploy. Each edit creates a new version; prior versions
  remain retrievable.
- FR-12.2: Draft legal content for Terms of Service, Privacy Policy, and Refund
  Policy — covering the marketplace model, the 3% commission, the per-transaction
  hold, and the rolling reserve — ships as `docs/legal/*.md` for human legal
  review before launch.
- FR-12.3: **Platform brand asset management (new)** — the admin-editable content
  capability in FR-12.1 extends to the platform's own visual assets (logo,
  favicon, marketing hero images), stored and versioned the same way as content
  pages (a current pointer + an append-only revision history), so a brand refresh
  is a data operation, never a deploy.
  - **Confirmation (no gap found):** per-plan visual/template tiers are already
    fully covered by existing FRs — FR-7.1 (plan editor gates `themes.tier`
    access) and FR-8.6 (template management assigns which plans can access a
    given template) — independently of, and layered under, the marketplace
    entitlement mechanism (FR-24.5). FR-12.3 only adds **platform-owned** brand
    assets to admin control; it does not change how seller-facing template tiers
    are gated.

### 5.13 Customers (CRM)
- FR-13.1: A **customer record** is automatically created (or matched by email) in
  a per-store `customers` table the first time a buyer checks out at that store —
  name, email, phone, order count, and total spent are tracked and updated on
  every subsequent order from the same email. **This applies uniformly regardless
  of order source** (clarified in v0.6): a manual/draft order (FR-17.1) updates the
  same customer record a storefront order would.
- FR-13.2: Seller dashboard customer list (searchable, sortable by total
  spent/order count) and a per-customer detail view showing their order history at
  that store.
- FR-13.3: Customer records are tenant-scoped exactly like every other store table
  — a seller never sees another seller's customers, even for the same buyer email.

### 5.14 Product Reviews & Ratings
- FR-14.1: A buyer can submit a review (rating 1–5, text) against a product they
  purchased, identified via the order-status link (FR-5.4) rather than an account.
- FR-14.2: A review is flagged `verified_purchase` when it is linked to a real
  order for that product at that store; unverified submissions are allowed but
  shown as unverified, never hidden as spam by default.
- FR-14.3: A seller **moderates** reviews for their own store — approve or hide —
  before a review counts toward the product's displayed average rating; no review
  publishes automatically.
- FR-14.4: A product's average rating and review count are shown on its storefront
  page, recomputed whenever a review's moderation status changes (denormalized for
  page-load speed — the highest-traffic read path a review touches).

### 5.15 Cart Persistence & Abandoned Carts
- FR-15.1: **Checkout is email-first (locked UX decision, new in v0.6).** Email is
  the first field/step in checkout, captured before any payment details — this
  defines exactly when a shopping cart is persisted to the database: **once the
  email-first step is completed.** Carts before that point are client-side/
  anonymous and not tracked server-side. This was previously an open design
  question (v0.5, Risk 17); it is now a locked decision, not an implementation
  detail to be discovered mid-build.
- FR-15.2: A scheduled job flags a captured-email cart as `abandoned` once it has
  been inactive beyond a configurable window (`cart.abandoned_after_hours`,
  Settings Registry). **v1.0 ships the flagging mechanism and the underlying table
  only; recovery emails are v1.1** (§5.22, FR-22.2).

### 5.16 Storefront Discovery & Merchandising
- FR-16.1: **Collections** — a seller defines named product groupings (distinct
  from the admin-managed global `categories`) rendered as storefront sections; a
  product can belong to multiple collections.
- FR-16.2: **Storefront search & filters** — in-store product search via Postgres
  full-text search, plus filtering by price range, category, and collection.
- FR-16.3: **Navigation editor** — a seller edits header and footer menus, each
  entry linking to a collection, a content page, or an external URL. **Extended in
  v0.6:** the footer location supports richer content blocks beyond simple menu
  links — a free-text block and a social-links row (FR-16.8) — not only linked
  menu items.
- FR-16.4: **Announcement bar** — a dismissible or persistent banner, configured as
  a Theme Engine customizer setting.
- FR-16.5: **Coming-soon / password-protected mode** — a store owner can gate the
  entire storefront behind a "coming soon" page or a shared password before public
  launch.
- FR-16.6: **SEO structured data** — schema.org `Product` JSON-LD markup,
  OpenGraph tags, and an auto-generated `sitemap.xml` + `robots.txt` per store.
- FR-16.7: **WhatsApp chat/order button** — a seller sets a WhatsApp number and
  toggles a floating chat/order button on their storefront.
- FR-16.8: **Social media links (new in v0.6)** — a seller enters their social
  profile URLs (Facebook, Instagram, TikTok, etc.) in store settings; the
  storefront renders them as icons, typically in the header/footer — a Theme
  Engine customizer setting, not a new content system.
- FR-16.9: **FAQ accordion section (new in v0.6)** — a reusable template section
  type: a seller enters a list of question/answer pairs, rendered as an
  expand/collapse accordion anywhere a template supports section placement (§5.1).

### 5.17 Manual/Draft Orders & Order Management Enhancements
- FR-17.1: **Manual/draft orders — v1.0 scope: mark-as-paid only (bounded per
  founder decision, v0.6).** A seller creates an order directly from the dashboard
  (critical for phone/WhatsApp selling) and marks it paid directly, recorded via a
  `manual`-type payment entry that still produces the correct ledger entries —
  commission is still deducted (FR-6.1); a manual order is not a way to avoid
  commission. **The payment-link flow (generating a hosted Safepay checkout link
  tied to a manual order) is deferred to v1.1** — this was previously the v0.5
  Risk 16 flag; the founder's decision bounds v1.0 to the smaller, lower-integration-
  risk slice.
- FR-17.2: **Order notes** — free-text, seller/admin-only notes on an order, never
  shown to the buyer.
- FR-17.3: **Order tags** — free-form labels a seller can filter the order
  dashboard by.
- FR-17.4: **Order timeline** — an append-only, per-order activity log (status
  changes, notes added, edits made, tracking uploaded) rendered chronologically.
  Timeline events for an edit (FR-17.5) record both the before and after value, the
  same discipline as `admin_audit_logs` (clarified in v0.6).
- FR-17.5: **Basic order editing** — an order's line items, shipping, or applied
  discount may be edited only while its status is `pending` or `confirmed` (never
  after `shipped`). An edit that changes the total after a ledger entry already
  exists produces a **compensating ledger entry** (never a rewrite of the original)
  and appends a timeline event. **Clarified in v0.6:** an edit that changes item
  quantities correspondingly adjusts `product_variants.stock_quantity` (restoring
  stock for a removed/reduced item, decrementing it for an added/increased one) —
  an order edit is never a ledger-only operation that silently leaves inventory
  out of sync.

### 5.18 Data Portability (CSV Import/Export)
- FR-18.1: **Bulk product import — v1.0 scope: core fields only (bounded per
  founder decision, v0.6).** A CSV import maps a standard **Shopify
  product-export CSV**'s core fields: title, description, price, variants/options,
  images, and inventory (stock quantity). **The import screen explicitly lists
  which fields in the uploaded file were and were not mapped, per upload** — a
  seller always sees what did and didn't come across, rather than silent data
  loss. Metafields and complex/nested option combinations are a **v1.1 fast-follow**,
  not a v1.0 gap left undocumented. This bounds what was previously the v0.5 Risk
  15 flag to a scope the founder has explicitly accepted.
- FR-18.2: Import runs as a **background job** (existing BullMQ infrastructure), not
  a synchronous request, with a per-row error log a seller can review and fix
  rather than an all-or-nothing failure.
- FR-18.3: **Product and order CSV export**, for the seller's own records or to
  move to another platform — exporting a seller's own data is treated as a right,
  not a retention lever.

### 5.19 Receipts, Invoices & Tax
- FR-19.1: **Self-hosted PDF invoice/receipt generation** (no paid invoicing
  service, per the self-host-first principle) — a branded, downloadable PDF
  (seller logo, currency, tax line) is attached to the order-confirmation email
  and available from the buyer order-status page.
- FR-19.2: **v1.0 ships exactly ONE well-designed, branded invoice template
  (bounded per founder decision, v0.6),** meeting a **"clean and professional, not
  generic" bar**, verified by a **single founder sign-off** (§14.19) — not an
  open-ended "make it feel luxury" iteration loop. Further visual polish is an
  explicitly **time-boxed backlog item**, never a pre-launch gate. This bounds what
  was previously the v0.5 Risk 18 flag.
- FR-19.3: **Basic tax settings** — a seller sets a per-store tax rate and whether
  displayed prices are tax-inclusive or tax-exclusive; the applicable tax amount is
  computed at checkout and itemized as its own line on the invoice. One rate per
  store in v1.0 — no multi-jurisdiction complexity.

### 5.20 Seller Onboarding Wizard
- FR-20.1: A guided, post-signup checklist walks a new seller through: pick a
  template → set a logo → add a first product → configure a domain (or accept the
  free subdomain) — with visible progress state.

### 5.21 Subscription Plans (see §5.7)
*(Consolidated into §5.7 above in this revision to avoid duplicate numbering —
§5.7's FR-7.1–FR-7.7 is the complete plans/pricing/billing specification.)*

### 5.22 v1.1 Roadmap Features (documented ahead of time)
Not v1.0 scope — documented now so v1.1 work can start immediately after v1.0
ships, and so v1.0's schema doesn't need to be redesigned to accommodate them.
- FR-22.1: **Optional buyer accounts** — guest checkout remains the v1.0 default.
  Already **schema-ready**: `orders.buyer_id` has been nullable-FK-to-`users` since
  v0.4 specifically for this.
- FR-22.2: **Abandoned-cart recovery emails** — sends against the `carts` table's
  `abandoned` flag already shipping in v1.0 (FR-15.2). v1.1 adds only the email
  template and send job.
- FR-22.3: **Returns/refunds seller-side workflow** — a buyer-initiated return
  request, a seller accept/reject action, and completion linked to the existing
  refund/ledger flow (FR-6.5) — a new `return_requests` table, no change to the
  ledger mechanism itself.
- FR-22.4: **Per-store content pages + blog** (for SEO) — mirrors the
  platform-level versioned content-page pattern already built for FR-12.1, just
  tenant-scoped.
- FR-22.5: **Built-in support/ticket system** (seller ↔ platform admin),
  self-hosted — no third-party helpdesk SaaS.
- FR-22.6: **Seller referral program** — referral links, conversion tracking, and
  reward parameters (amount, trigger condition) expressed as Settings Registry
  entries.
- FR-22.7: **Low-stock alerts + storefront email-capture (newsletter list)** —
  low-stock alerting is a threshold check against existing
  `product_variants.stock_quantity`; the newsletter list is a new, tenant-scoped,
  exportable subscriber table.
- FR-22.8: **Manual/draft order payment-link flow** (deferred from v1.0, FR-17.1)
  — generating a hosted Safepay checkout link tied to a manual order, reusing the
  existing Payment Adapter.
- FR-22.9: **CSV import metafields/complex option combinations** (deferred from
  v1.0, FR-18.1) — the fast-follow to the core-fields-only v1.0 importer.

### 5.23 Business Guard-Rails & Platform Economics
Every threshold below is a Settings Registry entry, not a hard-coded constant.
- FR-23.1: **Free-plan enforcement** — storage quota is metered per store against
  the plan's Settings-Registry-defined limit; the product-count limit is enforced
  **at creation time** (a create request beyond the limit is rejected with a clear
  reason), not merely displayed as a soft warning.
- FR-23.2: **Dormant-store lifecycle** — a scheduled job flags a free-plan store
  inactive beyond a configurable threshold (`lifecycle.dormant_warning_days`) and
  sends a warning email; after a further configurable period
  (`lifecycle.dormant_suspend_days`) it is suspended; after a further configurable
  period (`lifecycle.dormant_archive_days`) it is **archived** — a store status
  distinct from `suspended`: data retained, storefront fully and permanently
  offline until the seller re-engages.
- FR-23.3: **No trial-of-paid-features (binding product principle)** — the Free
  Plan is complete and permanently usable within its limits, never a time-boxed
  trial; a paid-plan-only feature is inaccessible on the Free Plan regardless of
  account age, enforced by the same plan-scoped Settings Registry checks used
  everywhere else — no separate "trial expired" code path exists to build or
  accidentally leave open.
- FR-23.4: **Unit-economics admin dashboard** — extends FR-8.10 with: active
  free-vs-paid store counts, commission earned specifically from Free-Plan stores,
  per-store storage usage, and a monthly platform-cost-vs-revenue break-even view
  where the cost figure is **admin-entered** (`finance.monthly_infra_cost`) rather
  than computed.
- FR-23.5: **Velocity/abuse limits** — a per-identity limit on the number of
  Free-Plan stores one verified identity can create, and signup-rate limiting at
  the auth layer — both Settings-Registry-tunable thresholds.

### 5.24 External-SaaS Integration Hooks (new in v0.6)
The founder runs two separate future SaaS products. goto5x.com builds **only its
own side** of each hook — a small, versioned, authenticated API surface — never the
external product itself. See §3.10 for the shared architectural pattern both hooks
follow.

#### 5.24a Template Store Hook
- FR-24.1: goto5x.com **always** ships its own built-in free templates (the
  existing `themes` catalog, FR-1.1) — the theme-selection UI's core functionality
  never depends on the Template Store existing or being reachable.
- FR-24.2: The theme-selection UI additionally includes a **premium-templates
  showcase** — a curated, visually consistent panel linking out to the Template
  Store SaaS. This is a presentation/link-out feature only; goto5x.com does not
  proxy or mirror the Template Store's own catalog or checkout.
- FR-24.3: **Template Install/License API** — after a seller completes a purchase
  on the Template Store, that external system calls a **signed, authenticated**
  goto5x.com API endpoint to grant the seller a **template entitlement**: the
  purchased template is registered into goto5x.com's `themes` catalog (if not
  already present) and a `template_entitlements` row is created linking that
  specific seller to that specific theme.
- FR-24.4: **Import-only, no downloadable files (anti-piracy, luxury UX).** At no
  point does a seller receive a raw template file/package to download — the
  Template Store's purchase flow leads directly into an installed, selectable
  template in the seller's own theme-selection UI. This is both a piracy control
  (the template's source never leaves goto5x.com-controlled storage in a form a
  buyer could redistribute) and a UX one (no manual install step).
- FR-24.5: A seller's access to a marketplace-purchased template is gated by their
  **template entitlement**, a mechanism distinct from — and layered on top of —
  the existing plan-based template-**tier** gating (FR-7.1, `themes.tier`): a
  Free-Plan seller who purchases a premium marketplace template still has that one
  specific template available to them, without their plan's tier otherwise
  changing. The two gating mechanisms are checked independently and both must pass.
- FR-24.6: The Template Install/License API's authenticity is verified via a
  signed-request scheme (§6.5) before any entitlement is granted; every grant is
  captured in `admin_audit_logs` (as an automated/system actor, not a human admin)
  so a forged or duplicate grant attempt is traceable. Revocation (e.g. a refunded
  purchase) is symmetric: the same API surface accepts a revoke call, which removes
  the entitlement without deleting the underlying `themes` catalog entry others may
  legitimately hold.
- FR-24.7: goto5x.com does not implement or assume anything about the Template
  Store's own billing, refund policy, or catalog management — those are that
  product's concern; goto5x.com only honors grant/revoke signals it receives
  through this API.

#### 5.24b Social Media SaaS Hook
- FR-24.8: The seller dashboard includes a **"Marketing" section** — a polished
  entry point that hands the seller off to the founder's separate Social Media
  SaaS **using the existing SSO hook (§3.2a)** — no second signup, no second
  password.
- FR-24.9: **Product Feed API** — an authenticated, **seller-scoped**, read-only
  API exposing that seller's products (title, price, images, storefront URL) so
  the Social Media SaaS can auto-fill post templates. The feed exposes only fields
  already public on the seller's own storefront — nothing a buyer couldn't already
  see.
- FR-24.10: Access is via a **seller-scoped, revocable API token** — a seller can
  see which external app(s) are connected and **revoke access at any time** from
  the "Marketing" section, immediately invalidating that token.
- FR-24.11: The Product Feed API is **rate-limited** like every other public API
  surface (§6.5) and strictly **tenant-isolated** — a token scoped to seller A can
  never return seller B's products, exactly like every other tenant-scoped access
  path in the platform.
- FR-24.12: Monetization of the Social Media SaaS (subscriptions, usage billing,
  etc.) lives **entirely inside that product** — goto5x.com is the bridge (identity
  + product data), not a party to that product's billing relationship with the
  seller.

#### 5.24c Shared hook requirements (referral attribution & cross-SaaS discounts, new)
Both SaaS products are founder-owned and connect via the same signed-API-key
pattern (§3.10); these two requirements apply identically to both hooks:
- FR-24.13: **Referral attribution** — every SSO handoff (FR-24.8) and every
  signed API call from either SaaS (FR-24.3, FR-24.9) carries a verifiable
  signal that the seller originated from goto5x.com, so the founder can confirm
  (and, later, revenue-share against) genuine cross-product attribution. This is
  **distinct from the seller-to-seller referral program** (FR-22.6, Phase 1.1) —
  that rewards a seller for referring another seller to goto5x.com; this
  attributes a goto5x.com seller's activity on a *different, founder-owned*
  product. No new table: the attribution event is recorded in
  `admin_audit_logs` as a system actor, the same pattern already used for
  Template Install grants (FR-24.6).
- FR-24.14: **Cross-SaaS discount eligibility** — goto5x.com exposes a small,
  signed, read-only eligibility-check endpoint (e.g. "is this seller on an
  active paid plan") that either SaaS can call to decide whether a seller
  qualifies for a cross-product discount on *that SaaS's own* pricing. goto5x.com
  never applies or knows the discount terms themselves — it only answers the
  eligibility question, consistent with FR-24.7/FR-24.12's rule that each
  product's own billing stays inside that product.

### 5.25 Authentication & Account Security (new — closes a gap identified during Module 1 planning)
No prior version of this SRS specified password reset, despite specifying signup,
login, and email verification. Approved for Module 1:
- FR-25.1: **Self-serve password reset** — any account holder (seller, supplier,
  or admin) can request a reset link sent to their verified email; the link
  contains a signed, single-use, **time-limited token** (expiry short enough to
  bound the attack window, e.g. 30–60 minutes — exact value is a Settings Registry
  entry, `auth.password_reset_token_ttl_minutes`, not hard-coded).
- FR-25.2: A reset request, and a reset completion, are both **rate-limited** per
  account and per IP (extends §6.5's existing auth-endpoint rate limiting) —
  requesting many reset emails cannot be used to spam a user's inbox or brute-force
  the token.
- FR-25.3: Every password reset (request and completion) is **audit-logged**
  (`admin_audit_logs`-style event for admin accounts; a lighter user-security-event
  record for seller/supplier accounts — not conflated with platform-admin
  control-plane actions) so an account-takeover attempt leaves a trace.
- FR-25.4: Completing a reset invalidates the token immediately (single-use) and
  invalidates all of that user's existing Redis-backed sessions (§3.2a) — a
  compromised session cannot outlive a password reset.
- FR-25.5: **Regional launch gating (new).** Signup captures the applicant's
  country. **Seller** account creation succeeds only for countries on an
  admin-managed **allowed-countries list** — a Settings Registry entry
  (`auth.seller_signup_allowed_countries`), so opening a new region is a config
  change, never a deploy. A non-allowed-country visitor attempting seller signup
  sees a "launching in your region soon" message instead of an error, and their
  email + country is captured in a `seller_signup_waitlist` table for future
  launch-campaign outreach — never silently dropped. **Buyer-side access is never
  gated by country** — a buyer anywhere can shop any storefront. Built in
  **Seller Onboarding Wizard** (renumbered Module 15 as of v0.10's two module
  insertions, `docs/build-plan.md`), not reworked into Module 1's
  already-approved signup endpoint; the admin allowed-countries list reuses the
  Settings Registry admin CRUD already shipped in Module 1.
- FR-25.6: **Seller TOTP 2FA (new, v0.10).** Sellers can enroll in TOTP-based
  2FA through the exact same mechanism Module 1 already built for admin
  accounts — the `User` table's `mfaSecret`/`mfaEnabled` fields and the
  `otplib` enroll/verify flow are shared, not duplicated. **Enforcement
  mode** is a Settings Registry entry (`auth.seller_mfa_enforcement`,
  scoped `global`/`plan`): `optional` (seller's own choice),
  `required_for_payout_actions` (2FA must be verified before a payout
  request or a payout-account change succeeds, regardless of the seller's
  own enrollment preference), or `required_always` (2FA mandatory at every
  login, admin-style). Slotted as a new module inserted immediately before
  Payouts & Disbursement (`docs/build-plan.md`) — `required_for_payout_actions`
  is meaningless if 2FA doesn't exist yet by the time a seller can request one.
- FR-25.7: **Seller session/device management (new, v0.10).** A seller's
  dashboard lists their active sessions/devices (device label, IP,
  first-seen/last-active timestamps) and can revoke any one of them
  individually — revoking a session ends it immediately, same mechanism as
  FR-25.4's password-reset-triggered invalidation, applied to a single
  session rather than all of them. **Concurrent-device limit:** a Settings
  Registry entry (`auth.max_concurrent_devices`, default 3), usable at
  `global`/`plan`/`seller` scope — a plan-level override raises the limit
  platform-wide for that plan, and a **seller-scoped override represents an
  individual seller's paid extra-device-slot add-on** (no new Settings
  Registry scope type needed; the existing `seller` scope already resolves
  with higher precedence than `plan`, per §3.8's precedence order). A new
  login beyond the resolved limit does not silently evict the oldest
  session — it is rejected with a clear "device limit reached, revoke a
  session first" response. The add-on's **price** is a separate global-scope
  Settings Registry entry (`auth.extra_device_slot_price`) for a later
  billing flow to read — **mechanism now, monetization/checkout decision at
  launch**, per explicit founder instruction; no billing UI is built as part
  of this FR.

### 5.26 Platform Event Log (Business Analytics Substrate — new)
The architecture and table shape are specified in §3.11; this section is the
functional requirement that emission actually happens, module by module.
- FR-26.1: **Every module emits its own lifecycle events** into
  `platform_events` at the point of the state change (signup, verification,
  creation, attach/verify, etc.) — never inferred after the fact from other
  tables. Modules 1–3 are backfilled with their events retroactively (this is
  a small addition to existing code, not a redesign); every module from
  Module 4 onward emits its events as part of that module's own build, not a
  follow-up pass.
- FR-26.2: **Lean taxonomy is enforced at review time, not by a schema
  constraint** — `event_type` is free text (a fixed enum would fight future
  modules), but §3.11's "would this appear on a growth or unit-economics
  report" rule is a binding review gate for any new event type.
- FR-26.3: Emission is **non-blocking**: an event-write failure is caught,
  logged, and discarded — it never surfaces as an error to the user and never
  rolls back the action it's describing.
- FR-26.4: **No PII in `metadata`** — enforced by convention and code review
  (same as §6.5's general PII-in-logs discipline), not by a runtime PII
  scanner, which would be disproportionate machinery for a lean internal
  analytics log.
- FR-26.5: The Module 1–3 backfill emits, at minimum: `seller.signup`,
  `store.created` (Module 1); `product.created`, `media.imported` (Module 2);
  `domain.attached`, `domain.verified` (Module 3).

### 5.27 Listing Moderation Engine (new, v0.10 — launch-blocking legal safety, zero-cost/rule-based)
A rule-based content-moderation layer for self-fulfilled seller product
listings, required **live before public launch** — this is a legal-safety
requirement, not a discovery/UX feature, so it is slotted as its own module
immediately after Discovery & Merchandising rather than folded into either
Catalog (Module 2, already built) or Discovery (Module 5) themselves.

- FR-27.1: **Admin-managed banned/restricted keyword lists**, Settings
  Registry-backed (`moderation.banned_keywords`, `moderation.restricted_keywords`
  — both JSON string arrays, `global` scope, admin-editable through the
  already-generic Settings Registry admin API — no new admin UI mechanism
  needed). A banned keyword in a product's title/description blocks
  submission outright with a clear reason; a restricted keyword routes the
  listing to manual review instead of blocking it.
- FR-27.2: **Restricted-category rules** (`moderation.restricted_categories`,
  JSON array of category ids, `global` scope): a product in a restricted
  category always enters the moderation queue regardless of keyword
  matches, for categories the founder judges to need a human look
  regardless of wording (e.g. supplements, electronics safety claims).
- FR-27.3: **New-seller probation.** A seller's first N submitted products
  require manual review regardless of keyword/category checks passing; N is
  a Settings Registry entry (`moderation.new_seller_probation_count`,
  default e.g. 10). Once a seller has N **approved** products, subsequent
  products skip probation (still subject to keyword/category checks).
- FR-27.4: **Trusted-seller auto-approve.** An admin can mark a seller
  `is_trusted` (a new boolean on `sellers`); a trusted seller's listings
  skip both probation and the keyword/category queue entirely (still
  logged, per FR-27.6) — a manual, admin-granted status, not automatically
  earned by a threshold, so the founder retains judgment over who bypasses
  review.
- FR-27.5: **Moderation queue + product visibility gate.** A product that
  triggers any of FR-27.1–27.3 above is created with a `moderation_status`
  of `pending` and is **not publicly visible** — excluded from the public
  storefront (Module 4) and Discovery search/collections (Module 5) alike —
  until a Reviewer or Admin approves it. Rejecting a listing records the
  reviewer's notes and keeps the product hidden; the seller sees the
  rejection reason and notes in their own dashboard.
- FR-27.6: **REVIEWER admin sub-role (§4, new).** A narrowly-scoped admin
  account type that sees only the moderation queue and can approve/reject
  with notes — nothing else in the admin terminal. Every decision (approve,
  reject, and the keyword/category/probation reason that queued it) is
  captured in the existing `admin_audit_logs` table (Module 1) — no new
  audit mechanism. **A bare functional admin page for this queue (list,
  view a product, approve/reject with notes; no design pass) is required
  before public launch — v0.11 slots it into Module 16 (Admin Control Plane
  completion, §14.8), since Module 6 itself is API-only by design.**
- FR-27.7: **Zero-cost, rule-based only — explicitly not AI moderation.**
  No ML/LLM content-classification service is introduced by this FR; keyword/
  category/probation rules are the entire mechanism, kept deliberately
  simple and free to run, matching this SRS's existing "lean, Settings-
  Registry-driven" discipline. An AI-assisted moderation upgrade, if ever
  wanted, is a distinct future FR, not implied by this one.
- **Follow-up amendment required in already-built modules (flagged, not a
  silent gap):** shipping this module requires adding a
  `moderation_status = 'approved'` filter to Module 4's public storefront
  product-listing query and Module 5's Discovery search/collection queries —
  both currently show every `active` product regardless of moderation state,
  which was correct at the time each shipped (this FR didn't exist yet) and
  is disclosed here as the follow-up this module's own build must make.

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Storefront pages should target sub-2s first contentful paint via CDN + edge caching of static assets |
| Scalability | Architecture (modular monolith + row-level tenancy + statelessness principle, §3.1) must support scaling to a multi-VPS deployment without an application rewrite — verified module-by-module in §3.6 |
| Security | See §6.5 (expanded below) |
| Availability | Automated daily DB backups + point-in-time recovery, plus a MinIO data-directory backup, stored **off the primary VPS**, with a documented and periodically-tested restore runbook |
| Maintainability | CI/CD pipeline, versioned + backward-compatible migrations, feature flags, a same-VPS staging environment mirroring production, rollback runbook |
| Usability | Non-technical sellers must be able to fully customize a store without support tickets; dashboards must be usable on mobile |
| Internationalization | No hard-coded UI strings or currency/date formatting outside a translation-key/locale layer, from v1.0 (§3.9) — RTL/Urdu later is content work, not a rewrite |
| **Buyer-facing polish** | The storefront, PDF receipts/invoices (FR-19.2), the order-status page, and transactional emails are held to the **same premium visual bar as the marketing site** (§5.0, §13) — "luxury feel" extends to every surface a *buyer* sees |
| Cost efficiency | Self-host-first by default (§9); every recurring third-party dependency justified against a self-hosted/build-in-house alternative; **every feature added since v0.4, including both v0.6 SaaS hooks, is plain Postgres tables + application code + a small API surface — none of it adds infrastructure cost**, reconfirmed in this revision |
| **Client/mobile-app readiness (new)** | The API (`apps/api`) is the single source of truth for every business rule; `apps/web` is a client of it, not a place logic can hide. No app work ships in v1.0 — this NFR only guarantees that Phase 4 mobile apps (§10) are a new client, not an API/business-logic rewrite (§2.5) |

### 6.5 Security & Compliance (expanded)
- **Multi-tenant isolation:** enforced at both the application layer (mandatory
  scoping middleware) and the database layer (Postgres RLS as a backstop), with an
  automated cross-tenant-access test suite as a release gate (§3.2). This covers
  every tenant table added through v0.6, with no exceptions.
- **Permission boundaries:** a supplier's session can only ever query orders/
  listings for stores it holds an active `StoreSupplierLink` to; a seller can never
  see another seller's supplier relationships or ledger. A Product Feed API token
  (FR-24.9) is scoped identically — one seller, never platform-wide.
- **Payment security:** goto5x.com never stores raw card data — checkout uses the
  gateway's hosted fields/tokenization (PCI-DSS SAQ-A scope). All inbound
  payment-gateway and supplier webhooks are **signature-verified**; an unsigned or
  invalid-signature webhook is rejected before it can touch the ledger.
- **External-API signing (new in v0.6):** the Template Install/License API (FR-24.6)
  and the Product Feed API (FR-24.9/24.10) both require signed/authenticated
  requests — an HMAC or public-key signature scheme verified before any entitlement
  is granted or any product data is returned. Neither hook accepts an unauthenticated
  or unsigned call under any circumstance.
- **Admin access control:** MFA is **mandatory** for every admin account;
  admin-terminal login is a separate, more scrutinized flow from seller/supplier
  login, and every admin action is captured in the immutable audit log.
- **Rate limiting:** applied specifically to authentication endpoints, listing-
  submission endpoints, payout-request endpoints, the Product Feed API, the
  Template Install/License API, and public storefront/API endpoints generally.
- **Secrets management:** payment-gateway keys, supplier API credentials, Google
  Drive OAuth secrets, and the signing secrets for both external-SaaS hooks are
  stored in an encrypted secrets store, with per-environment separation.
- **Google Drive token handling (schema gap closed in v0.7, FR-9.1):** a seller's
  Drive **refresh token is encrypted at rest** (app-level AES-256-GCM, key from
  env, never logged) in `google_drive_connections`; the **access token is never
  persisted to Postgres** — it lives only in Redis for an active import job's
  duration. No API response ever returns either token value. Revocation is
  seller-initiated and audit-trailed like a Product Feed API token revoke
  (FR-24.10).
- **PII handling:** buyer PII is excluded from application logs by default; access
  to raw PII in the database is limited to the roles that functionally need it.
  The buyer order-status link uses a signed, unguessable token. The same rule
  applies to `platform_events.metadata` (§3.11/FR-26.4): IDs only, never an
  email, name, phone number, or address.
- **Dependency hygiene:** automated dependency vulnerability scanning runs in CI.
- **Content/legal risk:** listing moderation exists specifically to reduce
  marketplace liability for counterfeit or prohibited goods, linked directly to
  the payout freeze (FR-6.10).

---

## 7. External Interface Requirements

### 7.1 User-Facing Applications
- **goto5x.com public site** — marketing/signup, premium visual bar.
- **Storefront** — public, per-tenant, template-rendered site, including
  discovery/merchandising (§5.16), the buyer order-status lookup (FR-5.4), and
  review submission (§5.14).
- **Seller Dashboard** — authenticated app for store owners, including customers,
  reviews moderation, discovery/merchandising settings, manual orders, CSV
  import/export, tax settings, the onboarding wizard, and the Marketing entry
  point (FR-24.8).
- **Supplier Portal** — authenticated app for suppliers.
- **Admin Terminal** — authenticated, restricted app for platform staff,
  MFA-mandatory, including the payout approval queue, content-page editor, and the
  external-API client registry (FR-8.14).

### 7.2 Third-Party & External-API Integrations
Payment gateway (Safepay at launch; PayFast PK/direct JazzCash-Easypaisa in Phase
1.x; Stripe via foreign entity in Phase 4; a gated future COD path) · Supplier APIs
(Printify, then CJ Dropshipping, adapter interface for future suppliers, plus the
Markaz research item) · Google Drive API · Transactional email provider · DNS/domain
verification · (Phase 2+) SMS/WhatsApp Business API · **Template Store SaaS**
(inbound: Template Install/License API) · **Social Media SaaS** (outbound SSO
handoff; outbound-authenticated: Product Feed API). Object storage (MinIO) and CDN
(Cloudflare free tier) are self-hosted/free-tier, not paid third-party dependencies.

---

## 8. High-Level Data Model (core entities)

`User, Seller, Store, Theme/Template, StoreThemeSettings, Product, ProductVariant,
Category, StoreShippingSettings, StoreTaxSettings, DiscountCode, Supplier,
SupplierAdapterRegistry, SupplierListing, StoreSupplierLink, Order, OrderItem,
TrackingUpdate, Payment, LedgerEntry, Payout, SellerPayoutAccount, Plan,
Subscription, MediaAsset, Domain, ContentPage, ContentPageRevision,
SettingsDefinition, SettingsValue, AdminUser, AdminAuditLog,
AdminImpersonationSession, OrderFlag, Announcement, Customer, ProductReview, Cart,
Collection, CollectionProduct, StoreNavigationMenu, OrderNote, OrderTimelineEvent,
ImportJob, SellerOnboardingProgress` (all v1.0), **plus, new in v0.6:**
`TemplateEntitlement, ExternalApiClient, SellerApiToken` (v1.0 — both SaaS hooks
ship with v1.0, since they are cheap API surfaces, not full products),
`UserSecurityEvent` (v1.0, new — FR-25.3's audit trail for password reset and
other account-security events, deliberately separate from `AdminAuditLog`, which
is scoped to platform-admin control-plane actions, not general account security),
and, documented ahead for v1.1 — `ReturnRequest, StoreContentPage,
StoreContentPageRevision, SupportTicket, SupportTicketMessage, ReferralLink,
ReferralConversion, NewsletterSubscriber`. **New in v0.7:**
`SellerSignupWaitlist` (FR-25.5), `PlatformPromoCode` (FR-7.9),
`PlatformBrandAsset, PlatformBrandAssetRevision` (FR-12.3),
`GoogleDriveConnection` (FR-9.1, closes a schema gap found while planning
Module 2 — the token store FR-9.1 always assumed but never had a table) — all
v1.0. The `Announcement` entity gains `channel`/`target_type`/`target_id` fields
(FR-8.15) rather than a new table. **New in v0.8:** `PlatformEvent` (§3.11,
FR-26.x) — v1.0, recording starts immediately, no dashboard reads from it yet.

Every tenant-scoped table among the above carries `store_id` and is protected by
RLS (§3.2) — no exceptions for new tables. `LedgerEntry` is append-only. Full
column-level schema, including the Currency Strategy, is in
`docs/database-schema.md`.

---

## 9. Build vs. Buy Decisions

**Self-host-first principle (binding):** the default choice is to self-host on the
platform's own VPS. A recurring paid third-party service is justified only where
self-hosting is genuinely infeasible — specifically payment processing (PCI/legal
liability) and email deliverability. Every row states which side of that line it
falls on and why.

| Component | Decision | Reasoning |
|---|---|---|
| Payment processing | **Buy** (Safepay, then additional gateways) | PCI compliance and fraud liability make in-house processing a non-starter; commission/hold/reserve/payout logic stays custom on top |
| Payout disbursement | **Build** (manual adapter first, API adapter later) | Mirrors the Payment Adapter reasoning — no third-party payout-automation SaaS is justified before v1.0 proves real payout volume |
| Object storage | **Build (self-hosted MinIO on the VPS)** | Self-host-first principle — MinIO is free and S3-API-compatible; a later migration to R2/S3 is a config change |
| Store builder / theme engine | **Build** | Core product differentiator — cannot be a wrapper around a third-party tool |
| Drag-and-drop customizer | **Build**, deliberately scoped small at first | Core IP; a full visual page builder is a multi-year problem — Phase 1 ships a bounded token set (FR-1.2) |
| Coded-theme escape hatch | **Build (lightweight)** | Template override mechanism, reuses the same rendering pipeline |
| AI image/content generation | **Buy (API-based)** initially | Use existing model APIs rather than training/hosting models |
| Analytics | **Build (lightweight)** | Avoid per-event SaaS pricing that scales badly with store count |
| Transactional email | **Buy (managed service, free tier initially)** | Deliverability is a specialized problem genuinely infeasible to self-host well — the one clear exception alongside payments |
| Search | **Build on Postgres first** | Defer a dedicated search engine until catalog scale requires it |
| Identity/Auth | **Build (lightweight library, not per-MAU SaaS)** | Keeps unit economics sane at marketplace-scale buyer counts; satisfies the SSO hook |
| Admin control plane / config management | **Build (generic Settings Registry)** | Costs nothing extra to run; the single highest-leverage decision for a solo-founder-operated platform |
| PDF generation (receipts/invoices) | **Build (self-hosted)** | A self-hosted PDF renderer costs nothing beyond compute already on the VPS; a paid invoicing SaaS is not justified for one templated PDF (FR-19.2) |
| CSV import/export processing | **Build** | Runs as a background job on existing BullMQ infrastructure — the Shopify-compatible core-field mapping (FR-18.1) is a maintained code artifact, not a licensed tool |
| Template Store / Social Media SaaS integration hooks | **Build (small API surface only)** | goto5x.com never builds either external product — it builds and owns a small, versioned, authenticated API on its own side (§5.24), which is the cheapest possible way to benefit from both without taking on their scope |

---

## 10. Phased Roadmap (solo-founder pacing)

Each phase is broken into small, independently shippable increments; no module
starts until the previous module's Acceptance Checklist (§14) is verified. See
`docs/mvp-v1-cutlist.md` for the exact v1.0 boundary.

- **Phase 0 (current):** SRS finalized, architecture decisions locked, tech stack
  chosen, database schema designed.
- **Phase 1 — v1.0 MVP:** the platform's own site; store builder with premium
  templates + built-in free-template guarantee + Template Store showcase; storefront
  discovery & merchandising (collections, search, navigation, announcement bar,
  coming-soon mode, SEO structured data, WhatsApp button, social links, FAQ
  accordion); Customers/CRM; product reviews; cart persistence (email-first) +
  abandoned-cart flagging; ONE supplier integration (Printify) with full
  transparency; Safepay-only checkout; shipping + tax settings; discount codes;
  manual orders (mark-as-paid only); order notes/tags/timeline + editing; CSV
  import/export (core fields); one branded PDF invoice; seller onboarding wizard;
  commission + ledger + hold + rolling reserve; payout request → admin approval →
  manual disbursement; the Free Plan + inverse commission laddering + yearly
  billing + launch-campaign pricing; Business Guard-Rails; the admin Control Plane
  (including the external-API client registry); the Template Install/License API
  and the Product Feed API (both hooks, goto5x.com's side only); legal/content
  pages.
- **Phase 1.1:** CJ Dropshipping adapter, self-serve supplier registration + full
  multi-store dashboard, listing moderation queue, hold graduation logic, scheduled
  payout mode, API-based disbursement adapter, optional buyer accounts,
  abandoned-cart recovery emails, returns/refunds workflow, per-store content pages
  + blog, support/ticket system, referral program, low-stock alerts + newsletter
  capture, **the manual-order payment-link flow** (FR-22.8), **CSV metafields/
  complex option combinations** (FR-22.9).
- **Phase 2:** Tiered plan proration, coded-theme escape hatch, dispute workflow,
  SMS/WhatsApp notifications, second payment gateway, gated per-seller COD,
  shipping zones/weight-based rates, advanced discounts (auto-apply, BOGO,
  scheduled sales).
- **Phase 3:** Advanced theme customizer (animation presets, AI-assisted design),
  deeper analytics, **admin sub-roles/seller staff accounts (reaffirmed here, not
  pulled forward into any earlier phase)**.
- **Phase 4:** Multi-VPS scale-out, international payment gateways, mobile apps
  (consuming the existing API per the mobile-readiness NFR, §6), **region-sharded
  deployments** (per-region DB/stack + a global admin aggregation view — §3.6
  architecture note only, not yet a committed build), **RTL/Urdu storefront
  support** (content work only, per §3.9), **Markaz supplier-adapter evaluation**
  (pending API verification).

---

## 11. Payment Gateway Research Summary

| Option | Verdict for Phase 1 |
|---|---|
| **Safepay** | **Chosen as v1.0's sole payment method.** YC-backed, modern API, explicitly startup/SME-friendly onboarding, no setup fees, supports individual/sole-proprietor accounts (with stricter limits), unifies cards + mobile wallets + Raast under one integration. |
| **Cash on Delivery** | **Deferred from v1.0** (see §5.6a) — inverts commission collection since the platform never holds the money to deduct 3% from; reintroduced later as a per-seller, balance-gated Settings Registry flag rather than a launch-day payment method. |
| **PayFast PK** | Deferred to Phase 1.x. Reputable and PCI-DSS compliant, but onboarding is described as "enterprise-paced" with heavier documentation/notarization requirements — not the fastest path to a solo founder's first live payment. |
| **Direct JazzCash / Easypaisa merchant APIs** | Deferred to Phase 1.x/2. Requires a direct merchant agreement with the telco/bank (registered company, settlement account), lower-level integration — better economics at volume, not the fastest Phase 1 path. |
| **Stripe (via foreign entity)** | Deferred to Phase 4. Stripe does not onboard Pakistani entities directly; would require a foreign entity — relevant only once the platform serves international buyers. |

---

## 12. Risk Register (ranked)

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Solo founder + AI capacity vs. Shopify-class scope** — over-scoping stalls or burns out the build | Hard MVP cut-list (`docs/mvp-v1-cutlist.md`), phase-gated roadmap (§10) with module-level checklist gating (§14), no feature enters v1.0 without another leaving it |
| 2 | **Payment gateway access as an individual/new entity blocks launch** | Safepay chosen specifically for fast sole-proprietor onboarding (§5.6a) |
| 3 | **Cross-tenant data leakage** (row-level tenancy bug exposes seller A's data to seller B) | Mandatory scoping middleware + Postgres RLS backstop + release-gating cross-tenant test suite (§3.2, §6.5, §14) |
| 4 | **Ledger/commission bugs cause silent financial loss or seller distrust** | Append-only ledger, no destructive balance edits, daily reconciliation job against gateway settlement reports (FR-6.4, FR-6.6) |
| 5 | **Single VPS is a single point of failure** | Off-box automated backups + tested restore runbook from day 1 (§6, Availability row) |
| 6 | **Fraud via new-seller hold bypass** (fake accounts cashing out before the 22-day hold) | Per-transaction (not account-level) hold, identity verification gating hold graduation, the payout approval queue's risk summary, and the rolling reserve (FR-6.2, FR-6.3, FR-6.9, FR-6.13) |
| 7 | **Supplier API fragility/change** (Printify/CJ API changes or rate limits break live stores) | Adapter interface isolates blast radius to one adapter; cached last-known catalog degrades gracefully instead of breaking (§3.5, FR-4.3); admin adapter registry (FR-4.9) allows disabling a broken adapter instantly |
| 8 | **Regulatory/legal exposure** (counterfeit goods, buyer data protection, Pakistani e-commerce/tax rules) | Listing moderation queue (FR-8.13) linked to payout freeze (FR-6.10); legal consultation on SECP/PECA/data-protection obligations tracked as an explicit open item (§13); legal content drafts in `docs/legal/` flagged for human review |
| 9 | **"AI/premium 3D template" scope creep** stalls Phase 1 chasing a generative-design problem that isn't solved | Phase 1 templates are hand-built to a high visual bar (FR-1.1); animation presets and AI tooling deferred to Phase 3 (FR-1.7) |
| 10 | **Over-building the theme engine/customizer** (a multi-year problem for a small team) | Phase 1 customizer is deliberately scoped to a bounded token set (FR-1.2); expand only after MVP validates demand |
| 11 | **A bad admin config value breaks the platform** (e.g. commission set to 105%, or the wrong seller's payouts frozen) | `settings_definitions` enforces a validation rule per key (range/type) rejected before it reaches the database; every change is audit-logged with before/after values (FR-8.9) |
| 12 | **Manual disbursement is a human-in-the-loop process** — admin fatigue or error transferring funds via bank/Raast could delay or misdirect a payout | The status flow (FR-6.12) is visible to the seller so delays are transparent, not silent; the Disbursement Adapter pattern (FR-6.11) means automating this in Phase 1.x requires no change to the queue or ledger |
| 13 | **Self-hosted MinIO is a new single point of failure for media**, now living on the same VPS as everything else | Same off-box backup discipline as the database (Risk 5) extends to the MinIO data directory; the Cloudflare CDN cache in front of it means a brief MinIO hiccup doesn't immediately take already-cached images offline |
| 14 | **Discount code abuse** (bulk-generated codes used to reduce effective commission, or a leaked code used far beyond its intended reach) | Usage limits and expiry are enforced server-side at checkout (FR-5.5, never client-side); commission is calculated on the post-discount amount (FR-6.1), so a discount reduces seller revenue and platform commission proportionally |
| 15 | **CSV import/export scope, resolved (v0.6):** a shallow "Shopify-compatible" importer risks being compatible in name only | Bounded to core fields (title, description, price, variants/options, images, inventory) with unmapped fields listed explicitly per upload (FR-18.1); metafields/complex option combos are an explicit v1.1 fast-follow (FR-22.9), not a silent gap |
| 16 | **Manual/draft orders payment-link integration surface, resolved (v0.6):** a second checkout entry point reconciling with commission/ledger logic | Bounded to mark-as-paid only for v1.0 (FR-17.1); the payment-link path is deferred to v1.1 (FR-22.8) |
| 17 | **Cart persistence timing, resolved (v0.6):** "when is a buyer's email captured" was an undecided UX question coupling with checkout design | Locked as an explicit decision: checkout is email-first, email captured before payment details (FR-15.1) — no longer discovered mid-build |
| 18 | **"Luxury" PDF invoices as an open-ended polish trap, resolved (v0.6):** unbounded design-iteration risk | Bounded to exactly one template meeting a "clean and professional" bar with a single founder sign-off (FR-19.2); further polish is an explicitly time-boxed backlog item, never a launch gate |
| 19 | **Template license/entitlement bypass (new in v0.6)** — a forged or replayed call to the Template Install API could grant a seller a premium template without a valid Template Store purchase, undercutting that product's monetization | Signed/authenticated requests (§6.5) verified before any entitlement is granted; every grant/revoke is audit-logged (FR-24.6) as a traceable, reversible action; the external-API client registry (FR-8.14) can disable the integration instantly if abuse is detected |
| 20 | **Product Feed API token leak or abuse (new in v0.6)** — a leaked seller token could expose product data beyond intended use, or be scraped at volume | Tokens are seller-scoped (never platform-wide), revocable at any time from the dashboard (FR-24.10), rate-limited like every other public API surface, and the feed is read-only and limited to fields already public on the storefront — no data exposure beyond what a buyer could already see |

---

## 13. Open Questions / Decisions Needed (remaining)

1. **Legal entity:** confirm timeline for registering a business entity — needed
   for Phase 1.x gateways (PayFast/direct JazzCash-Easypaisa), for enabling the
   gated COD feature at scale, and for hold-graduation identity verification
   (FR-6.3), even though Safepay alone can launch without it.
2. **Regulatory review:** SECP/PECA/data-protection obligations for a Pakistani
   e-commerce marketplace handling buyer PII and commission-based payments — needs
   a legal consult before Phase 1.1 (Risk 8); the `docs/legal/` drafts (FR-12.2)
   are a starting point for that consultation, not a substitute for it. **New in
   v0.6:** the Privacy Policy draft has been updated to disclose the two external-
   SaaS data flows (§5.24) — this still needs counsel review like everything else
   in `docs/legal/`.
3. **Branding assets & direction (resolved in part):** founder owns branding
   assets; the agreed visual direction for the platform's own site (FR-0.1) is
   **apple.com-level minimal premium polish combined with the horizonx.so motion
   aesthetic** — final assets are still needed before the Theme Engine's first
   templates and the platform's own site are designed.
4. **Hold graduation thresholds** — exact number of completed orders /
   verification criteria for FR-6.3 needs a founder decision once real transaction
   data exists to calibrate against.
5. **Rolling-reserve default trigger criteria** — FR-6.13 ships with a 0% default
   and admin-manual application; the specific risk signals that should
   *auto-apply* a reserve need calibration once real seller/order data exists.
6. **Markaz API viability** (§5.4, FR-4.10) — needs research before any adapter
   build commitment.
7. **Template Store / Social Media SaaS timelines and contracts (new in v0.6):**
   this SRS specifies goto5x.com's side of both hooks (§5.24) independent of when
   either external product ships; the actual signing-secret exchange, API version
   support window, and any commercial terms between the two products (even though
   they share a founder) are the founder's decision, not specified here since
   they're the *other* product's concern by design (§2.6).
8. **Template Store revocation semantics (new in v0.6, explicitly not resolved
   here):** FR-24.6 states revocation is symmetric (an API call removes an
   entitlement), but *when* the Template Store should call it (e.g. on a refund
   window closing, on a subscription-style template lapsing, on a dispute) is that
   product's own business logic — goto5x.com only needs the hook to exist, not an
   opinion on the Template Store's monetization model. Flagged explicitly per the
   founder's request rather than silently assumed.

---

## 14. Acceptance Checklists

**Binding process rule:** no module or phase begins implementation until the
previous module's checklist below is **100% verified and explicitly approved by
the founder**. These checklists are the definition of done for each module — not a
summary of what was built, but the exhaustive list of what must be true before the
next module starts. Each item is written to be testable, not aspirational.

### 14.0 Platform's Own Site
- [ ] Public site meets the premium visual bar (apple.com-level polish +
      horizonx.so motion, §13) — explicit founder sign-off against FR-0.1
- [ ] Mobile-responsive across the three most common breakpoints
- [ ] Signup flow works end-to-end: create account → verify email → land in
      dashboard
- [ ] Password reset works end-to-end: request → emailed single-use token →
      complete reset → all prior sessions for that account are invalidated
      (FR-25.1–25.4)
- [ ] A reset token is rejected after its configured expiry and after first use
- [ ] Repeated reset requests for the same account/IP are rate-limited (FR-25.2)
- [ ] Every reset request and completion produces a `UserSecurityEvent` row
      (FR-25.3)
- [ ] A seller-signup attempt from a country **not** on the Settings-Registry
      allowed-countries list shows the "launching in your region soon" message
      (not an error) and creates a `seller_signup_waitlist` row with the
      submitted email + country (FR-25.5)
- [ ] Adding a country to the allowed-countries list via the Settings Registry
      (no deploy) immediately allows seller signup from that country on the very
      next request (FR-25.5)
- [ ] A **buyer** can shop any storefront regardless of country — regional
      gating never applies to buyer-side access (FR-25.5)
- [ ] **Events emitted (backfilled, v0.8):** a successful signup produces a
      `seller.signup` row in `platform_events`; creating a store produces a
      `store.created` row — both with the correct `actor_id`/`store_id`, no
      PII in `metadata` (§3.11/FR-26.5)
- [ ] Page load meets the sub-2s first-contentful-paint target (§6)
- [ ] Legal/content pages (ToS, Privacy, Refund, About, Contact) are linked,
      render correctly, and are served from admin-editable content (FR-12.1), not
      static files

### 14.1 Store Builder & Theme Engine
- [ ] All v1.0 templates selectable at store creation and each meets the premium
      visual bar (FR-1.1)
- [ ] Customizer persists and correctly renders: colors, fonts, logo/banner
      images, section show/hide/reorder (FR-1.2 v1.0 scope — explicitly, no
      animation controls)
- [ ] Live preview output matches published output exactly
- [ ] Storefront is mobile-responsive; dashboard is mobile-usable
- [ ] SEO meta fields save and render correctly in page `<head>`
- [ ] **SEO fallback chain renders correctly when fields are null** (v0.9,
      FR-1.5): a product/store with no `seo_title`/`seo_description` set
      renders its own name/description instead, and a product with neither
      falls back to the parent store's default
- [ ] **Sitemap URLs match the store's active domain** (v0.9, FR-1.5):
      `sitemap.xml` uses the verified custom domain when one exists, the free
      subdomain otherwise
- [ ] **Hidden store serves noindex with no sitemap** (v0.9, FR-1.5): a store
      in `coming_soon`/`password_protected` access mode serves a `noindex`
      `robots.txt` and returns no sitemap content
- [ ] **Events emitted (v0.9):** creating/updating a store's theme settings —
      no new event required by FR-26.x's lean taxonomy for this module beyond
      what Modules 1-3 already backfilled (theme customization is not a
      growth/unit-economics signal); noted here so the checklist explicitly
      confirms this was a deliberate scoping decision, not an oversight
- [ ] **Tenant isolation:** automated test proves seller A cannot read or write
      seller B's `store_theme_settings` via direct API manipulation
- [ ] Postgres RLS policy on `store_theme_settings` verified with a negative test
- [ ] Settings Registry key `theme.coded_mode_enabled` resolves correctly per plan
      and is off for every seller in v1.0
- [ ] Premium-templates showcase links out to the Template Store correctly, and
      its absence/unreachability never blocks selecting a built-in free template
      (FR-24.1, FR-24.2)

### 14.2 Seller Admin Dashboard
- [ ] Product CRUD, variants, and inventory tracking work correctly (FR-2.1)
- [ ] Order list filters by status and date correctly using the intended index
- [ ] Seller-initiated supplier invite creates a `store_supplier_links` row with
      the correct `invited_by` value and status (FR-2.6)
- [ ] Listing approve/reject updates `listing_reviews` and, on approve, creates
      the corresponding `products` row (FR-2.7)
- [ ] Google Drive OAuth connect + import copies media into MinIO — imported
      assets still render after the source Drive file is deleted
- [ ] A seller can revoke their Google Drive connection from the dashboard;
      revocation deletes the stored refresh token and is captured as a
      `UserSecurityEvent` (FR-9.1, new in v0.7)
- [ ] No API response (including the seller's own dashboard/profile endpoints)
      ever includes a Drive access or refresh token value, and neither token
      value appears in application logs (FR-9.1, new in v0.7)
- [ ] The Drive access token is confirmed to live only in Redis, scoped to an
      active import job — a direct query against `google_drive_connections`
      never returns anything but the encrypted refresh token (FR-9.1, new in
      v0.7)
- [ ] Custom domain attach completes DNS verification + TLS issuance for a real
      test domain within the documented time window (FR-2.9)
- [ ] Seller analytics view (FR-2.4) shows correct orders/revenue/top-products for
      that store only — **tenant isolation test**
- [ ] Shipping settings (flat rate + free-shipping threshold, FR-2.10) save and
      are applied correctly at checkout for a self-fulfilled cart
- [ ] Discount code CRUD (FR-2.11) works; a code created for store A cannot be
      applied to a checkout on store B
- [ ] **Tenant isolation, release gate:** the full automated cross-tenant test
      suite passes for every dashboard API route (§3.2)
- [ ] **Events emitted (backfilled, v0.8):** creating a product produces a
      `product.created` row in `platform_events`; a successful Google Drive
      or direct upload produces a `media.imported` row — both with no PII in
      `metadata` (§3.11/FR-26.5)

### 14.3 Supplier Portal
- [ ] Supplier registration/verification workflow completes end-to-end (FR-3.1)
- [ ] **Permission boundary:** a supplier's session returns zero results for a
      store they do not hold an active `store_supplier_links` row for
- [ ] Multi-store dashboard aggregates `order_items` across all linked stores
      correctly (FR-3.3)
- [ ] Fulfillment checklist updates correctly and reflects live in the seller's
      dashboard (FR-3.4)
- [ ] Tracking ID upload triggers the buyer notification (FR-5.2)

### 14.4 Dropshipping Supplier Integrations (Printify, v1.0)
- [ ] Printify adapter implements the full Supplier Adapter interface (§3.5)
- [ ] Shipping cost, estimated delivery time, and supported countries render
      correctly on the storefront product page (FR-4.6)
- [ ] Checkout blocks an order when any cart item's supplier listing doesn't
      support the buyer's shipping country (FR-4.7)
- [ ] Price sync propagates to the storefront within the scheduled interval; a
      checkout attempted against a stale cached price is rejected/re-validated
      against the latest synced price (FR-4.8)
- [ ] **Oversell protection:** two simultaneous orders against the last unit of a
      shared supplier stock figure — only one succeeds (FR-4.5)
- [ ] Supplier API outage is simulated: storefront serves the last-known cached
      catalog instead of erroring (FR-4.3)
- [ ] Admin can disable the Printify adapter from the adapter registry without a
      deploy; disabling stops new syncs but does not affect existing orders (FR-4.9)

### 14.5 Order & Fulfillment Management
- [ ] Unified order dashboard spans self- and supplier-fulfilled orders correctly
      (FR-5.1)
- [ ] Buyer email notifications fire correctly on confirmed/shipped/delivered
      (FR-5.2)
- [ ] Suspended-store buyer-facing behavior renders correctly; in-flight orders
      for a newly-suspended store remain fulfillable (FR-5.3)
- [ ] Buyer order-status lookup link works without an account, and the token
      cannot be guessed or enumerated (FR-5.4)
- [ ] Discount code validation: an expired code is rejected, a usage-limit-
      exceeded code is rejected, a valid code applies the correct discount (FR-5.5)
- [ ] Mixed-cart shipping calculation is correct (FR-5.6)
- [ ] **Financial Truth Invariant (§3.12, v0.10):** a submitted-but-unpaid
      order never appears in the order dashboard as a completed sale; it is
      only reachable as an internal pending/draft state until payment is
      verified

### 14.6 Payments, Commission, Ledger & Payout Engine
- [ ] Safepay checkout succeeds end-to-end in sandbox and in production
- [ ] Webhook signature verification rejects a forged/unsigned webhook (must fail
      closed)
- [ ] Commission (3% default, configurable) is deducted correctly on the
      post-discount, pre-gateway-fee amount (FR-6.1)
- [ ] **Ledger immutability:** an attempt to `UPDATE` or `DELETE` a
      `ledger_entries` row fails at the database grant level
- [ ] The 22-day hold: a `sale_credit` entry's `hold_release_at` is set correctly
      and the hold-release scheduled job promotes it to available at the right
      time, not before (FR-6.2)
- [ ] Daily reconciliation job flags a deliberately-introduced mismatch between
      the ledger and a mocked Safepay settlement report; a `manual`-type payment
      is correctly excluded from this reconciliation (FR-6.6)
- [ ] Payout request against available balance only (FR-6.7)
- [ ] Payout admin approval queue displays a correct risk summary for a
      constructed test seller (FR-6.9)
- [ ] A seller with an active prohibited-goods flag cannot have a payout approved
      (FR-6.10)
- [ ] Manual disbursement adapter: the admin batch screen shows payee/amount/IBAN
      correctly; marking a request Paid creates the correct `payout_debit` ledger
      entry and fires the seller notification (FR-6.11, FR-6.12)
- [ ] Rolling reserve: setting a test seller's reserve percentage above 0% causes
      the correct portion of their next `sale_credit` to be held as a separate
      `reserve_hold` entry, released via `reserve_release` after the configured
      period if undisputed (FR-6.13)
- [ ] Settings Registry keys resolve with correct scope precedence: commission
      rate, hold days, reserve percentage, payout freeze, COD gate (confirmed off
      for every seller in v1.0)
- [ ] Every monetary display shows the store's configured currency, never a
      hard-coded `"PKR"` string
- [ ] **Financial Truth Invariant (§3.12, v0.10):** an unpaid/unconfirmed/
      failed-payment order produces no `ledger_entries` row, no commission,
      and is excluded from every balance/payout-eligibility calculation —
      proven with a deliberately-constructed unpaid order, not assumed

### 14.7 Subscription Plans, Pricing & Billing
- [ ] Plan CRUD from the admin UI creates/edits/retires a plan without a deploy
      (FR-8.2)
- [ ] Free Plan enforces its limits correctly and carries the correct (higher)
      default commission rate (FR-7.3)
- [ ] A higher-tier plan's commission rate correctly overrides the Free Plan's via
      Settings Registry precedence (FR-7.4)
- [ ] A plan change applied mid-cycle takes effect at the next billing cycle, not
      immediately (FR-7.5)
- [ ] Yearly billing calculates the discounted price correctly (FR-7.6)
- [ ] A launch-campaign setting with an expiry or a counter condition stops
      applying correctly once its condition is met (FR-7.7)
- [ ] Plan-scoped Settings Registry entries (product limit, template tier,
      coded-theme access) enforce correctly for a seller on that plan
- [ ] Billing-cycle mechanics are correct for a full period even though v1.0
      launches on a Free Plan + simple paid tiers
- [ ] An admin can grant any plan, including Free, directly to a specific seller,
      bypassing checkout; the grant is captured in `admin_audit_logs` with the
      seller's before/after plan (FR-7.8)
- [ ] A platform-level subscription promo code redeems correctly against
      subscription billing, respects its redemption limit/expiry, and cannot be
      applied at a seller's storefront checkout (proving it's distinct from
      store-level `discount_codes`, FR-7.9)

### 14.8 Platform Admin Terminal — Control Plane
- [ ] Every FR-8.x item has a passing test: feature flags, plan editor,
      commission/hold/reserve settings, seller/supplier lifecycle, template
      management, maintenance mode, risk/fraud controls, audit log, analytics
- [ ] A Settings Registry write is visible to a module's very next read within one
      cache-invalidation cycle (timed test)
- [ ] An out-of-range value (e.g. commission = 105%) is rejected by
      `settings_definitions` validation before reaching the database
- [ ] Admin MFA is mandatory — creating or using an admin account without MFA
      enrollment fails (FR-8.12)
- [ ] Impersonation requires a reason before a session opens; every action during
      the session is tagged with `impersonation_session_id` in the audit log;
      ending the session is itself logged (FR-8.4)
- [ ] **Audit log immutability:** an attempt to `UPDATE` or `DELETE` an
      `admin_audit_logs` row fails at the database grant level (FR-8.9)
- [ ] Enabling maintenance mode shows the maintenance page to buyers/sellers while
      an allowlisted admin IP still reaches the admin terminal (FR-8.7)
- [ ] Content pages are editable from the admin terminal and versioned (FR-12.1)
- [ ] Platform brand assets (logo, favicon, hero images) are editable from the
      admin terminal and versioned the same way as content pages (FR-12.3)
- [ ] A Free-Plan seller with a marketplace template entitlement still sees only
      the base template tier otherwise — confirming FR-7.1/FR-8.6 plan-tier
      gating and FR-24.5 entitlement gating remain independently correct after
      FR-12.3 (no regression introduced by brand-asset management)
- [ ] A banner/popup/in-app-notification message targeted at "plan X" is visible
      only to sellers on plan X, one targeted at a specific seller is visible
      only to that seller, and one targeted "all" is visible platform-wide
      (FR-8.15)
- [ ] A scheduled message (banner/popup/in-app notification) becomes visible at
      its start time and stops at its end time without a deploy (FR-8.15,
      extends FR-8.7's existing scheduling)
- [ ] Enabling maintenance mode still applies globally regardless of any
      per-plan/per-seller message targeting in flight (FR-8.7 vs FR-8.15
      precedence)
- [ ] The external-API client registry lists the Template Store and Social Media
      SaaS clients; disabling one immediately rejects further calls from it
      without affecting the other (FR-8.14)
- [ ] **Financial Truth Invariant (§3.12, v0.10):** the real-time analytics
      dashboard (FR-8.10) and unit-economics dashboard (FR-23.4) both exclude
      a deliberately-constructed unpaid order from every count/total they
      display
- [ ] **Listing Moderation Engine admin page (FR-27.6, v0.11):** a bare
      functional page lists the moderation queue (Module 6), lets an admin/
      REVIEWER open a queued product's details, and approve/reject it with
      notes — a REVIEWER account sees only this page in the admin terminal,
      confirming §14.25's negative-access guarantee holds at the UI layer
      too, not only at the API layer

### 14.9 Media Management
- [ ] Google Drive import copies files into MinIO; the storefront still serves
      those images after simulating Drive being unavailable (FR-9.1, FR-9.2)
- [ ] Cloudflare CDN correctly caches and serves MinIO-backed assets
- [ ] **Events emitted (backfilled, v0.8):** see §14.2's `media.imported` item
      — restated here since this is media's own checklist section
      (§3.11/FR-26.5)

### 14.10 Notifications
- [ ] Order/payout/listing email notifications fire correctly and are not
      blocked by a queue backlog under simulated load (FR-10.1)

### 14.11 Custom Domain
- [ ] Domain attach → DNS verification → TLS issuance completes for a real test
      domain within the documented time window (FR-11.2)
- [ ] The `domains.domain_name` unique index correctly resolves the tenant on
      every request, with no ambiguity for two similarly-named domains (FR-11.1)
- [ ] **Events emitted (backfilled, v0.8):** attaching a domain produces a
      `domain.attached` row in `platform_events`; a successful verification
      produces a `domain.verified` row — both with no PII in `metadata`
      (§3.11/FR-26.5)

### 14.12 Security & Compliance (cross-cutting, applies to every module above)
- [ ] The full automated cross-tenant test suite passes as a release gate (§3.2)
- [ ] Rate limiting verified on auth endpoints, listing-submission endpoints,
      payout-request endpoints, the Product Feed API, the Template Install/
      License API, and public storefront/API endpoints
- [ ] Secrets (gateway keys, supplier API credentials, Drive OAuth secrets, and
      both external-SaaS signing secrets) are confirmed stored in an encrypted
      secrets store, never in a committed env file
- [ ] PII redaction verified in application logs
- [ ] A dependency-vulnerability scan runs in CI and blocks a
      deliberately-introduced known-vulnerable dependency

### 14.13 Customers (CRM)
- [ ] A checkout — storefront or manual (FR-17.1) — auto-creates or matches a
      `customers` row by email, updating order count and total spent correctly
      (FR-13.1)
- [ ] Customer list/detail view in the seller dashboard shows correct order
      history
- [ ] **Tenant isolation:** the same buyer email at two different stores produces
      two separate `customers` rows; seller A's customer list never includes
      seller B's customers, even for an identical email (FR-13.3)

### 14.14 Product Reviews & Ratings
- [ ] A buyer can submit a review via the order-status link without an account
- [ ] A review linked to a real order for that product/store is flagged
      `verified_purchase`; one submitted without an order reference is not
- [ ] A review does not affect the product's displayed average rating until a
      seller approves it (FR-14.3)
- [ ] Average rating/review count update correctly when a review's status
      changes approved ↔ hidden
- [ ] **Tenant isolation:** a seller cannot moderate another store's reviews

### 14.15 Cart Persistence & Abandoned Carts
- [ ] Checkout captures email as the first field/step, before payment details
      (FR-15.1, locked UX decision) — a cart row is created only once that step
      completes, never before
- [ ] The abandoned-cart scheduled job correctly flags a cart inactive beyond the
      configured window, and does not flag one still in progress
- [ ] **Tenant isolation:** a cart is only ever visible to its own store's
      dashboard

### 14.16 Storefront Discovery & Merchandising
- [ ] A collection renders its assigned products correctly on the storefront
      (FR-16.1)
- [ ] Search returns relevant results using Postgres full-text search; price/
      category/collection filters narrow results correctly (FR-16.2)
- [ ] Navigation editor changes (header/footer, including free-text and
      social-links footer blocks, FR-16.3) reflect live on the storefront with no
      deploy
- [ ] Announcement bar and coming-soon/password mode toggle correctly (FR-16.4,
      FR-16.5)
- [ ] Structured data validates against schema.org's `Product` type; `sitemap.xml`
      and `robots.txt` generate correctly per store (FR-16.6)
- [ ] WhatsApp button appears only when enabled and links to the configured
      number (FR-16.7)
- [ ] Social media icons (FR-16.8) render only for the platforms a seller has
      configured, linking to the correct URLs
- [ ] FAQ accordion (FR-16.9) expands/collapses correctly and renders seller-
      entered Q&A pairs in order
- [ ] **Tenant isolation:** collections, navigation menus, and discovery settings
      for store A never leak into store B's storefront rendering

### 14.17 Manual/Draft Orders & Order Management Enhancements
- [ ] A manual order created from the dashboard produces correct order/order-item
      rows identical in shape to a storefront-originated order (FR-17.1)
- [ ] "Mark as paid directly" — the **only** v1.0 payment path for manual orders —
      produces a `manual`-type payment row and correct ledger entries; no
      payment-link generation UI exists in v1.0 (confirms FR-17.1's bounded scope)
- [ ] Order notes are never exposed on any buyer-facing surface (FR-17.2)
- [ ] Order tags filter the dashboard order list correctly (FR-17.3)
- [ ] Every status change, note, and edit appends a timeline event, including
      before/after values for an edit (FR-17.4)
- [ ] An edit to a `shipped` order is rejected; an edit to a `pending`/`confirmed`
      order that changes the total produces a compensating ledger entry, never a
      rewrite of the original entry (FR-17.5)
- [ ] An order edit that changes item quantities correctly adjusts
      `product_variants.stock_quantity` in both directions (FR-17.5)

### 14.18 Data Portability (CSV Import/Export)
- [ ] A Shopify-format product-export CSV imports successfully for the core-field
      mapping (title, description, price, variants/options, images, inventory —
      FR-18.1); the import screen explicitly lists fields it did **not** map for
      that upload
- [ ] A CSV containing metafields or complex nested option combinations imports
      its mapped fields correctly and does not silently drop or corrupt the
      unmapped ones — they are visibly listed as unmapped, not lost without a trace
- [ ] Import runs as a background job and does not block the dashboard; a bad row
      is logged with a clear error and does not fail the entire import (FR-18.2)
- [ ] Product and order CSV export produce files a seller can re-import elsewhere
      (round-trip tested) (FR-18.3)
- [ ] **Tenant isolation:** an export for store A never includes store B's data

### 14.19 Receipts, Invoices & Tax
- [ ] A PDF invoice generates correctly (seller logo, correct currency, correct
      tax line) and attaches to the order-confirmation email and the order-status
      page (FR-19.1)
- [ ] **Exactly one invoice template exists in v1.0**, and it receives a single,
      explicit founder sign-off against the "clean and professional" bar (FR-19.2)
      — no open-ended design-iteration loop is treated as a launch blocker
- [ ] Tax is computed correctly for both tax-inclusive and tax-exclusive store
      settings and itemized correctly on the invoice (FR-19.3)

### 14.20 Seller Onboarding Wizard
- [ ] Progress state persists correctly across sessions (FR-20.1)
- [ ] Completing all four steps marks onboarding complete and the wizard no
      longer interrupts the dashboard

### 14.21 Business Guard-Rails & Platform Economics
- [ ] A Free-Plan store's product creation is rejected once its plan's
      product-count limit is reached — not merely warned (FR-23.1)
- [ ] The dormant-store job correctly progresses a test store through warning →
      suspend → archive at the configured thresholds, and not before them (FR-23.2)
- [ ] A paid-plan-only feature is verifiably inaccessible on the Free Plan
      regardless of account age — no "trial expired" code path exists to
      accidentally leave open (FR-23.3)
- [ ] The unit-economics dashboard correctly separates free-vs-paid store counts
      and commission, and the break-even view reflects the admin-entered cost
      figure against computed revenue (FR-23.4)
- [ ] A test identity is correctly blocked from creating more than the configured
      number of Free-Plan stores (FR-23.5)
- [ ] **Financial Truth Invariant (§3.12, v0.10):** the free-vs-paid store
      counts and commission figures in FR-23.4's unit-economics dashboard are
      unaffected by a deliberately-constructed unpaid order — restated here
      since this is Guard-Rails' own checklist section (also §14.8)

### 14.22 External-SaaS Integration Hooks
- [ ] A store's theme-selection UI functions fully (built-in free templates
      selectable, store creation unaffected) with the Template Store's showcase
      link deliberately made unreachable — proving no hard dependency (FR-24.1,
      FR-24.2)
- [ ] A signed, valid Template Install/License API call correctly creates a
      `themes` entry (if new) and a `template_entitlements` row scoped to the
      calling seller only
- [ ] An unsigned or invalidly-signed call to the Template Install/License API is
      rejected before any entitlement is granted (FR-24.6, security release gate)
- [ ] A revoke call correctly removes a seller's entitlement without affecting
      any other seller's entitlement to the same theme, or the `themes` catalog
      entry itself (FR-24.6)
- [ ] A Free-Plan seller who receives a marketplace template entitlement can use
      that one template despite their plan's tier otherwise excluding premium
      templates — the two gating checks (entitlement, plan tier) are verified
      independently (FR-24.5)
- [ ] The "Marketing" dashboard section correctly hands off to the Social Media
      SaaS via SSO with no second login prompt (FR-24.8)
- [ ] The Product Feed API returns only the calling seller's own products, never
      another seller's — **tenant isolation test**, same rigor as every other
      tenant-scoped endpoint (FR-24.11)
- [ ] A seller can see and revoke a connected Social Media SaaS token from the
      dashboard; a revoked token is rejected on its very next use (FR-24.10)
- [ ] Both external-API clients are individually toggleable from the admin
      registry without affecting each other or any other module (FR-8.14)
- [ ] An SSO handoff and a signed API call from either SaaS both carry a
      verifiable referral-attribution signal, recorded in `admin_audit_logs` as a
      system actor (FR-24.13)
- [ ] The cross-SaaS discount-eligibility endpoint answers correctly for a
      seller on a paid plan vs. the Free Plan, returns only the eligibility
      boolean (never discount terms), and is rejected when called unsigned
      (FR-24.14)

### 14.23 Platform Event Log (cross-cutting, applies to every module from here on)
- [ ] Every lifecycle event listed for a given module (FR-26.5 and each later
      module's own list) produces exactly one `platform_events` row with the
      correct `event_type`/`actor_type`/`actor_id`/`store_id`/`entity_type`/
      `entity_id` (FR-26.1)
- [ ] `metadata` on a sampled event from every module contains no PII — IDs
      only (FR-26.4)
- [ ] A simulated event-write failure (e.g. a deliberately broken DB call)
      does not fail or roll back the user-facing action that triggered it
      (FR-26.3)
- [ ] `UPDATE`/`DELETE` on `platform_events` fails at the database grant
      level, same as `admin_audit_logs` (§3.11)
- [ ] `platform_events.retention_days` resolves correctly through the
      Settings Registry (no archival job exists yet to consume it — this
      only proves the tunable itself works)
- [ ] **Financial Truth Invariant (§3.12, v0.10):** `order.placed` is emitted
      only once payment is verified (or a manual order is marked paid) —
      never on cart/checkout submission; a deliberately-constructed unpaid
      order produces no `order.placed` row at all

### 14.24 Seller Account Security (new, v0.10)
- [ ] A seller can enroll in TOTP 2FA using the same enroll/verify flow proven
      on admin accounts (FR-25.6); an invalid code is rejected
- [ ] `auth.seller_mfa_enforcement` resolves correctly per scope: `optional`
      never blocks login without 2FA; `required_for_payout_actions` blocks a
      payout request/payout-account change (not login) for an unenrolled
      seller; `required_always` blocks login itself without a valid code
- [ ] A seller's dashboard lists every active session/device with correct
      device label/IP/last-active data, and revoking one immediately ends
      that session (its next authenticated request fails) without affecting
      the seller's other active sessions (FR-25.7)
- [ ] `auth.max_concurrent_devices` resolves with correct scope precedence
      (`seller` > `plan` > `global`, per §3.8); a login attempt beyond the
      resolved limit is rejected with a clear reason, not silently evicting
      an existing session
- [ ] A seller-scoped override of `auth.max_concurrent_devices` (simulating a
      purchased extra-device-slot add-on) raises that one seller's limit
      without affecting any other seller on the same plan

### 14.25 Listing Moderation Engine (new, v0.10 — launch-blocking legal safety)
- [ ] A product whose title/description contains a configured banned keyword
      is rejected at submission with a clear reason (FR-27.1)
- [ ] A product containing a configured restricted keyword is created but
      enters the moderation queue and is not publicly visible until approved
      (FR-27.1)
- [ ] A product in a configured restricted category enters the moderation
      queue regardless of its keywords passing every other check (FR-27.2)
- [ ] A new (non-trusted) seller's first N products enter the moderation
      queue regardless of keyword/category checks; the (N+1)th product,
      after N approvals, does not (FR-27.3)
- [ ] A seller marked `is_trusted` bypasses probation and the keyword/
      category queue entirely; their listing is still recorded correctly
      (FR-27.4)
- [ ] A product with `moderation_status = pending` never appears in the
      public storefront (Module 4) or Discovery search/collections
      (Module 5) — **tenant-agnostic public-visibility test**, not just a
      seller-dashboard check (FR-27.5)
- [ ] A REVIEWER admin account can approve/reject a queued product with
      notes, and cannot reach any other admin surface (commission/plans,
      payouts, seller/supplier lifecycle, settings, the audit log itself) —
      tested as a negative-access case, not just a positive capability check
      (FR-27.6, §4)
- [ ] Every moderation decision (queued reason, approve, reject) is captured
      in `admin_audit_logs` with the correct reviewer/admin actor (FR-27.6)

---

*This is a living document — update it as decisions in §13 are resolved and as
each phase is scoped in detail. Companion deliverables: `docs/tech-stack.md`,
`docs/database-schema.md`, `docs/architecture.md`, `docs/mvp-v1-cutlist.md`,
`docs/legal/` (Terms of Service, Privacy Policy, Refund Policy drafts).*
