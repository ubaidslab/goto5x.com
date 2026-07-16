# goto5x.com — v1.0 MVP Cut-List (updated for SRS v0.5)

Solo founder + AI build team. The goal of v1.0 is a **real, live, revenue-capable
platform** with genuine day-one commerce feature parity — not every SRS requirement
at once. Everything cut here is still in the SRS; it is sequenced into v1.1/Phase
2/Phase 4, not dropped. This revision restructures the IN/OUT lists to match
sections A (v1.0), B (v1.1), and C (Phase 2+) of the founder+advisor Shopify-parity
and business-model review exactly.

**Process note (SRS §3.7, §14):** build order follows the SRS's per-module
Acceptance Checklists — no module below starts until the previous one's checklist
is 100% verified and approved. The IN/OUT calls below set *scope*; §14 of the SRS
sets *done*.

---

## ⚠️ Timeline Risk Flag — read this before approving scope (per founder's request)

Section A adds **sixteen** new features to v1.0 on top of an already-substantial
v0.4 scope (payout/disbursement engine, supplier transparency, shipping, discounts).
Most are genuinely cheap. **Four are not**, and deserve a deliberate decision rather
than being waved through with the rest:

| # | Feature | Why it's riskier than it looks | If timeline pressure appears |
|---|---|---|---|
| 9 | **CSV import/export, Shopify-compatible mapping** | Shopify's product-export format has real complexity (multi-row variants, option combinations, metafields, image handling). A shallow "compatible" importer risks being compatible in name only — support burden instead of time saved. | Ship the mapping for the fields that cover a straightforward catalog (title, price, variants, images) explicitly, document what's *not* mapped, treat metafields/complex option combos as fast-follow |
| 7 | **Manual/draft orders — payment-link flow** | This is a second checkout entry point that must reconcile with the same commission/ledger logic as normal checkout — real integration surface, not "just a table" | "Mark as paid directly" alone (no generated payment link) is a materially smaller slice that still serves the phone/WhatsApp-selling use case |
| 3 | **Cart persistence + abandoned-cart flagging** | "When exactly is a buyer's email captured pre-purchase?" is a real UX/checkout-architecture decision, not a trivial table — it couples with the checkout flow being built simultaneously | Make the email-capture point an explicit, early decision (e.g. one email-first field before payment details), not something discovered mid-build |
| 10 | **Self-hosted PDF invoices, "must look premium"** | Same failure mode as the existing Risk 9 (AI/premium template scope creep) applied to a new surface — an open-ended "make it feel luxury" bar can consume unbounded design-iteration time | Ship one well-designed, branded template meeting a "clean and professional" bar for v1.0; time-box further polish as a backlog item, not a pre-launch gate |

These four are documented in full below as **IN v1.0** per the founder's instruction
— this flag is informational, not a unilateral cut. **This is the founder's call to
make**, ideally before build starts on each: if the timeline needs a safety valve,
these four are the highest-value candidates to trim or resequence, in roughly this
order (CSV mapping first, manual-order payment-link second).

---

## IN — v1.0 (Section A)

**Platform**
- goto5x.com's own marketing/signup site, built to the premium visual bar (FR-0.1)
- Legal/content pages (ToS, Privacy, Refund, About, Contact) — admin-editable and
  versioned (FR-12.1); `docs/legal/` drafts flagged for human legal review

**Store builder**
- 3 hand-built premium templates, basic customizer (colors/fonts/logo/images/
  section show-hide/reorder — FR-1.2 v1.0 scope), live preview, mobile-responsive,
  free subdomain, custom domain attachment
- **Template marketplace integration hook** (FR-1.8) — a documented API only; the
  marketplace itself is the founder's separate future SaaS

**Catalog & storefront commerce**
- Manual product entry, Google Drive media import (into self-hosted MinIO)
- Store shipping settings (flat rate + free threshold, FR-2.10)
- Basic discount codes (FR-2.11/FR-5.5)
- **Basic tax settings** (FR-19.3): one rate per store, inclusive/exclusive toggle

**Storefront discovery & merchandising (new in v0.5)**
- Collections (FR-16.1) · storefront search & filters (FR-16.2) · navigation editor
  (FR-16.3) · announcement bar (FR-16.4) · coming-soon/password mode (FR-16.5) ·
  SEO structured data + sitemap/robots (FR-16.6) · WhatsApp chat/order button (FR-16.7)

**Customers, reviews & carts (new in v0.5)**
- Customers/CRM: auto-created records, list + detail view (FR-13.1–13.3)
- Product reviews & ratings with seller moderation (FR-14.1–14.4)
- Cart persistence once email is captured + abandoned-cart **flagging** (FR-15.1–
  15.2) — recovery emails are v1.1 (see Risk Flag above, item 3)

