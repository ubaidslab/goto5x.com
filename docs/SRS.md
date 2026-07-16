# goto5x.com — Software Requirements Specification (SRS)

**Version:** 0.4 (Draft — post founder+advisor review of v0.3)
**Date:** 2026-07-16
**Status:** Discussion draft — for review before Phase 1 build starts

**Changelog v0.1 → v0.2:** Added platform's-own-site design requirement, advanced/custom
theme code option for sellers, seller-initiated supplier invite flow, generic supplier
adapter/plugin interface, hold-graduation mechanism, shared-identity hook for the future
social SaaS, explicit tenant-isolation enforcement mechanism, expanded security section,
explicit statelessness/connection-pooling/session-handling requirements for scaling, a
Risk Register (§12), content-moderation requirement, and resolved open decisions
(supplier integration order, payment gateway direction, solo-founder pacing).

**Changelog v0.2 → v0.3:** Added the **Settings Registry** architectural pattern (§3.8)
and rebuilt §5.8 into a full **Admin Control Plane** section — feature flags, plan/pricing
editing, commission & hold configuration, seller/supplier lifecycle control with audited
impersonation, template management, announcements/maintenance mode, risk & fraud
controls, an enforced-immutable audit log, and live analytics — all as DB-backed
configuration every module reads at runtime, so day-to-day operational changes never
require a code deployment. Versioned releases (§3.7) are now explicitly reserved for
genuinely new capability only.

**Changelog v0.3 → v0.4 (closed decisions from founder + advisor review):**
- **Payments:** v1.0 is Safepay-only (prepaid). COD is not deleted — reclassified as a
  deferred, per-seller, balance-gated Settings Registry feature (§5.6a).
- **New: Payout Request & Disbursement Engine** (§5.6b) — seller-initiated payout
  requests, optional scheduled mode, admin approval queue with an auto-generated risk
  summary, a Disbursement Adapter pattern (manual in v1.0, API-based later), and a
  rolling reserve additive to the existing hold.
- **New: Supplier transparency requirements** (§5.4) — shipping cost/delivery time/
  country display, checkout country-blocking, live price re-validation, and an admin
  supplier-adapter registry.
- **New: Self-fulfilled shipping settings** (§5.2, FR-2.10) — flat rate + free-shipping
  threshold.
- **New: Discount codes** (§5.5) — basic percentage/fixed-amount coupons.
- **Currency-ready schema** — every monetary table carries/derives a currency code; no
  logic hard-codes PKR (§5.6, `docs/database-schema.md`).
- **Consistency fixes:** FR-1.2 reworded to match the v1.0/Phase-3 split in the cut-list;
  buyer order-status lookup added (FR-5.4).
- **Self-host-first principle** (§9) — object storage moves from Cloudflare R2 to
  self-hosted MinIO fronted by Cloudflare's free CDN tier (§3.3).
- **Staging** clarified as a same-VPS, zero-extra-cost Docker Compose stack (§3.7).
- **New §14: Acceptance Checklists** per module, plus a binding process rule — no
  module/phase starts until the previous module's checklist is 100% verified.
- **New: Content Pages** (§5.12) — admin-editable, versioned legal/about/contact pages;
  companion legal drafts in `docs/legal/` flagged for human legal review.
- **Branding direction recorded** (§13): apple.com-level minimal premium polish +
  horizonx.so motion aesthetic.

---

## 1. Introduction

### 1.1 Purpose
This document defines the requirements for **goto5x.com**, a multi-tenant e-commerce
platform (Shopify-class) that lets sellers launch premium-designed online stores,
connects them to dropshipping suppliers, and gives sellers deep control over store
design and operations through an advanced dashboard. It is the reference point for
all architecture and build decisions going forward — every phase of the product
should trace back to a requirement in this document, and (from v0.4 onward) every
module has an Acceptance Checklist (§14) that gates when it is considered done.

### 1.2 Scope
In scope for goto5x.com (this SRS):
- goto5x.com's **own** public site (marketing/signup) — premium, advanced, motion-rich
  visual bar, since it is the first impression of the whole platform's quality.
- Multi-tenant storefront + store builder (premium templates + customizer + optional
  hand-coded theme mode for technical sellers)
- Seller admin dashboard (store design, catalog, orders, payouts, shipping settings,
  discount codes)
- Supplier portal (seller-initiated supplier invite, listing review/approval, multi-store
  order tracking, delivery/country transparency) built on a generic supplier-adapter
  interface with an admin-managed adapter registry
- Dropshipping supplier integrations (Printify first, CJ Dropshipping second, more via
  the adapter interface without core changes)
- Payment, commission, hold, rolling-reserve, and payout/disbursement engine
- Platform admin terminal (super admin control panel) including admin-editable legal/
  content pages
- Custom domain attachment (seller-owned domain + hosting)

Explicitly **out of scope** for this SRS (separate product), but with one required hook:
- **Social media scheduling/management SaaS** is a distinct product and is not built as
  part of this platform. The only requirement placed on goto5x.com by that future
  product is architectural: identity/auth (§3.2a) must be designed so a second product
  can share the same account/login (SSO) without a rework of the Auth module. No
  features of the social SaaS itself are in scope here.

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
| VPS | Virtual Private Server |
| RLS | Row-Level Security (Postgres feature enforcing tenant scoping at the DB level) |

### 1.4 Vision Statement
Be the cheaper, Pakistan-first entry point into e-commerce for sellers who want a
**premium-feeling store** (advanced visuals, animation, AI-assisted design) without
Shopify's cost or complexity — while giving sellers built-in access to dropship
suppliers and a control panel simple enough that non-technical sellers can run a
professional-looking store, with a coded-theme escape hatch for the sellers who want
full control themselves.

---

## 2. Overall Description

### 2.1 Product Perspective
Direct competitor: **Shopify**. Differentiation strategy:
1. **Cheaper entry plans** targeting budget-conscious sellers (Pakistan-first pricing).
2. **Premium visual templates** as a standard offering, not a paid add-on — positioned
   like the aesthetic of horizonx.so (advanced motion, 3D-leaning visuals) rather than
   generic themes. This visual bar applies to **both** seller storefronts and
   goto5x.com's own marketing/product site — the platform must look as premium as what
   it promises sellers (§13: apple.com-level polish + horizonx.so motion).
3. **Built-in supplier network** — sellers don't need a separate app/plugin to start
   dropshipping; suppliers are part of the core platform, with buyer-facing delivery
   transparency (§5.4) so trust isn't sacrificed for convenience.
4. **Simple, advanced control panel** — sellers get deep design control (colors,
   layout, images) without needing to know code, with an optional hand-coded theme
   mode for sellers who prefer full control.

### 2.2 Product Functions (high level)
- Store creation and premium template selection
- Visual store customization (colors, fonts, images, layout), or self-coded themes
- Product catalog, inventory, shipping-rate, and discount-code management
- Supplier onboarding (seller-invited or self-registered), listing submission with
  delivery transparency, and seller-side approval, via a pluggable adapter per
  supplier/integration type, with an admin-managed adapter registry
- Order management with supplier fulfillment + tracking handoff to buyer + a
  no-account buyer order-status lookup
- Payments (prepaid at launch), commission deduction, a per-transaction hold, a
  rolling reserve, and a seller-initiated payout/disbursement flow through an admin
  approval queue
- Platform-wide administration and oversight, including admin-editable legal/content
  pages
- Custom domain + Google Drive media connection per seller

### 2.3 User Classes and Characteristics
| Role | Description |
|---|---|
| **Buyer** | Shops on a seller's storefront; needs no account on goto5x.com core system — order status is reachable via a secure emailed link (FR-5.4) |
| **Seller** | Owns a store; manages catalog, design, orders, shipping, discounts, and payouts; mostly non-technical, but may opt into a code-level theme editor |
| **Supplier** | Lists products for one or more sellers; fulfills orders and provides tracking |
| **Platform Admin** | goto5x.com staff; manages sellers, suppliers, commissions, payouts, disputes, platform health, and content pages |

### 2.4 Operating Environment
- **Phase 1:** Single VPS (recommended starting spec: 4–8 vCPU / 16 GB RAM / NVMe SSD),
  Docker-based deployment, reverse proxy + automatic TLS handling multiple per-seller
  custom domains, plus a separate staging Docker Compose stack on the **same VPS**
  under a staging subdomain (§3.7) — zero extra infrastructure cost at launch.
- **Phase 2+:** Split into multiple VPS instances (DB server, app server, worker/queue
  server, media/CDN edge) as load grows — see §3.6 Scaling Path.
