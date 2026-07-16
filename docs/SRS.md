# goto5x.com — Software Requirements Specification (SRS)

**Version:** 0.5 (Draft — final pre-build revision, post Shopify-parity + business-model review)
**Date:** 2026-07-16
**Status:** Discussion draft — v0.4 approved as foundation; this revision adds commerce
feature parity, pricing/plan mechanisms, and business guard-rails before build starts

**Changelog v0.1 → v0.2, v0.2 → v0.3, v0.3 → v0.4:** see prior changelog entries in
git history of this file — summarized: multi-tenant architecture + security hardening
(v0.2), Admin Control Plane / Settings Registry (v0.3), prepaid-only launch + Payout &
Disbursement Engine + supplier transparency + shipping + discounts + self-host-first +
Acceptance Checklists + legal pages (v0.4).

**Changelog v0.4 → v0.5 (Shopify feature-parity + business-model review):**
- **16 new v1.0 commerce features** (§5.13–§5.21): Customers/CRM, product reviews,
  cart persistence + abandoned-cart flagging, storefront discovery (collections,
  search/filters, navigation editor, announcement bar, coming-soon/password mode,
  SEO structured data, WhatsApp button), manual/draft orders, order notes/tags/
  timeline + editing, CSV import/export (Shopify-compatible mapping), self-hosted
  PDF receipts/invoices, basic tax settings, seller onboarding wizard.
- **7 v1.1 features documented ahead of time** (§5.22): optional buyer accounts,
  abandoned-cart recovery emails, returns/refunds workflow, per-store content pages
  + blog, support/ticket system, referral program, low-stock alerts + newsletter
  capture.
- **Pricing & plan mechanism** (§5.7 expanded): a first-class Free Plan, inverse
  commission laddering, a simple upgrade/downgrade rule, yearly billing with
  discount, and launch-campaign pricing — all mechanisms in the SRS; actual prices
  remain founder-set data in the plan editor, never hard-coded.
- **Business Guard-Rails** (§5.23, new): free-plan enforcement, dormant-store
  lifecycle automation, a binding "no trial of paid features" principle, a
  unit-economics admin dashboard, and velocity/abuse limits.
- **Phase 2+ roadmap items recorded:** RTL/Urdu storefront support (with an
  i18n-readiness architecture principle, §3.9, binding from v1.0 so RTL is content
  work later, not a rewrite); Markaz as a named supplier-adapter research item
  (§5.4, FR-4.10); a documented template-marketplace integration hook for the
  founder's separate future SaaS (§5.1, FR-1.8).
- **Cross-cutting NFR added:** buyer-facing "luxury" polish (storefront, receipts,
  order-status page, transactional emails) held to the same premium bar as the
  marketing site (§6).
- **§14 Acceptance Checklists extended** for every new module, including
  tenant-isolation tests where tenant-scoped.
- **Timeline risk flagged, not unilaterally resolved** (§12, Risks 15–18): four of
  the sixteen new v1.0 features carry real risk of extending the solo-founder
  timeline; documented for the founder's final cut decision, not pre-cut here.

---

## 1. Introduction

### 1.1 Purpose
This document defines the requirements for **goto5x.com**, a multi-tenant e-commerce
platform (Shopify-class) that lets sellers launch premium-designed online stores,
connects them to dropshipping suppliers, and gives sellers deep control over store
design and operations through an advanced dashboard. It is the reference point for
all architecture and build decisions going forward — every phase of the product
should trace back to a requirement in this document, and every module has an
Acceptance Checklist (§14) that gates when it is considered done.

### 1.2 Scope
In scope for goto5x.com (this SRS) — v0.5 adds commerce-parity features (customers,
reviews, carts, discovery/merchandising, manual orders, order management, data
portability, receipts/tax, onboarding) and business-model mechanisms (free plan,
commission laddering, guard-rails) on top of the v0.4 foundation: the platform's own
premium site; the multi-tenant store builder; the seller dashboard; the supplier
portal and adapter-based dropshipping integrations; the payments, commission, hold,
reserve, and payout/disbursement engine; the admin Control Plane; and custom domain
attachment. Full detail is in §5.

Explicitly **out of scope** for this SRS (separate products), each with a documented
integration hook so goto5x.com doesn't have to be rewritten to connect to them later:
- **Social media scheduling/management SaaS** — SSO hook via the Auth module (§3.2a).
- **Template marketplace** — a documented template-install API hook (§5.1, FR-1.8);
  the marketplace itself is a separate future SaaS by the founder.

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
| VPS | Virtual Private Server |
| RLS | Row-Level Security (Postgres feature enforcing tenant scoping at the DB level) |

### 1.4 Vision Statement
Be the cheaper, Pakistan-first entry point into e-commerce for sellers who want a
**premium-feeling store** (advanced visuals, animation, AI-assisted design) without
Shopify's cost or complexity — with genuine day-one commerce feature parity
(customers, reviews, discounts, manual orders, receipts), built-in access to dropship
suppliers, a control panel simple enough that non-technical sellers can run a
professional-looking store, and a free tier that is complete, not a ticking trial.

---

## 2. Overall Description

