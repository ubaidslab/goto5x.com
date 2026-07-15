# goto5x.com — Software Requirements Specification (SRS)

**Version:** 0.1 (Draft)
**Date:** 2026-07-15
**Status:** Discussion draft — for review before Phase 1 build starts

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
- Multi-tenant storefront + store builder (premium templates + customizer)
- Seller admin dashboard (store design, catalog, orders, payouts)
- Supplier portal (listing submission, multi-store order tracking)
- Built-in dropshipping supplier connections (starting with free/low-cost suppliers)
- Payment, commission, and payout (hold) engine
- Platform admin terminal (super admin control panel)
- Custom domain attachment (seller-owned domain + hosting)

Explicitly **out of scope** for this SRS (separate product):
- Social media scheduling/management SaaS — a distinct product, may share auth/billing
  infrastructure later, but is not part of the goto5x.com store platform build.

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

### 1.4 Vision Statement
Be the cheaper, Pakistan-first entry point into e-commerce for sellers who want a
**premium-feeling store** (advanced visuals, animation, AI-assisted design) without
Shopify's cost or complexity — while giving sellers built-in access to dropship
suppliers and a control panel simple enough that non-technical sellers can run a
professional-looking store.

---

## 2. Overall Description

### 2.1 Product Perspective
Direct competitor: **Shopify**. Differentiation strategy:
1. **Cheaper entry plans** targeting budget-conscious sellers (Pakistan-first pricing in PKR).
2. **Premium visual templates** as a standard offering, not a paid add-on — positioned
   like the aesthetic of horizonx.so (advanced motion, 3D-leaning visuals) rather than
   generic themes.
3. **Built-in supplier network** — sellers don't need a separate app/plugin to start
   dropshipping; suppliers are part of the core platform.
4. **Simple, advanced control panel** — sellers get deep design control (colors,
   animations, layout, images) without needing to know code.

### 2.2 Product Functions (high level)
- Store creation and premium template selection
- Visual store customization (design, animation, branding)
- Product catalog and inventory management
- Supplier onboarding, listing submission, and seller-side approval
- Order management with supplier fulfillment + tracking handoff to buyer
- Payments, commission deduction, and payout scheduling
- Platform-wide administration and oversight
- Custom domain + Google Drive media connection per seller

### 2.3 User Classes and Characteristics
| Role | Description |
|---|---|
| **Buyer** | Shops on a seller's storefront; needs no account on goto5x.com core system beyond checkout |
| **Seller** | Owns a store; manages catalog, design, orders, payouts; mostly non-technical |
| **Supplier** | Lists products for one or more sellers; fulfills orders and provides tracking |
| **Platform Admin** | goto5x.com staff; manages sellers, suppliers, commissions, disputes, platform health |

### 2.4 Operating Environment
- **Phase 1:** Single VPS (recommended starting spec: 4–8 vCPU / 16 GB RAM / NVMe SSD),
  Docker-based deployment, Nginx/Traefik as reverse proxy + TLS termination.
- **Phase 2+:** Split into multiple VPS instances (DB server, app server, worker/queue
  server, media/CDN edge) as load grows — see §3.5 Scaling Path.
- OS: Ubuntu LTS. Containerized services orchestrated with Docker Compose initially,
  migrating to a lightweight orchestrator (e.g. Docker Swarm or k3s) only when a single
  VPS is no longer sufficient — full Kubernetes is not justified at Phase 1–2 scale.

### 2.5 Design & Implementation Constraints
- Payments **must** go through a licensed payment processor / gateway partner —
  goto5x.com must never custom-build raw card/payment handling (PCI-DSS liability).
- Budget-conscious build: prefer building in-house over paying recurring SaaS fees
  where the in-house version is a core differentiator (see §9 Build-vs-Buy).
- Must support Pakistan-first payment rails (JazzCash, Easypaisa, bank transfer) from
  Phase 1; international gateways (Stripe) are a later phase.
- Hosting/domain for each storefront is owned and attached by the seller — goto5x.com
  does not resell hosting or act as registrar.

### 2.6 Assumptions & Dependencies
- A registered legal business entity is required before integrating Pakistani payment
  gateways (merchant account prerequisite) — tracked as an open decision (§11).
