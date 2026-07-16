# goto5x.com — v1.0 MVP Cut-List (updated for SRS v0.4)

Solo founder + AI build team. The goal of v1.0 is a **real, live, revenue-capable
platform** with the core differentiator (built-in supplier + premium store) provable
end-to-end — not every SRS requirement at once. Everything cut here is still in the
SRS; it is sequenced into v1.0.x/Phase 1.1/Phase 2, not dropped.

**Process note (SRS §3.7, §14):** build order now follows the SRS's per-module
Acceptance Checklists — no module below starts until the previous one's checklist is
100% verified and approved. The IN/OUT calls below set *scope*; §14 of the SRS sets
*done*.

---

## IN — v1.0

**Platform**
- goto5x.com's own marketing/signup site, built to the premium visual bar (FR-0.1)
- Legal/content pages (Terms of Service, Privacy Policy, Refund Policy, About,
  Contact) — admin-editable and versioned (FR-12.1); drafts in `docs/legal/` are
  flagged for human legal review before launch, not shipped as final copy

**Store builder**
- 3 hand-built premium templates (not 5–6 — fewer, higher-polish, ships faster)
- Basic customizer: colors, fonts, logo/banner images, section show/hide + reorder
  (FR-1.2 v1.0 scope — animation presets are explicitly Phase 3, not this)
- Live preview
- Mobile-responsive storefront + mobile-usable seller dashboard
- Free subdomain (`store.goto5x.com`)
- Custom domain attachment (Traefik auto-TLS)

**Catalog & storefront commerce**
- Manual product entry: title, description, price, variants, stock, images
- Google Drive media import (into self-hosted MinIO — see Infrastructure below)
- **Store shipping settings** (FR-2.10): flat rate + free-shipping threshold for
  self-fulfilled products; zones/weight-based rates are Phase 2
- **Basic discount codes** (FR-2.11/FR-5.5): percentage or fixed-amount, per-store,
  expiry date, usage limit; auto-apply/BOGO/scheduled sales are Phase 2

**Supplier (proves the differentiator, minimally, with real buyer-facing transparency)**
- Supplier Adapter interface built as the real internal contract from day one
  (not a stub) — but only **one adapter implemented**: Printify
- Seller can connect Printify-backed products into their store
- **Supplier listing transparency** (FR-4.6): shipping cost, estimated delivery
  time, and supported countries shown on the storefront product page
- **Checkout country-blocking** (FR-4.7): an order is blocked if any cart item's
  supplier can't deliver to the buyer's country
- **Live price re-validation at checkout** (FR-4.8): no sale completes at a stale
  cached supplier price
- **Adapter registry** (FR-4.9): admin can enable/disable the Printify adapter from
  the admin terminal without a deploy
- Basic order forwarding to Printify + tracking pulled back to the order

**Orders & checkout**
- Cart + checkout
- Payment: **Safepay only** (COD removed from v1.0 — see below)
- Order dashboard: list, filter by status, manual tracking entry for self-fulfilled
  orders
- Buyer email notifications (confirmed, shipped, delivered)
- **Buyer order-status lookup** (FR-5.4): a secure, unguessable emailed link, since
  buyers have no accounts
- **Mixed-cart shipping calculation** (FR-5.6): self-fulfilled and supplier-fulfilled
  shipping costs sum correctly in the same order

**Payments, commission & payout**
- 3% commission (configurable by admin via the Settings Registry), calculated on the
  **post-discount** amount (FR-6.1)
- Append-only ledger, now including the `reserved` balance bucket (FR-6.4)
- Fixed 22-day per-transaction hold (graduation logic deferred, see OUT)
- **Rolling reserve mechanism** (FR-6.13): built and functional, **default 0%** for
  every seller at launch — the machinery (ledger entry types, Settings Registry
  keys, release job) ships now so admin can apply it the moment a risk signal
  appears, without waiting on a migration
- **Payout request flow** (FR-6.7): a seller requests a payout up to their available
  balance
- **Admin payout approval queue with a risk summary** (FR-6.9): KYC status, dispute
  rate, flagged-order count, account age, and a simple sales-velocity threshold check
- **Payout freeze on prohibited-goods flag** (FR-6.10)
- **Manual Disbursement Adapter** (FR-6.11): admin batch screen (payee, amount,
  IBAN/Raast, copy-ready) → admin transfers funds outside the platform → marks Paid
  → ledger entry + seller notification
- Full payout status visibility to the seller: `requested → approved → processing →
  paid/rejected` (FR-6.12)
- Daily reconciliation job against gateway settlement (FR-6.6)
- Currency-ready schema throughout (store-level `currency`, denormalized onto
  historical records) — no visible difference at a Pakistan-only launch, but no
  PKR-hard-coding to unwind later

**Admin terminal — Control Plane (see full breakdown below)**
- Settings Registry (`settings_definitions` + `settings_values` + Redis cache) as
  the underlying mechanism — built in v1.0 because every item below depends on it,
  not optional infrastructure to defer