### 2.1 Product Perspective
Direct competitor: **Shopify**. Differentiation strategy:
1. **Cheaper entry plans**, including a genuinely usable **Free Plan** (§5.7, FR-7.3)
   — Pakistan-first pricing.
2. **Premium visual templates** as a standard offering — the aesthetic of
   horizonx.so, with the same bar applied to buyer-facing surfaces beyond the
   storefront (receipts, order-status pages, emails — §6) as well as goto5x.com's
   own marketing site.
3. **Built-in supplier network** with buyer-facing delivery transparency (§5.4).
4. **Genuine commerce parity from day one** — customers, reviews, carts, discovery/
   merchandising, manual orders, CSV data portability, receipts/tax — so switching
   from Shopify (or starting fresh) doesn't mean giving up features sellers expect.
5. **Simple, advanced control panel** with an admin-side Control Plane and
   Business Guard-Rails (§5.23) that protect the platform's own unit economics as it
   grows.

### 2.2 Product Functions (high level)
- Store creation, premium template selection, and storefront discovery (collections,
  search, navigation, announcement bar, coming-soon mode)
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

### 2.3 User Classes and Characteristics
| Role | Description |
|---|---|
| **Buyer** | Shops on a seller's storefront; needs no account (v1.0) — order status via a secure emailed link (FR-5.4); optional accounts are v1.1 (FR-22.1) |
| **Seller** | Owns a store; manages catalog, design, discovery, customers, orders (including manual/phone orders), shipping, discounts, tax, and payouts |
| **Supplier** | Lists products for one or more sellers; fulfills orders and provides tracking |
| **Platform Admin** | goto5x.com staff; manages sellers, suppliers, commissions/plans, payouts, disputes, platform health, content pages, and business guard-rails |

### 2.4 Operating Environment
Unchanged from v0.4: single VPS at Phase 1 (app, DB, Redis, MinIO, worker, same-VPS
staging stack), scaling out per §3.6 as load grows. Every new feature in this
revision is plain application code and Postgres tables — **none of it changes the
Phase 1 operating environment or adds infrastructure.**

### 2.5 Design & Implementation Constraints
Unchanged from v0.4 (self-host-first, Pakistan-first payments, solo-founder pacing),
plus:
- **i18n-readiness (binding, new in v0.5, §3.9):** no template or dashboard string is
  hard-coded outside a translation-key layer, and all number/currency/date
  formatting is locale-aware from v1.0 — even though only one locale (English)
  ships at launch — specifically so RTL/Urdu (§10, Phase 2+) is a content and CSS-
  direction task later, not an architecture rewrite.
- **No trial-of-paid-features (binding, new in v0.5, §5.23):** the Free Plan is a
  permanent, complete-but-limited tier, never a time-boxed trial of paid capability.

### 2.6 Assumptions & Dependencies
Unchanged from v0.4, plus: Markaz's public API availability (§5.4, FR-4.10) is an
open research item, not yet confirmed viable.

---

## 3. System Architecture Overview

*(§3.1 through §3.8 unchanged from v0.4 — modular monolith, statelessness principle,
row-level tenancy + RLS backstop, Auth/SSO hook, Postgres+Redis+self-hosted-MinIO
storage layer, BullMQ background processing, the Supplier/Payment/Disbursement
Adapter pattern, the four-phase scaling path, release/versioning + same-VPS staging,
and the Settings Registry. See `docs/database-schema.md` and `docs/architecture.md`
for the full detail; only the addition below is new in v0.5.)*

### 3.9 Internationalization Readiness (binding, new in v0.5)
Every v1.0 feature in this revision is built with the following non-negotiable
rules, specifically so that RTL/Urdu storefront support (§10, Phase 2+, item 24) is
**content and CSS-direction work later, not an architecture change now**:
- No UI copy (storefront, dashboard, emails, receipts) is hard-coded inline in
  template/component code — every string is sourced through a translation-key
  layer, even though v1.0 ships exactly one locale (English).
- All number, currency, and date formatting goes through a locale-aware formatting
  utility, never manual string concatenation (e.g. `"Rs. " + amount`) — this also
  directly serves the Currency Strategy (`docs/database-schema.md`) already in place.
- Storefront CSS is written so that a direction switch (`dir="rtl"`) re-flows layout
  correctly — this costs nothing extra when using standard logical CSS properties
  (`margin-inline-start` instead of `margin-left`, etc.) and is a discipline, not new
  infrastructure.
- This is a code-review-blocking rule from the first commit, the same way the
  statelessness principle (§3.1) is — not an aspiration to revisit later.

---

## 4. User Roles & Permissions (summary)

Unchanged from v0.4 — see prior version. New in v0.5: a Buyer's optional account
(v1.1, FR-22.1) will hold the same "own-data-only" access rule as every other role;
Seller permissions now explicitly include customer records, reviews moderation,
manual order creation, CSV import/export, and tax/onboarding settings — all scoped
to that seller's own store(s) exactly like every other tenant-scoped capability.

---

## 5. Functional Requirements

*(§5.0 through §5.12 are unchanged from v0.4 — Platform's Own Site, Store Builder &
Theme Engine, Seller Admin Dashboard, Supplier Portal, Dropshipping Integrations,
Order & Fulfillment Management, Payments/Commission/Ledger, Payment Gateway
Strategy, Payout & Disbursement Engine, Content Pages — with the additions below.)*