- OS: Ubuntu LTS. Containerized services orchestrated with Docker Compose initially,
  migrating to a lightweight orchestrator only when a single VPS is no longer
  sufficient — full Kubernetes is not justified at Phase 1–2 scale.

### 2.5 Design & Implementation Constraints
- Payments **must** go through a licensed payment processor / gateway partner —
  goto5x.com must never custom-build raw card/payment handling (PCI-DSS liability).
  Commission, hold, reserve, and payout logic are custom and gateway-independent (§5.6).
- **Self-host-first (binding, §9):** the default choice for any infrastructure
  component is to self-host on the platform's own VPS; a recurring paid third-party
  service is used only where self-hosting is genuinely infeasible (email deliverability,
  licensed payment processing) — each such exception is justified explicitly in §9.
- Must support Pakistan-first payment rails from Phase 1 (§5.6a); international
  gateways are a later phase.
- Hosting/domain for each storefront is owned and attached by the seller — goto5x.com
  does not resell hosting or act as registrar.
- **Team constraint:** solo founder + AI pair-programming. Every phase must ship in
  small, independently-releasable increments — no phase may depend on a "big bang"
  launch of multiple subsystems at once (§10, §13), and no module begins until the
  previous module's Acceptance Checklist (§14) is verified.

### 2.6 Assumptions & Dependencies
- Safepay's sole-proprietor-friendly onboarding (§5.6a, §11) is assumed sufficient to
  take goto5x.com's first live payment without waiting on a registered legal entity;
  a registered entity is still needed for Phase 1.x gateways and for hold-graduation
  identity verification (§13).
- Dropship supplier integrations depend on those suppliers exposing usable APIs.
  AliExpress has no official public dropship API — it is deferred and will be added
  through the same adapter interface as a third-party/affiliate-API-backed plugin once
  legally reviewed, without any core-platform change.

---

## 3. System Architecture Overview

### 3.1 Architectural Style
**Modular monolith** — one deployable application composed of clearly bounded
modules (Auth/Identity, Store/Tenant, Catalog, Orders, Payments/Ledger, Payouts,
Suppliers, Theme Engine, Media, Notifications, Admin), each with its own internal
boundary (own folder/package, own DB schema namespace, communicating through defined
interfaces — not through shared global state). This gets Phase 1 to market fast while
keeping a clean seam to extract any module into its own service later without a
rewrite.

Microservices are explicitly **not** used at Phase 1 — the operational overhead
(service discovery, distributed tracing, network failure handling) is not justified
until traffic/team size demands it, and would be actively harmful to solo-founder
velocity.

**Statelessness principle (binding on every module):** application server processes
hold no persistent state of their own. All state that must survive a request lives in
Postgres, Redis, or object storage — never on local disk or in-process memory beyond
the lifetime of a single request/job. This one rule is what makes the single-VPS →
multi-VPS transition (§3.6) a pure infrastructure change instead of a rewrite; it is
treated as a code-review-blocking rule from the first commit, not an aspiration.

### 3.2 Multi-Tenancy Model
Shared database, **row-level tenancy**: every tenant-scoped table carries a
`store_id`. This is simpler and cheaper to operate than schema-per-tenant or
database-per-tenant, and is sufficient until a single store's data volume genuinely
requires isolation — at which point that one store can be migrated out without
affecting the model for everyone else.

**Enforcement mechanism (not just convention):** tenant scoping is not left to
per-query discipline, because a single missed `WHERE store_id = ...` is a data-leak
bug between two sellers — the single most reputation-damaging bug class this platform
can ship.
- The data-access layer wraps every tenant-scoped query through a mandatory scoping
  helper/middleware that injects `store_id` from the authenticated session context —
  there is no code path that can query a tenant table without it.
- **Postgres Row-Level Security (RLS) is enabled as a hard backstop** on every
  tenant-scoped table, keyed to the session's `store_id`, so that even an application
  bug that forgets to scope a query still cannot return another tenant's rows.