**Supplier (proves the differentiator, with real buyer-facing transparency)**
- Supplier Adapter interface as the real internal contract from day one; **one
  adapter implemented: Printify**
- Listing transparency (shipping/delivery/countries, FR-4.6), checkout country-
  blocking (FR-4.7), live price re-validation (FR-4.8), admin adapter registry (FR-4.9)
- Basic order forwarding + tracking pull-back

**Orders & checkout**
- Cart + checkout, payment via **Safepay only** (COD deferred/gated, §5.6a)
- Order dashboard: list, filter by status, manual tracking entry
- Buyer email notifications; **buyer order-status lookup** via secure link (FR-5.4)
- Mixed-cart shipping calculation (FR-5.6)
- **Manual/draft orders** (FR-17.1 — see Risk Flag above, item 7) with a mark-as-paid
  path at minimum; the payment-link path is the flagged, trimmable piece
- **Order notes, tags, timeline, and basic pre-fulfillment editing** (FR-17.2–17.5)

**Data portability (new in v0.5)**
- **CSV product import (Shopify-compatible field mapping) + product/order export**
  (FR-18.1–18.3 — see Risk Flag above, item 9)

**Receipts & tax (new in v0.5)**
- **Self-hosted PDF invoice/receipt**, branded, attached to confirmation email and
  order-status page (FR-19.1–19.2 — see Risk Flag above, item 10)

**Seller onboarding (new in v0.5)**
- Guided post-signup wizard: template → logo → first product → domain (FR-20.1)

**Payments, commission & payout**
- 3% default commission (post-discount amount), append-only ledger with `reserved`
  bucket, fixed 22-day hold, rolling reserve mechanism (default 0%)
- Payout request → admin approval queue with risk summary → **manual Disbursement
  Adapter** → full status visibility to seller
- Daily reconciliation job; currency-ready schema throughout

**Pricing & plans (new in v0.5)**
- **Free Plan** as a first-class tier: no billing cycle, tight Settings-Registry
  limits, one store per identity, **higher default commission** (FR-7.3)
- **Inverse commission laddering** — higher plans, lower commission (FR-7.4)
- Plan changes take effect next billing cycle, no proration (FR-7.5)
- Yearly billing with admin-configurable discount (FR-7.6)
- Launch-campaign pricing as Settings Registry config (FR-7.7)

**Business Guard-Rails (new in v0.5)**
- Free-plan enforcement at creation time (storage + product-count limits, FR-23.1)
- Dormant-store lifecycle: warning → suspend → archive, all thresholds configurable
  (FR-23.2)
- **No trial-of-paid-features** — binding principle, no separate code path to build
  or leave open (FR-23.3)
- Unit-economics admin dashboard: free-vs-paid split, admin-entered cost vs.
  computed revenue (FR-23.4)
- Velocity/abuse limits: per-identity free-store cap, signup rate limiting (FR-23.5)

**Admin terminal — Control Plane**
- Settings Registry as the underlying mechanism for everything above
- Feature flags, plans & pricing editor, commission/hold/reserve settings, seller
  lifecycle (approve/suspend/ban/force-disable/view-any-store), template management,
  maintenance mode, payout freeze/release, manually-assisted refunds, immutable
  audit log, live platform analytics (incl. unit-economics view), mandatory admin
  MFA, content-page editor

**Infrastructure & security foundations (non-negotiable)**
- Tenant-scoping middleware + Postgres RLS across **every** tenant table, old and
  new (customers, reviews, carts, collections, navigation menus, order notes/
  timeline, import jobs, tax settings — same rule, no exceptions)
- Cross-tenant automated test suite as a release gate
- Stateless app servers, Redis-backed sessions, PgBouncer
- Self-hosted MinIO + Cloudflare free CDN tier
- Staging as a same-VPS Compose stack
- Webhook signature verification on all payment/supplier webhooks
- **i18n-readiness discipline** (SRS §3.9): no hard-coded strings, locale-aware
  formatting, RTL-safe CSS — a code-review rule, not a feature, so it costs nothing
  extra now and everything later if skipped

---

## v1.1 — documented ahead of time, not built now (Section B)