### 5.1 Store Builder & Theme Engine — additions
- FR-1.8: **Template marketplace integration hook (new)** — the founder's separate
  future template-marketplace SaaS needs only a documented integration point from
  goto5x.com: a template-install API that accepts a template package/reference and
  registers it into the `themes` catalog (§8). goto5x.com does not build the
  marketplace itself — this mirrors the social-SaaS SSO hook (§1.2, §3.2a): a
  contract, not a merge.

### 5.4 Dropshipping Supplier Integrations — addition
- FR-4.10: **Markaz — named research item (new, Phase 2+ roadmap)** — Markaz (a
  Pakistani dropship supplier) is recorded as a candidate for the Supplier Adapter
  interface (§3.5), exactly like Printify/CJ. Before committing build time: verify
  public API availability and stability. If viable, it is added as a standard
  adapter with zero core-platform changes (§3.5); if not, it stays a research note.
  AliExpress/Alibaba remain future adapter candidates under the same evaluate-first
  discipline (FR-4.4).

### 5.5 Order & Fulfillment Management — additions
*(FR-5.1–FR-5.6 unchanged from v0.4 — see prior version.)*

### 5.7 Subscription Plans, Pricing & Billing (expanded in v0.5)
- FR-7.1: Tiered plans (e.g. Free / Starter / Growth / Premium) priced in the
  platform's configured currency (PKR at launch), gating features (product count,
  storage, template tiers, custom domain, coded-theme mode, analytics depth) via the
  Settings Registry, exactly as in v0.4.
- FR-7.2: Recurring billing cycle with invoicing and dunning (failed-payment retry)
  for paid plans.
- FR-7.3: **Free Plan (new, first-class)** — a plan tier with **no billing cycle**
  (a subscription state without payment), bounded by tight Settings-Registry-tunable
  limits: product count, storage quota, access to the base template tier only, no
  custom domain, and one store per verified identity. The Free Plan carries a
  **higher default commission %** than paid plans (admin-configurable per FR-7.4) —
  this, not a feature ceiling alone, is how the platform earns from free usage.
- FR-7.4: **Inverse commission laddering (new)** — the plan editor (FR-8.2) exposes
  a per-plan commission-rate override such that higher-tier plans carry a **lower**
  commission than the Free Plan, using the same Settings Registry mechanism already
  defined for per-plan/per-seller/per-category overrides (FR-6.1, FR-8.3) — this is
  a data configuration on existing infrastructure, not new code per plan.
- FR-7.5: **Plan change flow (v1.0 simple rule)** — a plan upgrade or downgrade
  takes effect at the start of the seller's **next billing cycle**; there is no
  prorated mid-cycle billing in v1.0 (proration is a Phase 2 item, §10).
- FR-7.6: **Yearly billing option** — the plan editor supports an annual billing
  interval alongside monthly, with an admin-configurable discount for the yearly
  price relative to twelve months at the monthly rate (a plain data field in the
  plan editor, FR-8.2 — not a separate pricing engine).
- FR-7.7: **Launch-campaign pricing (new)** — time-limited or first-N-sellers
  promotional pricing/commission rates, expressed as Settings Registry entries with
  an optional expiry timestamp or a counter condition (e.g. "first 100 sellers get
  X"), so admin can start and stop a campaign as a config change, no deploy.

### 5.13 Customers (CRM) — new in v0.5
- FR-13.1: A **customer record** is automatically created (or matched by email) in a
  per-store `customers` table the first time a buyer checks out at that store —
  name, email, phone, order count, and total spent are tracked and updated on every
  subsequent order from the same email.
- FR-13.2: Seller dashboard customer list (searchable, sortable by total spent/order
  count) and a per-customer detail view showing their order history at that store.
- FR-13.3: Customer records are tenant-scoped exactly like every other store table —
  a seller never sees another seller's customers, even for the same buyer email
  (§14.13).

### 5.14 Product Reviews & Ratings — new in v0.5
- FR-14.1: A buyer can submit a review (rating 1–5, text) against a product they
  purchased, identified via the order-status link (FR-5.4) rather than an account.
- FR-14.2: A review is flagged `verified_purchase` when it is linked to a real order
  for that product at that store; unverified submissions (e.g. from a product-page
  form with no order reference) are allowed but shown as unverified, never hidden as
  spam by default.
- FR-14.3: A seller **moderates** reviews for their own store — approve or hide —
  before a review counts toward the product's displayed average rating; no review
  publishes automatically.
- FR-14.4: A product's average rating and review count are shown on its storefront
  page, recomputed whenever a review's moderation status changes (denormalized for
  page-load speed, §8/`docs/database-schema.md` — this is the highest-traffic read
  path a review touches).

### 5.15 Cart Persistence & Abandoned Carts — new in v0.5
- FR-15.1: A shopping cart is persisted to the database **once a buyer's email is
  captured** (at whatever point in checkout the storefront collects it) — carts
  before that point are client-side/anonymous and not tracked server-side.