- Automated tests explicitly assert cross-tenant access is impossible (e.g. "seller A's
  session cannot read seller B's orders/products/media/ledger no matter what endpoint
  is hit") — this test suite is a release gate, not optional coverage (see also §14).

### 3.2a Identity & Auth (shared-platform hook)
Auth is its own bounded module from day one, independent of the Store/Catalog/Orders
modules, specifically so that:
- A future second product (the social-media SaaS) can authenticate against the same
  identity service / user table via SSO instead of forcing a second signup — the
  contract for this is a stable `User` identity + token-issuance API, not a monolith
  merge.
- Sessions are **stateless** (signed JWT access tokens) or backed by Redis (shared,
  not in-process) — never held in a single app server's memory — so any app server
  behind a load balancer can serve any request (required for §3.6 Phase 3+).

### 3.3 Data & Storage Layer
- **Primary DB:** PostgreSQL (relational integrity for orders/payments/inventory),
  accessed through a **connection pooler (PgBouncer)** from Phase 1 onward — this is
  specified now, not deferred, because adding a pooler after multiple app-server
  instances already exist in production is a disruptive migration, not a config change.
- **Cache / queues:** Redis (session cache, rate limiting, job queue backend).
- **Object storage:** **self-hosted MinIO** (S3-compatible) running as a container on
  the same VPS, fronted by **Cloudflare's free-tier CDN** for bandwidth offload — per
  the self-host-first principle (§9), a paid object-storage service isn't justified
  when a self-hosted, S3-API-compatible alternative runs on infrastructure already
  paid for. Because MinIO speaks the S3 API, migrating to a managed provider
  (Cloudflare R2, AWS S3) later — once volume genuinely justifies offloading storage
  operations — is a configuration change (swap endpoint/credentials), not a rewrite.
  Google Drive remains a seller-side **import source**, never the runtime dependency.
- **Search:** Postgres full-text search initially; move to a dedicated search engine
  only once catalog scale requires it.

### 3.4 Background Processing
A job queue (Redis + BullMQ or equivalent) handles: payout hold-release scheduling,
rolling-reserve release scheduling, scheduled-payout-request generation, supplier
order sync, tracking-status polling, notification dispatch, and template asset
processing (image optimization, thumbnailing). Workers are stateless processes that
pull from the shared queue — any number of worker instances can run concurrently
across one or many VPS with no coordination logic beyond the queue itself, by design.

### 3.5 Adapter Pattern (Supplier, Payment, Disbursement Integrations)
Per the founder's decision, every external integration point in the platform — where
suppliers connect, where money is charged, and where money is paid out — is built the
same way: never as a one-off, hard-coded connection.
- **Supplier Adapter:** `listProducts()`, `syncStock()`, `submitListingForReview()`,
  `forwardOrder()`, `pullTrackingUpdate()` — implemented by Printify, CJ Dropshipping,
  etc. (FR-4.1–4.2). Admin can register/enable/disable a supplier adapter from the
  admin terminal without a deploy (FR-4.9).
- **Payment Adapter:** a single interface each gateway (Safepay, later PayFast/
  JazzCash/Stripe, and the gated future COD flow) implements so `PaymentsM`'s
  commission/ledger logic never talks to a specific gateway's SDK directly (§5.6a).
- **Disbursement Adapter:** v1.0's manual adapter and a future API-based adapter
  (bank/Raast/gateway payout API) both implement the same interface so the payout
  queue/ledger/notification logic never changes when the disbursement mechanism does
  (FR-6.11, §5.6b).

In every case, the orchestrating module (Suppliers, Payments, Payouts) contains zero
gateway/supplier-specific branching — that logic lives entirely inside the adapter
implementation. Adding a new integration of any of these three kinds is "write one
adapter," never "touch core order/ledger/catalog code." This determines how each
module's internal folders are organized (see `docs/architecture.md`).

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
change**, not an application rewrite — this was verified module-by-module during
review specifically to close off "rewrite trap" risk (§12).

### 3.7 Release & Versioning Strategy
- Environments: `dev` → `staging` → `production`. **Staging runs as a separate Docker
  Compose stack on the same single VPS**, under a staging subdomain (e.g.
  `staging.goto5x.com`) — separate containers, database, and Redis instance from
  production (a distinct Compose project and volumes), so a staging bug cannot touch
  production data. This is zero additional infrastructure cost at launch; staging
  moves to its own VPS once cashflow supports it (§10).
- Database migrations are versioned, reversible, and **backward-compatible with the
  previous release** (additive changes deploy before the code that depends on them;
  destructive changes happen in a separate, later migration) — this is what makes
  zero-downtime, rolling deploys possible on a single VPS.
- Deploys are rolling/blue-green even on a single VPS (old container stays up until
  the new one passes a health check), so a bad release can be rolled back by
  redeploying the previous image — a documented rollback runbook is a release-gate
  requirement, not optional documentation.
- Feature flags gate new functionality so it can be rolled out to a subset of sellers
  before a full release, and rolled back instantly without a deploy.
- Platform releases are semantically versioned (e.g. `v1.2.0`) with a changelog.
- **Versioned releases are reserved for genuinely new capability.** Anything that is
  merely an operational tuning change belongs in the Settings Registry (§3.8), not a
  deploy — this is the dividing line the founder asked for between "update" and
  "config change."
- **Module-gated build process (binding, new in v0.4):** during build, no module or
  phase starts until the previous module's Acceptance Checklist (§14) is 100%
  verified and explicitly approved — this is a process rule, not a suggestion, and it
  governs the roadmap (§10) at the module level, not just the phase level.

### 3.8 Settings Registry (Config-as-Data — the Admin Control Plane's foundation)
The founder's requirement that "day-to-day operational changes must never require a
code deployment" is implemented as a single, reused mechanism rather than one-off
switches scattered per feature:

- **`settings_definitions`** is a catalog of every tunable key the platform recognizes
  (e.g. `billing.commission_rate`, `payouts.hold_days`, `payouts.reserve_percentage`,
  `payouts.scheduled_mode_enabled`, `payments.cod_enabled`, `catalog.product_limit`,
  `platform.maintenance_mode`), each declaring its value type, which scopes it may be
  set at, a default, and a validation rule (e.g. a percentage must be 0–100) — so a bad
  admin edit is rejected before it reaches the database, not after it breaks billing.
- **`settings_values`** holds the actual values, each row scoped to `global`, `plan`,
  `seller`, `category`, or `store`. Every module resolves a setting through one
  `SettingsService.resolve(key, context)` call that checks the most specific
  applicable scope first (e.g. a seller-specific commission override beats their
  plan's rate, which beats the global default) — modules never read a hard-coded
  constant for anything the admin terminal is meant to control.
- **Cache layer:** resolved values are cached in the same Redis instance already used
  for sessions/queues (§3.3) — **no new infrastructure**, just new tables and a cache
  namespace. An admin write invalidates the specific cache key immediately, so a
  setting change is visible to every module on the very next request, with no restart
  and no deploy.
- **Binding rule:** if a behavior is something an admin should be able to tune
  operationally, it is registered as a setting, not a constant guarded by an
  `if (flag)` that itself needs a deploy to introduce. Wiring a *brand-new* tunable
  dimension into a module is still a (small, one-time) code change — the registry's
  guarantee is that changing a *value*, reassigning a *scope*, or flipping an existing
  *flag* is always pure data, never a release.
- Every write to `settings_values` is itself captured in `admin_audit_logs`
  (§5.8, FR-8.9) with the old and new value — configuration changes are first-class
  audited actions, not a silent side-channel around the audit log.

This one pattern is what makes essentially all of §5.8 (Admin Control Plane) and
§5.6b (Payout & Disbursement) below possible without a dedicated table and a
dedicated admin-UI screen per feature.

---

## 4. User Roles & Permissions (summary)

| Role | Key permissions |
|---|---|
| Buyer | Browse, checkout, and look up order status via a secure emailed link — no platform account required (FR-5.4) |
| Seller | Full control of own store(s): design, catalog, shipping, discounts, orders, supplier links, payout requests |
| Supplier | Submit listings, view/fulfill orders **only** across stores they are explicitly linked to — never a global view of the platform's orders |
| Platform Admin | Full oversight: approve/suspend sellers & suppliers, configure commission/plans/reserves, approve payouts, resolve disputes, manage template & adapter registries, edit content pages, view platform analytics |

Fine-grained permission scopes (e.g. seller staff sub-accounts, admin sub-roles) are a
Phase 3+ item — flagged explicitly rather than silently dropped, since a single
"platform admin" role with no internal separation is itself a security concern at
scale (§6.5).

---

## 5. Functional Requirements

### 5.0 goto5x.com's Own Site
- FR-0.1: The public marketing/signup site is held to the same premium visual bar as
  the seller storefront templates — specifically **apple.com-level minimal premium
  polish combined with the horizonx.so motion aesthetic** (§13) — it is the platform's
  own advertisement for what sellers will get, and ships as a first-class Phase 1
  deliverable, not an afterthought once the app is done.

### 5.1 Store Builder & Theme Engine
- FR-1.1: Seller selects from a library of premium templates at store creation. Even
  before any AI-assisted generation ships, Phase 1 templates must be hand-built to the
  same "advanced/motion-rich" visual bar described in the vision — a generic theme
  does not satisfy this requirement.
- FR-1.2: The visual customizer's **v1.0 scope** is: colors, fonts, logo/banner
  images, and section show/hide + reorder — no code required. **Animation/motion
  preset customization is Phase 3** (FR-1.7), not v1.0; this wording is intentionally
  aligned with `docs/mvp-v1-cutlist.md` to remove the ambiguity present in earlier
  drafts, where this FR implied animation controls shipped in v1.0.
- FR-1.3: Live preview of changes before publishing.
- FR-1.4: All templates are mobile-responsive by default, and the seller dashboard
  itself is usable on mobile (not just the storefront).
- FR-1.5: SEO controls per store/page (meta title/description, sitemap, robots.txt).
- FR-1.6: **Advanced/self-coded mode** — a seller who wants full control can switch a
  store (or section) into a code-level theme editor (custom HTML/CSS/template
  overrides) instead of the visual customizer. This does not replace the customizer;
  it is an opt-in escape hatch for technical sellers, gated behind a plan tier
  (Phase 2, per `docs/mvp-v1-cutlist.md`).
- FR-1.7 (Phase 3+): Animation/motion preset customization and AI-assisted content/
  image suggestions inside the customizer.

### 5.2 Seller Admin Dashboard
- FR-2.1: Product/catalog CRUD, variants, inventory tracking.
- FR-2.2: Order list with status, filtering, and fulfillment actions.
- FR-2.3: Store design panel (entry point to Theme Engine, §5.1).
- FR-2.4: **Sales/traffic analytics view** — v1.0 scope is basic: orders, revenue, and
  top products, computed via live queries (no pre-aggregation) scoped strictly to
  that seller's own store (see `docs/mvp-v1-cutlist.md` for the explicit v1.0 call).
- FR-2.5: Payout/commission breakdown view (available vs. pending vs. reserved
  balance, with the hold-release date visible per pending entry and the
  reserve-release date visible per reserved entry — sellers must be able to see
  exactly when funds unlock, not just that they're "pending" or "reserved").
- FR-2.6: **Seller-initiated supplier connection** — a seller can invite/create a
  supplier link directly from their own dashboard (generating an invite a supplier
  accepts), in addition to a supplier independently registering and requesting a link.
  Either path lands in the same place: a `StoreSupplierLink` pending the seller's
  review.
- FR-2.7: Listing review/approval — every listing a linked supplier submits is queued
  for the seller's explicit approval before it can appear in that seller's store; no
  auto-publish path exists.
- FR-2.8: Google Drive connect (OAuth) for bulk media import.
- FR-2.9: Custom domain attachment (DNS instructions + verification status).
- FR-2.10: **Store shipping settings** — a seller configures a flat shipping rate and,
  optionally, a free-shipping threshold (order subtotal above which shipping is
  waived) for **self-fulfilled** products. This is deliberately simple for v1.0 —
  shipping zones and weight-based rates are Phase 2 (§10). Supplier-fulfilled items
  use the rate provided by that supplier's adapter instead (FR-4.6, FR-5.6).
- FR-2.11: **Discount code management** — a seller creates percentage-off or
  fixed-amount codes for their store, each with an optional expiry date and usage
  limit (§5.5, FR-5.5). Advanced discount types (auto-apply, BOGO, scheduled sales)
  are Phase 2.

### 5.3 Supplier Portal
- FR-3.1: Supplier registration and verification workflow (independent self-registration,
  or acceptance of a seller-initiated invite per FR-2.6).
- FR-3.2: Supplier submits product listings — including shipping cost, estimated
  delivery time, and supported delivery countries (FR-4.6) — against the Supplier
  Adapter interface (§3.5); each seller reviews and approves before a listing goes
  live in their store (FR-2.7).
- FR-3.3: **Multi-store dashboard** — a supplier connected to multiple sellers' stores
  sees all their listings and orders across every connected store in one unified view,
  scoped strictly to the stores they are linked to (§4).
- FR-3.4: Fulfillment workflow per order, rendered as a literal per-order checklist in
  both the supplier's and the seller's dashboards (not just a status field):
  `Pending → Confirmed → Shipped (tracking added) → Delivered → Completed`. Supplier
  uploads tracking ID; system relays it to the buyer and ticks the corresponding
  checklist item in the seller's dashboard automatically.

### 5.4 Dropshipping Supplier Integrations
- FR-4.1: Phase 1 integration target: **Printify**, as the first Supplier Adapter
  implementation (§3.5) — chosen first for its well-documented, modern API and
  print-on-demand model that needs no separate stock-sync complexity.
- FR-4.2: Phase 1.1: **CJ Dropshipping**, as the second adapter — deliberately chosen
  second specifically to prove the adapter interface is genuinely generic and not
  quietly Printify-shaped.
- FR-4.3: Product price/stock sync from supplier catalogs on a scheduled interval, with
  a cached last-known catalog so a supplier API outage degrades gracefully (stale but
  available data) instead of breaking the live storefront.
- FR-4.4: AliExpress has no official dropship API; it is deferred and will be added
  later as a third-party-API-backed adapter once evaluated for API stability and legal/
  ToS risk — never as a special-cased core integration.
- FR-4.5: **Oversell protection** — when the same supplier product is listed by
  multiple sellers, stock sync (FR-4.3) must decrement a shared supplier-stock figure
  on order placement so two sellers cannot both sell the last unit; a listing shows
  "out of stock" once the supplier's reported quantity is exhausted.
- FR-4.6: **Supplier listing transparency** — every supplier-sourced listing displays
  to the buyer, sourced from the adapter's data: shipping cost, estimated delivery
  time, and the countries the supplier can deliver to.
- FR-4.7: Checkout **blocks** placing an order when any item in the cart is a supplier
  listing that does not support delivery to the buyer's shipping country — this is a
  hard stop, not a warning, since goto5x.com has no way to fulfill a promise the
  supplier can't keep.
- FR-4.8: Supplier price changes propagate through the existing sync mechanism
  (FR-4.3); checkout **re-validates** each item's price against the latest synced
  `supplier_listings.price` at the moment of order placement — a storefront page is
  never allowed to complete a sale at a stale cached price.
- FR-4.9: **Supplier adapter registry** — admin can register, enable, or disable a
  supplier adapter (e.g. temporarily disable Printify sync during an incident) from
  the admin terminal without a deploy; disabling an adapter stops new listing syncs
  and order forwarding through it but does not affect orders already placed.

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
  checkout, §2.3), order confirmation emails include a secure, unguessable link to a
  status page for that order; the link uses a signed token, not a sequential/
  guessable order number, so one buyer can never browse to another buyer's order.
- FR-5.5: **Discount code validation** — at checkout, a code is accepted only if it is
  active, not past its expiry date, and under its usage limit; an invalid code is
  rejected with a clear reason, never silently ignored. Commission (FR-6.1) is
  calculated on the post-discount amount.
- FR-5.6: Order shipping cost is computed **per fulfillment source** in a mixed cart:
  self-fulfilled items use the seller's shipping settings (FR-2.10); supplier-fulfilled
  items use their adapter-provided rate (FR-4.6); the order total is the sum of both,
  not a single flat rate applied to the whole cart.

### 5.6 Payments, Commission & Ledger Engine
- FR-6.1: Commission of 3% is deducted per completed sale, calculated on the
  **product + shipping subtotal actually charged to the buyer, net of any discount
  code applied (FR-5.5), before payment-gateway fees** (gateway fees are a separate,
  itemized deduction) — configurable per plan/category/seller by admin via the
  Settings Registry, not hard-coded. All monetary amounts are expressed in the
  store's configured currency (§ Currency Strategy, `docs/database-schema.md`) —
  no logic anywhere assumes PKR specifically, even though PKR is the only currency
  in use at launch.
- FR-6.2: New-seller payout hold: funds from a new seller's sales are held for a
  configurable period (default 21–22 days), applied **per transaction** (each sale's
  own hold timer starts at that sale's completion), not as an account-wide lock.
- FR-6.3: **Hold graduation** — once a seller reaches a configurable trust threshold
  (e.g. N successfully completed, non-disputed orders, and identity verification per
  §6.5 complete), the hold period shortens or is removed for that seller going
  forward. This is an explicit mechanism, not a one-time manual admin toggle.
- FR-6.4: Internal ledger per seller: tracks `pending_balance`, `available_balance`,
  `reserved_balance`, `total_paid_out` as **computed sums over an append-only
  `LedgerEntry` table** — every commission, hold-release, reserve-hold,
  reserve-release, gateway fee, and payout is its own entry; no balance field is ever
  directly mutated.
- FR-6.5: Dispute/refund workflow that freezes a specific ledger entry without
  affecting the seller's other available funds; disputes are handled manually via the
  admin terminal in Phase 1 (no automated buyer-facing dispute flow yet, §10 MVP note).
- FR-6.6: A daily reconciliation job compares the ledger's computed totals against the
  payment gateway's settlement report and alerts admin on any mismatch — this is the
  backstop against ledger bugs causing silent financial loss.

### 5.6a Payment Gateway Strategy (Pakistan-first, prepaid launch)
Resolved per founder decision — see §11 (research) for full comparison:
- **v1.0 launch: Safepay only.** A prepaid-only launch keeps commission capture
  clean: buyer pays → platform receives the full amount → 3% commission is deducted
  in the ledger (FR-6.1) → the remainder is credited to the seller's balance under
  the standard hold (FR-6.2). There is no path in v1.0 where the platform has to
  separately collect commission from a seller after the fact.
- **Cash on Delivery (COD) — deferred, not deleted.** COD is intentionally excluded
  from v1.0 because it inverts commission collection: the seller (or their courier)
  collects payment directly from the buyer, so the platform never holds money to
  deduct 3% from — commission would have to be collected *after* the fact, which
  reintroduces exactly the collections/chargeback risk a prepaid launch is designed
  to avoid. COD returns in a later phase as a **controlled, per-seller feature**: a
  Settings Registry flag (`payments.cod_enabled`, scope `seller`) that admin enables
  only for **verified sellers with a sufficient available ledger balance** to cover
  the commission on outstanding COD orders — the commission on a COD sale is deducted
  directly from that seller's existing balance rather than collected separately, so
  the platform is never chasing a seller for money. This mechanism is documented now
  so the schema/ledger already anticipates it (`payments.gateway` already includes
  `cod` in `docs/database-schema.md`), even though it is switched off for every
  seller at launch.
- **Phase 1.x:** add a second aggregator (PayFast PK) and/or direct JazzCash/Easypaisa
  merchant APIs once a registered company + transaction volume justify their more
  enterprise-paced onboarding and better headline rates.
- **Phase 4:** Stripe via a foreign entity (e.g. a US entity) for international buyers,
  once the platform expands beyond Pakistan.
- Commission, hold, reserve, and payout logic (§5.6, §5.6b) are implemented entirely
  in goto5x.com's own ledger and are **gateway-agnostic by construction** — switching
  or adding a gateway never touches that code, only a new Payment Adapter (§3.5).

### 5.6b Payout Request & Disbursement Engine (new in v0.4)
This closes a gap in v0.3: the ledger tracked balances, but nothing described how a
seller actually gets paid.
- FR-6.7: A seller can request a payout of any amount **up to their current
  `available_balance`** (post-hold, post-reserve); a request exceeding available
  balance is rejected before it reaches the approval queue.
- FR-6.8: An optional **scheduled payout mode** — a seller may opt into automatic
  payout requests generated on a fixed monthly date. Both the mode's availability and
  its parameters are Settings Registry entries (`payouts.scheduled_mode_enabled`,
  `payouts.scheduled_day_of_month`), so enabling it or changing the schedule is a
  config change, not a deploy.
- FR-6.9: Every payout request enters an **admin approval queue**. Each request
  displays an auto-generated **risk summary**: seller KYC status, dispute/refund
  rate, count of flagged orders/listings, account age, and an abnormal
  sales-velocity signal (v1.0: a simple threshold check, e.g. order count in the
  last 24h exceeding N — see §14.6 for the exact acceptance test). All thresholds are
  Settings Registry entries, not hard-coded.
- FR-6.10: A seller with an active prohibited-goods flag (FR-8.13/moderation) has
  payouts **fully frozen** and is routed toward the store-suspension path (FR-8.4) —
  this is not a soft warning.
- FR-6.11: **Disbursement Adapter pattern** (§3.5): v1.0 ships the **manual adapter**
  — an approved request appears on an admin batch screen showing payee name, amount,
  and bank/IBAN or Raast account details in a copy-ready format; the admin transfers
  funds outside the platform (bank/Raast) and marks the request **Paid**, which
  creates the corresponding `payout_debit` ledger entry and triggers a seller
  notification. Phase 1.x adds an **API-based adapter** (bank/Raast/gateway
  disbursement API) that plugs into the same queue/ledger/notification logic with
  zero changes to either.
- FR-6.12: Payout status is visible to the seller through the full lifecycle:
  `requested → approved → processing → paid` (or `rejected`, with a reason).
- FR-6.13: **Rolling reserve** — an additional, ongoing holdback **on top of** the
  per-transaction hold (FR-6.2), not a replacement for it: a per-seller reserve
  percentage (default **0%**) that is admin-settable or auto-applied when a seller is
  risk-flagged. The reserved portion of each sale is its own ledger entry class
  (`reserve_hold`), released via a `reserve_release` entry after a configurable
  period if the underlying order is undisputed. All parameters (percentage, release
  period) are Settings Registry entries.

### 5.7 Subscription Plans & Billing
- FR-7.1: Tiered plans (e.g. Starter / Growth / Premium) priced in the platform's
  configured currency (PKR at launch — see Currency Strategy, `docs/database-schema.md`),
  gating features (number of products, template tiers, custom domain, coded-theme
  mode, analytics depth).
- FR-7.2: Recurring billing cycle with invoicing and dunning (failed-payment retry).

### 5.8 Platform Admin Terminal — the Control Plane
The admin terminal is not "a management screen" — it is the platform's control plane.
Every item below is implemented as Settings Registry entries (§3.8) and small,
purpose-built tables, so that operating the platform day to day never requires the
founder (or a future ops hire) to ask an engineer for a deploy.

- FR-8.1: **Feature flags** — any feature-gated behavior can be enabled/disabled
  instantly at global, per-plan, or per-seller scope through the Settings Registry
  (§3.8); precedence is seller > plan > global.
- FR-8.2: **Plans & pricing editor** — create, edit, and retire plans (name, price,
  billing interval) directly from the admin UI; each plan's limits (product count,
  storage, template tier access, coded-theme access) are Settings Registry entries
  scoped to that plan — adding a new plan or changing a limit is a data operation, not
  a schema change.
- FR-8.3: **Commission & payout engine settings** — global commission %, category-
  and seller-level overrides, the default hold duration (21–22 days), hold-graduation
  thresholds (FR-6.3), and rolling-reserve parameters (FR-6.13) are all editable from
  the admin UI via the Settings Registry. Changing a rate affects only *new* ledger
  entries going forward — existing append-only `LedgerEntry` rows are never
  retroactively rewritten (§5.6, FR-6.4).
- FR-8.4: **Seller lifecycle control** — approve, suspend, ban, or limit a seller;
  read-only "view any store" access for support; a secure, time-boxed, reason-required
  **"login as seller" impersonation** mode that issues a distinctly-flagged session and
  is fully captured in the audit log (FR-8.9); instant force-disable of a single store
  (flips `store.status`, takes effect on the store's very next request — no restart).
- FR-8.5: **Supplier lifecycle control** — the same approve/suspend/ban controls as
  FR-8.4, plus platform-level listing approve/reject for policy violations (distinct
  from a seller's own per-listing approval, FR-2.7).
- FR-8.6: **Template management** — publish/unpublish a template, mark it free or
  premium, and assign which plans can access it — all data changes against the
  `themes` table and Settings Registry, no redeploy to add or retire a design.
- FR-8.7: **Announcements & maintenance mode** — scheduled, platform-wide banners for
  sellers/buyers, and a global maintenance-mode toggle (a Settings Registry entry)
  checked by a lightweight middleware in front of every module, with an admin-IP
  allowlist so the admin terminal itself stays reachable during maintenance.
- FR-8.8: **Risk & fraud controls** — flag a suspicious order for review with a
  reason; freeze or release a specific seller's payouts (a per-seller Settings
  Registry entry the payout approval queue and hold-release job both check, §12
  Risk 6); initiate a refund, recorded as a `refund_adjustment` ledger entry.
- FR-8.9: **Immutable audit log** — every control-plane action (settings change,
  lifecycle action, impersonation, refund, payout approval, template change — not
  just "admin actions" loosely) is recorded with actor, action, target, before-value,
  after-value, and, where applicable, the impersonation session it occurred under.
  Immutability is enforced at the database level (no `UPDATE`/`DELETE` privilege on
  this table for the application's runtime role) — it is not merely a convention the
  application layer is trusted to follow.
- FR-8.10: **Real-time platform analytics** — GMV, revenue, commission earned, active
  store count, and top sellers, computed live against the transactional tables at
  launch volume; only moves to a scheduled snapshot/materialized-view once actual
  volume makes live aggregation slow (an optimization earned by real load, not built
  ahead of it, per the founder's low-cost-VPS constraint).
- FR-8.11: System health dashboard (queue depth, error rates, VPS resource usage).
- FR-8.12: Admin accounts require mandatory MFA (not optional) given the financial and
  cross-tenant control this terminal holds (§6.5).
- FR-8.13: **Listing/content moderation queue** — supplier listings and store content
  can be flagged (by automated checks or admin review) for prohibited/counterfeit
  goods before or after going live, with a takedown action that also triggers the
  payout freeze in FR-6.10; this is a legal-exposure control, not optional (§12, Risk 9).

### 5.9 Media Management
- FR-9.1: Seller connects Google Drive via OAuth to bulk-import product images/video.
- FR-9.2: Imported media is copied into platform object storage (self-hosted MinIO,
  §3.3) fronted by the CDN for storefront delivery — Drive is a source, not the
  runtime dependency.

### 5.10 Notifications
- FR-10.1: Email notifications for order/payout/listing events at launch (including
  the buyer order-status link, FR-5.4, and payout status changes, FR-6.12); SMS/
  WhatsApp as a Phase 2+ addition given their relevance in the Pakistani market.

### 5.11 Custom Domain
- FR-11.1: Every store gets a free subdomain (`storename.goto5x.com`) by default.
- FR-11.2: Seller can attach an owned custom domain via CNAME/A-record instructions
  with automated verification and TLS issuance (handled by the reverse proxy layer,
  §2.4, which must support dynamic multi-domain TLS rather than a fixed domain list).

### 5.12 Content Pages (legal, about, contact — new in v0.4)
- FR-12.1: Platform content pages — Terms of Service, Privacy Policy, Refund Policy,
  About, Contact — are stored as **versioned, rich-text content in the database** and
  edited from the admin terminal; publishing a text change is a data operation, never
  a deploy, consistent with the Control Plane philosophy (§3.8). Each edit creates a
  new version; prior versions remain retrievable (relevant for proving what terms
  were in effect on a given date, e.g. during a dispute).
- FR-12.2: Draft legal content for Terms of Service, Privacy Policy, and Refund
  Policy — covering the marketplace model, the 3% commission, the per-transaction
  hold, and the rolling reserve — ships as `docs/legal/*.md` for human legal review
  before launch; these drafts are a starting point for counsel, not a substitute for
  one (§13, open question 2).

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Storefront pages should target sub-2s first contentful paint via CDN + edge caching of static assets |
| Scalability | Architecture (modular monolith + row-level tenancy + statelessness principle, §3.1) must support scaling to a multi-VPS deployment without an application rewrite — verified module-by-module in §3.6 |
| Security | See §6.5 (expanded) |
| Availability | Automated daily DB backups + point-in-time recovery, plus a MinIO data-directory backup (§12, Risk 13), stored **off the primary VPS** (separate storage/provider) from day one, with a documented and periodically-tested restore runbook |
| Maintainability | CI/CD pipeline, versioned + backward-compatible migrations, feature flags, a same-VPS staging environment mirroring production (§3.7), rollback runbook |
| Usability | Non-technical sellers must be able to fully customize a store without support tickets; dashboards must be usable on mobile |
| Cost efficiency | Self-host-first by default (§9); every recurring third-party dependency justified against a self-hosted/build-in-house alternative |

### 6.5 Security & Compliance (expanded)
The v0.1 draft under-specified security; this section replaces the single summary row
with concrete, testable controls.

- **Multi-tenant isolation:** enforced at both the application layer (mandatory
  scoping middleware) and the database layer (Postgres RLS as a backstop), with an
  automated cross-tenant-access test suite as a release gate (§3.2, §14).
- **Permission boundaries:** a supplier's session can only ever query orders/listings
  for stores it holds an active `StoreSupplierLink` to (FR-3.3); a seller can never see
  another seller's supplier relationships or ledger. These are asserted by the same
  test suite as tenant isolation, not left as an implicit consequence of UI routing.
- **Payment security:** goto5x.com never stores raw card data — checkout uses the
  gateway's hosted fields/tokenization (PCI-DSS SAQ-A scope, not a higher SAQ level).
  All inbound payment-gateway and supplier webhooks are **signature-verified**; an
  unsigned or invalid-signature webhook is rejected before it can touch the ledger —
  this closes the "fake payment-succeeded event" forgery risk.
- **Admin access control:** MFA is **mandatory** (not optional) for every admin
  account (FR-8.12); admin-terminal login is a separate, more scrutinized flow from
  seller/supplier login, and every admin action is captured in the immutable audit
  log (FR-8.9).
- **Rate limiting:** applied specifically to authentication endpoints (login, signup,
  password reset — brute-force/credential-stuffing defense), listing-submission
  endpoints (spam defense), payout-request endpoints (abuse defense), and public
  storefront/API endpoints — not just a generic blanket statement.
- **Secrets management:** payment-gateway keys, supplier API credentials, and Google
  Drive OAuth secrets are stored in an encrypted secrets store (not plain environment
  files committed anywhere), with per-environment (dev/staging/prod) separation.
- **PII handling:** buyer PII (address, phone, order contents) is excluded from
  application logs by default (redaction at the logging layer); access to raw PII in
  the database is limited to the roles that functionally need it. The buyer
  order-status link (FR-5.4) uses a signed, unguessable token — never a sequential ID.
- **Dependency hygiene:** automated dependency vulnerability scanning runs in CI, not
  as an ad hoc manual task.
- **Content/legal risk:** listing moderation (FR-8.13) exists specifically to reduce
  marketplace liability for counterfeit or prohibited goods sold through supplier
  listings, and is linked directly to the payout freeze (FR-6.10).

---

## 7. External Interface Requirements

### 7.1 User-Facing Applications
- **goto5x.com public site** — marketing/signup, premium visual bar (§5.0).
- **Storefront** — public, per-tenant, template-rendered site, including the buyer
  order-status lookup page (FR-5.4).
- **Seller Dashboard** — authenticated app for store owners, including payout requests
  and shipping/discount settings.
- **Supplier Portal** — authenticated app for suppliers.
- **Admin Terminal** — authenticated, restricted app for platform staff, MFA-mandatory,
  including the payout approval queue and content-page editor.

### 7.2 Third-Party Integrations
Payment gateway (Safepay at launch; PayFast PK / direct JazzCash-Easypaisa in Phase
1.x; Stripe via foreign entity in Phase 4; a gated future COD path) · Supplier APIs
(Printify, then CJ Dropshipping, adapter interface for future suppliers) · Google
Drive API · Transactional email provider · DNS/domain verification · (Phase 2+) SMS/
WhatsApp Business API. Object storage (MinIO) and CDN (Cloudflare free tier) are
self-hosted/free-tier, not paid third-party dependencies (§3.3, §9).

---

## 8. High-Level Data Model (core entities)

`User, Seller, Store, Theme/Template, StoreThemeSettings, Product, ProductVariant,
Category, StoreShippingSettings, DiscountCode, Supplier, SupplierAdapterRegistry,
SupplierListing, StoreSupplierLink, Order, OrderItem, TrackingUpdate, Payment,
LedgerEntry, Payout, Plan, Subscription, MediaAsset, Domain, ContentPage,
ContentPageRevision, SettingsDefinition, SettingsValue, AdminUser, AdminAuditLog,
AdminImpersonationSession, OrderFlag, Announcement`

`SettingsDefinition`/`SettingsValue` are the Settings Registry (§3.8) — they supersede
a standalone `FeatureFlag` table; a feature flag is simply a boolean-typed, scoped
setting, not a separate mechanism.

Every tenant-scoped table (`Store, Product, Order, MediaAsset, ...`) carries
`store_id` and is protected by RLS (§3.2). `LedgerEntry` is append-only and is the
single source of truth for seller balances, now including `reserve_hold`/
`reserve_release` entry types (FR-6.13) — `available_balance` and `reserved_balance`
are computed sums, never directly-edited fields. Full column-level schema, including
the currency strategy (§ new in v0.4), is the subject of a dedicated deliverable
(`docs/database-schema.md`).

---

## 9. Build vs. Buy Decisions

**Self-host-first principle (binding, new in v0.4):** the default choice is to
self-host on the platform's own VPS. A recurring paid third-party service is
justified only where self-hosting is genuinely infeasible — specifically payment
processing (PCI/legal liability) and, as argued below, email deliverability. Every
row states which side of that line it falls on and why.

| Component | Decision | Reasoning |
|---|---|---|
| Payment processing | **Buy** (Safepay, then additional gateways) | PCI compliance and fraud liability make in-house processing a non-starter; commission/hold/reserve/payout logic stays custom on top |
| Payout disbursement | **Build** (manual adapter first, API adapter later) | Mirrors the Payment Adapter reasoning (§3.5) — no third-party payout-automation SaaS is justified before v1.0 proves real payout volume; the manual adapter costs nothing beyond admin time |
| Object storage | **Build (self-hosted MinIO on the VPS)** | Self-host-first principle — MinIO is free, S3-API-compatible, and runs on infrastructure already paid for; Cloudflare's free CDN tier handles bandwidth offload without a paid storage service |
| Store builder / theme engine | **Build** | Core product differentiator — cannot be a wrapper around a third-party tool |
| Drag-and-drop customizer | **Build**, deliberately scoped small at first (§10 MVP) | Core IP; a full visual page builder is a multi-year problem — Phase 1 ships a bounded set of customizable tokens (FR-1.2), not a Shopify-scale editor |
| Coded-theme escape hatch | **Build (lightweight)** | Template override mechanism, not a full IDE — reuses the same rendering pipeline as the visual customizer |
| AI image/content generation | **Buy (API-based)** initially | Use existing model APIs rather than training/hosting models — revisit in-house only at meaningful scale |
| Analytics | **Build (lightweight)** | Avoid per-event SaaS pricing that scales badly with store count |
| Transactional email | **Buy (managed service, free tier initially)** | Deliverability is a specialized problem (IP reputation, spam-filter cooperation) that is genuinely infeasible to self-host well — the one clear exception to self-host-first alongside payments |
| Search | **Build on Postgres first** | Defer a dedicated search engine until catalog scale requires it |
| Identity/Auth | **Build (lightweight library, not per-MAU SaaS)** | A hosted per-user-priced auth service (Auth0/Clerk-style) becomes expensive fast at marketplace-scale buyer counts; a well-scoped self-hosted auth module keeps unit economics sane and satisfies the SSO hook (§3.2a) |
| Admin control plane / config management | **Build (generic Settings Registry, §3.8)** | A scoped key-value settings table costs nothing extra to run (same Postgres + same Redis already budgeted) and is the single highest-leverage decision for a solo-founder-operated platform — it is the difference between "edit a value" and "wait for a deploy" for nearly every operational lever in §5.8 |

---

## 10. Phased Roadmap (solo-founder pacing)

Re-scoped for a solo founder + AI build team: each phase below is itself broken into
small, independently shippable increments rather than one large release, and — new in
v0.4 — no module within a phase starts until the previous module's Acceptance
Checklist (§14) is verified. See `docs/mvp-v1-cutlist.md` for the exact v1.0 boundary.

- **Phase 0 (current):** SRS finalized, architecture decisions locked, tech stack
  chosen, database schema designed.
- **Phase 1 — v1.0 MVP:** goto5x.com's own site, store builder with a small set of
  premium templates, basic customizer (FR-1.2 v1.0 scope), product catalog, seller
  shipping settings, basic discount codes, ONE supplier integration (Printify)
  proving the adapter interface end-to-end with full delivery transparency, checkout
  via **Safepay only** (COD deferred, §5.6a), buyer order-status lookup, order
  management, commission + ledger + fixed hold + rolling-reserve mechanism (default
  0%), seller-initiated payout requests through an admin approval queue with a
  **manual** disbursement adapter, custom domain, Google Drive import into
  self-hosted MinIO, admin-editable legal/content pages, and the Admin Control Plane
  items marked IN in `docs/mvp-v1-cutlist.md`.
- **Phase 1.1:** CJ Dropshipping adapter (proves the interface is generic), self-serve
  supplier registration + full multi-store dashboard, listing moderation queue, hold
  graduation logic, scheduled payout mode, API-based disbursement adapter.
- **Phase 2:** Tiered subscription billing, coded-theme escape hatch, dispute workflow,
  SMS/WhatsApp notifications, second payment gateway, gated per-seller COD, shipping
  zones/weight-based rates, advanced discounts (auto-apply, BOGO, scheduled sales).
- **Phase 3:** Advanced theme customizer (animation presets, AI-assisted design),
  deeper analytics, admin sub-roles/seller staff accounts.
- **Phase 4:** Multi-VPS scale-out, international payment gateways, social-media SaaS
  SSO integration, mobile apps.

---

## 11. Payment Gateway Research Summary (resolves prior open question)

| Option | Verdict for Phase 1 |
|---|---|
| **Safepay** | **Chosen as v1.0's sole payment method.** YC-backed, modern API, explicitly startup/SME-friendly onboarding, no setup fees, supports individual/sole-proprietor accounts (with stricter limits), unifies cards + mobile wallets + Raast under one integration. |
| **Cash on Delivery** | **Deferred from v1.0** (see §5.6a) — inverts commission collection since the platform never holds the money to deduct 3% from; reintroduced later as a per-seller, balance-gated Settings Registry flag rather than a launch-day payment method. |
| **PayFast PK** | Deferred to Phase 1.x. Reputable and PCI-DSS compliant, but onboarding is described as "enterprise-paced" with heavier documentation/notarization requirements — not the fastest path to a solo founder's first live payment. |
| **Direct JazzCash / Easypaisa merchant APIs** | Deferred to Phase 1.x/2. Requires a direct merchant agreement with the telco/bank (registered company, settlement account), lower-level integration (manual request signing) — better economics at volume, not the fastest Phase 1 path. |
| **Stripe (via foreign entity)** | Deferred to Phase 4. Stripe does not onboard Pakistani entities directly; would require a foreign (e.g. US) entity — relevant only once the platform serves international buyers. |

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
| 10 | **Over-building the theme engine/customizer** (a multi-year problem for a small team) | Phase 1 customizer is deliberately scoped to a bounded token set (FR-1.2), not a full visual page builder (§9); expand only after MVP validates demand |
| 11 | **A bad admin config value breaks the platform** (e.g. commission set to 105%, or the wrong seller's payouts frozen) — the Control Plane (§5.8) makes changes instant, which cuts both ways | `settings_definitions` enforces a validation rule per key (range/type) rejected before it reaches the database; every change is audit-logged with before/after values (FR-8.9) so a bad edit is both hard to make and fast to spot and revert |
| 12 | **Manual disbursement is a human-in-the-loop process** — admin fatigue or error transferring funds via bank/Raast could delay or misdirect a payout | The status flow (FR-6.12) is visible to the seller so delays are transparent, not silent; the Disbursement Adapter pattern (FR-6.11) means moving to an automated API-based adapter in Phase 1.x requires no change to the queue or ledger — this is a temporary, bounded risk |
| 13 | **Self-hosted MinIO is a new single point of failure for media**, now living on the same VPS as everything else | Same off-box backup discipline as the database (Risk 5) extends to the MinIO data directory; the Cloudflare CDN cache in front of it means a brief MinIO hiccup doesn't immediately take already-cached images offline |
| 14 | **Discount code abuse** (bulk-generated codes used to reduce effective commission, or a leaked code used far beyond its intended reach) | Usage limits and expiry are enforced server-side at checkout (FR-5.5, never client-side); commission is calculated on the post-discount amount (FR-6.1), so a discount reduces seller revenue and platform commission proportionally — it cannot make a sale commission-free while leaving seller revenue untouched |

---

## 13. Open Questions / Decisions Needed (remaining)

1. **Legal entity:** confirm timeline for registering a business entity — needed for
   Phase 1.x gateways (PayFast/direct JazzCash-Easypaisa), for enabling the gated COD
   feature at scale, and for hold-graduation identity verification (FR-6.3), even
   though Safepay alone can launch without it.
2. **Regulatory review:** SECP/PECA/data-protection obligations for a Pakistani
   e-commerce marketplace handling buyer PII and commission-based payments — needs a
   legal consult before Phase 1.1 (Risk 8); the `docs/legal/` drafts (FR-12.2) are a
   starting point for that consultation, not a substitute for it.
3. **Branding assets & direction (resolved in part):** founder owns branding assets
   (logo, etc.); the agreed visual direction for the platform's own site (FR-0.1) is
   **apple.com-level minimal premium polish combined with the horizonx.so motion
   aesthetic** — final assets are still needed before the Theme Engine's first
   templates and the platform's own site are designed.
4. **Hold graduation thresholds** — exact number of completed orders / verification
   criteria for FR-6.3 needs a founder decision once real transaction data exists to
   calibrate against (a placeholder default should not become the permanent rule
   without revisiting it).
5. **Rolling-reserve default trigger criteria** — FR-6.13 ships with a 0% default and
   admin-manual application; the specific risk signals that should *auto-apply* a
   reserve (rather than requiring an admin to notice and act) need calibration once
   real seller/order data exists, similar to open question 4.

---

## 14. Acceptance Checklists (new in v0.4)

**Binding process rule:** during build, no module or phase begins implementation
until the previous module's checklist below is **100% verified and explicitly
approved by the founder**. These checklists are the definition of done for each
module — not a summary of what was built, but the exhaustive list of what must be
true before the next module starts (§3.7, §10). Each item is written to be testable
(automatable where possible), not aspirational.

### 14.0 Platform's Own Site
- [ ] Public site meets the premium visual bar (apple.com-level polish + horizonx.so
      motion, §13) — explicit founder sign-off against FR-0.1
- [ ] Mobile-responsive across the three most common breakpoints
- [ ] Signup flow works end-to-end: create account → verify email → land in dashboard
- [ ] Page load meets the sub-2s first-contentful-paint target (§6)
- [ ] Legal/content pages (ToS, Privacy, Refund, About, Contact) are linked, render
      correctly, and are served from admin-editable content (FR-12.1), not static files

### 14.1 Store Builder & Theme Engine
- [ ] All v1.0 templates selectable at store creation and each meets the premium
      visual bar (FR-1.1)
- [ ] Customizer persists and correctly renders: colors, fonts, logo/banner images,
      section show/hide/reorder (FR-1.2 v1.0 scope — explicitly, no animation controls)
- [ ] Live preview output matches published output exactly
- [ ] Storefront is mobile-responsive; dashboard is mobile-usable
- [ ] SEO meta fields save and render correctly in page `<head>`
- [ ] **Tenant isolation:** automated test proves seller A cannot read or write seller
      B's `store_theme_settings` via direct API manipulation
- [ ] Postgres RLS policy on `store_theme_settings` verified with a negative test
      (a query without the correct session `store_id` returns zero rows)
- [ ] Settings Registry key `theme.coded_mode_enabled` resolves correctly per plan
      and is off for every seller in v1.0 (Phase 2 feature, FR-1.6)

### 14.2 Seller Admin Dashboard
- [ ] Product CRUD, variants, and inventory tracking work correctly (FR-2.1)
- [ ] Order list filters by status and date correctly using the intended index
      (`orders (store_id, status, placed_at desc)`)
- [ ] Seller-initiated supplier invite creates a `store_supplier_links` row with the
      correct `invited_by` value and status (FR-2.6)
- [ ] Listing approve/reject updates `listing_reviews` and, on approve, creates the
      corresponding `products` row (FR-2.7)
- [ ] Google Drive OAuth connect + import copies media into MinIO — imported assets
      still render after the source Drive file is deleted (proves no runtime
      dependency on Drive, FR-9.2)
- [ ] Custom domain attach completes DNS verification + TLS issuance for a real test
      domain within the documented time window (FR-2.9)
- [ ] Seller analytics view (FR-2.4) shows correct orders/revenue/top-products for
      that store only — **tenant isolation test**: seller A's analytics never include
      seller B's orders
- [ ] Shipping settings (flat rate + free-shipping threshold, FR-2.10) save and are
      applied correctly at checkout for a self-fulfilled cart
- [ ] Discount code CRUD (FR-2.11) works; a code created for store A cannot be
      applied to a checkout on store B
- [ ] **Tenant isolation, release gate:** the full automated cross-tenant test suite
      passes for every dashboard API route (§3.2)

### 14.3 Supplier Portal
- [ ] Supplier registration/verification workflow completes end-to-end (FR-3.1)
- [ ] **Permission boundary:** a supplier's session returns zero results for a store
      they do not hold an active `store_supplier_links` row for (negative test)
- [ ] Multi-store dashboard aggregates `order_items` across all linked stores
      correctly, using the `order_items (supplier_id, fulfillment_status, created_at)`
      index (FR-3.3)
- [ ] Fulfillment checklist (`pending→confirmed→shipped→delivered→completed`) updates
      correctly and reflects live in the seller's dashboard (FR-3.4)
- [ ] Tracking ID upload triggers the buyer notification (FR-5.2)

### 14.4 Dropshipping Supplier Integrations (Printify, v1.0)
- [ ] Printify adapter implements the full Supplier Adapter interface (§3.5):
      `listProducts`, `syncStock`, `submitListingForReview`, `forwardOrder`,
      `pullTrackingUpdate`
- [ ] Shipping cost, estimated delivery time, and supported countries render
      correctly on the storefront product page for a Printify-sourced listing (FR-4.6)
- [ ] Checkout blocks an order when any cart item's supplier listing doesn't support
      the buyer's shipping country — verified with a deliberately unsupported country
      (FR-4.7)
- [ ] Price sync propagates to the storefront within the scheduled interval; a
      checkout attempted against a stale cached price is rejected/re-validated against
      the latest synced price (FR-4.8)
- [ ] **Oversell protection:** two simultaneous orders against the last unit of a
      shared supplier stock figure — only one succeeds (FR-4.5)
- [ ] Supplier API outage is simulated (adapter forced to error): storefront serves
      the last-known cached catalog instead of erroring (FR-4.3)
- [ ] Admin can disable the Printify adapter from the adapter registry without a
      deploy; disabling stops new syncs but does not affect existing orders (FR-4.9)

### 14.5 Order & Fulfillment Management
- [ ] Unified order dashboard spans self- and supplier-fulfilled orders correctly (FR-5.1)
- [ ] Buyer email notifications fire correctly on confirmed/shipped/delivered (FR-5.2)
- [ ] Suspended-store buyer-facing behavior renders correctly; in-flight orders for a
      newly-suspended store remain fulfillable (FR-5.3)
- [ ] Buyer order-status lookup link works without an account, and the token cannot
      be guessed or enumerated — verified with a token-brute-force test that fails
      (FR-5.4)
- [ ] Discount code validation: an expired code is rejected, a usage-limit-exceeded
      code is rejected, a valid code applies the correct discount to the order total
      (FR-5.5)
- [ ] Mixed-cart shipping calculation is correct: a cart with one self-fulfilled and
      one supplier-fulfilled item charges the sum of both applicable shipping rates,
      not a single flat rate (FR-5.6)

### 14.6 Payments, Commission, Ledger & Payout Engine
- [ ] Safepay checkout succeeds end-to-end in sandbox and in production
- [ ] Webhook signature verification rejects a forged/unsigned webhook — this test
      must fail closed (security release gate, §6.5)
- [ ] Commission (3% default, configurable) is deducted correctly on the
      post-discount, pre-gateway-fee amount (FR-6.1)
- [ ] **Ledger immutability:** an attempt to `UPDATE` or `DELETE` a `ledger_entries`
      row fails at the database grant level, not merely at the application layer
- [ ] The 22-day hold: a `sale_credit` entry's `hold_release_at` is set correctly and
      the hold-release scheduled job promotes it to available at the right time, not
      before (FR-6.2)
- [ ] Daily reconciliation job flags a deliberately-introduced mismatch between the
      ledger and a mocked gateway settlement report (FR-6.6)
- [ ] Payout request against available balance only — a request exceeding available
      balance is rejected before reaching the approval queue (FR-6.7)
- [ ] Payout admin approval queue displays a correct risk summary (KYC status,
      dispute rate, flagged-order count, account age, sales-velocity signal) for a
      constructed test seller (FR-6.9)
- [ ] A seller with an active prohibited-goods flag cannot have a payout approved —
      the request is blocked, not merely flagged (FR-6.10)
- [ ] Manual disbursement adapter: the admin batch screen shows payee/amount/IBAN
      correctly; marking a request Paid creates the correct `payout_debit` ledger
      entry and fires the seller notification (FR-6.11, FR-6.12)
- [ ] Rolling reserve: setting a test seller's reserve percentage above 0% causes the
      correct portion of their next `sale_credit` to be held as a separate
      `reserve_hold` entry, released via `reserve_release` after the configured
      period if undisputed (FR-6.13)
- [ ] Settings Registry keys resolve with correct scope precedence (seller > plan >
      global): `billing.commission_rate`, `payouts.hold_days`,
      `payouts.reserve_percentage`, `payouts.frozen`, `payments.cod_enabled`
      (confirmed off for every seller in v1.0)
- [ ] Every monetary display shows the store's configured currency, never a
      hard-coded `"PKR"` string (Currency Strategy, `docs/database-schema.md`)

### 14.7 Subscription Plans & Billing
- [ ] Plan CRUD from the admin UI creates/edits/retires a plan without a deploy (FR-8.2)
- [ ] Plan-scoped Settings Registry entries (product limit, template tier,
      coded-theme access) enforce correctly for a seller on that plan
- [ ] Billing-cycle mechanics are correct for a full period even though v1.0 launches
      on a single flat/free plan — the structure is proven ahead of Phase 2's tiered
      billing (FR-7.1, FR-7.2)

### 14.8 Platform Admin Terminal — Control Plane
- [ ] Every FR-8.x item has a passing test: feature flags, plan editor, commission/
      hold/reserve settings, seller/supplier lifecycle, template management,
      maintenance mode, risk/fraud controls, audit log, analytics
- [ ] A Settings Registry write is visible to a module's very next read within one
      cache-invalidation cycle (timed test)
- [ ] An out-of-range value (e.g. commission = 105%) is rejected by
      `settings_definitions` validation before reaching the database (§12, Risk 11)
- [ ] Admin MFA is mandatory — creating or using an admin account without MFA
      enrollment fails (FR-8.12)
- [ ] Impersonation requires a reason before a session opens; every action during the
      session is tagged with `impersonation_session_id` in the audit log; ending the
      session is itself logged (FR-8.4)
- [ ] **Audit log immutability:** an attempt to `UPDATE` or `DELETE` an
      `admin_audit_logs` row fails at the database grant level (FR-8.9)
- [ ] Enabling maintenance mode shows the maintenance page to buyers/sellers while an
      allowlisted admin IP still reaches the admin terminal (FR-8.7)
- [ ] Content pages (legal/about/contact) are editable from the admin terminal and
      versioned — editing a page produces a new version, and the prior version
      remains retrievable (FR-12.1)

### 14.9 Media Management
- [ ] Google Drive import copies files into MinIO; the storefront still serves those
      images after simulating Drive being unavailable (FR-9.1, FR-9.2)
- [ ] Cloudflare CDN correctly caches and serves MinIO-backed assets

### 14.10 Notifications
- [ ] Order/payout/listing email notifications fire correctly and are not blocked by
      a queue backlog under simulated load (FR-10.1)

### 14.11 Custom Domain
- [ ] Domain attach → DNS verification → TLS issuance completes for a real test
      domain within the documented time window (FR-11.2)
- [ ] The `domains.domain_name` unique index correctly resolves the tenant on every
      request, with no ambiguity for two similarly-named domains (FR-11.1)

### 14.12 Security & Compliance (cross-cutting, applies to every module above)
- [ ] The full automated cross-tenant test suite passes as a release gate (§3.2)
- [ ] Rate limiting verified on auth endpoints, listing-submission endpoints,
      payout-request endpoints, and public storefront/API endpoints (§6.5)
- [ ] Secrets (gateway keys, supplier API credentials, Drive OAuth secrets) are
      confirmed stored in an encrypted secrets store, never in a committed env file
- [ ] PII redaction verified in application logs (search logs for a test buyer's
      phone/address; confirm absence)
- [ ] A dependency-vulnerability scan runs in CI and blocks a deliberately-introduced
      known-vulnerable dependency

---

*This is a living document — update it as decisions in §13 are resolved and as each
phase is scoped in detail. Companion deliverables: `docs/tech-stack.md`,
`docs/database-schema.md`, `docs/architecture.md`, `docs/mvp-v1-cutlist.md`,
`docs/legal/` (Terms of Service, Privacy Policy, Refund Policy drafts).*