- Dropship supplier integrations depend on those suppliers exposing usable APIs
  (see §11 — AliExpress has no official public dropship API; CJ Dropshipping and
  Printify do, and are the recommended Phase 1 integration targets).

---

## 3. System Architecture Overview

### 3.1 Architectural Style
**Modular monolith** — one deployable application composed of clearly bounded
modules (Auth, Store/Tenant, Catalog, Orders, Payments, Suppliers, Theme Engine,
Media, Notifications, Admin), each with its own internal boundary (own folder/package,
own DB schema namespace, communicating through defined interfaces — not through
shared global state). This gets Phase 1 to market fast while keeping a clean seam to
extract any module into its own service later without a rewrite.

Microservices are explicitly **not** used at Phase 1 — the operational overhead
(service discovery, distributed tracing, network failure handling) is not justified
until traffic/team size demands it.

### 3.2 Multi-Tenancy Model
Shared database, **row-level tenancy**: every tenant-scoped table carries a
`store_id`. This is simpler and cheaper to operate than schema-per-tenant or
database-per-tenant, and is sufficient until a single store's data volume genuinely
requires isolation — at which point that one store can be migrated out without
affecting the model for everyone else.

### 3.3 Data & Storage Layer
- **Primary DB:** PostgreSQL (relational integrity for orders/payments/inventory).
- **Cache / queues:** Redis (session cache, rate limiting, job queue backend).
- **Object storage:** S3-compatible storage (e.g. Cloudflare R2 — no egress fees) for
  product images/video, served through a CDN. Google Drive is a seller-side **import
  source**, not the primary asset store — storefront performance must not depend on
  Drive's availability or latency.
- **Search:** Postgres full-text search initially; move to a dedicated search engine
  (e.g. Meilisearch) only once catalog scale requires it.

### 3.4 Background Processing
A job queue (Redis + BullMQ or equivalent) handles: payout hold-release scheduling,
supplier order sync, tracking-status polling, notification dispatch, and template
asset processing (image optimization, thumbnailing).

### 3.5 Scaling Path (designed in from day one)
| Phase | Setup |
|---|---|
| 1 | Single VPS: app + DB + Redis + worker, all containerized on one box |
| 2 | Move DB to its own VPS; add a read replica; app stays on original VPS |
| 3 | Separate worker/queue VPS; dedicated media/CDN edge; app servers behind a load balancer (2+ VPS) |
| 4 | Multi-region app servers; DB read replicas per region; extract highest-load modules (e.g. Orders, Catalog) into standalone services |

Because tenancy is row-based and modules are already bounded internally, each phase
transition is an infrastructure change, not an application rewrite.

### 3.6 Release & Versioning Strategy
- Environments: `dev` → `staging` → `production`.
- Database migrations are versioned and reversible (e.g. via a migration tool with
  up/down scripts) — no manual schema edits in production.
- Feature flags gate new functionality so it can be rolled out to a subset of sellers
  before a full release, and rolled back instantly without a deploy.
- Platform releases are semantically versioned (e.g. `v1.2.0`) with a changelog, so
  "bug fixes / updates" the founder mentioned are tracked, reviewable, and revertible.

---

## 4. User Roles & Permissions (summary)

| Role | Key permissions |
|---|---|
| Buyer | Browse, checkout — no platform account required beyond order lookup |
| Seller | Full control of own store(s): design, catalog, orders, payouts, supplier links |
| Supplier | Submit listings, view/fulfill orders across all linked stores, upload tracking |
| Platform Admin | Full oversight: approve/suspend sellers & suppliers, configure commission/plans, resolve disputes, manage template marketplace, view platform analytics |

Fine-grained permission scopes (e.g. seller staff sub-accounts) are a Phase 3+ item.

---

## 5. Functional Requirements

### 5.1 Store Builder & Theme Engine
- FR-1.1: Seller selects from a library of premium templates at store creation.
- FR-1.2: Visual customizer lets seller edit colors, fonts, section layout, images,
  and animation/motion presets without writing code.