- FR-15.2: A scheduled job flags a captured-email cart as `abandoned` once it has
  been inactive (no further checkout progress) beyond a configurable window
  (`cart.abandoned_after_hours`, Settings Registry) — **v1.0 ships the flagging
  mechanism and the underlying table only; recovery emails are v1.1** (§5.22,
  FR-22.2), so this data exists and is usable the moment recovery emails are built,
  with no schema change.

### 5.16 Storefront Discovery & Merchandising — new in v0.5
- FR-16.1: **Collections** — a seller defines named product groupings (distinct
  from the admin-managed global `categories`, §8) rendered as storefront sections
  (e.g. a homepage "Summer Picks" block); a product can belong to multiple
  collections.
- FR-16.2: **Storefront search & filters** — in-store product search via Postgres
  full-text search, plus filtering by price range, category, and collection.
- FR-16.3: **Navigation editor** — a seller edits header and footer menus, each
  entry linking to a collection, a content page (§5.12), or an external URL.
- FR-16.4: **Announcement bar** — a dismissible or persistent banner, configured as
  a Theme Engine customizer setting (text + on/off), not a separate content system.
- FR-16.5: **Coming-soon / password-protected mode** — a store owner can gate the
  entire storefront behind a "coming soon" page or a shared password before public
  launch.
- FR-16.6: **SEO structured data** — schema.org `Product` JSON-LD markup, OpenGraph
  tags, and an auto-generated `sitemap.xml` + `robots.txt` per store, built from
  data the catalog already holds (no new data entry required of the seller).
- FR-16.7: **WhatsApp chat/order button** — a seller sets a WhatsApp number and
  toggles a floating chat/order button on their storefront.

### 5.17 Manual/Draft Orders & Order Management Enhancements — new in v0.5
- FR-17.1: **Manual/draft orders** — a seller creates an order directly from the
  dashboard (critical for phone/WhatsApp selling, common in Pakistan), choosing
  either to generate a **payment link** (a hosted Safepay checkout link tied to that
  order, using the existing Payment Adapter, FR-6.1's commission logic applies
  identically) or to **mark it paid directly** (recorded via a `manual`-type payment
  entry, still producing the correct ledger entries — commission is still deducted;
  a manual order is not a way to avoid commission).
- FR-17.2: **Order notes** — free-text, seller/admin-only notes on an order, never
  shown to the buyer.
- FR-17.3: **Order tags** — free-form labels a seller can filter the order dashboard
  by (e.g. `gift`, `priority`).
- FR-17.4: **Order timeline** — an append-only, per-order activity log (status
  changes, notes added, edits made, tracking uploaded) rendered chronologically in
  both the seller dashboard and (for admin) the platform's records.
- FR-17.5: **Basic order editing** — an order's line items, shipping, or applied
  discount may be edited only while its status is `pending` or `confirmed` (never
  after `shipped`). An edit that changes the total after a ledger entry already
  exists produces a **compensating ledger entry** (never a rewrite of the original,
  preserving the append-only guarantee, FR-6.4) and appends a timeline event (FR-17.4).

### 5.18 Data Portability (CSV Import/Export) — new in v0.5
- FR-18.1: **Bulk product import** via CSV, including a field mapping compatible
  with a standard **Shopify product-export CSV** (Handle, Title, Variant SKU,
  Variant Price, Option1/2/3 Name/Value, Image Src, etc.) — this is explicitly
  strategic: switching from Shopify to goto5x.com must not require re-keying a
  catalog by hand.
- FR-18.2: Import runs as a **background job** (existing BullMQ infrastructure,
  §3.4), not a synchronous request, with a per-row error log a seller can review and
  fix rather than an all-or-nothing failure.
- FR-18.3: **Product and order CSV export**, for the seller's own records or to move
  to another platform — exporting a seller's own data is treated as a right, not a
  retention lever.

### 5.19 Receipts, Invoices & Tax — new in v0.5
- FR-19.1: **Self-hosted PDF invoice/receipt generation** (no paid invoicing
  service, per the self-host-first principle, §9) — a branded, downloadable PDF
  (seller logo, currency, tax line) is attached to the order-confirmation email and
  available from the buyer order-status page (FR-5.4).
- FR-19.2: The **invoice's visual design is held to the same premium bar** as the
  rest of the buyer-facing experience (§6, cross-cutting NFR) — this is stated
  explicitly because a plain, unstyled PDF would undercut the platform's core
  positioning at the exact moment (post-purchase) a buyer forms their lasting
  impression of the seller's store.
- FR-19.3: **Basic tax settings** — a seller sets a per-store tax rate and whether
  displayed prices are tax-inclusive or tax-exclusive; the applicable tax amount is
  computed at checkout and itemized as its own line on the invoice (pairs with
  FR-19.1). No multi-jurisdiction/tax-table complexity in v1.0 — one rate per store.

### 5.20 Seller Onboarding Wizard — new in v0.5
- FR-20.1: A guided, post-signup checklist walks a new seller through: pick a
  template → set a logo → add a first product → configure a domain (or accept the
  free subdomain) — with visible progress state, so the empty-store drop-off moment
  is addressed structurally rather than left to a seller's own initiative.