| Feature | Note |
|---|---|
| CJ Dropshipping adapter | Proves the Supplier Adapter interface is genuinely generic |
| Self-serve supplier registration + full multi-store dashboard UI | v1.0 supplier connections are admin-assisted |
| Listing review/approval self-serve UI | Ships with self-serve supplier onboarding |
| Hold graduation logic | Needs real transaction data to calibrate thresholds |
| Scheduled payout mode (FR-6.8) | Automation on top of the v1.0 request flow |
| API-based Disbursement Adapter (FR-6.11) | Manual adapter proves the queue/ledger first |
| Advanced sales-velocity anomaly detection (FR-6.9) | v1.0 uses a simple threshold check |
| **Optional buyer accounts** (FR-22.1) | Schema-ready: `orders.buyer_id` has been nullable-FK-to-`users` since v0.4 |
| **Abandoned-cart recovery emails** (FR-22.2) | Sends against the v1.0 `carts.status='abandoned'` flag — only the send job is new |
| **Returns/refunds seller-side workflow** (FR-22.3) | New `return_requests` table; reuses the existing refund/ledger mechanism |
| **Per-store content pages + blog** (FR-22.4) | Mirrors the v1.0 platform-level content-page pattern, tenant-scoped |
| **Support/ticket system** (FR-22.5) | Self-hosted, no third-party helpdesk SaaS |
| **Referral program** (FR-22.6) | Reward terms are Settings Registry config |
| **Low-stock alerts + newsletter capture** (FR-22.7) | Low-stock is a threshold check on existing data; newsletter list is one new small table |
| Listing/content moderation automation | v1.0's admin-assisted catalog is small enough to eyeball manually |
| "Login as seller" impersonation (full secure flow) | `admin_impersonation_sessions` table already exists in v1.0 schema |
| Supplier lifecycle self-serve controls | Matches suppliers being admin-assisted in v1.0 |
| Scheduled/multi-banner announcements | v1.0 ships only the single maintenance-mode toggle |
| Suspicious-order flagging queue (`order_flags` UI) | Admin reviews orders directly at launch volume |
| Automated one-click refunds via Payment Adapter | Manual-assisted refund is sufficient at launch volume |
| `platform_metrics_snapshots` (pre-aggregated analytics) | Live queries are fast enough at v1.0 volume |

---

## Phase 2+ — roadmap entries only (Section C)

| Item | Note |
|---|---|
| **RTL/Urdu storefront support** | Content + CSS-direction work only, because the i18n-readiness principle (SRS §3.9) is binding from v1.0 — this is the whole point of building that discipline in now |
| **Markaz supplier-adapter evaluation** (FR-4.10) | Named research item — verify public API availability before any build commitment; integrates via the standard adapter interface if viable, exactly like Printify/CJ |
| **Template marketplace integration** (FR-1.8) | The hook exists in v1.0; the marketplace itself is the founder's separate future SaaS, built and launched independently |
| Tiered plan proration | v1.0 ships the simple next-cycle rule (FR-7.5) |
| Coded-theme escape hatch, dispute workflow, SMS/WhatsApp notifications, second payment gateway, gated per-seller COD, shipping zones/weight rates, advanced discounts | Unchanged from v0.4 — see prior version |
| Multi-VPS scale-out, international payment gateways, social-media SaaS SSO, mobile apps | Unchanged from v0.4 |

---

## Zero added infrastructure cost — verified again for v0.5

Every new v0.5 IN item is Postgres tables + application code, reusing the Redis
instance, the BullMQ worker, and the self-hosted MinIO already budgeted for v1.0:
- CSV import/export and PDF generation run as **background jobs** on the existing
  worker — no new service.
- PDF generation is a **self-hosted** renderer (not a paid invoicing API) — the only
  cost is compute already on the VPS; this is worth an explicit operational note
  (not a cost, but a resource one): a headless-browser-based PDF renderer is heavier
  on CPU/RAM per job than the rest of the stack, worth monitoring under real load,
  even though it introduces no new *billed* infrastructure.
- Search uses Postgres full-text search (already the v1.0 default, SRS §3.3) — no
  dedicated search service.
- Every guard-rail (free-plan limits, dormant lifecycle) is a Settings Registry
  entry + a scheduled job on the existing worker.

---

## Definition of "v1.0 done"

A seller signs up, works through the onboarding wizard (template → logo → first
product → domain), sets a shipping rate, tax rate, and a discount code, imports a
CSV of products (Shopify-format) alongside a few Printify items (shipping/delivery/
country shown to buyers), organizes products into a collection, and configures
navigation and an announcement bar. A buyer finds a product via search, leaves the
site with items in cart (captured by email, later flagged abandoned if never
completed), returns and checks out with a discount code applied — blocked if any
cart item's supplier can't ship to their country — receives a branded PDF invoice,
and later checks order status via a secure emailed link with no account, leaving a
review after delivery that the seller moderates. The seller also takes a phone order
and enters it manually. The seller sees a 3% (or plan-adjusted) commission deducted
on the post-discount amount, their payout sitting in a 22-day hold, and — once
available — requests a payout an admin reviews and pays out manually, visible
through the full status flow. A free-plan seller who exceeds their product limit is
blocked at creation, not warned after the fact; one who goes dormant for the
configured period is warned, then suspended, then archived. Every step of that
sentence is a shipped, testable feature, verified against its module's Acceptance
Checklist (SRS §14) — not a demo path through unfinished code.
