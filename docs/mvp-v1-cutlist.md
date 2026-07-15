# goto5x.com — v1.0 MVP Cut-List

Solo founder + AI build team. The goal of v1.0 is a **real, live, revenue-capable
platform** with the core differentiator (built-in supplier + premium store) provable
end-to-end — not every SRS requirement at once. Everything cut here is still in the
SRS; it is sequenced into v1.0.x/Phase 2/3, not dropped.

---

## IN — v1.0

**Platform**
- goto5x.com's own marketing/signup site, built to the premium visual bar (FR-0.1)

**Store builder**
- 3 hand-built premium templates (not 5–6 — fewer, higher-polish, ships faster)
- Basic customizer: colors, fonts, logo/banner images, section show/hide + reorder
- Live preview
- Mobile-responsive storefront + mobile-usable seller dashboard
- Free subdomain (`store.goto5x.com`)
- Custom domain attachment (Traefik auto-TLS)

**Catalog**
- Manual product entry: title, description, price, variants, stock, images
- Google Drive media import

**Supplier (proves the differentiator, minimally)**
- Supplier Adapter interface built as the real internal contract from day one
  (not a stub) — but only **one adapter implemented**: Printify
- Seller can connect Printify-backed products into their store
- Basic order forwarding to Printify + tracking pulled back to the order

**Orders & checkout**
- Cart + checkout
- Payment: Safepay (cards, wallets, Raast) + Cash on Delivery
- Order dashboard: list, filter by status, manual tracking entry for self-fulfilled orders
- Buyer email notifications (confirmed, shipped, delivered)

**Payments/commission**
- 3% commission (configurable by admin), calculated per FR-6.1
- Append-only ledger (FR-6.4)
- Fixed 22-day per-transaction hold (graduation logic deferred, see OUT)
- Daily reconciliation job against gateway settlement (FR-6.6)

**Admin terminal — Control Plane (see full breakdown below)**
- Settings Registry (`settings_definitions` + `settings_values` + Redis cache) as
  the underlying mechanism — built in v1.0 because every item below depends on it,
  not optional infrastructure to defer
- Feature flags (global/plan/seller scope)
- Plans & pricing editor
- Commission % + hold-duration settings (editable; automatic graduation logic is v1.1)
- Seller approve/suspend/ban, instant store force-disable, read-only "view any store"
- Template publish/unpublish + free/premium marking
- Maintenance mode toggle (single global switch, admin-IP allowlisted)
- Per-seller payout freeze/release
- Manually-assisted refunds (ledger entry + admin processes the refund in the
  gateway's own dashboard; one-click automated refund via the Payment Adapter is v1.1)
- Immutable audit log (DB-enforced insert-only) — every control-plane action, including
  settings changes
- Live platform analytics (GMV, revenue, commission, active stores) via direct SQL —
  no snapshot table yet
- Mandatory MFA for admin accounts

**Security/architecture foundations (non-negotiable, not a "feature" to cut)**
- Tenant-scoping middleware + Postgres RLS
- Cross-tenant automated test suite as a release gate
- Stateless app servers, Redis-backed sessions, PgBouncer, object storage for media
- Webhook signature verification on all payment/supplier webhooks

---

## OUT of v1.0 (explicitly deferred, not forgotten)

| Feature | Deferred to | Why cut from v1.0 |
|---|---|---|
| CJ Dropshipping adapter | v1.1 | One adapter (Printify) is enough to prove the interface end-to-end for launch; a second adapter is the fastest way to *validate* the interface is generic, right after, not before, shipping |
| Self-serve supplier registration + full multi-store dashboard UI | v1.1 | v1.0 supplier connections are admin-assisted (founder manually links the first suppliers); the self-serve flow and multi-store dashboard UI are real scope, sequenced right after v1.0 ships |
| Listing review/approval self-serve UI | v1.1 | v1.0 uses admin-assisted listing import; the seller-facing approve/reject queue UI ships with v1.1's self-serve supplier flow |
| Hold graduation logic (trust-based shortening) | v1.1 | Needs real transaction data + KYC flow to calibrate thresholds (SRS §13, open question 4) — v1.0 ships a safe fixed 22-day default |
| Animation-preset customization, AI content/image tools | Phase 3 | Generative/AI design tooling is a multi-month problem on its own (Risk 9, SRS §12) — v1.0 templates are hand-built to the premium bar instead |
| Coded-theme escape hatch (FR-1.6) | Phase 2 | Real scope (a template-override rendering path); not needed to prove the core loop to first sellers |
| Tiered subscription billing/dunning | Phase 2 | v1.0 launches on a single flat plan (or free) to avoid building recurring billing before there's anyone to bill |
| SMS/WhatsApp notifications | Phase 2 | Email is sufficient to validate the order-notification loop first |
| Second payment gateway (PayFast/JazzCash direct) | Phase 1.x | Needs a registered company; Safepay + COD is enough to take real orders at launch |
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
| 3 | Commission % + hold-duration settings | **IN** (values editable; automatic graduation logic is v1.1) |
| 4 | Seller lifecycle: approve/suspend/ban, force-disable, view-any-store | **IN**; full "login as seller" impersonation is v1.1 |
| 5 | Supplier lifecycle + portal approve/reject | **v1.1** (matches suppliers being admin-assisted, not self-serve, in v1.0) |
| 6 | Template management (publish/unpublish, free/premium, plan assignment) | **IN** (cheap — reuses the plans editor already being built) |
| 7 | Announcements & maintenance mode | **IN** for maintenance mode toggle; scheduled multi-banner announcements are v1.1 |
| 8 | Risk & fraud controls (flag orders, freeze payouts, refunds) | **IN** for payout freeze/release (one setting) and manually-assisted refunds; automated order-flagging queue and one-click refunds are v1.1 |
| 9 | Immutable audit log | **IN** — foundational, every other control-plane feature depends on it existing from day one |
| 10 | Real-time platform analytics | **IN** as live queries; pre-aggregated snapshots are load-triggered, not v1.0 |

**Zero added infrastructure cost:** every "IN" item above is new Postgres tables and
application code reusing the Redis instance and single VPS already budgeted for
v1.0 — nothing on this list requires a new service, a new server, or a paid
third-party tool.

---

## Definition of "v1.0 done"

A seller can: sign up → pick one of 3 templates → customize colors/logo/sections →
import a few Printify products → attach a custom domain (or use the free subdomain)
→ a buyer checks out with Safepay or COD → the order appears in the seller's
dashboard → Printify ships it and the tracking ID flows back to the buyer → the
seller sees a 3% commission deducted and their payout sitting in a 22-day hold in
their ledger view. Every step of that sentence is a shipped, testable feature — not
a demo path through unfinished code.
