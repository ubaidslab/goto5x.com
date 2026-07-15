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

**Admin terminal**
- Seller approve/suspend/ban with audit log
- Commission/plan configuration
- Basic platform analytics (GMV, active stores)
- Mandatory MFA for admin accounts
- Manual dispute/hold override tools

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

---

## Definition of "v1.0 done"

A seller can: sign up → pick one of 3 templates → customize colors/logo/sections →
import a few Printify products → attach a custom domain (or use the free subdomain)
→ a buyer checks out with Safepay or COD → the order appears in the seller's
dashboard → Printify ships it and the tracking ID flows back to the buyer → the
seller sees a 3% commission deducted and their payout sitting in a 22-day hold in
their ledger view. Every step of that sentence is a shipped, testable feature — not
a demo path through unfinished code.