### 5.21 v1.1 Roadmap Features (documented ahead of time, new in v0.5)
These are **not** v1.0 scope — documented now so v1.1 work can start immediately
after v1.0 ships, and so v1.0's schema doesn't have to be redesigned to accommodate
them (each note states how it's already schema-ready or what it needs).
- FR-22.1: **Optional buyer accounts** — guest checkout remains the v1.0 default; an
  account layered on top would add order history and saved details. Already
  **schema-ready**: `orders.buyer_id` has been nullable-FK-to-`users` since v0.4
  specifically for this.
- FR-22.2: **Abandoned-cart recovery emails** — sends against the `carts` table's
  `abandoned` flag already shipping in v1.0 (FR-15.2). v1.1 adds only the email
  template and send job.
- FR-22.3: **Returns/refunds seller-side workflow** — a buyer-initiated return
  request, a seller accept/reject action, and completion linked to the existing
  refund/ledger flow (FR-6.5) — a new `return_requests` table, no change to the
  ledger mechanism itself.
- FR-22.4: **Per-store content pages + blog** (for SEO) — mirrors the platform-level
  versioned content-page pattern already built for FR-12.1, just tenant-scoped.
- FR-22.5: **Built-in support/ticket system** (seller ↔ platform admin), self-hosted
  — no third-party helpdesk SaaS, consistent with the self-host-first principle (§9).
- FR-22.6: **Seller referral program** — referral links, conversion tracking, and
  reward parameters (amount, trigger condition) expressed as Settings Registry
  entries so reward terms are a config change, not a deploy.
- FR-22.7: **Low-stock alerts + storefront email-capture (newsletter list)** —
  low-stock alerting is a threshold check against existing `product_variants.stock_quantity`
  (a Settings Registry key, no new table); the newsletter list is a new,
  tenant-scoped, exportable (FR-18.3) subscriber table.

### 5.22 Business Guard-Rails & Platform Economics — new in v0.5
These protect the platform's own unit economics as it grows — every threshold below
is a Settings Registry entry, not a hard-coded constant, per the same reasoning as
every other operational lever in the Control Plane (§3.8).
- FR-23.1: **Free-plan enforcement** — storage quota is metered per store against
  the plan's Settings-Registry-defined limit; the product-count limit is enforced
  **at creation time** (a create request beyond the limit is rejected with a clear
  reason), not merely displayed as a soft warning a seller can ignore.
- FR-23.2: **Dormant-store lifecycle** — a scheduled job (existing BullMQ
  infrastructure) flags a free-plan store inactive beyond a configurable threshold
  (`lifecycle.dormant_warning_days`) and sends a warning email; after a further
  configurable period (`lifecycle.dormant_suspend_days`) it is suspended (reusing
  the existing suspend mechanism, FR-8.4/FR-5.3); after a further configurable
  period (`lifecycle.dormant_archive_days`) it is **archived** — a new store status
  distinct from `suspended`: data retained, storefront fully and permanently offline
  until the seller re-engages.
- FR-23.3: **No trial-of-paid-features (binding product principle, §2.5)** — the
  Free Plan is complete and permanently usable within its limits (FR-23.1), never a
  time-boxed trial; a paid-plan-only feature (custom domain, coded-theme mode,
  premium templates, etc.) is inaccessible on the Free Plan regardless of account
  age, enforced by the same plan-scoped Settings Registry checks used everywhere
  else (FR-8.2) — there is no separate "trial expired" code path to build or to
  accidentally leave open.
- FR-23.4: **Unit-economics admin dashboard** — extends the real-time analytics of
  FR-8.10 with: active free-vs-paid store counts, commission earned specifically
  from Free-Plan stores, per-store storage usage, and a monthly platform-cost-vs-
  revenue break-even view where the cost figure is **admin-entered** (a Settings
  Registry value, e.g. `finance.monthly_infra_cost`) rather than computed — the
  platform has no way to know its own VPS bill automatically, so this is
  deliberately a simple manual input compared against automatically-computed
  revenue, not a fully automated FinOps system.
- FR-23.5: **Velocity/abuse limits** — extends the rate limiting already required
  in §6.5 with a per-identity limit on the number of Free-Plan stores one verified
  identity can create, and signup-rate limiting at the auth layer — both
  Settings-Registry-tunable thresholds.

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Storefront pages should target sub-2s first contentful paint via CDN + edge caching of static assets |
| Scalability | Architecture (modular monolith + row-level tenancy + statelessness principle, §3.1) must support scaling to a multi-VPS deployment without an application rewrite — verified module-by-module in §3.6 |
| Security | See §6.5 (expanded, v0.4) |
| Availability | Automated daily DB backups + point-in-time recovery, plus a MinIO data-directory backup, stored **off the primary VPS**, with a documented and periodically-tested restore runbook |
| Maintainability | CI/CD pipeline, versioned + backward-compatible migrations, feature flags, a same-VPS staging environment mirroring production, rollback runbook |
| Usability | Non-technical sellers must be able to fully customize a store without support tickets; dashboards must be usable on mobile |
| Internationalization | No hard-coded UI strings or currency/date formatting outside a translation-key/locale layer, from v1.0 (§3.9) — RTL/Urdu later is content work, not a rewrite |
| **Buyer-facing polish (new in v0.5)** | The storefront, PDF receipts/invoices (FR-19.2), the order-status page, and transactional emails are held to the **same premium visual bar as the marketing site** (§5.0, §13) — "luxury feel" is not confined to the site sellers see before signing up; it extends to every surface a *buyer* sees, since that is what justifies premium pricing for the seller in the first place |
| Cost efficiency | Self-host-first by default (§9); every recurring third-party dependency justified against a self-hosted/build-in-house alternative; **every feature added in v0.5 is plain Postgres tables + application code — none of it adds infrastructure cost** |

*(§6.5 Security & Compliance is unchanged from v0.4 — see prior version — with one
addition: tenant-isolation tests now also cover every new tenant-scoped table listed
in §8, per §14.)*

---

## 7. External Interface Requirements

Unchanged from v0.4, with the Seller Dashboard's scope note extended to include:
customers, reviews moderation, cart/abandoned-cart visibility, discovery/
merchandising settings, manual order creation, CSV import/export, tax settings, and
the onboarding wizard. No new external-facing *application* is introduced — all new
v0.5 capability lives inside the existing four applications (public site, storefront,
seller dashboard, admin terminal) plus the existing supplier portal.

---

## 8. High-Level Data Model (core entities)

Unchanged v0.4 entities (`User, Seller, Store, Theme/Template, StoreThemeSettings,
Product, ProductVariant, Category, StoreShippingSettings, DiscountCode, Supplier,
SupplierAdapterRegistry, SupplierListing, StoreSupplierLink, Order, OrderItem,
TrackingUpdate, Payment, LedgerEntry, Payout, SellerPayoutAccount, Plan,
Subscription, MediaAsset, Domain, ContentPage, ContentPageRevision,
SettingsDefinition, SettingsValue, AdminUser, AdminAuditLog,
AdminImpersonationSession, OrderFlag, Announcement`) **plus, new in v0.5:**

`Customer, ProductReview, Cart, Collection, CollectionProduct,
StoreNavigationMenu, OrderNote, OrderTimelineEvent, ImportJob,
StoreTaxSettings, SellerOnboardingProgress` (all v1.0) and, documented ahead for
v1.1 — `ReturnRequest, StoreContentPage, StoreContentPageRevision, SupportTicket,
SupportTicketMessage, ReferralLink, ReferralConversion, NewsletterSubscriber`.

Every tenant-scoped table among the above (`Customer, ProductReview, Cart,
Collection, StoreNavigationMenu, OrderNote, OrderTimelineEvent, StoreTaxSettings,
NewsletterSubscriber, ...`) carries `store_id` and is protected by RLS (§3.2) —
this is not a special case for "new" tables; the same rule applies uniformly. Full
column-level schema is in `docs/database-schema.md`.

---

## 9. Build vs. Buy Decisions

*(Table unchanged from v0.4 — self-host-first principle remains binding — with two
additions:)*

| Component | Decision | Reasoning |
|---|---|---|
| PDF generation (receipts/invoices) | **Build (self-hosted)** | Self-host-first principle — a self-hosted PDF renderer (e.g. a headless-browser-based generator run as a worker job) costs nothing beyond compute already on the VPS; a paid invoicing SaaS is not justified for a templated PDF |
| CSV import/export processing | **Build** | Runs as a background job on existing BullMQ infrastructure (§3.4) — no new service; the Shopify-compatible field mapping (FR-18.1) is a maintained code artifact, not a licensed tool |

---

## 10. Phased Roadmap (solo-founder pacing)

Restructured in v0.5 to match sections A/B/C of the founder+advisor review exactly —
each phase is still broken into small, independently shippable increments, and no
module starts until the previous module's Acceptance Checklist (§14) is verified.
See `docs/mvp-v1-cutlist.md` for the founder's final IN/OUT call, including the
timeline-risk flags in §12.

- **Phase 0 (current):** SRS finalized, architecture decisions locked, tech stack
  chosen, database schema designed.
- **Phase 1 — v1.0 MVP (Section A features):** everything in the v0.4 MVP (store
  builder, Printify integration with transparency, Safepay-only checkout, shipping,
  discounts, payout/disbursement engine, admin Control Plane, legal pages) **plus**:
  Customers/CRM, product reviews, cart persistence + abandoned-cart flagging,
  storefront discovery & merchandising (collections, search/filters, navigation,
  announcement bar, coming-soon mode, SEO structured data, WhatsApp button),
  manual/draft orders, order notes/tags/timeline + editing, CSV import/export,
  self-hosted PDF receipts + tax settings, seller onboarding wizard, the Free Plan +
  inverse commission laddering + yearly billing + launch-campaign pricing, and the
  Business Guard-Rails. See §12 Risks 15–18 for which of these the founder should
  weigh most carefully against the timeline.
- **Phase 1.1 (Section B features + v0.4 carryover):** CJ Dropshipping adapter,
  self-serve supplier registration + full multi-store dashboard, listing moderation
  queue, hold graduation logic, scheduled payout mode, API-based disbursement
  adapter, optional buyer accounts, abandoned-cart recovery emails, returns/refunds
  workflow, per-store content pages + blog, support/ticket system, referral
  program, low-stock alerts + newsletter capture.
- **Phase 2:** Tiered plan proration, coded-theme escape hatch, dispute workflow,
  SMS/WhatsApp notifications, second payment gateway, gated per-seller COD,
  shipping zones/weight-based rates, advanced discounts (auto-apply, BOGO,
  scheduled sales).
- **Phase 3:** Advanced theme customizer (animation presets, AI-assisted design),
  deeper analytics, admin sub-roles/seller staff accounts.
- **Phase 4 (Section C features):** Multi-VPS scale-out, international payment
  gateways, social-media SaaS SSO integration, mobile apps, **RTL/Urdu storefront
  support** (content work only, per the i18n-readiness principle, §3.9),
  **Markaz supplier-adapter evaluation** (§5.4, FR-4.10, pending API verification),
  and the **template-marketplace integration** (§5.1, FR-1.8, once the founder's
  separate marketplace SaaS exists to call it).

---

## 11. Payment Gateway Research Summary

Unchanged from v0.4 — see prior version.

---

## 12. Risk Register (ranked)

*(Risks 1–14 unchanged from v0.4 — see prior version — with four new risks added
below, specifically answering the founder's request to flag anything in the v0.5
commerce-feature set that genuinely endangers the v1.0 timeline.)*

| # | Risk | Mitigation |
|---|---|---|
| 15 | **CSV import/export with Shopify-compatible mapping is a bigger project than it sounds** — Shopify's product-export format has real complexity (multi-row variants, option combinations, metafields, image handling), and a shallow "compatible" importer risks being compatible in name only, generating support burden instead of saving it | Scope the v1.0 mapping to the fields that matter most for a straightforward catalog (title, price, variants, images) explicitly, document what's *not* mapped, and treat edge cases (metafields, complex option combinations) as a fast-follow rather than a launch blocker — flagged for the founder's cut decision, not resolved unilaterally here |
| 16 | **Manual/draft orders with a payment-link flow adds a second checkout entry point** that must reconcile with the same commission/ledger logic as normal storefront checkout — real integration surface, not "just a table" | The payment-link path reuses the existing Payment Adapter (§3.5) rather than a parallel implementation; if timeline pressure appears, "mark as paid directly" alone (no generated payment link) is a materially smaller v1.0 slice that still serves the core phone/WhatsApp-selling use case |
| 17 | **Cart persistence timing is a real UX/architecture design question** ("when exactly is a buyer's email captured pre-purchase?"), not a trivial table — getting this wrong couples awkwardly with the checkout flow being built at the same time | Treat FR-15.1's email-capture point as a decision to make explicitly and early (e.g. a single email-first field before payment details) rather than an implementation detail discovered mid-build; the abandoned-cart *flagging* mechanism is cheap once that decision is made — recovery emails are already correctly deferred to v1.1 |
| 18 | **"Luxury" as an explicit bar on self-hosted PDF invoices (FR-19.2) can absorb unbounded design-iteration time** for a solo founder — the same failure mode already flagged as Risk 9 (AI/premium template scope creep), now applied to a new surface | Ship one well-designed, branded invoice template that meets a "clean and professional, not generic" bar for v1.0; treat further "make it feel more premium" iteration as a backlog item explicitly bounded by a time-box, not an open-ended polish pass before launch |

---

## 13. Open Questions / Decisions Needed (remaining)

Unchanged from v0.4 (legal entity, regulatory review, final branding assets, hold-
graduation thresholds, rolling-reserve auto-trigger criteria — see prior version),
plus:
5. **Markaz API viability** (§5.4, FR-4.10) — needs research before any adapter build
   commitment; currently a named roadmap item, not a scoped feature.
6. **Section A timeline risk (§12, Risks 15–18)** — the founder's final cut decision
   on whether all sixteen v0.5 v1.0 features ship together, or whether the four
   flagged items are resequenced into v1.0.x, is the single open item this revision
   was produced to surface, not resolve.

---

## 14. Acceptance Checklists

**Binding process rule (unchanged from v0.4):** no module or phase begins
implementation until the previous module's checklist is **100% verified and
explicitly approved by the founder**. Checklists §14.0–§14.12 are unchanged from
v0.4 (see prior version); the checklists below are new in v0.5, one per new module
in §5.13–§5.23, each following the same "testable, not aspirational" rule and
including tenant-isolation tests wherever the module is tenant-scoped.

### 14.13 Customers (CRM)
- [ ] A checkout auto-creates or matches a `customers` row by email, updating order
      count and total spent correctly on repeat purchases (FR-13.1)
- [ ] Customer list/detail view in the seller dashboard shows correct order history
- [ ] **Tenant isolation:** the same buyer email at two different stores produces
      two separate `customers` rows; seller A's customer list never includes seller
      B's customers, even for an identical email (FR-13.3)

### 14.14 Product Reviews & Ratings
- [ ] A buyer can submit a review via the order-status link without an account
- [ ] A review linked to a real order for that product/store is flagged
      `verified_purchase`; one submitted without an order reference is not
- [ ] A review does not affect the product's displayed average rating until a
      seller approves it (FR-14.3)
- [ ] Average rating/review count update correctly when a review's status changes
      approved ↔ hidden
- [ ] **Tenant isolation:** a seller cannot moderate another store's reviews

### 14.15 Cart Persistence & Abandoned Carts
- [ ] A cart persists to the database only after a buyer's email is captured, not
      before (FR-15.1)
- [ ] The abandoned-cart scheduled job correctly flags a cart inactive beyond the
      configured window, and does not flag one still in progress
- [ ] **Tenant isolation:** a cart is only ever visible to its own store's dashboard

### 14.16 Storefront Discovery & Merchandising
- [ ] A collection renders its assigned products correctly on the storefront (FR-16.1)
- [ ] Search returns relevant results using Postgres full-text search; price/
      category/collection filters narrow results correctly (FR-16.2)
- [ ] Navigation editor changes (header/footer) reflect live on the storefront with
      no deploy (FR-16.3)
- [ ] Announcement bar and coming-soon/password mode toggle correctly from the
      customizer (FR-16.4, FR-16.5)
- [ ] Structured data validates against schema.org's `Product` type; `sitemap.xml`
      and `robots.txt` generate correctly per store (FR-16.6)
- [ ] WhatsApp button appears only when enabled and links to the configured number
      (FR-16.7)
- [ ] **Tenant isolation:** collections, navigation menus, and discovery settings
      for store A never leak into store B's storefront rendering

### 14.17 Manual/Draft Orders & Order Management Enhancements
- [ ] A manual order created from the dashboard produces correct order/order-item
      rows identical in shape to a storefront-originated order (FR-17.1)
- [ ] The generated payment link, when paid, produces the same ledger entries
      (sale_credit, commission_debit) as a normal checkout — commission is not
      bypassed for manual orders
- [ ] "Mark as paid directly" produces a `manual`-type payment row and correct
      ledger entries
- [ ] Order notes are never exposed on any buyer-facing surface (FR-17.2)
- [ ] Order tags filter the dashboard order list correctly (FR-17.3)
- [ ] Every status change, note, and edit appends a timeline event in the correct
      order (FR-17.4)
- [ ] An edit to a `shipped` order is rejected; an edit to a `pending`/`confirmed`
      order that changes the total produces a compensating ledger entry, never a
      rewrite of the original entry (FR-17.5, ledger immutability re-verified)

### 14.18 Data Portability (CSV Import/Export)
- [ ] A Shopify-format product-export CSV imports successfully for the mapped field
      set (FR-18.1), with a documented list of fields intentionally not mapped
- [ ] Import runs as a background job and does not block the dashboard; a bad row
      is logged with a clear error and does not fail the entire import (FR-18.2)
- [ ] Product and order CSV export produce files a seller can re-import elsewhere
      (round-trip tested) (FR-18.3)
- [ ] **Tenant isolation:** an export for store A never includes store B's data

### 14.19 Receipts, Invoices & Tax
- [ ] A PDF invoice generates correctly (seller logo, correct currency, correct tax
      line) and attaches to the order-confirmation email and the order-status page
      (FR-19.1)
- [ ] Invoice visual design meets the premium bar — explicit founder sign-off
      against FR-19.2, the same standard applied to FR-0.1
- [ ] Tax is computed correctly for both tax-inclusive and tax-exclusive store
      settings and itemized correctly on the invoice (FR-19.3)

### 14.20 Seller Onboarding Wizard
- [ ] Progress state persists correctly across sessions (a seller who leaves and
      returns sees their true progress, not a reset) (FR-20.1)
- [ ] Completing all four steps marks onboarding complete and the wizard no longer
      interrupts the dashboard

### 14.21 Subscription Plans, Pricing & Billing (v0.5 additions)
- [ ] Free Plan enforces its limits correctly and carries the correct (higher)
      default commission rate (FR-7.3)
- [ ] A higher-tier plan's commission rate correctly overrides the Free Plan's via
      the Settings Registry precedence rules (FR-7.4)
- [ ] A plan change applied mid-cycle takes effect at the next billing cycle, not
      immediately (FR-7.5)
- [ ] Yearly billing calculates the discounted price correctly against the admin-
      configured discount (FR-7.6)
- [ ] A launch-campaign setting with an expiry or a counter condition stops applying
      correctly once its condition is met (FR-7.7)

### 14.22 Business Guard-Rails & Platform Economics
- [ ] A Free-Plan store's product creation is rejected once its plan's product-count
      limit is reached — not merely warned (FR-23.1)
- [ ] The dormant-store job correctly progresses a test store through warning →
      suspend → archive at the configured thresholds, and not before them (FR-23.2)
- [ ] A paid-plan-only feature is verifiably inaccessible on the Free Plan regardless
      of account age — no "trial expired" code path exists to accidentally leave
      open (FR-23.3)
- [ ] The unit-economics dashboard correctly separates free-vs-paid store counts and
      commission, and the break-even view reflects the admin-entered cost figure
      against computed revenue (FR-23.4)
- [ ] A test identity is correctly blocked from creating more than the configured
      number of Free-Plan stores (FR-23.5)

---

*This is a living document — update it as decisions in §13 are resolved and as each
phase is scoped in detail. Companion deliverables: `docs/tech-stack.md`,
`docs/database-schema.md`, `docs/architecture.md`, `docs/mvp-v1-cutlist.md`,
`docs/legal/` (Terms of Service, Privacy Policy, Refund Policy drafts).*