- FR-1.3: Live preview of changes before publishing.
- FR-1.4: All templates are mobile-responsive by default.
- FR-1.5: SEO controls per store/page (meta title/description, sitemap, robots.txt).
- FR-1.6 (Phase 2+): AI-assisted content/image suggestions inside the customizer.

### 5.2 Seller Admin Dashboard
- FR-2.1: Product/catalog CRUD, variants, inventory tracking.
- FR-2.2: Order list with status, filtering, and fulfillment actions.
- FR-2.3: Store design panel (entry point to Theme Engine, §5.1).
- FR-2.4: Sales/traffic analytics view.
- FR-2.5: Payout/commission breakdown view (available vs. pending balance).
- FR-2.6: Supplier management — view linked suppliers, review/approve submitted listings.
- FR-2.7: Google Drive connect (OAuth) for bulk media import.
- FR-2.8: Custom domain attachment (DNS instructions + verification status).

### 5.3 Supplier Portal
- FR-3.1: Supplier registration and verification workflow.
- FR-3.2: Supplier submits product listings; each seller reviews and approves before
  it appears in their store (no listing goes live without seller approval).
- FR-3.3: **Multi-store dashboard** — a supplier connected to multiple sellers' stores
  sees all their listings and orders across every connected store in one unified view.
- FR-3.4: Fulfillment workflow per order: `Pending → Confirmed → Shipped (tracking
  added) → Delivered → Completed`. Supplier uploads tracking ID; system relays it to
  the buyer and updates the seller's order checklist automatically.

### 5.4 Dropshipping Supplier Integrations
- FR-4.1 (Phase 1 candidates): CJ Dropshipping and Printify integrations via their
  official partner APIs for product import and order forwarding.
- FR-4.2: Product price/stock sync from supplier catalogs on a scheduled interval.
- FR-4.3: AliExpress integration is deferred — no official dropship API exists;
  revisit via AliExpress's affiliate/open platform terms once legal review is done
  (see §11).

### 5.5 Order & Fulfillment Management
- FR-5.1: Unified order dashboard per seller, spanning both self-fulfilled and
  supplier-fulfilled orders.
- FR-5.2: Automated buyer notification on status change (order confirmed, shipped
  with tracking, delivered).

### 5.6 Payments, Commission & Payout Engine
- FR-6.1: Integrate Pakistani payment rails (JazzCash, Easypaisa, bank transfer) at
  launch; Stripe/international gateways in a later phase.
- FR-6.2: Platform commission of 3% deducted per completed sale (configurable per
  plan/category by admin, not hard-coded).
- FR-6.3: New-seller payout hold: funds from a new seller's first sales are held for
  a configurable period (default 21–22 days) before becoming withdrawable, to absorb
  chargeback/dispute risk.
- FR-6.4: Internal ledger per seller: tracks `pending_balance`, `available_balance`,
  `total_paid_out` — every commission, hold-release, and payout is a ledger entry
  (append-only, auditable), not a mutable balance field.
- FR-6.5: Dispute/refund workflow that can freeze a specific ledger entry without
  affecting the seller's other available funds.

### 5.7 Subscription Plans & Billing
- FR-7.1: Tiered plans (e.g. Starter / Growth / Premium) priced in PKR, gating
  features (number of products, template tiers, custom domain, analytics depth).
- FR-7.2: Recurring billing cycle with invoicing and dunning (failed-payment retry).

### 5.8 Platform Admin Terminal
- FR-8.1: Seller account lifecycle management (approve, suspend, ban) with audit trail.
- FR-8.2: Supplier verification and management.
- FR-8.3: Global commission and plan configuration (no code deploy needed to change
  a rate).
- FR-8.4: Manual override tools for payout holds and dispute resolution.
- FR-8.5: Template/theme marketplace management (add, update, retire templates).
- FR-8.6: Platform-wide analytics: GMV, active stores, revenue, churn.
- FR-8.7: System health dashboard (queue depth, error rates, VPS resource usage).
- FR-8.8: Immutable audit log of all admin actions.
- FR-8.9: Feature-flag management UI for staged rollouts.

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
  with automated verification and TLS issuance.

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Storefront pages should target sub-2s first contentful paint via CDN + edge caching of static assets |
| Scalability | Architecture (modular monolith + row-level tenancy) must support scaling to a multi-VPS deployment without an application rewrite |
| Security | TLS everywhere; encryption at rest for sensitive fields; RBAC per role; rate limiting on public endpoints; 2FA available for seller/admin accounts; payments never touch raw card data directly (delegated to gateway) |
| Availability | Automated daily DB backups + point-in-time recovery from day one, even on a single VPS |
| Maintainability | CI/CD pipeline, versioned migrations, feature flags, staging environment mirroring production |
| Usability | Non-technical sellers must be able to fully customize a store without support tickets |
| Cost efficiency | Every recurring third-party dependency justified against a build-in-house alternative (§9) |

