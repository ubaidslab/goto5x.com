# UZEYN — UI Feature Inventory

Master reference for personally designing and reviewing every screen before any pixel is coded. Every claim below is backed by a real file that was actually read during this audit — a real API route, a real service method, a real Prisma schema field, a real Settings Registry key, or a real existing frontend file. Where something plausible-sounding turned out **not** to be backed by real code, it is marked **NOT FOUND — flag for founder** rather than invented. Several assumptions in the original brief did not hold once checked against the real codebase — those gaps are flagged explicitly throughout, not papered over.

This document is research output, not a design brief. It does not prescribe visual treatment (color, spacing, motion) — Phase 1's tokens/component kit already establish that direction. It exists so a redesign of any given screen can start from "here is everything this screen must do" rather than rediscovering it mid-build.

Methodology note on **Part 1** (the founder's per-page documentation template — purpose, nav placement, plan-gating, every section/button/form/table, icons, empty/loading/error states, modals, real-time elements, mobile notes): rather than a standalone section, this template was applied to *every* page in Parts 3–5 below. There is no separate "Part 1" section as a result — it is the shape every page write-up follows.

---

## Part 0 — Module Coverage Audit

Every built module (1–80) mapped to where it surfaces in this inventory. Sourced from `docs/SRS.md`'s §14 Acceptance Checklists (the authoritative, item-level built/not-built record — checklist items were read individually since some section *headers* are stale even where the items inside were later flipped to `[x]`), cross-referenced against `docs/build-plan.md` and `CHANGELOG.md`.

**Critical finding, resolved:** Modules 63–72 ("Subscription Business Readiness" — MRR analytics, 14-day data-retention window, renewal reminders, multi-store downgrade rule, admin gateway-health monitoring, support-SLA-by-plan, seller health funnel, monthly seller report, first-cycle discount-abuse prevention, 50% refund policy) are **genuinely not built**. SRS §14.66 is headed "not yet built" and *every* checklist item under it (FR-6.40–6.49) is still unchecked. `docs/build-plan.md`'s own narrative claims this batch was "renumbered 73–80" — that claim is factually contradicted by SRS §14.66 vs §14.67 covering two entirely different FR sets. Modules 73–80 are real, built, but are a *different* body of work (the subscription-only business-model pivot). Treat Modules 63–72 as reserved module numbers with a full spec and zero shipped code — no page below claims to surface them; each gap is flagged inline at its natural home instead.

Also per SRS §14.68: Modules 81–88 ("Buyer Experience Batch" — optional buyer accounts, review media, live chat, shipping calculator, wishlist, stock countdown, image zoom/video, missing-tracking alert) are likewise **not built**, all `[ ]`. These surface throughout Part 4 (Buyer-Facing Storefront) as confirmed gaps.

| Module # | Name | Built? | Surfaces in this document at |
|---|---|---|---|
| 1 | Foundation (auth, multi-tenancy/RLS, Settings Registry, admin audit log) | yes | Cross-cutting; §16 Settings (Security); §18.19 Audit log |
| 2 | Catalog & Media | yes | §3 Products |
| 3 | Custom Domain & TLS | yes | §16 Settings → Domains tab |
| 4 | Theme Engine & Storefront Rendering | yes | §17 Buyer-Facing Storefront; §9 Design Studio |
| 5 | Discovery & Merchandising | yes | §17.4 Storefront search |
| 6 | Listing Moderation Engine | yes | §3 Products (moderationStatus); §18.9 Admin moderation queue |
| 7 | Shipping, Tax & Discounts | yes | §10 Shipping & Tracking; §7.4 Discounts tab |
| 8 | Suppliers & Printify Adapter | yes | §11 Suppliers |
| 9 | Orders, Cart & Checkout | yes | §2 Orders; §17.5–17.8 Cart/Checkout/Order status/confirmation |
| 10 | Seller Dashboard UI (foundation) | yes | Cross-cutting (this whole document's subject) |
| 11 | Commission & Invoicing Engine | yes, now dormant (0% commission since Module 74) | §15 Billing & Plan (background) |
| 12 | Trust & Safety System | yes | §16 Settings (Identity verification); §18.10 Admin Trust & Safety |
| 13 | Seller Account Security (2FA + devices) | yes | §16 Settings → Security |
| 14 | Plans, Pricing & Business Guard-Rails | yes | §15 Billing & Plan; §18.15 Admin Plans |
| 15 | Customers, Reviews & Data Portability | yes | §5 Customers; §5c Reviews; §17.10 Reviews submission |
| 15.5 | Storefront Buyer Purchase Flow & Store Branding | yes | §17 Buyer-Facing Storefront; §16 Settings (Store branding) |
| 16 | Seller Onboarding Wizard | yes | §1 Home (Setup checklist) |
| 17 | Admin Control Plane completion | yes | §18.1–18.4, 18.24 Admin home/search/sellers/messages |
| 18 | External-SaaS Integration Hooks | yes | §7.6–7.7 Marketing hub (Meta feed, Social Media SaaS handoff); §18.22 |
| 19 | Product Design System (marketing site) | partial (Phases 1–2 only; superseded for dashboard/admin by the separate UI/UX Design Phase) | Out of scope for this document (storefront visual identity explicitly excluded) |
| 20 | Wallet / Prepaid Credits (superseded, see 73) | yes, now dormant | §15 Billing & Plan (background) |
| 21 | Hardening & Launch Readiness | yes | Cross-cutting, not a UI surface |
| 22 | Growth & Partner Programs (Ambassador/Student Referral/Creator + Careers) | yes | §15 Billing & Plan (real gap: no seller UI); §18.11–18.14, 18.28 Admin queues |
| 23 | Store Health Score + Verified Store Program | yes | §16 Settings → Store Health / Verified Store tabs; §18.8 |
| 24 | Seller Data Export to Personal Cloud Storage | yes | §13 Reports (Data export card) |
| 25 | Admin Terminal Completion | yes | §18 Admin Terminal (all pages) |
| 26 | Order Verification Channel Adapter | yes | §2c Order Verification settings |
| 27 | Orders Command Center + Tracking Timeline | yes | §2a Orders list (bucket tiles); §2b Order detail (timeline) |
| 28 | Inventory Management | yes | §4 Inventory |
| 29 | Delivery-Time Badges | yes | §17.2 Product page (DeliveryBadge); §11 Suppliers (data source) |
| 30 | WhatsApp Semi-Automation | yes | §7.5 Marketing hub → WhatsApp recovery; §2b Order detail (send links) |
| 31 | Automated Profit & Loss Engine | yes | §6b Profit & Loss |
| 32 | Gift Cards | yes | §7.3 Marketing hub → Gift Cards tab |
| 33 | Customer Segments | yes | §7.2 Marketing hub → Customer Segments tab |
| 34 | Email Campaigns | yes | §7.1 Marketing hub → Campaigns tab |
| 35 | Staff Accounts, plan-tier | yes | §14 Staff |
| 36 | Admin Email Section | yes | §18.25 Admin Email |
| 37 | Advanced Granular Admin Control | yes | §18.9 Admin moderation (force remove/restore) |
| 38 | Built-in Email Verification Service | **not built** | N/A — spec only |
| 39 | One-Click Shopify Migration | **not built** | N/A — spec only |
| 40 | Cost-Savings Calculator | **not built** | N/A — spec only (marketing-site widget) |
| 41 | Trust & Achievement Badge Engine | **not built** | N/A — spec only |
| 42 | Emotional & Retention Layer (milestone celebrations) | **not built** | §1 Home — flagged as PLANNED (founder-approved Phase 2 addendum), not live |
| 43 | Community & Belonging | **not built** | N/A — spec only |
| 44 | No Free Plan — First Month Entry Pricing rework | yes | §15 Billing & Plan (background) |
| 45 | Commission Rate Hard Cap | yes | background only, no UI |
| 46 | Self-Fulfilled Stock Protection | yes | §4 Inventory (trackInventory) |
| 47 | Wallet Balance Running Total & Reconciliation | yes | background only, no seller UI |
| 48 | Facebook/Instagram Shop Feed + WhatsApp Catalog Links | yes | §7.6 Marketing hub — confirmed **zero frontend**, tab content not yet built |
| 49 | Multi-Store Per Seller | yes | Cross-cutting (store switcher in Sidebar) |
| 50 | Product Organization at Scale | yes | §3a Products list (search/filter) |
| 51 | Bulk Product Operations | yes | §3a Products list (bulk actions) |
| 52 | Bulk Order Operations, Tracking Entry & Advanced Search | yes | §2a Orders list |
| 53 | Returns & Refunds Workflow | yes | §17.7 (buyer-facing); real gap — no seller-side entry point on Order detail, separate unlinked `/returns` page |
| 54 | Analytics Depth (seller-facing) | yes | §6a Analytics |
| 55 | Seller Notifications | yes | §16 Settings → Notifications (real gap: only one checkbox, no granular event control) |
| 56 | One-Click Full Export, Pro Gate | yes | §13 Reports (FLY-tier gate on Data export) |
| 57 | Invoice/Receipt Customization | yes | §13 Reports (Invoice customization card) |
| 58 | Advanced Store SEO Control | yes | §3b Products form (Advanced SEO card); §16 Settings (store-level Advanced SEO) |
| 59 | Combined Entry-Flow Payment | yes, now superseded/dormant (retired by Module 73) | §15 Billing & Plan (confirmed: does not exist as a separate screen) |
| 60 | Wallet/Commission Re-Verification vs Four-Tier Plans | yes | background only, no UI |
| 61 | Four-Tier Plan Pricing Model | yes | §15 Billing & Plan |
| 62 | Seller Payment Gateway Connect | yes | §12 Payments |
| 63–72 | Subscription Business Readiness (MRR analytics, retention window, renewal reminders, downgrade rule, gateway health, support SLA, health funnel, monthly report, discount-abuse prevention, refund policy) | **NOT BUILT** | Flagged individually at their natural homes: §12 Payments (gateway health), §18.21 Admin analytics (MRR, health funnel), §10 Shipping & Tracking (missing-tracking is a *different*, later-built item — see §88) |
| 73 | Subscription-Only Renewal Mechanism | yes | §15 Billing & Plan |
| 74 | Final Plans + First-Cycle Discount | yes | §15 Billing & Plan |
| 75 | Feature-Gate Ladder | yes | throughout (plan-gating sections per page) |
| 76 | Prepaid Partial-Advance, 5% | yes | §2c / §12 — confirmed **zero frontend surface**, real flagged gap |
| 77 | Verification-Channel Pricing | yes | §2c Order Verification settings |
| 78 | Referral Program Rename (Commerce Students Support) | yes | §15 Billing & Plan (real gap: no seller UI) |
| 79 | Ambassador Program Repricing | yes | §15 Billing & Plan (real gap: no seller UI) |
| 80 | Pricing Page Rebuild | yes | Out of scope (marketing site) |
| 81–88 | Buyer Experience Batch (buyer accounts, review media, live chat, shipping calculator, wishlist, stock countdown, image zoom/video, missing-tracking alert) | **NOT BUILT** | Flagged individually throughout §17 Buyer-Facing Storefront and §10 Shipping & Tracking |

---

## Part 2 — Cross-Cutting Patterns

### Global top bar

**Not built.** No search box, notification bell, or avatar/account menu exists anywhere in the codebase. `apps/web/app/(dashboard)/stores/[storeId]/layout.tsx` renders only `SupportModeBanner`, a conditional `orders_paused` billing Alert, and `Sidebar` + `PlatformMessages` inside `<main>`. `Sidebar.tsx` itself contains only the store switcher and nav links (plan name shown as small text under Settings) — **no account/avatar menu exists at all**, not even a visible logout button, a real gap worth flagging on its own.

`PlatformMessages` is **not** a notification bell — it's an admin-authored broadcast renderer (banner/popup/in-app-notification channels, targeted all/plan/seller, scheduled via start/end window), fetched once on mount with no polling, no unread count, no bell icon. It renders inline above page content, not in a header dropdown, and carries no personal event stream (no order/verification/low-stock events flow into it — those all go through email instead, see below). A proper global top bar is genuinely new Phase 2+ work.

### Breadcrumb pattern

**Not built.** Zero matches for "breadcrumb" anywhere in the dashboard tree. Nested detail pages (`customers/[customerId]`, `orders/[orderId]`) have no trail — only Sidebar active-link highlighting and each page's own `PageHeader` title provide context.

### Toast/banner notification system — every real trigger

**There is no in-app toast component anywhere in the codebase.** Every real "notification" mechanism is either a page-level `Alert`, `PlatformMessages`' admin broadcast, or a transactional **email** — never an in-app toast.

| Trigger | Source | Mechanism | Frontend consumer? |
|---|---|---|---|
| Order confirmed | `orders.service.ts` `markAsPaid()` | Buyer email | No |
| Order shipped | `orders.service.ts` `uploadTracking*()` | Buyer email | No |
| Order delivered | `orders.service.ts` `markItemDelivered()` | Buyer email | No |
| Order manual status change | `orders.service.ts` `changeStatus()` | **None at all** — timeline event only | N/A |
| Verification failed (too many attempts) | `order-verification.service.ts` `alertSellerVerificationFailed()` | Seller email | No |
| Low stock | `inventory.service.ts` `checkAndAlertLowStock()`, debounced via `lowStockAlertSentAt` (one alert per dip, not per sale) | Seller email | No |
| Daily sales summary | `seller-notifications/daily-sales-summary.*` | Seller email | No |
| Platform newsletter | `seller-notifications/platform-newsletter.*` | Seller email | No |
| Platform message (banner/popup/in-app) | `messaging/platform-messages.service.ts`, targeted all/plan/seller, scheduled | In-app render | **Yes** — `PlatformMessages.tsx` |
| New order alert | wired directly in `CheckoutService` (per Module 55's own doc comment) | Seller email | No |
| Seller milestone reached | **not yet built** — no `platform_events` type exists for this; a real `platform_events` table exists but is used exclusively as an audit log (auth/moderation/trust-safety/impersonation), never seller-facing celebration | — | No — needs both emitter and consumer |
| Gateway health alert | **NOT FOUND** — `PaymentGatewayService.testConnection()` is seller-initiated/on-demand only, no scheduler, no stored health state (confirms the Subscription Business Readiness batch, Modules 63–72, is unbuilt) | — | No |
| Plan renewal reminder | **NOT FOUND** — `plan-fee-debit.service.ts`'s own comment confirms the renewal sweep is dormant; renewal only happens via admin manual verification, no pre-expiry reminder logic anywhere | — | No |

**Bottom line:** real, working transactional-email triggers exist for order lifecycle, verification failure, low stock, and digests — but zero in-app toast infrastructure. Every one would need a frontend consumer built from scratch for in-app surfacing. `PlatformMessages` is the only thing that renders in-app today, and it's admin broadcast content, not a personal event stream.

### Status pill color/label mapping — proposed master table

`components/ui/Badge.tsx` defines exactly 5 tones: `neutral`/`success`/`warning`/`danger`/`info`. **One real precedent exists** — `customers/[customerId]/page.tsx`'s `statusTone` map for `OrderStatus`: `pending→warning, confirmed→info, shipped→info, delivered→success, completed→success, cancelled→neutral, disputed→danger`. Everything below is a **proposal**, not existing system, noting where it agrees/disagrees with that one precedent.

| Enum | Real values | Proposed tone mapping |
|---|---|---|
| `OrderStatus` | pending, confirmed, shipped, delivered, completed, cancelled, disputed | warning/info/info/success/success/**danger** (⚠️ disagrees with the real precedent's `neutral`)/danger |
| `PaymentStatus` | pending, succeeded, failed, refunded | warning/success/danger/neutral |
| `OrderVerificationStatus` | pending, verified, failed, expired | warning/success/danger/neutral |
| `ModerationStatus` | not_required, pending, approved, rejected, admin_removed | neutral/warning/success/danger/danger |
| `SubscriptionStatus` | active, cancelled | success/neutral |
| `StoreStatus` | active, orders_paused, suspended, banned, archived | success/warning (recoverable grace state)/danger/danger/neutral |
| `ProductStatus` | draft, active, archived | neutral/success/neutral |
| `ReviewStatus` | pending, approved, hidden | warning/success/neutral |
| `GiftCardStatus` | pending_payment, active, depleted, expired, cancelled | warning/success/neutral/neutral/danger |
| `ReturnRequestStatus` | requested, approved, rejected, completed | warning/info/danger/success |
| `StaffAccountStatus` | active, revoked | success/danger |
| `ProgramParticipantStatus` | pending, approved, rejected, suspended, terminated | warning/success/danger/danger/danger |
| `VerifiedStoreApplicationStatus` | pending_review, approved, rejected | warning/success/danger |
| `JobApplicationStatus` | received, reviewing, interviewing, rejected, hired | neutral/info/info/danger/success |
| `KycStatus` | unverified, pending, verified | neutral/warning/success |
| Discount code `isActive` (plain boolean, not an enum) | true/false | success "Active" / neutral "Inactive" |

The `cancelled` disagreement above (danger vs. the real precedent's neutral) needs a founder call before this becomes platform-wide — right now the codebase has exactly one instance of this decision, not a system.

### Confirmation-dialog pattern — every destructive action platform-wide

**Seller dashboard: zero confirm steps exist anywhere** — confirmed by grep across the whole dashboard tree for `window.confirm`/`confirm(`/any Dialog-based confirmation. Every `.delete(...)` call site fires immediately: bulk delete products (`products/page.tsx`, applied via `Promise.allSettled` across every selected product — no confirm even for multi-select bulk delete), discount code deletion, staff removal, and (by tree-wide absence of any confirm pattern) collections/customer-segments/domains/marketing/order-verification/orders/settings deletions too.

**Admin terminal: fixed (FR-8.16, shipped post-audit).** At the time of this audit, exactly one real confirm gate existed platform-wide — `admin/settings/page.tsx`'s `isHighImpact()` check (`key.startsWith("billing.") || key.includes("commission") || key.startsWith("platform.maintenance")`), a hardcoded frontend heuristic triggering a native `window.confirm()`. That finding drove a dedicated fix batch, now shipped: a shared `useConfirm()` hook (`components/admin/ConfirmDialogProvider.tsx`, built on the existing Radix `Dialog` primitive, mounted once in `admin/layout.tsx`) that every admin screen now imports rather than copy-pasting its own confirm logic. Money/value-changing actions show an explicit old→new row (the same pattern the Settings Registry editor pioneered); irreversible/high-blast-radius actions use `tone: "danger"`; sending a newsletter — the single highest-blast-radius action in the terminal, a broadcast to every seller — additionally requires typing "SEND" before the button enables. The hardcoded `isHighImpact()` string-match is gone: `requiresConfirmation` is now a real boolean field on `SettingsDefinition` (seeded `true` on the same 29 keys the old heuristic covered), resolved through `GET /admin/settings/resolve` and read by *both* the standalone Settings Registry editor and Seller-360's settings-override mini-editor — closing the gap where the mini-editor bypassed high-impact protection entirely. The two `window.prompt()` calls that remain (impersonation-start reason, growth-program suspend/terminate reason) are still not confirm gates — they capture an audit-trail reason string; the action proceeds the instant *any* string is entered — but neither was in scope for this fix.

**Seller dashboard: still zero confirm steps anywhere** (out of scope for FR-8.16, which covered only the admin terminal) — confirmed by grep across the whole dashboard tree for `window.confirm`/`confirm(`/any Dialog-based confirmation. Every `.delete(...)` call site fires immediately: bulk delete products (`products/page.tsx`, applied via `Promise.allSettled` across every selected product — no confirm even for multi-select bulk delete), discount code deletion, staff removal, and (by tree-wide absence of any confirm pattern) collections/customer-segments/domains/marketing/order-verification/orders/settings deletions too. This remains a real, open gap the founder should prioritize as a follow-up — the admin terminal is no longer the platform's weak point on this axis, the seller dashboard now is.

| Action | Real confirm today? |
|---|---|
| Bulk delete products (seller) | No |
| Discount code deletion (seller) | No |
| Staff removal (seller) | No |
| Gift card actions (seller) | No (inferred — no confirm pattern exists anywhere in the dashboard tree) |
| Campaign send (seller) | No |
| Plan downgrade (seller) | **NOT FOUND — flag for founder to locate/verify** |
| Refund/return approval (seller) | **NOT FOUND — flag for founder to locate/verify** |
| Settings-registry high-impact key changes (admin, standalone editor) | **Yes** — `useConfirm()`, data-driven `requiresConfirmation` field |
| Settings-registry high-impact key changes (admin, Seller-360 mini-editor) | **Yes** — same `requiresConfirmation` field, gap closed |
| Wallet adjust (admin, Seller-360) | **Yes** — `useConfirm()`, shows old→new balance |
| Clawback (admin, Seller-360) | **Yes** — `useConfirm()`, danger tone, shows old→new balance |
| Seller ban/suspend/lifecycle change (admin, Sellers list + Seller-360) | **Yes** — `useConfirm()`, danger tone on suspended/banned |
| Mark paid (admin, Commission invoices) | **Yes** — `useConfirm()` |
| Waive commission (admin, Commission invoices) | **Yes** — `useConfirm()`, danger tone |
| Complete refund (admin, Returns & Refunds) | **Yes** — `useConfirm()`, danger tone, shows refund amount |
| Force remove product (admin, Moderation queue) | **Yes** — `useConfirm()`, danger tone |
| Moderation bulk approve/reject (admin) | **Yes** — `useConfirm()` |
| Wallet top-up bulk verify/reject (admin) | **Yes** — `useConfirm()`, danger tone on reject |
| Retire plan (admin) | **Yes** — `useConfirm()`, danger tone |
| Regenerate API client secret (admin) | **Yes** — `useConfirm()`, danger tone |
| Supplier adapter enable/disable (admin) | **Yes** — `useConfirm()`, danger tone on disable |
| Impersonation start (admin) | No true confirm — reason-prompt only (unchanged, out of scope) |
| Delete platform message (admin) | **Yes** — `useConfirm()`, danger tone |
| Unlink email account (admin) | **Yes** — `useConfirm()`, danger tone |
| Send newsletter to whole platform (admin) | **Yes** — `useConfirm()`, danger tone, **types "SEND" to enable** |

**Bottom line:** the admin terminal's confirmation coverage is now systematic rather than accidental — every destructive/money-moving action the audit flagged goes through the same shared, data-driven mechanism, styled with `Dialog.tsx`'s current (intentionally minimal) look pending Phase 6's admin-terminal re-skin. The seller dashboard's near-total absence of confirm steps is the platform's next-highest-leverage gap on this axis.

### Onboarding/setup-progress strip (Module 16)

Confirmed exactly 4 steps, real completion logic (`StoresService.getOnboardingProgress`):
1. **theme** — `!!store.onboardingThemeAckAt` (explicit ack only — either "Keep this theme" or a real theme-settings save; not auto-true from a default theme existing).
2. **logo** — `!!store.logoMediaId` (true the instant any logo is set, no ack needed).
3. **product** — `productCount > 0`, **any** status counts including drafts — "has the seller touched product creation at all," not a publish check.
4. **domain** — `!!store.onboardingDomainAckAt || domainCount > 0` (explicit "use free subdomain" ack, or a real attached domain).

Once all 4 are true, `onboardingCompletedAt` is stamped permanently and sticky — deleting the only product later can never resurrect the wizard.

**Frontend — confirmed NOT a progress-bar strip.** While incomplete, the wizard **fully replaces** Home (`page.tsx`) — not a strip alongside other content. Exact copy: title **"Get your store ready"**, description **"{N} of {4} steps done - complete them to finish setting up your store."** Rendered as a "Setup checklist" Card, 4 rows, each a "Done" (success) / "To do" (neutral) Badge. Exact step copy and button labels:

| Step | Description | Button(s) |
|---|---|---|
| Pick a theme | "Choose how your storefront looks, or keep the default." | "Choose a theme" (→ Customizer) / "Keep this theme" (ack) |
| Set a logo | "Shown on your storefront, invoices, and order emails." | "Upload a logo" (→ Settings) |
| Add a product | "Give it a title, a price, and a quantity to get started." | "Add a product" (→ new product) |
| Configure a domain | "Attach your own domain, or use the free uzeyn.com subdomain." | "Add a domain" (→ Domains) / "Use free subdomain" (ack) |

A completed step's button disappears entirely — only outstanding steps show an action. This confirms the founder's original brief assumption (a KPI-gauge dashboard already sitting behind/above this strip) does not match reality — see §1 Home for the full picture.

---

# Part 3 — Seller Dashboard

## 1. Home

**File:** `apps/web/app/(dashboard)/stores/[storeId]/page.tsx`
**Nav:** Main menu → Home (`LayoutDashboard` icon)
**Plan-tier gating:** none.

### ⚠️ Headline finding
The founder's brief assumed Home already renders 4 KPI gauges, a revenue chart, a weekly bar chart, a recent-orders list, and a milestone banner. **None of that is true today.** The real page is a 4-state sequential gate (onboarding → empty-products → unpublished → dashboard), and the final "dashboard" state renders only two plain stat cards (Products count, Orders awaiting payment). No analytics call, no chart, no recent-orders list, no milestone banner exist in this file. Everything below the state-gate description is a **design target backed by real endpoints**, not a reskin of existing UI.

### Screen states, in real render order

**State 1 — Onboarding wizard** (while `!onboarding.completedAt`)
- Data: `GET /stores/:storeId/onboarding` → `StoresService.getOnboardingProgress`. Each step derived from real state: `theme` = `store.onboardingThemeAckAt` set; `logo` = `store.logoMediaId` set; `product` = `product.count > 0`; `domain` = `store.onboardingDomainAckAt` set OR a domain row exists. Once all 4 true, server stamps `onboardingCompletedAt` permanently — sticky, this state never shows again.
- Card "Setup checklist" — one row per step, `Badge` "Done"/"To do".
- Buttons (exact labels): "Choose a theme" (→ `/customizer`) / "Keep this theme" (POST `.../onboarding/theme-ack`) · "Upload a logo" (→ `/settings`) · "Add a product" (→ `/products/new`) · "Add a domain" (→ `/domains`) / "Use free subdomain" (POST `.../onboarding/domain-ack`).

**State 2 — Empty-products gate** (onboarding done, 0 products)
- "Welcome to your store" card, button "Add a product" → `/products/new`.

**State 3 — Unpublished gate** (products exist, `!store.publishedAt`)
- "Publish your store" — button "Publish store" → `POST /stores/:storeId/publish` (`WalletGraceLadderService.publish`), which throws real, specific errors surfaced via Alert: "Configure at least one payment method before publishing this store." / "Complete identity verification (CNIC) before publishing this store."

**State 4 — Dashboard (real steady state)**
- Two `Card`s only: **Products** (links to `/products`, shows count) and **Orders awaiting payment** (client-computed from `GET /stores/:storeId/orders?limit=100`, filtered `status === "pending"` — not a dedicated stat endpoint).

### The 4 KPI gauges — verified real, endpoint-backed, not yet wired
| Gauge | Real source |
|---|---|
| Sales (30d) | `GET /stores/:storeId/analytics/sales-over-time` → sum `orderCount` |
| Revenue (30d) | same endpoint → sum `revenue` |
| AOV | `GET /stores/:storeId/analytics/overview` → `aov` |
| Repeat Customers | same endpoint → `repeatCustomerRate` |

`overview` does **not** return revenue/order-count directly — Sales/Revenue must come from summing `sales-over-time`, not `overview`. `GET /stores/:storeId/pnl/period` is a real alternative (true net-profit framing) but returns full P&L, not a plain revenue figure — pick one.

### Recent orders list
**Not on this page today.** The orders fetch exists (`limit=100`) but only its length is used. Real list fields available without a backend change: `orderNumber`, `buyerEmail`, `status`, `totalAmount`, `placedAt`, `tags` — **no `customer` relation is included** in the list query (`orders.service.ts`), so a joined customer name/avatar needs either a separate fetch or a one-line service `include` change (see §5's `initialsFor()` decision: real name preferred, buyerEmail fallback).

### Milestone celebration banner
**Confirmed: does not exist in code.** Repo-wide search for "milestone" returns zero matches outside planning docs. **PLANNED, not yet built** (Module 42, approved as a Phase 2 addendum per the founder's own reply in this engagement): a `platform_events`-based `seller.milestone_reached` event (first-ever confirmed order + configurable order-count/revenue thresholds via new Settings Registry keys), a dismissible frontend banner. Do not design as if live — nothing about its exact shape exists in code yet.

- **Buttons/actions:** navigational only in State 4.
- **Icons:** none (no lucide-react import in this file).
- **Empty state:** State 2 uses inline copy, not the shared `EmptyState` component.
- **Loading:** `PageSpinner` while any of products/orders/onboarding/store is null.
- **Error:** only the publish action has visible error handling (`Alert`); every other fetch fails silently (`.catch(() => fallback)`).
- **Modals:** none.
- **Real-time:** none.
- **Mobile:** relies entirely on the shared Sidebar drawer + a `sm:grid-cols-2` on the two stat cards.

---

## 2. Orders

### 2a. Orders list
**File:** `apps/web/app/(dashboard)/stores/[storeId]/orders/page.tsx`
**Nav:** Main menu → Orders (`ShoppingBag` icon)
**Plan-tier gating:** none.

**Sections, top to bottom:**
1. `PageHeader` "Orders" / "What needs your attention, at a glance, plus every order placed on your store."
2. **Bucket strip** (this IS "the Orders Command Center" — not a separate screen) — 7 clickable tiles from `GET /stores/:storeId/orders/overview`, exact mutually-exclusive predicates:

| Bucket | Predicate |
|---|---|
| Pending | `status: pending`, not awaiting-verification, not prepaid-received |
| Awaiting verification | `status: pending` AND `verification.status: pending` |
| Prepaid received | `status: pending` AND `verification.channel: prepaid_confirmation` AND `verification.status: verified` |
| Awaiting tracking | `status: confirmed` |
| Shipped | `status: shipped` |
| Delivered | `status: in [delivered, completed]` |
| Cancelled/returned | `status: in [cancelled, disputed]` |

Below the tiles: conditional "*N* supplier-fulfilled item(s) still awaiting fulfillment" line.
3. **Filter card** — Status, Placed from/to (`datetime-local` — **real full timestamp, not date-only**, confirming Module 52's time-range claim), Payment state, Verification state, Courier (text), Customer (email/name text), Min/Max amount. Footer: "*N* order(s) match".
4. **Bulk tracking upload card** — hidden file input `.csv`, button "Upload tracking CSV" → `POST .../tracking-import-jobs`. Recent jobs (last 3) with status Badge + up to 5 inline row-error messages.
5. **Bulk-action panel** (≥1 selected) — select action → confirm step (first 5 order numbers + "and N more") → **Confirm**/**Cancel**. Client-side fan-out via `Promise.allSettled` over per-order endpoints (no dedicated bulk endpoint):

| Bulk label | Per-order call |
|---|---|
| Mark as paid | `POST .../mark-as-paid` |
| Mark items delivered | `POST .../items/:itemId/deliver` per item |
| Cancel | `PATCH .../status {status:"cancelled"}` |
| Mark disputed | same, `{status:"disputed"}` |
| Mark completed | same, `{status:"completed"}` |

6. **Order list** — card rows (not `<table>`), select-all header + per-row checkbox. Row: order number + buyer email (line 1), placed date + amount + tags (line 2), status Badge. Fixed sort (`placedAt desc`), no column sort.
7. **Pagination.**

- **Empty state:** real `EmptyState` — "No orders match this filter" / "No orders yet".
- **Loading:** `PageSpinner`.
- **Error:** overview/list fetches fail silently; bulk/CSV/tracking errors surface inline (never a toast).
- **Icons:** none.
- **Modal:** none — bulk confirm is an inline expanding panel.

### 2b. Order detail
**File:** `apps/web/app/(dashboard)/stores/[storeId]/orders/[orderId]/page.tsx`

**Sections, top to bottom:**
1. `PageHeader` — "Order from {buyerEmail}", action "Back to orders".
2. Status bar — status Badge + source ("Manually created"/"Placed on storefront") + conditional action buttons.
3. **Order timeline** — the same computed timeline the buyer sees (`OrderTimelineUtil.computeOrderTimeline`), 5 fixed stages (placed/confirmed/shipped/delivered/cancelled), dot + label + timestamp.
4. **Items** — per item: product/variant, qty × price, "· supplier-fulfilled" suffix if applicable, fulfillment-status Badge, tracking updates, inline Tracking ID/Carrier + "Save tracking" + conditional "Mark delivered" (non-supplier items only). Totals breakdown below.
5. **Costs & profit** (only for confirmed/shipped/delivered/completed) — Courier cost / Handling cost inputs + "Save costs"; real P&L breakdown from `GET .../pnl/orders/:orderId` (Revenue/Commission/COGS/Courier+handling/Net profit) + incomplete-cost warning line.
6. **Shipping address** — read-only.
7. **Tags** — comma-separated input + "Save tags".
8. **Internal notes** (Disclosure) — textarea "Only visible to you, never the buyer." + "Add".
9. **Timeline (raw events)** — second, separate Disclosure of `OrderTimelineEvent` rows (status_changed, tracking_uploaded, note_added, item_delivered, edited, supplier_order_forwarded).

**Buttons:** "Send WhatsApp confirmation" / "Send shipping update" (conditional on buyerWhatsapp + status, opens `wa.me` deep link in new tab) · "Mark as paid" (status===pending only, no confirm, gated server-side on order-verification clearance) · per-item "Save tracking"/"Mark delivered" · "Save costs" · "Save tags" · "Add" note. **None show a toast** — every success path silently reloads.

### ⚠️ Confirmed gaps on this page
1. **Verification status + resend action: NOT FOUND.** Real backend exists and is unused: `GET/POST .../verification`, `POST .../verification/resend`, `POST .../verification/mark-prepaid-received` (`seller-verification.controller.ts`). The order's `verification` relation isn't even fetched by `OrdersService.getOne()`.
2. **Returns/refund initiation: NOT FOUND on this page.** Returns is a wholly separate, currently unlinked page (`/returns`) — real, working (approve/reject/complete with refund amount), not surfaced from order detail.

### The tracking-upload paths, precisely named
1. Seller manual, item-level (`POST .../items/:itemId/tracking`).
2. Seller manual, order-level quick-entry (`POST .../tracking` — applies to every not-yet-shipped item at once); used by both Order detail and the Orders-list inline quick-entry row.
3. Seller bulk CSV (`POST .../tracking-import-jobs`), shares the same underlying write path as #2.
4. **Supplier-forwarded tracking — a different role, not the seller** (`POST suppliers/portal/order-items/:orderItemId/tracking`), via the separate Supplier Portal. Supplier-fulfilled items hide the seller's tracking-entry form entirely — read-only display of whatever the supplier uploaded.

- **Loading/error:** `PageSpinner`; every mutation shows inline `Alert tone="danger"` with the real message (unlike the list page, nothing fails silently here).
- **Icons:** none. **Modal:** none (Disclosure, not modal). **Real-time:** none.

### 2c. Order Verification Channel settings
**File:** `apps/web/app/(dashboard)/stores/[storeId]/order-verification/page.tsx`
**Nav: NOT in the sidebar today** — reachable only by direct URL; planned to become an Orders-hub tab (Phase 3), homed there per the founder's own "under Orders or Settings" choice.

**Plan gating, real, 5-value channel list confirmed in the DTO** (`["none","whatsapp_otp","email_otp","prepaid_confirmation","prepaid_partial_advance"]`):
- `whatsapp_otp` → `orders.whatsapp_verification_enabled`, off by default, **RUN+**
- `prepaid_partial_advance` → `orders.prepaid_partial_advance_enabled`, off by default, **RUN+**
- `email_otp`, `prepaid_confirmation` → never gated, free every tier

### ⚠️ Confirmed real gap
The page's `CHANNEL_LABEL` map has only **4** entries — `prepaid_partial_advance` (Module 76, real, RUN+, backend-complete with a dedicated adapter and gateway-connection check) **is not selectable anywhere in this dashboard.** It does not live "elsewhere under Payments" — it has no UI at all. Design target: 5th option on this page, with plan-upsell messaging and a dependency on an active gateway connection.

**Sections:**
1. "Verification channel" card — Channel select (4 real options today) + OTP message template textarea (`{{otp}}` placeholder, `maxLength=1000`) + Save.
2. "Connected sender emails" card — list (email, `host:port`, sends-today, active/revoked Badge, Revoke) + connect form (email, SMTP host/port/username/password). Copy claims "up to 5 connected" — **not independently confirmed as a hard-enforced limit in the service read; flag for verification before treating as enforced.**

- **Empty state:** real — "No sender emails connected yet."
- **Loading/Error:** `PageSpinner` / `Alert tone="danger"`.
- **Icons/Modal:** none.

---

## 3. Products

### 3a. Products list
**File:** `apps/web/app/(dashboard)/stores/[storeId]/products/page.tsx`
**Nav:** Main menu → Products (`Package` icon)

**Plan gating:** real, on *create* only — `catalog.product_limit`, seeded **GO 100 / RUN 100 / RISE 500 / FLY 100,000**. Enforced server-side on `POST /products`; **no visible "N/100 used" indicator anywhere on this page** — a real gap, the limit is invisible until hit.

**Sections:** Filter card (Search title/SKU, Tag, Stock status, Category, Moderation state, Min/Max price) → Bulk-action panel → Product list (card rows, select-all) → Pagination.

**Bulk actions** (client-side fan-out, no dedicated bulk endpoint):

| Label | Per-item call |
|---|---|
| Publish/Unpublish/Archive | `PATCH .../:id {status}` |
| Delete | `DELETE .../:id` |
| Update price | `PATCH .../variants/:id {price}` (fixed-Rs or percent mode) |
| Update stock | `POST .../inventory/:variantId/adjust` |
| Assign category | `PATCH .../:id {categoryId}` |
| Assign to collection | `POST .../collections/:id/products` |
| Add tag | `PATCH .../:id {tags:[...]}` |

**Real enum correction:** `Product.status` is 3-value (`draft`/`active`/`archived`) — there is **no `under_review` status value**. "Under review" is the *separate* `moderationStatus` field (`not_required`/`pending`/`approved`/`rejected`/`admin_removed`), independent of publish state.

- **Empty:** real `EmptyState`. **Loading:** `PageSpinner`. **Error:** list fetches fail silently; only bulk-action failures surface inline. **Icons:** none.

### 3b. Product create/edit form
**Files:** `products/new/page.tsx`, `products/[productId]/page.tsx`, `ProductForm.tsx`, `ImagesSection.tsx`, `VariantsSection.tsx`

**ProductForm fields:** Title (required, ≤200) · Description (textarea) · Category (select) · Status (draft/active/archived) · Tags (comma-separated) · SEO title/description (behind a Disclosure, fall back to title/description).

**ImagesSection — richer than "images only," confirmed real:** upload accepts `image/*,video/*` (`MediaAsset.type` is a real 2-value enum, image/video) — **video IS wired end-to-end**, not images-only. Reorder (↑/↓, persisted, optimistic w/ rollback), Set primary, Remove (detach not delete), attach unattached store media, Google Drive import (OAuth connect → browse → multi-select import). **No zoom/lightbox UI exists** in this component — upload/attach/reorder/primary only.

**VariantsSection:** SKU/Price/Stock per variant, saves `onBlur`. Add-variant form: SKU/Price/Stock.

### ⚠️ Most concrete, well-evidenced gap in the whole Products area
`ProductVariant.baseCost` is a real, nullable schema column, and both create/update variant DTOs fully accept it — **the backend is 100% ready.** `VariantsSection.tsx`'s `Variant` interface has **no `baseCost` field anywhere** — not in the interface, the add-form, or per-row edit inputs. Sellers currently have **no way to enter base cost anywhere in this dashboard**, which directly explains the "incomplete" P&L warning already visible on Order Detail (§2b) and the P&L page (§6b).

**Advanced SEO card** (Module 58, RISE/FLY-gated server-side): canonical URL, custom slug, 4 robots/OG/structured-data/sitemap checkboxes (all default `true`), social preview title/description. **Card renders unconditionally for every plan tier client-side** — a GO/RUN seller only discovers the block via a raw error on save, not a proactive lock/upsell.

**Supplier-sourced products:** VariantsSection replaced with a read-only Alert — "managed by them, not editable here."

- **Loading:** `PageSpinner` (edit only). **Error:** `Alert` with real message, no silent-failure paths (unlike the list pages). **Icons:** none. **Modal:** none, including the Drive picker (inline, not modal).

---

## 4. Inventory

**File:** `apps/web/app/(dashboard)/stores/[storeId]/inventory/page.tsx`
**Nav:** Main menu → Inventory (`Boxes` icon)
**Plan gating:** none.

**Purpose:** dedicated read/adjust surface over `ProductVariant.stockQuantity`, distinct from the Products catalog screen.

**Layout:** "Low stock only" checkbox (client-side filter, threshold shown inline) → variant row-list (not a `<table>`) — product title, SKU, stock, Low-stock Badge → expandable row (accordion) with an adjust-stock mini-form (Type: Add/Remove/Set to; Amount; Reason, all required) + "Save adjustment" (**no confirm step**) + adjustment history (`{before} → {after} — {reason}`, real audit trail: `StockAdjustment` model captures who/when/why — `adjustedByUserId` from JWT).

**Real gaps confirmed:**
- Low-stock threshold (`inventory.low_stock_threshold`, default 5) is **displayed but has no settings-UI to change it anywhere in the frontend** — DB/global-settings-level only.
- `trackInventory` (the Module 46 self-fulfilled stock-protection flag) is fetched by the API but **never rendered** — no lock/protected/untracked indicator per row despite the data being available.
- Bulk stock edit exists (real CSV endpoint) but lives on the separate **Import & export (Data)** page, not embedded here.

- **Icons:** none. **Empty:** real `EmptyState` (two variants — "No variants yet" / "No variants match"). **Loading:** `PageSpinner`. **Error:** plain red text, not the shared `Alert`. **Modal:** none — accordion, not drawer. **Real-time:** none in-UI; a low-stock **email** (not toast) fires server-side, debounced via `lowStockAlertSentAt`.

---

## 5. Customers (+ Reviews)

**Files:** `customers/page.tsx`, `customers/[customerId]/page.tsx`, `reviews/page.tsx`
**Nav:** Main menu → Customers (`Users` icon); Growth → Reviews (`Star` icon, own top-level item, not nested under Customers)
**Plan gating:** none on Customers/Reviews themselves. (Adjacent: Customer *Segments* creation is RISE+FLY-gated — see §7.2.)

### 5a. Customers list
Search (name/email, no debounce — fires every keystroke) + Sort (Total spent/Order count/Most recent order) → row-list (name-or-email, email/order-count/last-order, total spent) — no pagination, no bulk-select. Real fields include `unsubscribedAt`/`unsubscribeToken` (campaign suppression) that exist in the schema but **are not surfaced anywhere on either Customers page.**

### 5b. Customer detail
Stat strip (Orders/Total spent/First order/Last order, + Phone if set) → Order history list (status Badge, `pending` relabeled "awaiting payment" in the UI). **No pagination.** **Segment membership: NOT FOUND on this page** — Customer Segments only works in the opposite direction (browse a segment → see its members); there is no reverse lookup.

### 5c. Reviews (moderation queue)
Status filter (Awaiting moderation/Approved/Hidden/All) → row-list (product + star rating as literal ★/☆ characters, buyer name + date, "verified purchase" Badge if applicable, body text) → **Approve**/**Hide** buttons, single-click, **no confirm step**, no toast — row updates/disappears on filter mismatch.

Verified-purchase logic: order must be `confirmed`-or-beyond AND contain the reviewed product (Financial Truth Invariant). Moderating instantly recomputes the product's `averageRating`/`reviewCount`.

**Media (photo/video) support: NOT FOUND.** `ProductReview` has no media columns at all (`id, storeId, productId, orderId?, buyerName, buyerEmail, rating, body, isVerifiedPurchase, status, createdAt`). This buyer-experience-batch capability does not exist in the backend.

**Wishlist-save counts: NOT FOUND anywhere** — zero matches for "wishlist" in the entire codebase, no model, no endpoint, nothing seller-visible.

- **Icons:** none anywhere in this trio (star rating uses literal Unicode, not the lucide `Star` used at nav level). **Modals:** none on any of the three pages. **Loading:** `PageSpinner`. **Error:** inline text/`Alert` depending on page.

---

## 6. Analytics (+ Profit & Loss)

### 6a. Analytics
**File:** `analytics/page.tsx` · **Nav:** Growth → Analytics (`BarChart3`) · **Gating:** none.

Real endpoints, all Financial-Truth-gated (confirmed+ orders only, except return-rate which also counts refunded/partially-refunded):
- `GET .../analytics/top-products?by=revenue|units&limit=1-100`
- `GET .../analytics/sales-over-time?bucket=day|week|month&start&end` (30-day rolling default if omitted)
- `GET .../analytics/overview` → `{repeatCustomerRate, returnRate, aov, bestDayOfWeek, bestHourOfDay}`
- `GET .../analytics/return-rate-by-product` — **real, exists, has no frontend consumer today.**

**Layout:** 4-tile stat row (Repeat customers %, Return rate %, AOV, "Best time to sell" from a hardcoded day-name array) → Sales-over-time card (Day/Week/Month toggle, recharts LineChart) → Top products card (revenue/units toggle, horizontal BarChart). **No date-range picker in the UI** despite the backend supporting `start`/`end`. No raw data table anywhere — charts only.

- **Icons:** none directly (charts via recharts). **Modal:** none. **Empty (implicit):** "No confirmed sales..." copy per chart.

### 6b. Profit & Loss
**File:** `pnl/page.tsx` · **Nav: not in the sidebar at all today** — real, working, reachable only by direct URL (`nav-items.ts` roadmap comment confirms it's slated to become an Analytics-hub tab).

Real endpoints: `GET .../pnl/orders/:orderId` (unused by this page — meant for an Orders-detail tab later), `GET .../pnl/period?periodStart&periodEnd`, `GET/POST .../pnl/ad-spend`.

**Profit formula (exact):** `revenue = totalAmount − taxAmount`; `netProfit = revenue − commission − cogs − courierCost − handlingCost (− adSpend for periods)`. `cogs = Σ(baseCost ?? 0) × qty`; `incomplete: true` the instant any item's variant has `baseCost === null` (never silently treated as 0).

**Layout:** Period picker (From/To dates + "View" button — **not auto-refetched on date change**) → incomplete-cost warning Alert (exact copy: *"...net profit is understated until you add it on that product's variant."*) → Revenue/Net-profit stat pair → Breakdown line list → Ad-spend card (manual entry form + CSV upload with a **fixed 1500ms `setTimeout`** before refresh — a genuinely fragile pattern, flagged for redesign — + entry list with Manual/CSV source Badge).

**Inconsistencies flagged:** period-view date inputs have no explicit server-side malformed-date guard (unlike Analytics' `sales-over-time`, which does guard). No `EmptyState` component for zero ad-spend entries (silently renders nothing, unlike the rest of the product).

- **Icons:** none. **Loading:** `PageSpinner` only on first load. **Modal:** none — CSV upload uses a hidden native file input.

---

## 7. Marketing hub

Locked nav: **Growth → Marketing**, one item, internal tabs over 6 real currently-separate routes. **No page in this hub imports lucide-react** — every button/action is text-only. **No plan-tier lock/upsell UI exists anywhere in this hub** — gated actions 403 with a raw message only.

### 7.1 Tab: Campaigns
`campaigns/page.tsx` · Module 34. Gating: not feature-gated, only *volume*-gated via `email_campaigns.monthly_send_limit` (**GO 799/mo, RUN 2,499/mo, RISE 10,000/mo, FLY 1,000,000,000 sentinel**) — **quota never displayed on this page**, only discoverable via a rejected-send error message.

Compose form: Segment (select), Send from (select, connected sender emails), Subject (≤200), Message (textarea, ≤20,000) → "Send campaign" (**no confirm step** despite being an irreversible send-to-many action). Campaign list: subject, segment/sender/date, sent/failed counts, status Badge. **Unsubscribe stats: NOT FOUND** — never aggregated/displayed anywhere, even though unsubscribed customers are excluded at send time.

### 7.2 Tab: Customer Segments
`customer-segments/page.tsx` · Module 33. **Create** is real-gated: `customer_segments.enabled`, off by default, **RISE+FLY**. Read (list/view/preview) is explicitly ungated.

Filter-builder form: Name, Min/Max orders, Min/Max total spent, Last-order after/before, City, Country — all 8 criteria optional. **No live member-count preview while building** despite a real `POST .../preview` endpoint existing unused. Segment list: name, computed criteria summary, live member-count Badge, expand-to-view-members, **Delete with no confirm step.**

### 7.3 Tab: Gift Cards
`gift-cards/page.tsx` · Module 32. **Seller-issue** is real-gated (`gift_cards.enabled`, off default, **RISE+FLY**); buyer-purchase path is ungated.

Issue form: Amount (required, positive), Code (optional, auto-generated if blank), Note (optional). List: code, source, balance/initial-value, status Badge, "Confirm payment received" (pending_payment rows only, **no confirm dialog** despite being a financial-state change). **Redemption history: NOT FOUND in the UI** despite the backend already `include`-ing it on the detail fetch — no "view redemptions" action exists. Error UI is a plain `<p>`, inconsistent with the `Alert`-based pattern elsewhere in this hub.

### 7.4 Tab: Discounts
`discounts/page.tsx` (lives in the `store-settings` backend module, not a dedicated `discounts` module). **Fully ungated across every plan tier** — confirm this is intentional.

Create form: Code (uppercased client-side), Type (%/fixed), Value (positive; % capped at 100 server-side), Usage limit (optional), Expires (optional). Code/type immutable after creation by design. List: code, summary, usage, expiry, active/inactive toggle, **Delete with no confirm step.**

### 7.5 Tab: WhatsApp recovery
`whatsapp/page.tsx`. Ungated. Abandoned-cart list → "Send recovery message" (disabled if no WhatsApp number captured) opens a pre-filled `wa.me` deep link in a new tab — **nothing is sent automatically by the platform**, the seller taps send themselves. Template (`whatsapp.cart_recovery_template`) has **no editing UI anywhere.** (Order-confirmation/shipping-update WhatsApp links live on Order detail instead, per this page's own doc comment — not independently re-verified in this pass, flagged for confirmation.)

### 7.6 Tab: FB/IG Shop feed + WhatsApp product-share link — confirmed zero frontend
Two real, distinct, differently-authenticated backend capabilities, **neither has any page anywhere:**
- **A. Meta Commerce Catalog feed** (`GET /external/social-media/meta-catalog-feed`) — bearer-token auth reusing the *same* `SellerApiToken` mechanism the existing `/marketing` page's connect/list/revoke UI already manages. Gated `social_media.meta_catalog_feed_enabled`, **RISE+FLY**. A new tab needs, at minimum: feed-URL/token display (reusing the existing token UI pattern), a locked-tier state, ideally a live item-count preview.
- **B. WhatsApp product-share link** (`GET .../whatsapp/products/:productId/share-link`) — session-authenticated, per-product, gated `whatsapp.product_share_enabled`, **RISE+FLY**, requires the product be `active`. Opens WhatsApp's own share/contact picker (no pre-addressed recipient, unlike the other 3 WhatsApp generators). Likely belongs as a per-product action (Products page) more than a hub tab — open IA question.

### 7.7 Existing `/marketing` page — confirmed NOT the Campaigns tab
This route is the seller-scoped API-token hand-off to the founder's *separate* Social Media SaaS product (SSO handoff button + connect/list/revoke tokens) — an entirely different feature from Campaigns. **Open IA question, not decided here:** does this become its own 7th tab, or fold into the FB/IG feed tab since they share the exact same token mechanism?

---

## 8. Design Studio hub

Locked nav: **Growth → Design Studio**, tabs: Customizer, Navigation. "Coded mode" is confirmed **not** a third tab.

### 8.1 Tab: Customizer
`customizer/page.tsx` (~420 lines) · Module 4/58.

**Gating, three distinct, real:**
- Theme selection: `marketplace`-tier themes need a purchased `TemplateEntitlement` (never plan-gated); `premium`-tier themes need `theme.premium_tier_enabled`, **RISE+FLY**.
- Branding removal ("Managed by UZEYN" mark): `branding.powered_by_removable`, real only on individual **FLY** (or any team tier). A downgrade off the qualifying tier always reverts the mark to visible regardless of the seller's stored preference.

**Layout (two-column, controls | live preview using the *actual production* storefront section components):** Theme select → Premium-templates card (conditionally rendered only if a showcase URL is configured — **does not render at all in v1.0**) → Storefront branding checkbox → Colors (3 native color swatches: primary/background/text) → Sections (checkbox + ↑/↓ reorder, **fixed 5-item bounded set**: hero/featured_products/about/newsletter/faq — no add/remove beyond this) → Announcement bar → WhatsApp button → FAQ (repeating Q&A rows) → Save.

**4 built-in themes + "Start from blank," confirmed exact defaults:**

| Theme | Tier | Default sections |
|---|---|---|
| Editorial | free, default | hero, featured_products, about, newsletter |
| Atelier | free | hero, featured_products |
| Studio | premium | featured_products, hero, newsletter |
| Market | premium | featured_products, hero |
| Start from blank | free | none (empty) |

**Coded-mode — precise status, not a dangling flag:** `theme.coded_mode_enabled` (real, **RISE+FLY**) is **actively enforced** server-side — `StoreThemeSettingsService.update()` rejects a `customCode` write with a real `ForbiddenException` if the flag resolves false, and `customCode` is a real, tested, persisted DTO/schema field. What's genuinely missing: **zero frontend exposure** (`customizer/page.tsx` never reads/sends `customCode`) and **no confirmed storefront-side execution path** for a stored value. Founder decision needed: build the full escape hatch, or remove the now-partially-built backend plumbing since nothing consumes it end-to-end.

**Store branding/logo upload — real gap:** `ThemeSettings.logoUrl`/`.bannerUrl` exist in the data model and are read at render time, but **the Customizer has no upload control for either field**, and no dedicated logo-upload backend endpoint was confirmed. (Note: §16 Settings' "Store branding" card *does* have a real logo upload/remove flow via `POST/DELETE /stores/:id/logo` — separate from this `ThemeSettings.logoUrl` field; worth reconciling which is canonical.)

- **Empty state:** not handled distinctly. **Loading:** `PageSpinner`. **Icons:** none (↑/↓ text glyphs, not lucide). **Modal:** none.

### 8.2 Tab: Navigation
`navigation/page.tsx`. Header/Footer toggle → repeating item editors (Link/Text block/Social links — the last a fixed 4-platform set: facebook/instagram/tiktok/twitter) → Add item / Save (whole-array replace, no per-item endpoint). **No loading state, no empty-state copy** — a genuine inconsistency vs. the rest of the product. Plan-gating not independently confirmed in this pass — flagged for a follow-up read before finalizing.

---

## 9. Shipping & Tracking

**File:** `shipping-tax/page.tsx` · **Nav:** Operations → Shipping & tracking (`Truck`) · **Gating:** none.

Two cards: **Shipping** (Flat rate required; Free-shipping threshold optional, blank disables it) → **Tax** (Rate %, Label, "Prices already include tax" checkbox). No filters/tables/icons.

**"Orders Command Center" is not a separate screen** — it *is* the Orders list's bucket-tile strip (§2a). Do not design it twice.

**Missing-tracking alerts: NOT FOUND** — confirmed as genuinely unbuilt (Module 88, Buyer Experience Batch, `[ ]` in SRS §14.68). When built, spec calls for surfacing as an overdue state on the existing "Awaiting tracking" bucket tile, not a new page.

**Delivery-time badges (Module 29): no seller-facing settings section anywhere.** The feature is entirely buyer-facing (storefront `DeliveryBadge` component), sourced from **admin-configured platform-wide Settings Registry defaults** for the Printify adapter (not real per-shipment data, not seller-editable at any tier).

**Shipping-cost-calculator display toggle: NOT FOUND** (Module 84, Buyer Experience Batch, not built — zero Settings Registry key, zero toggle).

---

## 10. Suppliers

**File:** `suppliers/page.tsx` · **Nav:** Operations → Suppliers (`Handshake`), **conditional** — sidebar item only appears once ≥1 supplier link exists (explicit "SIMPLICITY INVARIANT" comment).

Invite form (email) → list (Card rows, no supplier name/logo — just a truncated ID) with status Badge (`pending_seller_review`/`active`/`revoked`) → **Approve** (pending only) / **Revoke** (active only), both **no confirm step.** Empty state real: *"No suppliers connected — Selling entirely your own products? You can ignore this screen..."*

**Supplier portal connection flow:** the supplier-side login is a wholly separate app surface (`supplier-portal.controller.ts`), out of scope for the seller dashboard beyond the invite-by-email above.

**Printify adapter status: not seller-facing at all** — adapter registration/health is **admin-only** (`admin/supplier-adapters`); the seller's own row is fully adapter-agnostic, showing nothing about which adapter or its health.

**Listing review/approval queue — real backend, zero frontend, confirmed gap.** `GET/PATCH .../listing-reviews[/approve|reject]` is real and seller-facing (creates the real Product + Variant on approve, runs the same moderation check self-fulfilled products go through) — but `suppliers/page.tsx` has no UI for it at all: no listing preview, no approve/reject buttons, no nav link.

**Delivery-badge data source:** traced end to end — Printify adapter → platform Settings Registry defaults → `SupplierListing` rows → storefront `DeliveryBadge`. No seller UI anywhere in this chain.

---

## 11. Payments

Currently bridged via `/settings#payments` anchor (real Card inside the still-monolithic Settings page, not yet its own route). **Nav:** Operations → Payments (`CreditCard`).

**Two cards, real, in page order:**

**A — "Payment instructions"** (manual/COD path): Bank title/number/name, JazzCash number/title, Easypaisa number/title, "registered in my own legal name" checkbox (triggers admin review if inconsistent), "Accept Cash on Delivery" checkbox. `PATCH .../payment-instructions`.

**B — id="payments" "Payment gateway"** (Module 62, auto-confirm path, ungated on every plan): connections list (provider, merchant ID, Active toggle, Test button — result not persisted, lost on reload, Remove **no confirm**) → connect form (Provider select, Merchant ID optional, API key required/password-masked, API secret optional/password-masked). **All 4 providers share one generic field set** — the DTO does not differentiate real per-provider requirements (e.g. JazzCash's typical hash key) — flag as a placeholder shape, not provider-accurate, if real integrations need more fields.

**Connection health / "gateway health monitoring": confirmed NOT FOUND, and confirmed why** — this is exactly Module 67 of the not-built Subscription Business Readiness batch, spec'd as an **admin-facing, aggregate** rollup on the System Status page, never seller-facing. The seller only ever sees the one-off, non-persisted "Test" result.

**Alert history: NOT FOUND** — no persisted test/alert log model exists.

**Manual mark-as-paid fallback — real, confirmed to be the same "Mark as paid" button already documented on Order detail (§2b) and the Orders bulk-action bar (§2a) — not a separate toggle.** It's the built-in fallback for sellers using instructions-only (no gateway).

**Module 76 Prepaid Partial-Advance — confirmed absent from both this card and Order Verification settings.** Backend fully real: `orders.prepaid_partial_advance_percent` (default **5**, store-scoped) and `_enabled` (RUN+ plan-gated). Natural home: a 5th option on the Order Verification channel dropdown (§2c) with a conditional percent field, not this Payments card.

---

## 12. Reports

Currently bridged via `/settings#reports` anchor. **Nav:** Admin → Reports (`FileText`).

**Gating, real, FLY-only:** `data_export.on_demand_enabled` — true only for tierOrder 3 (FLY). Error copy still says **"Pro-plan"** (stale naming vs. the current GO/RUN/RISE/FLY vocabulary) — flag for copy correction. Renewal-triggered exports are never gated (every tier).

"Request export now" (seller-scoped, not store-scoped — spans every store a seller owns) → rate-limited (`data_export.on_demand_min_interval_hours`, default 24h) → history list, each row: trigger label, timestamp, status Badge, per-file download links (Products/Orders/Customers/Inventory CSVs + Summary PDF — exact real column headers confirmed for each) via authenticated blob download (PII-safe, not a plain URL). Delivery: Drive first, email fallback if not connected.

**No `EmptyState` for zero exports** — the history block just doesn't render, no "no exports yet" copy (inconsistent with the rest of the product).

**Invoice customization (Module 57) — a separate card on the same Settings page, not merged with Data export:** Tax/NTN number, Invoice footer text, Invoice terms text — all real, all confirmed rendered on generated invoice PDFs. Plus the store logo (set via the separate "Store branding" card) is also used on invoices. No NTN verification, no invoice-numbering-format field, no color/template picker exist.

---

## 13. Staff

**File:** `staff-accounts/page.tsx` · **Nav:** Admin → Staff (`UserCog`)

**Seller-scoped, not store-scoped** — a hire's access spans every store the owner has. Owner-only: staff sessions are blocked from this controller entirely.

**Real scope enum:** `orders`, `catalog`, `discounts`, `customers`, `design`.

**Seat-limit gating, real** (`staff.max_accounts`): GO/RUN/Team-Starter = 0 (falls to global default), **RISE 3, FLY 10**, Team-Growth 2, Team-Scale 5. **No seat-limit display anywhere in the UI** — only discoverable via a failed-create error message.

Create form: Email, Name (optional), Password (min 8), Scopes (toggle-pill row, ≥1 required client-side) → "Create staff account". List: name/email, scope Badges, status Badge, **Revoke** (active only, **no confirm step**, no un-revoke). Flat card list — no table, no sort/pagination/bulk-actions.

- **Icons:** none in-page. **Loading:** `PageSpinner`. **Error:** single page-level `Alert`. **Modal:** none.

---

## 14. Billing & Plan

**File:** `billing/page.tsx` · **Nav:** Admin → Billing & plan (`Wallet`)

**Current plan card** → **Plan-fee payment card** (Module 73 — confirms Module 59's "combined entry-flow payment screen" is **not a separate page**; it's fully superseded by this always-current flow. No wallet balance/top-up concept remains) → **Payment history** (list, real, no true data table) → **Available plans** — **not a feature-comparison matrix**: just name/price/Switch-button per card, **no row-by-row feature list exists in code today** (would need to be built reading from the same Settings Registry values used elsewhere, e.g. `staff.max_accounts`) → **Team invitations** / **Team membership** / **Teams** (sponsor-side: invite by email — success via a native `alert()`, not the app's own Alert component; create-team form).

**Downgrade confirm step: NOT FOUND** — no warning about losing RISE+/FLY-gated features (seats, SEO fields, etc.) anywhere in the switch-plan flow, front or back.

**Billing-cycle selector — real answer, corrects the founder's brief:** `PlanBillingInterval` has exactly **4** real values — `monthly`, `yearly`, `none`, and **`six_month`** (not a 1/3/6/12-month set). The backend *already accepts* a `billingInterval` param on plan-change, but **the frontend never sends it** — a real, ready-to-surface gap, pure frontend work.

**Referral (Commerce Students Support) / Ambassador program — real, confirmed gap.** Seller-facing apply/list-own/certificate-tier endpoints are fully real and working — but **no seller-facing frontend page anywhere calls any of them.** Only admin-side program pages exist. A seller today cannot apply, check status, or view rewards for either program through any dashboard screen.

- **Icons:** none. **Loading:** `PageSpinner`. **Error:** single shared page-level `Alert` across every mutation on the page.

---

## 15. Settings

**File:** `settings/page.tsx` (~1,100 lines, single long scroll, no in-page tabs) · **Nav:** Admin → Settings (`Settings`, plan name shown as small text alongside)

**Confirmed absorption (authoritative, from `nav-items.ts`'s own doc comment, founder-approved):** Settings hub (Part 5) absorbs Domains, Store Health, Verified Store, Import & export as tabs. Payments/Reports are bridged anchors into this same file today (see §11–12).

**Sections, exact order:** Store branding (logo upload/replace/remove) → Storefront access (Public/Coming soon/Password-protected) → Store policy (feeds Store Health's profile-completeness check) → Invoice customization (see §12) → **Advanced SEO** (real-gated `seo.advanced_fields_enabled`, **RISE+FLY** — 4 checkboxes + custom head-tags textarea; **no proactive lock UI**, reactive error only) → **Data export** (see §12) → Payment instructions (see §11) → **Payment gateway** (see §11) → Identity verification (CNIC, masked once set, 5-bullet explainer, review-pending Alert) → **Notifications — the entire surface is one checkbox** ("Send me the UZEYN newsletter") — **no granular per-event control exists anywhere** (order alerts, low-stock alerts, etc. are always-on with no opt-out UI) → Security (2FA enroll — raw `otpauthUrl` text, **not a QR code**; signed-in devices with Revoke, no confirm; read-only support-access audit log) → Dashboard appearance (4 accent swatches, selecting one does a **full `window.location.reload()`** — no live theme-context switching).

**Zero destructive-action confirm steps anywhere across this file** — Remove logo, Remove domain, Remove gateway connection, Revoke session all fire immediately.

**Genuinely not on this page** (explicit gaps vs. the brief): domain management (real, but a separate route — see below), legal/policy page links (not found anywhere), account deletion/data-retention info (not found anywhere in the codebase).

### Absorbed tab: Domains
`domains/page.tsx` · Module 3. Attach form (domain name) + real CNAME/A-record config display → list (verification-status Badge, Verify now, Remove no-confirm) → domain-registrar affiliate referral block (unrelated to the growth-programs referral concept above).

### Absorbed tab: Store Health
`health/page.tsx` · Module 23. Score (0-100) + threshold-based Badge (≥80 Healthy/≥50 Needs attention/else At risk) → plain-language "what's lowering your score" suggestions (no raw weighted-sum math shown, by design) → full breakdown list → history. Entirely read-only.

### Absorbed tab: Verified Store
`verification/page.tsx` · Module 23. Status Badge → eligibility criteria list (Pass/Not yet per criterion) → conditional Apply button (only when every criterion passes) with explicit fee-refund-on-rejection disclosure, **no confirm step before the fee-charging apply click** → application history.

### Absorbed tab: Import & export
`data/page.tsx`. Import products (Shopify-format CSV) → Bulk update stock CSV (SKU+Quantity only) → Export products/orders (opens `fileUrl` in new tab — a **different, inconsistent pattern** from the authenticated-blob download used by the Data-export card in §12) → Recent jobs list. **No loading gate at all** on this page — the one page in the whole Settings hub without a `PageSpinner`, a real inconsistency.

- **Cross-cutting for the whole hub:** no icons anywhere in these 5 files; 4 of 5 pages gate on `PageSpinner`, Data page doesn't; error pattern is `Alert tone="danger"` (or a plain paragraph on the Data page); no modal/dialog exists in any of the 5 files; no real-time elements anywhere.

---

# Part 4 — Buyer-Facing Storefront

Every buyer-facing page lives under `apps/web/app/storefront/`, host-header-routed per tenant, sharing one chrome (`AnnouncementBar`, `SiteHeader`, `SiteFooter`, `WhatsappButton`). Confirmed "bare functional, no design pass yet" — almost no icons anywhere (only a literal ✓ Verified badge glyph and a 💬 WhatsApp emoji). **Visual identity is explicitly out of scope for this phase** — this is a pure functional audit.

## Homepage — 4 templates + "Start from blank"

Every template renders from the same fixed 5-section set (`hero`/`featured_products`/`about`/`newsletter`/`faq`) with different **default** on/off states and structural treatment:

| Template | Tier | Default sections | Structural notes |
|---|---|---|---|
| Editorial | free, default | hero, featured_products, about, newsletter | Serif headings, hero-first order, 2-3 col grid |
| Studio | premium | featured_products, hero, newsletter | Products-first order (not hero-first); About renders as an inverted color block |
| Market | premium | featured_products, hero | Hero is a compact horizontal bar, not a banner; up to 6-col dense grid — sparsest default (2 sections) |
| Atelier | free | hero, featured_products | Monochrome, much taller hero padding, square-crop grid |
| Start from blank | utility | none (all hidden) | Reuses the plain/base components — also the fallback for any unrecognized theme name |

Templates are structurally isolated by design (CI-enforced: no template file may import cart/checkout/order-status/wallet/verification code). **Newsletter section is a stub in all 5 templates** — "coming in a later module," not a real signup form. FAQ is real (native `<details>` accordion, seller-entered Q&A).

## Product detail page

Media gallery (flex-wrapped images, **no lightbox/carousel**) → description → `DeliveryBadge` (static "Ships in X-Y days"/"Delivers to: ..." for supplier-sourced products only — never computed from the buyer's own address) → Add-to-cart form → plain-text rating line (no star icons, no jump-to-reviews link).

**Add to cart is purely client-side (localStorage) until checkout's email step** — no server call at this stage. Out-of-stock variants are excluded/disabled in the select; if every variant is out, the whole form is replaced with plain "Out of stock." text.

**Stock-countdown/urgency messaging: confirmed NOT FOUND**, independently re-verified. No "Only N left!" anywhere — repo-wide search confirms the only "low stock" surfaces anywhere in the codebase are seller-only (Inventory dashboard, low-stock seller email).

## Collection page / Search page

Collection: fixed manual seller-ordered product grid, no sort/filter controls. Search: plain GET form (URL-state, no client JS) — `q`, min/max price, category select. **No sort-by control** (price/newest/etc.). A `collectionId` filter exists in the backend type but has **no UI control** — dead capability.

## Cart

Fully client-side/localStorage (no server cart row yet). Per-line quantity edit + Remove. **No discount-code field on the cart page** — that's checkout-only. Static disclaimer: "Shipping, tax, and any discount are calculated at checkout." → "Proceed to checkout."

## Checkout — "email-first lock," confirmed exactly as it sounds

Strict 2-step wizard: **Step 1 collects only email (required) + optional WhatsApp number** — submitting this is the *one and only point* a real server-side cart/order session is created. Only then does **Step 2** (full name, address, city, country, postal, phone, optional discount code) unlock. This is not an email-verification gate — no OTP at this stage.

**Payment method selection on checkout: NOT FOUND.** No dynamic gateway list/radio/icons anywhere on the checkout form — the order is always placed `pending` first; "how to pay" instructions only appear *after* placement, as static text on order-confirmation/order-status.

**Prepaid-advance flow (Module 76): backend fully real (4 dedicated buyer-facing routes exist), zero frontend anywhere** — confirmed by a repo-wide grep of `apps/web` for every relevant endpoint name, zero matches. Same for the OTP-based order-verification submission flow (buyer-side) — only the seller-side settings page exists in the frontend.

**Shipping-cost calculator: NOT FOUND** on checkout either — same static disclaimer sentence, no live recompute.

## Order-status / tracking page

Status line (`pending` relabeled "Awaiting payment") → real order timeline (5-stage dot list, Module 27) → items/tracking → totals → conditional invoice-PDF link → **static** "how to pay" block (only place payment info ever surfaces to a buyer) → shipping address → **Return & refund form** (real, textarea + submit, or a read-only status view once a request exists) → **Review form** (see below).

**UZEYN brand disclosure: present, but only via the shared footer mark**, gated by the same plan-based `poweredByVisible` flag as every other page — no additional disclosure specific to this page beyond that.

## Order confirmation page

Reuses the same order-status fetch. Explicit banner: "Thank you for your order! Your order is **awaiting payment** — it isn't confirmed yet." (Financial Truth Invariant enforced in copy, not just data.)

## Buyer account / order history — confirmed does not exist

**No buyer login/account system at all.** Confirmed by the code's own comment: the order-status token *is* "the buyer's only post-checkout reference (no account exists to log into)." No saved addresses, no order-history list, no wishlist — single-order lookup via an unguessable per-order token link is the entire buyer-side persistence model. This is a real, deliberate, confirmed gap (Module 81, Buyer Experience Batch, not built).

## Reviews-with-media submission flow

Buyer-facing `ReviewForm` (on the order-status page): Product select (from the order's own line items), Name, Rating (5→1 select, no interactive star click), Review textarea. **No file/photo/video upload input exists** — independently re-confirmed the `ProductReview` model has zero media columns. Submission is moderation-gated (defaults `pending`), server-validated.

## Live chat widget entry point — not a real distinct feature

Only the `WhatsappButton` deep-link exists (floating button → `wa.me`). No embedded chat widget, no unread badge, no in-page conversation UI, no third-party chat integration (Intercom/Crisp/Tawk.to/etc.) anywhere in the codebase.

## Shipping-cost calculator — confirmed NOT FOUND anywhere in the storefront

Only two static text surfaces exist: the `DeliveryBadge`'s fixed shipping-window label (not a cost, not computed from the buyer's address) and the cart/checkout disclaimer sentences. No address-driven "estimate my shipping" widget anywhere.

## Stock-countdown urgency indicator — confirmed NOT FOUND

Independently re-verified across every buyer-facing surface (product page, all 5 template grids, collection/search results) — `stockQuantity` is sent by the API but never rendered on any buyer-facing card; only used to disable the add-to-cart button. No countdown, no "Only N left," no urgency styling anywhere.

---

# Part 5 — Admin Terminal

All 24 pages under `apps/web/app/(admin)/admin/**/page.tsx` (plus the top-level `impersonate/page.tsx`) are real, functional, and **100% unstyled** — plain HTML, inline `style={}`, zero design tokens, zero component library, **zero icons anywhere in this entire section**. This is Module 25's confirmed state, matching Part B item 9's "re-skin, not rebuild" framing exactly.

**Shared chrome** (`admin/layout.tsx`): fixed 220px flat sidebar, no header/breadcrumbs/user-menu. **Notification bell is real and functioning** (`GET /admin/notifications`, dropdown with `{label,count}` items linking to queues) — this directly answers the founder's original open question; it is a different thing from `admin/messages` (an outbound seller-facing broadcast tool). Nav is a hardcoded flat 24-item list with **no grouping** — the code's own comment names this a known gap. Proposed grouping (founder's call, not locked anywhere): **Overview** (Home, Search, Analytics, Status) · **Sellers & Money** (Sellers, Wallet top-ups, Commission invoices, Plans) · **Queues** (Returns, Verified Store, Moderation, Trust & Safety, 3× Growth queues, Careers) · **Catalog & Supply** (Categories, Supplier adapters) · **Content & Comms** (Content pages, Messages, Email, Newsletters) · **Platform Config** (Settings Registry, External API clients, Audit log).

## Cross-cutting observations for the whole admin terminal

- **Fixed (FR-8.16):** a shared `useConfirm()` dialog component (`components/admin/ConfirmDialogProvider.tsx`, on the existing Radix `Dialog` primitive, mounted once in `admin/layout.tsx`) now gates ban/suspend a seller, wallet adjust/clawback, mark paid/waive commission, complete a refund, force-remove a product, moderation and wallet-topup bulk actions, retire a plan, regenerate an API secret, toggle a supplier adapter, delete a message, unlink an email account, and send a newsletter (the last with a typed "SEND" confirmation, being the single highest-blast-radius action in the terminal). High-impact Settings Registry key detection is now the data-driven `requiresConfirmation` field (was a hardcoded `window.confirm()` string-match), and the same field now also gates Seller-360's settings-override mini-editor, closing that inconsistency. The `window.prompt()` calls (impersonation reason, growth-program suspend/terminate reasons, re-review revoke reason) are unchanged — still reason-capture, not confirm gates. **Still open, out of scope for FR-8.16:** Verified Store approve/reject/revoke, Trust & Safety payment-instrument review + Seller Agreement publish, the three Growth-program queues, Careers status changes, "Grant a plan to a seller," and the Content pages/brand-asset save buttons have no confirm step.
- **Error handling is wildly inconsistent** page to page — full-page replacement, silent `.catch(() => {})` swallowing, inline red-text banners, or (login only) a clean consistent inline pattern.
- **Loading states are almost universally the literal string `"Loading..."`** — no skeletons, no spinners.
- **No pagination anywhere** except Audit log's simple "last N" limit selector.
- **Raw-ID-typing is pervasive** — seller/plan/product/order IDs typed as free text with no lookup/autocomplete, even on pages built after Seller-360 already existed as a lookup target.

## Page-by-page

**Home** — read-only KPI text lines (today + all-time) + a "Needs attention (N)" jump-link table sourced from `GET /admin/overview`. No forms, filters, or actions. No loading indicator, no error handling (silent).

**Search** — one query box across Sellers/Stores/Orders/Suppliers, 4 result sections. No result-count empty-state copy, no loading indicator during search, no error handling on failure.

**Sellers (list)** — T&S lifecycle filter (single status) → table with per-row "Approve activation," "Set {status}" (×4, requires a shared page-level Reason field, **now also gated by `useConfirm()`** — danger tone on suspended/banned, shows old→new status), "Impersonate" (`window.prompt` for reason → opens `/impersonate` in a new tab). Duplicates seller-360's own lifecycle/impersonation logic independently.

**Seller-360** — the single most complex page: Actions (lifecycle/activation/impersonate, lifecycle changes now `useConfirm()`-gated same as the Sellers list) → Wallet (balance + adjust form + ledger, **adjust now `useConfirm()`-gated**, shows old→new balance) → Stores → Invoices → Growth program participation (Suspend/Terminate via `window.prompt`, Clawback form **now `useConfirm()`-gated**, danger tone, shows old→new balance) → **Settings overrides** (a seller-scoped mini-editor writing to the *same* endpoint as the standalone Settings Registry page — **fixed**: now reads the same `requiresConfirmation` field and shows the same confirm gate on high-impact keys, closing the prior inconsistency) → Trust & Safety flags (read-only) → Devices/sessions (read-only) → Timeline (read-only).

**Wallet top-ups** — legacy-named route (real invoices live at Commission invoices instead); bulk Verify/Reject (client-side `Promise.all` fan-out, no dedicated bulk endpoint) **now `useConfirm()`-gated** (danger tone on reject), per-row Verify/Reject unchanged — **no confirm/reason on either** (only the bulk actions were in scope for FR-8.16).

**Commission invoices** — table + "Mark paid" (**now `useConfirm()`-gated**) + a "Waive a commission line" form (Seller ID/Order ID/Amount, all raw free-text, **now `useConfirm()`-gated**, danger tone, shows the waived amount).

**Returns & Refunds (admin override)** — Approve (no confirm) / Reject (reason required) / "Complete refund" (amount input defaulting to order total, **now `useConfirm()`-gated**, danger tone, shows the refund amount — Approve/Reject were not in scope for FR-8.16 and remain unconfirmed).

**Verified Store** — Pending-applications cards (Approve / "Reject (refunds fee)" — label documents the side-effect, **neither has a confirm dialog**) + Re-review cards ("Clear - keep verified" / "Confirm - revoke," revoke requires a reason). One of the few pages with genuine, real empty-state copy for both lists.

**Moderation queue** — REVIEWER-sub-role-accessible. "Force remove/restore" direct-lookup tool (raw product-ID text field, reaches *any* product; **Force remove now `useConfirm()`-gated**, danger tone — Restore is non-destructive and stayed ungated) + bulk Approve/Reject (Reject requires shared notes, explicitly disclosed as buyer/seller-visible; **both now `useConfirm()`-gated**) + per-row queue table (per-row Approve/Reject unchanged, not in scope). Real empty-state copy: "The queue is empty."

**Trust & Safety** — Payment-instrument review queue (Approve/Reject, no reason field, no confirm) + 5 read-only risk-monitor tables (cancellation-rate, pending-forever-rate, signup-velocity, bypass-attempts, self-referral — none link through to Seller-360 despite showing seller IDs) + Seller Agreement version publish form (**no confirm despite being a legal-document publish affecting every seller**).

**Growth: applications / content-submissions / withdrawals** — three separate queue pages, each Approve/Reject (or a processing→paid state machine for withdrawals) with optional notes, **no confirm dialogs anywhere**, no seller-ID linking to Seller-360.

**Careers** — postings table (draft/open/closed) + expandable per-posting applicant sub-table (status change via an **instant-commit dropdown**, no explicit Save button, no confirm) + create-posting form (always created as draft).

**Plans** — 3 grouped tables (individual/team/supplier) → Create-tier form → **Grant a plan to a seller** (raw seller-ID text, bypasses billing/checkout entirely, no confirm — not in scope for FR-8.16) → Create promo code form. "Retire" button per active plan, **now `useConfirm()`-gated**, danger tone. Widest table in the terminal (13 columns), zero responsive handling.

**Categories** — deliberately append-only (no rename/delete, disclosed in-page). Writes to `/categories`, not `/admin/categories` — a real backend-naming inconsistency worth flagging.

**Supplier adapters** — per-adapter enable/disable toggle (**now `useConfirm()`-gated**, danger tone on disable) + raw-JSON config textarea (validates "is it valid JSON," not schema-correctness) + register-new form (free-text adapter type, no dropdown of known types).

**Settings Registry editor** — the flagship write UI. Definitions table (unsorted/unsearchable at ~90 keys) → detail panel: precedence-chain table (winning scope bold), type-aware Save form with real client-side validation mirroring server rules. **High-impact confirm — fixed (FR-8.16):** detection is now the data-driven `requiresConfirmation` boolean on `SettingsDefinition` (seeded `true` on the same 29 keys the old `billing.`/`commission`/`platform.maintenance` string-match covered), resolved via `GET /admin/settings/resolve` and shown through the shared `useConfirm()` dialog (old→new value) instead of a native `window.confirm()`. A future equally-sensitive key no longer needs to match a frontend string pattern — it just needs the field set true. Seller-360's own settings-override mini-editor now reads the same field and shows the same gate, closing the prior inconsistency.

**Audit log** — genuinely read-only (DB-grant-enforced insert-only), single "last N" limit filter, no date/action/admin/target filters, no search. Before/after diffs in a native `<details>` disclosure. Impersonation-session column lets an admin trace exactly what happened during any support session.

**System status** — Core services list (DB/Redis/storage/email/backups — backups line is a **documented, founder-authorized stub**, not fake data but not real monitoring either) + background-queue-depth table (Failed count is the *only* conditional styling found anywhere in the admin terminal). **One-shot fetch, no auto-refresh/polling** despite "live infrastructure health" framing — founder should decide if this needs one.

**Analytics** — real-time GMV/revenue table + top-sellers-by-commission table + unit-economics table (admin-entered infra cost, break-even calc). **No charts anywhere** — every figure is plain HTML text. **MRR/subscription analytics, seller health funnel, support SLA queue view, and payment-gateway health monitoring are all confirmed NOT built** — this whole cluster is the not-built Subscription Business Readiness batch (Modules 63–72); this page is the SRS's own designated future extension point for MRR specifically.

**External API clients** — register/enable-disable/regenerate-secret for the two SaaS integration hooks. "Regenerate secret" **now `useConfirm()`-gated**, danger tone (the new one is still shown once in a copy-now banner after confirming).

**Content pages & brand assets** — 5 fixed legal/info page editors (plain textarea, deliberately not WYSIWYG) + 3 fixed brand-asset URL-reference fields (no actual file-upload widget — URL-paste only). 8 independent save buttons, **zero confirm steps** despite being public-facing legal/brand content.

**Messages** (seller-facing banners/popups/in-app) — target All/Plan/Seller (raw ID fields, no lookup), scheduled window — table + create form + Delete (**now `useConfirm()`-gated**, danger tone). Not the same as the admin's own notification bell (see chrome, above).

**Email** — UZEYN's own unified inbox: link IMAP+SMTP accounts (native `FormData` form, the only one built this way; plain-text password fields with **no masking toggle**) → merged inbox → reply (fixed "To," pre-filled subject). "Unlink" is **now `useConfirm()`-gated**, danger tone. A failed reply-send blanks the *entire* inbox view rather than showing an inline error — a real UX gap.

**Newsletters** — compose (native form) → save as draft → **Send** (an irreversible broadcast to every seller on the platform — the single highest-blast-radius action in the whole admin terminal, and now protected accordingly: `useConfirm()`, danger tone, **and a typed "SEND" confirmation** before the button enables — the strongest gate in the terminal). Live status tracking (sent/failed counts, failure reason).

**Login** — credentials step → mandatory TOTP MFA step, including automatic first-time enrollment. **MFA setup shows the raw `otpauthUrl` as plain text, not a scannable QR code** — a real usability gap worth a design decision. The only page with a clean, consistent inline error pattern in the whole terminal.

**Impersonation flow (cross-cutting, not its own nav page)** — start (reason prompt → new tab bridge, stores the impersonation token under the same `accessToken` key a normal seller session uses so every dashboard screen works unmodified) → transparency banner (`SupportModeBanner`, "Exit support mode" is a **local-only soft exit** — real termination happens from the admin's original tab) → **real, server-enforced blocked-writes guard** (`@BlockDuringImpersonation()`) confirmed applied to real money-adjacent routes across payment-gateway, wallet, orders (mark-as-paid), growth-program withdrawals, payment-instructions, and subscriptions controllers → full audit-log traceability via a real `impersonationSessionId` column. This is one of the most thoroughly implemented, end-to-end mechanisms in the entire admin terminal.
