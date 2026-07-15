# goto5x.com — Software Requirements Specification (SRS)

**Version:** 0.3 (Draft — post self-review + control-plane addendum)
**Date:** 2026-07-15
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

---

## 1. Introduction

### 1.1 Purpose
This document defines the requirements for **goto5x.com**, a multi-tenant e-commerce
platform (Shopify-class) that lets sellers launch premium-designed online stores,
connects them to dropshipping suppliers, and gives sellers deep control over store
design and operations through an advanced dashboard. It is the reference point for
all architecture and build decisions going forward — every phase of the product
should trace back to a requirement in this document.

### 1.2 Scope
In scope for goto5x.com (this SRS):
- goto5x.com's **own** public site (marketing/signup) — premium, advanced, motion-rich
  visual bar, since it is the first impression of the whole platform's quality.
- Multi-tenant storefront + store builder (premium templates + customizer + optional
  hand-coded theme mode for technical sellers)
- Seller admin dashboard (store design, catalog, orders, payouts)
- Supplier portal (seller-initiated supplier invite, listing review/approval, multi-store
  order tracking) built on a generic supplier-adapter interface
- Dropshipping supplier integrations (Printify first, CJ Dropshipping second, more via
  the adapter interface without core changes)
- Payment, commission, and payout (hold) engine
- Platform admin terminal (super admin control panel)
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
1. **Cheaper entry plans** targeting budget-conscious sellers (Pakistan-first pricing in PKR).
2. **Premium visual templates** as a standard offering, not a paid add-on — positioned
   like the aesthetic of horizonx.so (advanced motion, 3D-leaning visuals) rather than
   generic themes. This visual bar applies to **both** seller storefronts and
   goto5x.com's own marketing/product site — the platform must look as premium as what
   it promises sellers.
3. **Built-in supplier network** — sellers don't need a separate app/plugin to start
   dropshipping; suppliers are part of the core platform.
4. **Simple, advanced control panel** — sellers get deep design control (colors,
   animations, layout, images) without needing to know code, with an optional
   hand-coded theme mode for sellers who prefer full control.

### 2.2 Product Functions (high level)
- Store creation and premium template selection
- Visual store customization (design, animation, branding), or self-coded themes
- Product catalog and inventory management
- Supplier onboarding (seller-invited or self-registered), listing submission, and
  seller-side approval, via a pluggable adapter per supplier/integration type
- Order management with supplier fulfillment + tracking handoff to buyer
- Payments, commission deduction, and payout scheduling with a trust-based hold
- Platform-wide administration and oversight
- Custom domain + Google Drive media connection per seller

### 2.3 User Classes and Characteristics
| Role | Description |
|---|---|
| **Buyer** | Shops on a seller's storefront; needs no account on goto5x.com core system beyond checkout |
| **Seller** | Owns a store; manages catalog, design, orders, payouts; mostly non-technical, but may opt into a code-level theme editor |
| **Supplier** | Lists products for one or more sellers; fulfills orders and provides tracking |
| **Platform Admin** | goto5x.com staff; manages sellers, suppliers, commissions, disputes, platform health |

### 2.4 Operating Environment
- **Phase 1:** Single VPS (recommended starting spec: 4–8 vCPU / 16 GB RAM / NVMe SSD),
  Docker-based deployment, reverse proxy + automatic TLS handling multiple per-seller
  custom domains.
- **Phase 2+:** Split into multiple VPS instances (DB server, app server, worker/queue
  server, media/CDN edge) as load grows — see §3.6 Scaling Path.
- OS: Ubuntu LTS. Containerized services orchestrated with Docker Compose initially,
  migrating to a lightweight orchestrator only when a single VPS is no longer
  sufficient — full Kubernetes is not justified at Phase 1–2 scale.

### 2.5 Design & Implementation Constraints
- Payments **must** go through a licensed payment processor / gateway partner —
  goto5x.com must never custom-build raw card/payment handling (PCI-DSS liability).
  Commission and hold logic are custom and gateway-independent (§5.6).
- Budget-conscious build: prefer building in-house over paying recurring SaaS fees
  where the in-house version is a core differentiator (§9 Build-vs-Buy).