- Feature flags (global/plan/seller scope)
- Plans & pricing editor
- Commission % + hold-duration + rolling-reserve settings (editable; automatic hold
  graduation logic is v1.1)
- Seller approve/suspend/ban, instant store force-disable, read-only "view any store"
- Template publish/unpublish + free/premium marking
- Maintenance mode toggle (single global switch, admin-IP allowlisted)
- Per-seller payout freeze/release
- Manually-assisted refunds (ledger entry + admin processes the refund in the
  gateway's own dashboard; one-click automated refund via the Payment Adapter is v1.1)
- Immutable audit log (DB-enforced insert-only) — every control-plane action,
  including settings changes and payout approvals
- Live platform analytics (GMV, revenue, commission, active stores) via direct SQL —
  no snapshot table yet
- Mandatory MFA for admin accounts
- Content-page editor (legal/about/contact), versioned

**Infrastructure & security foundations (non-negotiable, not a "feature" to cut)**
- Tenant-scoping middleware + Postgres RLS
- Cross-tenant automated test suite as a release gate
- Stateless app servers, Redis-backed sessions, PgBouncer
- **Self-hosted MinIO** for object storage, fronted by Cloudflare's free CDN tier
  (replaces the earlier Cloudflare R2 assumption — self-host-first principle, SRS §9)
- **Staging as a same-VPS Docker Compose stack** under a staging subdomain — zero
  extra infrastructure cost
- Webhook signature verification on all payment/supplier webhooks

---

## OUT of v1.0 (explicitly deferred, not forgotten)

| Feature | Deferred to | Why cut from v1.0 |
|---|---|---|
| **Cash on Delivery (COD)** | Later phase, per-seller gated | Removed from v1.0 entirely (was IN in the v0.3 draft) — COD inverts commission collection since the platform never holds the money to deduct 3% from. Returns as a Settings Registry flag (`payments.cod_enabled`) enabled only for verified sellers with sufficient balance to absorb the commission (SRS §5.6a) |
| CJ Dropshipping adapter | v1.1 | One adapter (Printify) is enough to prove the interface end-to-end for launch; a second adapter is the fastest way to *validate* the interface is generic, right after, not before, shipping |
| Self-serve supplier registration + full multi-store dashboard UI | v1.1 | v1.0 supplier connections are admin-assisted (founder manually links the first suppliers); the self-serve flow and multi-store dashboard UI are real scope, sequenced right after v1.0 ships |
| Listing review/approval self-serve UI | v1.1 | v1.0 uses admin-assisted listing import; the seller-facing approve/reject queue UI ships with v1.1's self-serve supplier flow |
| Hold graduation logic (trust-based shortening) | v1.1 | Needs real transaction data + KYC flow to calibrate thresholds (SRS §13, open question 4) — v1.0 ships a safe fixed 22-day default |
| **Scheduled payout mode** (FR-6.8) | v1.1 | Automation on top of the core request flow — v1.0 ships seller-initiated requests only; the Settings Registry keys for it are documented in the SRS but not built until v1.1 |
| **API-based Disbursement Adapter** (FR-6.11) | v1.1 | The manual adapter proves the queue/ledger/notification logic first; automating bank/Raast transfers is a real integration project not worth doing before payout volume justifies it |
| **Advanced sales-velocity anomaly detection** (FR-6.9) | v1.1 | v1.0 uses a simple threshold check; statistical anomaly detection needs real order data to calibrate against |
| Animation-preset customization, AI content/image tools | Phase 3 | Generative/AI design tooling is a multi-month problem on its own (Risk 9, SRS §12) — v1.0 templates are hand-built to the premium bar instead |
| Coded-theme escape hatch (FR-1.6) | Phase 2 | Real scope (a template-override rendering path); not needed to prove the core loop to first sellers |
| Tiered subscription billing/dunning | Phase 2 | v1.0 launches on a single flat plan (or free) to avoid building recurring billing before there's anyone to bill |
| SMS/WhatsApp notifications | Phase 2 | Email is sufficient to validate the order-notification loop first |
| Second payment gateway (PayFast/JazzCash direct) | Phase 1.x | Needs a registered company; Safepay alone is enough to take real orders at launch |
| **Shipping zones / weight-based rates** (FR-2.10) | Phase 2 | v1.0's flat-rate + free-threshold model is deliberately simple; zone/weight logic is real scope |
| **Advanced discounts** (auto-apply, BOGO, scheduled sales) | Phase 2 | v1.0 ships only percentage/fixed-amount codes with expiry + usage limit |
| Automated buyer-facing dispute/refund flow | Phase 2 | v1.0 handles disputes manually via admin terminal — low volume at launch makes this fine |
| Admin sub-roles / seller staff accounts | Phase 3 | Solo founder is the only admin at launch; no one else to scope a role for yet |
| Dedicated search engine (Meilisearch) | Later | Postgres full-text search covers v1.0 catalog sizes |
| Multi-VPS scale-out | Phase 4 | Architecture is *ready* for it (docs/architecture.md); actually splitting VPS before there's load to justify it is wasted ops effort |
| International payment gateways (Stripe) | Phase 4 | Pakistan-first launch has no international buyers yet |
| Social-media SaaS SSO integration | Phase 4 | The hook (shared Auth module) is built now; the second product itself doesn't exist yet |
| Listing/content moderation automation | v1.1 | v1.0's single admin-assisted Printify catalog is small enough to eyeball manually; automated moderation queue ships with self-serve supplier onboarding |
| "Login as seller" impersonation (full secure flow) | v1.1 | Security-sensitive to build correctly (time-boxed sessions, reason capture, audit tagging) — not worth rushing before there are enough sellers to need support-by-impersonation; the `admin_impersonation_sessions` table exists in the v1.0 schema so v1.1 is additive, not a migration |
| Supplier lifecycle self-serve controls (approve/suspend/ban supplier accounts) | v1.1 | Consistent with suppliers being admin-assisted, not self-serve, in v1.0 (see Supplier row above) |
| Scheduled/multi-banner announcements (`announcements` table UI) | v1.1 | v1.0 ships only the single maintenance-mode toggle, which covers the actual launch-critical case (taking the site down for a deploy window) |
| Suspicious-order flagging queue (`order_flags` UI) | v1.1 | At launch order volume, admin reviews orders directly; a dedicated flagging queue earns its keep once volume makes that impractical |
| Automated one-click refunds via Payment Adapter | v1.1 | Manual-assisted refund (ledger entry + gateway dashboard) is sufficient at launch volume and avoids building refund logic into the Payment Adapter interface before it's been proven with real transactions |
| `platform_metrics_snapshots` (pre-aggregated analytics) | Phase 1.1+, load-triggered | Live `SUM`/`COUNT` queries are fast enough at v1.0 order volume; this table is schema-ready but only populated once live aggregation is measurably slow — an optimization earned by real load, not built ahead of it |

### Admin Control Plane — the 10 requirements mapped to v1.0

| # | Control-plane requirement | v1.0? |
|---|---|---|
| 1 | Feature flags (global/plan/seller) | **IN** |
| 2 | Plans & pricing editor | **IN** |
| 3 | Commission % + hold-duration + rolling-reserve settings | **IN** (values editable; automatic hold-graduation logic is v1.1) |
| 4 | Seller lifecycle: approve/suspend/ban, force-disable, view-any-store | **IN**; full "login as seller" impersonation is v1.1 |
| 5 | Supplier lifecycle + portal approve/reject | **v1.1** (matches suppliers being admin-assisted, not self-serve, in v1.0) |
| 6 | Template management (publish/unpublish, free/premium, plan assignment) | **IN** (cheap — reuses the plans editor already being built) |
| 7 | Announcements & maintenance mode | **IN** for maintenance mode toggle; scheduled multi-banner announcements are v1.1 |
| 8 | Risk & fraud controls (flag orders, freeze payouts, refunds) | **IN** for payout freeze/release (one setting) and manually-assisted refunds; automated order-flagging queue and one-click refunds are v1.1 |
| 9 | Immutable audit log | **IN** — foundational, every other control-plane feature depends on it existing from day one |
| 10 | Real-time platform analytics | **IN** as live queries; pre-aggregated snapshots are load-triggered, not v1.0 |

**Zero added infrastructure cost:** every "IN" item above — including the full
Payout Request & Disbursement Engine, discount codes, shipping settings, supplier
transparency, and self-hosted MinIO — is new Postgres tables and application code
reusing the Redis instance and single VPS already budgeted for v1.0. Nothing on this
list requires a new service, a new server, or a paid third-party tool; the manual
Disbursement Adapter specifically substitutes admin time for a paid payout API.

---

## Definition of "v1.0 done"

A seller signs up, picks one of 3 templates, customizes colors/logo/sections, sets a
flat shipping rate, creates a discount code, imports a few Printify products (with
shipping cost/delivery time/country shown to buyers), and attaches a custom domain
(or uses the free subdomain). A buyer applies the discount code, checks out with
Safepay (blocked if any cart item's supplier can't ship to their country), and can
later check order status via a secure emailed link with no account. The order
appears in the seller's dashboard; Printify ships it and the tracking ID flows back
to the buyer. The seller sees a 3% commission (on the post-discount amount) deducted,
their payout sitting in a 22-day hold in their ledger view, and — once available —
requests a payout that an admin reviews (with a risk summary) and pays out manually
via bank/Raast, visible to the seller through the full `requested → approved →
processing → paid` status flow. Every step of that sentence is a shipped, testable
feature, verified against its module's Acceptance Checklist (SRS §14) — not a demo
path through unfinished code.