---

## 7. External Interface Requirements

### 7.1 User-Facing Applications
- **Storefront** — public, per-tenant, template-rendered site.
- **Seller Dashboard** — authenticated app for store owners.
- **Supplier Portal** — authenticated app for suppliers.
- **Admin Terminal** — authenticated, restricted app for platform staff.

### 7.2 Third-Party Integrations
Payment gateways (JazzCash, Easypaisa, bank transfer, later Stripe) · Supplier APIs
(CJ Dropshipping, Printify) · Google Drive API · Transactional email provider ·
DNS/domain verification · (Phase 2+) SMS/WhatsApp Business API.

---

## 8. High-Level Data Model (core entities)

`User, Seller, Store, Theme/Template, Product, ProductVariant, Supplier,
SupplierListing, StoreSupplierLink, Order, OrderItem, TrackingUpdate, Payment,
LedgerEntry, Payout, Plan, Subscription, MediaAsset, AdminAuditLog`

Every tenant-scoped table (`Store, Product, Order, ...`) carries `store_id`.
`LedgerEntry` is append-only and is the single source of truth for seller balances —
`available_balance` is a computed sum, never a directly-edited field.

---

## 9. Build vs. Buy Decisions

| Component | Decision | Reasoning |
|---|---|---|
| Payment processing | **Buy** (licensed gateway) | PCI compliance and fraud liability make in-house processing a non-starter |
| Store builder / theme engine | **Build** | Core product differentiator — cannot be a wrapper around a third-party tool |
| Drag-and-drop customizer | **Build** | Core IP; ties directly into the theme engine |
| AI image/content generation | **Buy (API-based)** initially | Use existing model APIs rather than training/hosting models — revisit in-house only at meaningful scale |
| Analytics | **Build (lightweight)** | Avoid per-event SaaS pricing (e.g. Mixpanel) that scales badly with store count |
| Transactional email | **Buy (managed service)** | Deliverability is a specialized problem not worth solving in-house |
| Search | **Build on Postgres first** | Defer a dedicated search engine until catalog scale requires it |

---

## 10. Phased Roadmap

- **Phase 0 (current):** SRS finalized, architecture decisions locked, tech stack chosen.
- **Phase 1 — MVP:** Store builder with 5–6 premium templates, product catalog, basic
  checkout with 1–2 Pakistani payment gateways, seller dashboard core, admin terminal
  core, subdomain + custom domain support.
- **Phase 2:** Supplier portal, CJ Dropshipping/Printify integration, commission +
  ledger/payout engine, dispute handling.
- **Phase 3:** Advanced theme customizer (animation presets, AI-assisted design),
  analytics depth, multi-store supplier dashboard, SMS/WhatsApp notifications.
- **Phase 4:** Multi-VPS scale-out, international payment gateways, social-media SaaS
  cross-integration, mobile apps.

---

## 11. Open Questions / Decisions Needed

1. **AliExpress integration:** no official dropship API exists — decide whether to
   pursue their affiliate/open-platform program, skip AliExpress and lead with CJ
   Dropshipping + Printify, or revisit later.
2. **Legal entity:** a registered business is required to obtain JazzCash/Easypaisa
   merchant accounts — needs to be confirmed/started before Phase 1 payment work.
3. **Team size & timeline** for Phase 1 build — affects how aggressively scope should
   be trimmed for the first release.
4. **Branding assets** (logo, domain, final visual direction beyond the horizonx.so
   reference) — needed before the Theme Engine's first templates are designed.

---

*This is a living document — update it as decisions in §11 are resolved and as each
phase is scoped in detail.*