- Must support Pakistan-first payment rails from Phase 1 (§5.6a); international
  gateways are a later phase.
- Hosting/domain for each storefront is owned and attached by the seller — goto5x.com
  does not resell hosting or act as registrar.
- **Team constraint:** solo founder + AI pair-programming. Every phase must ship in
  small, independently-releasable increments — no phase may depend on a "big bang"
  launch of multiple subsystems at once (§10, §13).

### 2.6 Assumptions & Dependencies
- A registered legal business entity (or an aggregator gateway that supports individual/
  sole-proprietor onboarding, §5.6a) is required before any payment gateway goes live.
- Dropship supplier integrations depend on those suppliers exposing usable APIs.
  AliExpress has no official public dropship API — it is deferred and will be added
  through the same adapter interface as a third-party/affiliate-API-backed plugin once
  legally reviewed, without any core-platform change.

---

## 3. System Architecture Overview

### 3.1 Architectural Style
**Modular monolith** — one deployable application composed of clearly bounded
modules (Auth/Identity, Store/Tenant, Catalog, Orders, Payments/Ledger, Suppliers,
Theme Engine, Media, Notifications, Admin), each with its own internal boundary (own
folder/package, own DB schema namespace, communicating through defined interfaces —
not through shared global state). This gets Phase 1 to market fast while keeping a
clean seam to extract any module into its own service later without a rewrite.

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
  is hit") — this test suite is a release gate, not optional coverage.

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
- **Object storage:** S3-compatible storage (e.g. Cloudflare R2 — no egress fees) for
  product images/video, served through a CDN. Google Drive is a seller-side **import
  source**, not the primary asset store — storefront performance must not depend on
  Drive's availability or latency.
- **Search:** Postgres full-text search initially; move to a dedicated search engine
  only once catalog scale requires it.

### 3.4 Background Processing
A job queue (Redis + BullMQ or equivalent) handles: payout hold-release scheduling,
supplier order sync, tracking-status polling, notification dispatch, and template
asset processing (image optimization, thumbnailing). Workers are stateless processes
that pull from the shared queue — any number of worker instances can run
concurrently across one or many VPS with no coordination logic beyond the queue
itself, by design.

### 3.5 Supplier Integration Architecture (adapter/plugin interface)
Per the founder's decision, supplier integrations are never built as one-off,
hard-coded connections. Every supplier (Printify, CJ Dropshipping, a future
AliExpress-via-third-party-API, or a manual/CSV "supplier") implements the same
internal **Supplier Adapter interface**: `listProducts()`, `syncStock()`,
`submitListingForReview()`, `forwardOrder()`, `pullTrackingUpdate()`. The Supplier
module orchestrates against this interface only — it never contains
Printify-specific or CJ-specific logic outside that supplier's own adapter
implementation. Adding a new supplier is "write one adapter," never "touch core
order/catalog code." This is the mechanism, not just an intention — it directly
determines how the Supplier module's internal folders are organized (§ architecture
diagram, separate deliverable).

### 3.6 Scaling Path (designed in from day one)
| Phase | Setup |
|---|---|
| 1 | Single VPS: app + DB + Redis + worker, all containerized on one box |
| 2 | Move DB to its own VPS; add a read replica; app stays on original VPS |
| 3 | Separate worker/queue VPS; dedicated media/CDN edge; app servers behind a load balancer (2+ VPS) |
| 4 | Multi-region app servers; DB read replicas per region; extract highest-load modules (e.g. Orders, Catalog) into standalone services |

Because tenancy is row-based, sessions are stateless, workers are stateless, media
lives in object storage (not local disk), and DB access already goes through a
pooler, each phase transition above is an **infrastructure change**, not an
application rewrite — this was verified module-by-module during this review
specifically to close off "rewrite trap" risk (§13.4).

### 3.7 Release & Versioning Strategy
- Environments: `dev` → `staging` → `production`.
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

### 3.8 Settings Registry (Config-as-Data — the Admin Control Plane's foundation)
The founder's requirement that "day-to-day operational changes must never require a
code deployment" is implemented as a single, reused mechanism rather than one-off
switches scattered per feature:

- **`settings_definitions`** is a catalog of every tunable key the platform recognizes
  (e.g. `billing.commission_rate`, `payouts.hold_days`, `catalog.product_limit`,
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

This one pattern is what makes essentially all of §5.8 (Admin Control Plane) below
possible without a dedicated table and a dedicated admin-UI screen per feature.

---

## 4. User Roles & Permissions (summary)

| Role | Key permissions |
|---|---|
| Buyer | Browse, checkout — no platform account required beyond order lookup |
| Seller | Full control of own store(s): design, catalog, orders, payouts, supplier links |
| Supplier | Submit listings, view/fulfill orders **only** across stores they are explicitly linked to — never a global view of the platform's orders |
| Platform Admin | Full oversight: approve/suspend sellers & suppliers, configure commission/plans, resolve disputes, manage template marketplace, view platform analytics |

Fine-grained permission scopes (e.g. seller staff sub-accounts, admin sub-roles) are a
Phase 3+ item — flagged explicitly rather than silently dropped, since a single
"platform admin" role with no internal separation is itself a security concern at
scale (§6.5).

---

## 5. Functional Requirements

### 5.0 goto5x.com's Own Site
- FR-0.1: The public marketing/signup site is held to the same premium visual bar as
  the seller storefront templates (motion, polish, "advanced AI-designed" feel) — it
  is the platform's own advertisement for what sellers will get, and ships as a
  first-class Phase 1 deliverable, not an afterthought once the app is done.

### 5.1 Store Builder & Theme Engine
- FR-1.1: Seller selects from a library of premium templates at store creation. Even
  before any AI-assisted generation ships, Phase 1 templates must be hand-built to the
  same "advanced/motion-rich" visual bar described in the vision — a generic theme
  does not satisfy this requirement.
- FR-1.2: Visual customizer lets seller edit colors, fonts, section layout, images,
  and animation/motion presets without writing code.
- FR-1.3: Live preview of changes before publishing.
- FR-1.4: All templates are mobile-responsive by default, and the seller dashboard
  itself is usable on mobile (not just the storefront).
- FR-1.5: SEO controls per store/page (meta title/description, sitemap, robots.txt).
- FR-1.6: **Advanced/self-coded mode** — a seller who wants full control can switch a
  store (or section) into a code-level theme editor (custom HTML/CSS/template
  overrides) instead of the visual customizer. This does not replace the customizer;
  it is an opt-in escape hatch for technical sellers, gated behind a plan tier.
- FR-1.7 (Phase 3+): AI-assisted content/image suggestions inside the customizer.

### 5.2 Seller Admin Dashboard
- FR-2.1: Product/catalog CRUD, variants, inventory tracking.
- FR-2.2: Order list with status, filtering, and fulfillment actions.
- FR-2.3: Store design panel (entry point to Theme Engine, §5.1).
- FR-2.4: Sales/traffic analytics view.
- FR-2.5: Payout/commission breakdown view (available vs. pending balance, with the
  hold-release date visible per pending entry — sellers must be able to see exactly
  when funds unlock, not just that they're "pending").
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

### 5.3 Supplier Portal
- FR-3.1: Supplier registration and verification workflow (independent self-registration,
  or acceptance of a seller-initiated invite per FR-2.6).
- FR-3.2: Supplier submits product listings against the Supplier Adapter interface
  (§3.5); each seller reviews and approves before a listing goes live in their store
  (FR-2.7).
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

### 5.5 Order & Fulfillment Management
- FR-5.1: Unified order dashboard per seller, spanning both self-fulfilled and
  supplier-fulfilled orders.
- FR-5.2: Automated buyer notification on status change (order confirmed, shipped
  with tracking, delivered).
- FR-5.3: Defined suspended/banned-store behavior: if a store is suspended by admin
  (§5.8), its storefront shows a clear "temporarily unavailable" state to buyers
  rather than a broken page, and in-flight orders remain fulfillable so existing
  buyers aren't stranded.

### 5.6 Payments, Commission & Payout Engine
- FR-6.1: Commission of 3% is deducted per completed sale, calculated on the
  **product + shipping subtotal charged to the buyer, before payment-gateway fees**
  (gateway fees are a separate, itemized deduction) — configurable per plan/category
  by admin, not hard-coded.
- FR-6.2: New-seller payout hold: funds from a new seller's sales are held for a
  configurable period (default 21–22 days), applied **per transaction** (each sale's
  own hold timer starts at that sale's completion), not as an account-wide lock.
- FR-6.3: **Hold graduation** — once a seller reaches a configurable trust threshold
  (e.g. N successfully completed, non-disputed orders, and identity verification per
  §6.5 complete), the hold period shortens or is removed for that seller going
  forward. This is an explicit mechanism, not a one-time manual admin toggle.
- FR-6.4: Internal ledger per seller: tracks `pending_balance`, `available_balance`,
  `total_paid_out` as **computed sums over an append-only `LedgerEntry` table** —
  every commission, hold-release, gateway fee, and payout is its own entry; no
  balance field is ever directly mutated.
- FR-6.5: Dispute/refund workflow that freezes a specific ledger entry without
  affecting the seller's other available funds; disputes are handled manually via the
  admin terminal in Phase 1 (no automated buyer-facing dispute flow yet, §13 MVP note).
- FR-6.6: A daily reconciliation job compares the ledger's computed totals against the
  payment gateway's settlement report and alerts admin on any mismatch — this is the
  backstop against ledger bugs causing silent financial loss.

### 5.6a Payment Gateway Strategy (Pakistan-first)
Resolved per founder decision — see §11 (research) for full comparison:
- **Phase 1 primary:** an aggregator gateway (Safepay) that supports fast, startup/
  sole-proprietor-friendly onboarding and unifies cards, mobile wallets, and Raast
  under one modern API — chosen specifically to avoid the multi-week enterprise
  onboarding timeline of going directly to JazzCash/Easypaisa or PayFast at day one.
- **Phase 1, parallel:** **Cash on Delivery (COD)** as a payment method, since it is
  extremely common in Pakistan and de-risks launch against any single gateway's
  onboarding delay.
- **Phase 1.x:** add a second aggregator (PayFast PK) and/or direct JazzCash/Easypaisa
  merchant APIs once a registered company + transaction volume justify their more
  enterprise-paced onboarding and better headline rates.
- **Phase 4:** Stripe via a foreign entity (e.g. a US entity) for international buyers,
  once the platform expands beyond Pakistan.
- Commission and hold logic (§5.6) are implemented entirely in goto5x.com's own
  ledger and are **gateway-agnostic by construction** — switching or adding a gateway
  never touches commission/hold code, only a new Payment Adapter (mirroring the
  Supplier Adapter pattern, §3.5).

### 5.7 Subscription Plans & Billing
- FR-7.1: Tiered plans (e.g. Starter / Growth / Premium) priced in PKR, gating
  features (number of products, template tiers, custom domain, coded-theme mode,
  analytics depth).
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
- FR-8.3: **Commission & hold engine settings** — global commission %, category- and
  seller-level overrides, the default hold duration (21–22 days), and hold-graduation
  thresholds (FR-6.3) are all editable from the admin UI via the Settings Registry.
  Changing a rate affects only *new* ledger entries going forward — existing
  append-only `LedgerEntry` rows are never retroactively rewritten (§5.6, FR-6.4).
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
  Registry entry the hold-release job checks before releasing any pending ledger
  entry for that seller, §12 Risk 6); initiate a refund, recorded as a
  `refund_adjustment` ledger entry.
- FR-8.9: **Immutable audit log** — every control-plane action (settings change,
  lifecycle action, impersonation, refund, template change — not just "admin
  actions" loosely) is recorded with actor, action, target, before-value,
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
  goods before or after going live, with a takedown action; this is a legal-exposure
  control, not optional (§13, Risk 9).

### 5.9 Media Management
- FR-9.1: Seller connects Google Drive via OAuth to bulk-import product images/video.
- FR-9.2: Imported media is copied into platform object storage/CDN for storefront
  delivery — Drive is a source, not the runtime dependency.

### 5.10 Notifications
- FR-10.1: Email notifications for order/payout/listing events at launch; SMS/WhatsApp
  as a Phase 2+ addition given their relevance in the Pakistani market.

### 5.11 Custom Domain
- FR-11.1: Every store gets a free subdomain (`storename.goto5x.com`) by default.
- FR-11.2: Seller can attach an owned custom domain via CNAME/A-record instructions
  with automated verification and TLS issuance (handled by the reverse proxy layer,
  §2.4, which must support dynamic multi-domain TLS rather than a fixed domain list).

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Storefront pages should target sub-2s first contentful paint via CDN + edge caching of static assets |
| Scalability | Architecture (modular monolith + row-level tenancy + statelessness principle, §3.1) must support scaling to a multi-VPS deployment without an application rewrite — verified module-by-module in §3.6 |
| Security | See §6.5 (expanded) |
| Availability | Automated daily DB backups + point-in-time recovery, stored **off the primary VPS** (separate storage/provider) from day one, with a documented and periodically-tested restore runbook |
| Maintainability | CI/CD pipeline, versioned + backward-compatible migrations, feature flags, staging environment mirroring production, rollback runbook (§3.7) |
| Usability | Non-technical sellers must be able to fully customize a store without support tickets; dashboards must be usable on mobile |
| Cost efficiency | Every recurring third-party dependency justified against a build-in-house alternative (§9) |

### 6.5 Security & Compliance (expanded)
The v0.1 draft under-specified security; this section replaces the single summary row
with concrete, testable controls.

- **Multi-tenant isolation:** enforced at both the application layer (mandatory
  scoping middleware) and the database layer (Postgres RLS as a backstop), with an
  automated cross-tenant-access test suite as a release gate (§3.2).
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
  account (FR-8.11); admin-terminal login is a separate, more scrutinized flow from
  seller/supplier login, and every admin action is captured in the immutable audit
  log (FR-8.8).
- **Rate limiting:** applied specifically to authentication endpoints (login, signup,
  password reset — brute-force/credential-stuffing defense), listing-submission
  endpoints (spam defense), and public storefront/API endpoints (abuse defense) — not
  just a generic blanket statement.
- **Secrets management:** payment-gateway keys, supplier API credentials, and Google
  Drive OAuth secrets are stored in an encrypted secrets store (not plain environment
  files committed anywhere), with per-environment (dev/staging/prod) separation.
- **PII handling:** buyer PII (address, phone, order contents) is excluded from
  application logs by default (redaction at the logging layer); access to raw PII in
  the database is limited to the roles that functionally need it.
- **Dependency hygiene:** automated dependency vulnerability scanning runs in CI, not
  as an ad hoc manual task.
- **Content/legal risk:** listing moderation (FR-8.10) exists specifically to reduce
  marketplace liability for counterfeit or prohibited goods sold through supplier
  listings.

---

## 7. External Interface Requirements

### 7.1 User-Facing Applications
- **goto5x.com public site** — marketing/signup, premium visual bar (§5.0).
- **Storefront** — public, per-tenant, template-rendered site.
- **Seller Dashboard** — authenticated app for store owners.
- **Supplier Portal** — authenticated app for suppliers.
- **Admin Terminal** — authenticated, restricted app for platform staff, MFA-mandatory.

### 7.2 Third-Party Integrations
Payment gateways (Safepay first, then PayFast PK / direct JazzCash-Easypaisa, then
Stripe via foreign entity) · Supplier APIs (Printify, then CJ Dropshipping, adapter
interface for future suppliers) · Google Drive API · Transactional email provider ·
DNS/domain verification · (Phase 2+) SMS/WhatsApp Business API.

---

## 8. High-Level Data Model (core entities)

`User, Seller, Store, Theme/Template, StoreThemeSettings, Product, ProductVariant,
Category, Supplier, SupplierListing, StoreSupplierLink, Order, OrderItem,
TrackingUpdate, Payment, LedgerEntry, Payout, Plan, Subscription, MediaAsset,
Domain, SettingsDefinition, SettingsValue, AdminUser, AdminAuditLog,
AdminImpersonationSession, OrderFlag, Announcement`

`SettingsDefinition`/`SettingsValue` are the Settings Registry (§3.8) — they supersede
a standalone `FeatureFlag` table; a feature flag is simply a boolean-typed, scoped
setting, not a separate mechanism.

Every tenant-scoped table (`Store, Product, Order, MediaAsset, ...`) carries
`store_id` and is protected by RLS (§3.2). `LedgerEntry` is append-only and is the
single source of truth for seller balances — `available_balance` is a computed sum,
never a directly-edited field. Full column-level schema is the subject of a dedicated
deliverable (`docs/database-schema.md`).

---

## 9. Build vs. Buy Decisions

| Component | Decision | Reasoning |
|---|---|---|
| Payment processing | **Buy** (Safepay, then additional gateways) | PCI compliance and fraud liability make in-house processing a non-starter; commission/hold logic stays custom on top |
| Store builder / theme engine | **Build** | Core product differentiator — cannot be a wrapper around a third-party tool |
| Drag-and-drop customizer | **Build**, deliberately scoped small at first (§13 MVP) | Core IP; a full visual page builder is a multi-year problem — Phase 1 ships a bounded set of customizable tokens, not a Shopify-scale editor |
| Coded-theme escape hatch | **Build (lightweight)** | Template override mechanism, not a full IDE — reuses the same rendering pipeline as the visual customizer |
| AI image/content generation | **Buy (API-based)** initially | Use existing model APIs rather than training/hosting models — revisit in-house only at meaningful scale |
| Analytics | **Build (lightweight)** | Avoid per-event SaaS pricing that scales badly with store count |
| Transactional email | **Buy (managed service)** | Deliverability is a specialized problem not worth solving in-house |
| Search | **Build on Postgres first** | Defer a dedicated search engine until catalog scale requires it |
| Identity/Auth | **Build (lightweight library, not per-MAU SaaS)** | A hosted per-user-priced auth service (Auth0/Clerk-style) becomes expensive fast at marketplace-scale buyer counts; a well-scoped self-hosted auth module keeps unit economics sane and satisfies the SSO hook (§3.2a) |
| Admin control plane / config management | **Build (generic Settings Registry, §3.8)** | A scoped key-value settings table costs nothing extra to run (same Postgres + same Redis already budgeted) and is the single highest-leverage decision for a solo-founder-operated platform — it is the difference between "edit a value" and "wait for a deploy" for nearly every operational lever in §5.8 |

---

## 10. Phased Roadmap (solo-founder pacing)

Re-scoped for a solo founder + AI build team: each phase below is itself broken into
small, independently shippable increments rather than one large release — see
`docs/mvp-v1-cutlist.md` for the exact v1.0 boundary.

- **Phase 0 (current):** SRS finalized, architecture decisions locked, tech stack
  chosen, database schema designed.
- **Phase 1 — v1.0 MVP:** goto5x.com's own site, store builder with a small set of
  premium templates, basic customizer, product catalog, ONE supplier integration
  (Printify) proving the adapter interface end-to-end, checkout via Safepay + COD,
  order management, commission + ledger + fixed hold, custom domain, Google Drive
  import, core admin terminal.
- **Phase 1.1:** CJ Dropshipping adapter (proves the interface is generic), self-serve
  supplier registration + full multi-store dashboard, listing moderation queue, hold
  graduation logic.
- **Phase 2:** Tiered subscription billing, coded-theme escape hatch, dispute workflow,
  SMS/WhatsApp notifications, second payment gateway.
- **Phase 3:** Advanced theme customizer (animation presets, AI-assisted design),
  deeper analytics, admin sub-roles/seller staff accounts.
- **Phase 4:** Multi-VPS scale-out, international payment gateways, social-media SaaS
  SSO integration, mobile apps.

---

## 11. Payment Gateway Research Summary (resolves prior open question)

| Option | Verdict for Phase 1 |
|---|---|
| **Safepay** | **Chosen as primary.** YC-backed, modern API, explicitly startup/SME-friendly onboarding, no setup fees, supports individual/sole-proprietor accounts (with stricter limits), unifies cards + mobile wallets + Raast under one integration. |
| **Cash on Delivery** | **Chosen, parallel to Safepay.** Extremely common buyer preference in Pakistan; removes dependency on any single gateway's approval timeline for launch. |
| **PayFast PK** | Deferred to Phase 1.x. Reputable and PCI-DSS compliant, but onboarding is described as "enterprise-paced" with heavier documentation/notarization requirements — not the fastest path to a solo founder's first live payment. |
| **Direct JazzCash / Easypaisa merchant APIs** | Deferred to Phase 1.x/2. Requires a direct merchant agreement with the telco/bank (registered company, settlement account), lower-level integration (manual request signing) — better economics at volume, not the fastest Phase 1 path. |
| **Stripe (via foreign entity)** | Deferred to Phase 4. Stripe does not onboard Pakistani entities directly; would require a foreign (e.g. US) entity — relevant only once the platform serves international buyers. |

---

## 12. Risk Register (ranked)

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Solo founder + AI capacity vs. Shopify-class scope** — over-scoping stalls or burns out the build | Hard MVP cut-list (`docs/mvp-v1-cutlist.md`), phase-gated roadmap (§10), no feature enters v1.0 without another leaving it |
| 2 | **Payment gateway access as an individual/new entity blocks launch** | Safepay chosen specifically for fast sole-proprietor onboarding + COD as a parallel path that needs no gateway approval at all (§5.6a) |
| 3 | **Cross-tenant data leakage** (row-level tenancy bug exposes seller A's data to seller B) | Mandatory scoping middleware + Postgres RLS backstop + release-gating cross-tenant test suite (§3.2, §6.5) |
| 4 | **Ledger/commission bugs cause silent financial loss or seller distrust** | Append-only ledger, no destructive balance edits, daily reconciliation job against gateway settlement reports (FR-6.4, FR-6.6) |
| 5 | **Single VPS is a single point of failure** | Off-box automated backups + tested restore runbook from day 1 (§6, Availability row) |
| 6 | **Fraud via new-seller hold bypass** (fake accounts cashing out before the 22-day hold) | Per-transaction (not account-level) hold, identity verification gating hold graduation, velocity limits on new accounts (FR-6.2, FR-6.3) |
| 7 | **Supplier API fragility/change** (Printify/CJ API changes or rate limits break live stores) | Adapter interface isolates blast radius to one adapter; cached last-known catalog degrades gracefully instead of breaking (§3.5, FR-4.3) |
| 8 | **Regulatory/legal exposure** (counterfeit goods, buyer data protection, Pakistani e-commerce/tax rules) | Listing moderation queue (FR-8.13); legal consultation on SECP/PECA/data-protection obligations tracked as an explicit open item before commission-based payments go fully live |
| 9 | **"AI/premium 3D template" scope creep** stalls Phase 1 chasing a generative-design problem that isn't solved | Phase 1 templates are hand-built to a high visual bar (FR-1.1); actual generative AI tooling deferred to Phase 3 (FR-1.7) |
| 10 | **Over-building the theme engine/customizer** (a multi-year problem for a small team) | Phase 1 customizer is deliberately scoped to a bounded token set, not a full visual page builder (§9); expand only after MVP validates demand |
| 11 | **A bad admin config value breaks the platform** (e.g. commission set to 105%, or the wrong seller's payouts frozen) — the Control Plane (§5.8) makes changes instant, which cuts both ways | `settings_definitions` enforces a validation rule per key (range/type) rejected before it reaches the database; every change is audit-logged with before/after values (FR-8.9) so a bad edit is both hard to make and fast to spot and revert |

---

## 13. Open Questions / Decisions Needed (remaining)

1. **Legal entity:** confirm timeline for registering a business entity — needed for
   Phase 1.x gateways (PayFast/direct JazzCash-Easypaisa) and for hold-graduation
   identity verification (FR-6.3), even though Safepay + COD can launch without it.
2. **Regulatory review:** SECP/PECA/data-protection obligations for a Pakistani
   e-commerce marketplace handling buyer PII and commission-based payments — needs a
   legal consult before Phase 1.1 (Risk 8).
3. **Branding assets** (logo, final visual direction beyond the horizonx.so reference)
   — needed before the Theme Engine's first templates and the platform's own site
   (FR-0.1) are designed.
4. **Hold graduation thresholds** — exact number of completed orders / verification
   criteria for FR-6.3 needs a founder decision once real transaction data exists to
   calibrate against (a placeholder default should not become the permanent rule
   without revisiting it).

---

*This is a living document — update it as decisions in §13 are resolved and as each
phase is scoped in detail. Companion deliverables: `docs/tech-stack.md`,
`docs/database-schema.md`, `docs/architecture.md`, `docs/mvp-v1-cutlist.md`.*
