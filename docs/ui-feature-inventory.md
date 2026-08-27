# UZEYN — UI Feature Inventory

Master reference for personally designing and reviewing every screen before any pixel is coded. Every claim below is backed by a real file that was actually read during this audit — a real API route, a real service method, a real Prisma schema field, a real Settings Registry key, or a real existing frontend file. Where something plausible-sounding turned out **not** to be backed by real code, it is marked **NOT FOUND — flag for founder** rather than invented. Several assumptions in the original brief did not hold once checked against the real codebase — those gaps are flagged explicitly throughout, not papered over.

This document is research output, not a design brief. It does not prescribe visual treatment (color, spacing, motion) — Phase 1's tokens/component kit already establish that direction. It exists so a redesign of any given screen can start from "here is everything this screen must do" rather than rediscovering it mid-build.

Methodology note on **Part 1** (the founder's per-page documentation template — purpose, nav placement, plan-gating, every section/button/form/table, icons, empty/loading/error states, modals, real-time elements, mobile notes): rather than a standalone section, this template was applied to *every* page in Parts 3–5 below. There is no separate "Part 1" section as a result — it is the shape every page write-up follows.

---

## Part 0 — Module Coverage Audit

Every built module (1–80) mapped to where it surfaces in this inventory. Sourced from `docs/SRS.md`'s §14 Acceptance Checklists (the authoritative, item-level built/not-built record — checklist items were read individually since some section *headers* are stale even where the items inside were later flipped to `[x]`), cross-referenced against `docs/build-plan.md` and `CHANGELOG.md`.

**Critical finding, now resolved by this session's own build batch:** Modules 63–72 ("Subscription Business Readiness" — MRR analytics, 14-day data-retention window, renewal reminders, multi-store downgrade rule, admin gateway-health monitoring, support-SLA-by-plan, seller health funnel, monthly seller report, first-cycle discount-abuse prevention, 50% refund policy) were confirmed genuinely not built as of the original audit (SRS §14.66 headed "not yet built", every FR-6.40–6.49 checklist item unchecked) — **all ten are now built**, backend-complete with real schedulers/services/e2e test coverage, and SRS §14.66 has been updated accordingly. **No frontend UI exists yet for any of them** — that is Phase 3+/4 design work, not yet started; every page below that would surface this batch is still flagged with its pre-build gap description, now understood as "backend ready, frontend not started" rather than "nothing exists." Module 89 (SRS FR-8.17, admin bulk-action endpoints for moderation/wallet-topup verification) and Module 90 (minimal support-ticket system, built alongside Module 68) were built in the same batch.

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
| 63–72 | Subscription Business Readiness (MRR analytics, retention window, renewal reminders, downgrade rule, gateway health, support SLA, health funnel, monthly report, discount-abuse prevention, refund policy) | **yes, backend-complete; no frontend yet** | Flagged individually at their natural homes: §12 Payments (gateway health), §18.21 Admin analytics (MRR, health funnel), §10 Shipping & Tracking (missing-tracking is a *different*, later-built item — see §88). Every real endpoint/service is live and e2e-tested; no dashboard/admin UI has been designed for any of them yet — this is Phase 3+/4 work. |
| 89 | Bulk-action backend endpoints (moderation queue + wallet top-up verification) | yes | §18.9 Admin moderation (bulk approve/reject); Wallet top-ups (bulk verify/reject) — both now real `POST .../bulk-decide` endpoints, replacing the old client-side `Promise.all` fan-out |
| 90 | Minimal support-ticket system + SLA-by-plan | yes | Built alongside Module 68; **no frontend surface yet** for either the seller-facing ticket thread or an admin queue view — backend/API only |
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
| Gateway health alert | **Now built (Module 67)** — `GatewayHealthService.runHealthCheckSweep()` records per-provider results, alerts affected sellers by email, and creates a `PlatformMessages` system banner; `AdminSystemStatusService` surfaces a `paymentGatewayHealth` rollup. **No admin-facing UI renders this rollup yet** — backend/API only. | Seller email + in-app banner (`PlatformMessages`) | Partial — banner mechanism exists, no dedicated admin page yet |
| Plan renewal reminder | **Now built (Module 65)** — `RenewalRemindersService`'s scheduled sweep sends renewal-reminder and win-back emails on a real schedule. **No frontend surface** — email-only, same as every other transactional trigger in this table. | Seller email | No |

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
1. ~~**Verification status + resend action: NOT FOUND.**~~ **Fixed in Phase 3.** A "Verification" card now renders between the status bar and the order timeline whenever `GET .../verification` returns a real gate (channel + status badge), with a "Resend" action for the OTP channels and "Mark deposit received" for `prepaid_confirmation` — the exact two seller-triggered actions `seller-verification.controller.ts` already exposed.
2. **Returns/refund initiation: NOT FOUND on this page.** Returns is a wholly separate, currently unlinked page (`/returns`) — real, working (approve/reject/complete with refund amount), not surfaced from order detail. Still open — deferred out of this Phase 3 pass (a real cross-page linking decision, not a quick add).

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

### Fixed (Phase 5c) - was a confirmed real gap
`CHANNEL_LABEL` now has all **5** entries — `prepaid_partial_advance` is selectable, with its configured percentage shown in the description text and an `UpgradeLockedCard` (locked-not-disabled: the option stays in the select with a "(requires RUN or above)" suffix, never removed) rendered below the select whenever the currently-chosen channel isn't enabled for the seller's plan - the same treatment `whatsapp_otp` already got. The Save button stays fully clickable regardless (a real 403 would surface via the page's existing error Alert).

**Sections:**
1. "Verification channel" card — Channel select (all 5 real options now) + OTP message template textarea (`{{otp}}` placeholder, `maxLength=1000`) + Save.
2. "Connected sender emails" card — list (email, `host:port`, sends-today, active/revoked Badge, Revoke) + connect form (email, SMTP host/port/username/password). Copy claims "up to 5 connected" — **not independently confirmed as a hard-enforced limit in the service read; flag for verification before treating as enforced.**

- **Empty state:** real — "No sender emails connected yet."
- **Loading/Error:** `PageSpinner` / `Alert tone="danger"`.
- **Icons/Modal:** none.

---

## 3. Products

### 3a. Products list
**File:** `apps/web/app/(dashboard)/stores/[storeId]/products/page.tsx`
**Nav:** Main menu → Products (`Package` icon)

**Plan gating:** real, on *create* only — `catalog.product_limit`, seeded **GO 100 / RUN 100 / RISE 500 / FLY 100,000**. Enforced server-side on `POST /products`; **no visible "N/100 used" indicator anywhere on this page** — a real gap, the limit is invisible until hit. **Deliberately deferred in Phase 3**, not fixed: no seller-facing endpoint currently resolves a plan-scoped Settings Registry value like `catalog.product_limit` (only `admin/settings/resolve` exists) — closing this properly needs a small new backend endpoint, not just a frontend change, so it's flagged here for a future small batch rather than bolted on ad hoc.

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

**VariantsSection:** SKU/Price/Stock/**Base cost** per variant, saves `onBlur`. Add-variant form: SKU/Price/Stock/Base cost.

### ⚠️ Most concrete, well-evidenced gap in the whole Products area — fixed in Phase 3
`ProductVariant.baseCost` is a real, nullable schema column, and both create/update variant DTOs fully accepted it already — the backend was 100% ready, only the frontend was missing. `VariantsSection.tsx`'s `Variant` interface now carries `baseCost`, with a per-row edit input (an inline "no cost set" warning when null) and a field on the add-variant form. Sellers can now enter base cost directly on the product edit screen, closing the root cause of the "incomplete" P&L warning on Order Detail (§2b) and the P&L page (§6b) — existing variants with no cost entered yet will still show that warning until a seller sets one, which is correct (never silently defaulted to 0).

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
- ~~`trackInventory` ... never rendered~~ **Fixed in Phase 3** — an "Untracked" badge (with a tooltip explaining it never triggers a low-stock alert or blocks a sale) now renders per row when `trackInventory` is false.
- Bulk stock edit exists (real CSV endpoint) but lives on the separate **Import & export (Data)** page, not embedded here.

- **Icons:** none. **Empty:** real `EmptyState` (two variants — "No variants yet" / "No variants match"). **Loading:** `PageSpinner`. **Error:** plain red text, not the shared `Alert`. **Modal:** none — accordion, not drawer. **Real-time:** none in-UI; a low-stock **email** (not toast) fires server-side, debounced via `lowStockAlertSentAt`.

---

## 5. Customers (+ Reviews)

**Files:** `customers/page.tsx`, `customers/[customerId]/page.tsx`, `reviews/page.tsx`
**Nav:** Main menu → Customers (`Users` icon); Growth → Reviews (`Star` icon, own top-level item, not nested under Customers)
**Plan gating:** none on Customers/Reviews themselves. (Adjacent: Customer *Segments* creation is RISE+FLY-gated — see §7.2.)

### 5a. Customers list
Search (name/email, **now 300ms-debounced, fixed in Phase 3** — was firing every keystroke) + Sort (Total spent/Order count/Most recent order) → row-list (name-or-email, email/order-count/last-order, total spent) — no pagination, no bulk-select. `unsubscribedAt` **now surfaced on both Customers pages** (an "Unsubscribed" badge next to the name in the list row, and a dedicated banner on the detail page) — `unsubscribeToken` itself is an internal campaign-link secret and correctly stays unrendered.

### 5b. Customer detail
Stat strip (Orders/Total spent/First order/Last order, + Phone if set) → Order history list (status Badge, `pending` relabeled "awaiting payment" in the UI). **No pagination.** **Segment membership: NOT FOUND on this page** — Customer Segments only works in the opposite direction (browse a segment → see its members); there is no reverse lookup.

### 5c. Reviews (moderation queue)
Status filter (Awaiting moderation/Approved/Hidden/All) → row-list (product + star rating, buyer name + date, "verified purchase" Badge if applicable, body text) → **Approve**/**Hide** buttons, single-click, **Fixed (Phase 4): a success toast now confirms the action** (the shared `Toaster`/`toast()` system was already mounted globally in the root layout but had zero call sites anywhere in the product until this pass) — no confirm step still, judged proportionate to the blast radius (reversible either direction, unlike a destructive delete).

Verified-purchase logic: order must be `confirmed`-or-beyond AND contain the reviewed product (Financial Truth Invariant). Moderating instantly recomputes the product's `averageRating`/`reviewCount`.

**Media (photo/video) support — Fixed (Phase 4 close-out):** built end-to-end, not just a UI pass. New `ReviewMedia` model (`id, storeId, reviewId, type[image|video], url, sortOrder, createdAt`, RLS-isolated one-hop via `storeId`) + a second, independent buyer-facing upload step (`POST storefront/order-status/:token/reviews/:reviewId/media`, `FilesInterceptor`, real `ObjectStorageService` round-trip, 5-file cap, MIME-validated before any upload happens so a rejected file never orphans earlier uploads in the same batch) — the original JSON-only `submit()` review endpoint is untouched. Moderation queue now shows a thumbnail grid per review (image `<img>` / video-with-`Play`-overlay) that opens a `Dialog`-based lightbox (full image, or `<video controls autoPlay>`) on click.

**⚠️ Tracked gap, not yet fixed (found + disclosed during the D-Studio close-out's storage-discipline research, founder confirmed this must stay recorded):** `ReviewMedia` has no `sizeBytes` column and is never summed against any quota — buyer-submitted review media is completely unmetered against `catalog.storage_quota_bytes` today, unlike every other store asset (`MediaAssetsService.uploadDirect()`'s pattern). Its actual per-file cap is 20MB (`MAX_REVIEW_MEDIA_BYTES`, `review-submission.controller.ts`), not the 12MB one might assume from the general media pipeline. Fix, when scheduled: add `sizeBytes` to `ReviewMedia`, sum it into the same storage-quota check `uploadDirect()` already does, persist through the same accounting rather than a bespoke review-only counter.

**Wishlist-save counts: NOT FOUND anywhere** — zero matches for "wishlist" in the entire codebase, no model, no endpoint, nothing seller-visible. Same as above - a real feature, not a UI gap.

- **Icons:** **Fixed: star rating now the lucide `Star` icon** (filled/outline per rating, `aria-label`'d), matching the icon used at nav level — was literal Unicode ★/☆. **Modals:** none on any of the three pages. **Loading:** `PageSpinner`. **Error:** inline text/`Alert` depending on page.

---

## 6. Analytics (+ Profit & Loss)

### 6a. Analytics
**File:** `analytics/page.tsx` · **Nav:** Growth → Analytics (`BarChart3`) · **Gating:** none.

Real endpoints, all Financial-Truth-gated (confirmed+ orders only, except return-rate which also counts refunded/partially-refunded):
- `GET .../analytics/top-products?by=revenue|units&limit=1-100`
- `GET .../analytics/sales-over-time?bucket=day|week|month&start&end` (30-day rolling default if omitted)
- `GET .../analytics/overview` → `{repeatCustomerRate, returnRate, aov, bestDayOfWeek, bestHourOfDay}`
- `GET .../analytics/return-rate-by-product` — **Fixed (Phase 4):** now consumed, as a "Return rate by product" horizontal-bar-chart card (same visual language as Top Products, keeping the page's own "charts, not spreadsheets" FR-61.6 discipline rather than a raw table).

**Layout:** 4-tile stat row (Repeat customers %, Return rate %, AOV, "Best time to sell" from a hardcoded day-name array, **each now with a lucide icon**) → Sales-over-time card (Day/Week/Month toggle, recharts LineChart, **Fixed: From/To date inputs now wired to the backend's own `start`/`end` params, with a "Reset to last 30 days" link**) → Top products card (revenue/units toggle, horizontal BarChart) → Return rate by product card (new). Reveal entrance motion applied throughout.

- **Icons:** stat tiles now iconed (lucide); charts still via recharts. **Modal:** none. **Empty (implicit):** "No confirmed sales..." copy per chart.

### 6b. Profit & Loss
**File:** `pnl/page.tsx` · **Nav: not in the sidebar at all today** — real, working, reachable only by direct URL (`nav-items.ts` roadmap comment confirms it's slated to become an Analytics-hub tab).

Real endpoints: `GET .../pnl/orders/:orderId` (unused by this page — meant for an Orders-detail tab later), `GET .../pnl/period?periodStart&periodEnd`, `GET/POST .../pnl/ad-spend`.

**Profit formula (exact):** `revenue = totalAmount − taxAmount`; `netProfit = revenue − commission − cogs − courierCost − handlingCost (− adSpend for periods)`. `cogs = Σ(baseCost ?? 0) × qty`; `incomplete: true` the instant any item's variant has `baseCost === null` (never silently treated as 0).

**Layout:** Period picker (From/To dates + "View" button — not auto-refetched on date change, left as-is) → incomplete-cost warning Alert (exact copy: *"...net profit is understated until you add it on that product's variant."*) → Revenue/Net-profit stat pair → Breakdown line list → Ad-spend card (manual entry form + CSV upload, **Fixed (Phase 4): the fragile fixed-1500ms `setTimeout` guess replaced with a real poll against the import job's own status** (`GET .../import-jobs/:jobId`, ~600ms interval, up to 20 attempts) + toast on completion/failure + entry list with Manual/CSV source Badge, **Fixed: real `EmptyState` for zero entries** (was silently rendering nothing) + Reveal entrance motion.

**Inconsistencies flagged:** period-view date inputs still have no explicit server-side malformed-date guard (unlike Analytics' `sales-over-time`, which does guard) — left as-is, out of Phase 4's UI-only scope.

- **Icons:** none. **Loading:** `PageSpinner` only on first load. **Modal:** none — CSV upload uses a hidden native file input.

---

## 7. Marketing hub

Locked nav: **Growth → Marketing**, one item, internal tabs over 6 real currently-separate routes. **Fixed (Phase 4):** every destructive/financial-state action across this hub now goes through a real confirm dialog — a new seller-dashboard `ConfirmDialogProvider`/`useConfirm()` (`components/dashboard/ConfirmDialogProvider.tsx`, mounted in `stores/[storeId]/layout.tsx`), the same pattern FR-8.16 built for the admin terminal but its own separate provider tree (admin's copy is mid-Phase-6-pending re-skin; this one is free to evolve with the dashboard's own design pass). **No plan-tier lock/upsell UI exists anywhere in this hub** — gated actions 403 with a raw message only, left as-is (a bigger, separate IA piece).

### 7.1 Tab: Campaigns
`campaigns/page.tsx` · Module 34. Gating: not feature-gated, only *volume*-gated via `email_campaigns.monthly_send_limit` (**GO 799/mo, RUN 2,499/mo, RISE 10,000/mo, FLY 1,000,000,000 sentinel**) — **Fixed (Phase 4):** new `GET .../campaigns/quota` read (`EmailCampaignsService.getQuota()`, the exact same computation `create()` itself enforces, factored out) now shown as a progress bar + "X remaining" up front, previously only discoverable via a rejected-send error message.

Compose form: Segment (select), Send from (select, connected sender emails), Subject (≤200), Message (textarea, ≤20,000) → "Send campaign" (still no confirm step - an irreversible send-to-many action, left as-is this pass; the quota bar above is the more actionable fix). Campaign list: subject, segment/sender/date, sent/failed counts, status Badge, Reveal entrance motion. **Unsubscribe stats: NOT FOUND** — still never aggregated/displayed anywhere (out of scope), even though unsubscribed customers are excluded at send time.

### 7.2 Tab: Customer Segments
`customer-segments/page.tsx` · Module 33. **Create** is real-gated: `customer_segments.enabled`, off by default, **RISE+FLY**. Read (list/view/preview) is explicitly ungated.

Filter-builder form: Name, Min/Max orders, Min/Max total spent, Last-order after/before, City, Country — all 8 criteria optional. **Fixed (Phase 4): live member-count preview** while building (form converted to controlled state, 400ms-debounced call to the previously-unused `POST .../preview` endpoint, "N customers currently match" readout). Segment list: name, computed criteria summary, live member-count Badge, expand-to-view-members, **Fixed: Delete now confirm-gated** (danger tone, names the segment).

### 7.3 Tab: Gift Cards
`gift-cards/page.tsx` · Module 32. **Seller-issue** is real-gated (`gift_cards.enabled`, off default, **RISE+FLY**); buyer-purchase path is ungated.

Issue form: Amount (required, positive), Code (optional, auto-generated if blank), Note (optional) — **Fixed: now the shared `Field`/`Input` kit** (was hand-rolled `<input>` elements). List: code, source, balance/initial-value, status Badge, "Confirm payment received" (pending_payment rows only, **Fixed: now confirm-gated**, names the code, explains the activation effect). **Fixed: Redemption history** — "View redemptions" expand-in-place action (same pattern as Customer Segments' member view) now surfaces the `redemptions` array the detail fetch already included. **Fixed: error UI now `Alert`-based**, consistent with the rest of this hub (was a plain `<p>`).

### 7.4 Tab: Discounts
`discounts/page.tsx` (lives in the `store-settings` backend module, not a dedicated `discounts` module). **Fully ungated across every plan tier** — confirm this is intentional (unchanged, flagged for founder confirmation).

Create form: Code (uppercased client-side), Type (%/fixed), Value (positive; % capped at 100 server-side), Usage limit (optional), Expires (optional). Code/type immutable after creation by design. List: code, summary, usage, expiry, active/inactive toggle, **Fixed: Delete now confirm-gated** (danger tone, names the code), Reveal entrance motion.

### 7.5 Tab: WhatsApp recovery
`whatsapp/page.tsx`. Ungated. Abandoned-cart list → "Send recovery message" (disabled if no WhatsApp number captured) opens a pre-filled `wa.me` deep link in a new tab — **nothing is sent automatically by the platform**, the seller taps send themselves. **Fixed: error UI now `Alert`-based**, Reveal entrance motion. **Fixed (Phase 4 close-out): template editing now real** — a new "Cart-recovery message template" card (Textarea + Save, Settings-Registry-backed via new `GET/PUT stores/:storeId/whatsapp/settings/cart-recovery-template`, ownership-verified via a new `assertOwnsStore()` RLS lookup). (Order-confirmation/shipping-update WhatsApp links live on Order detail instead, per this page's own doc comment — not independently re-verified in this pass, flagged for confirmation.)

### 7.6 Tab: FB/IG Shop feed + WhatsApp product-share link — Fixed (Phase 4 close-out)
Two real, distinct, differently-authenticated backend capabilities, now both surfaced as new cards on the existing `/marketing` page (no new top-level nav item, per `nav-items.ts`'s own hub-absorption plan):
- **A. Meta Commerce Catalog feed** (`GET /external/social-media/meta-catalog-feed`) — bearer-token auth reusing the *same* `SellerApiToken` mechanism the existing `/marketing` page's connect/list/revoke UI already manages. Gated `social_media.meta_catalog_feed_enabled`, **RISE+FLY**. New "Facebook & Instagram Shop feed" card: feed-URL display + copy-to-clipboard when unlocked, `UpgradeLockedCard` when not.
- **B. WhatsApp product-share link** (`GET .../whatsapp/products/:productId/share-link`) — session-authenticated, per-product, gated `whatsapp.product_share_enabled`, **RISE+FLY**, requires the product be `active`. Opens WhatsApp's own share/contact picker (no pre-addressed recipient, unlike the other 3 WhatsApp generators). New "WhatsApp product-share link" card: published-product `<Select>` + "Generate share link" when unlocked, `UpgradeLockedCard` when not. Both cards read a single new `GET sellers/me/api-tokens/social-media-feed-status` round-trip (`{metaCatalogFeedEnabled, whatsappProductShareEnabled, metaCatalogFeedPath}`).

### 7.7 Existing `/marketing` page — confirmed NOT the Campaigns tab
This route is the seller-scoped API-token hand-off to the founder's *separate* Social Media SaaS product (SSO handoff button + connect/list/revoke tokens) — an entirely different feature from Campaigns. **Open IA question, not decided here:** does this become its own 7th tab, or fold into the FB/IG feed tab since they share the exact same token mechanism?

---

## 8. Design Studio hub

Locked nav: **Growth → Design Studio** → **now `/stores/:id/d-studio`** (Fixed, D-Studio v1 — was `/customizer`). "Coded mode" is confirmed **not** a third tab of the old two-tab (Customizer/Navigation) structure — it's absorbed into D-Studio's own Custom CSS panel instead.

### 8.0 D-Studio v1 — the flagship animated-store design tool (built this pass, replacing the bare Customizer as the nav destination)

**File:** `app/stores/[storeId]/d-studio/page.tsx` — deliberately lives **outside** the `(dashboard)` route group (not `app/(dashboard)/stores/[storeId]/...`), so navigating here renders **zero Sidebar/topbar chrome** — confirmed via a real click-through (`hasSidebar: false`). Only the root layout's fonts/Toaster apply. A real, standalone, Figma/Webflow-style fullscreen workspace: slim top bar (store name, device-size toggle, save-state indicator, exit-to-dashboard), left rail (Sections/Style/Custom CSS tabs), centered device-frame live preview, right contextual inspector. Deliberately distinct dark "creative-tool chrome" from the rest of the (light monochrome) dashboard — same reasoning Figma/Photoshop use a dark workspace so canvas colors read clearly.

**Section library — 22 real section types, founder-approved GO/RUN/RISE reallocation** (backend-enforced, not just UI-hidden — `apps/api/src/theme-engine/section-catalog.ts` + `section-validation.ts`):
- **GO (8, free):** Hero, Product grid, Story/About, Testimonials, FAQ, Footer/Contact, Newsletter signup, Spacer/divider — a genuinely complete, professional store, single layout variant, one animation preset (Fade Up). GO was deliberately reallocated mid-build once the founder flagged the original split as "crippled" — Testimonials and Footer/Contact moved up from RUN/new into GO for exactly this reason.
- **RUN (+6, 14 total):** Featured collection, Gallery, Video banner, Countdown, Stats/counter, Trust badges — 2 layout variants per section, 6 animation presets. RUN's real upgrade case is motion, not section count.
- **RISE (+8, full 22):** Team, Before/after, Map/location, Social feed (placeholder grid only — no live Instagram/Meta API in v1), Sticky CTA, Shape divider, Comparison table, Blog/press — every layout variant, all 14 animation presets, Custom CSS unlocked.
- **FLY:** shares RISE's ceiling exactly (nothing withheld to upsell FLY) — instead gets a handful of FLY-exclusive premium variants (e.g. Hero's "Diagonal split", Product grid's "Editorial grid") and is positioned for 30-day early access to future sections/presets.

Section-library modal: category-tabbed (Marketing/Catalog/Content/Social proof/Structural) grid, tier badges, locked sections show a lock icon + "Upgrade to X to unlock" — same visual contract as `UpgradeLockedCard` used elsewhere. Real drag-to-reorder (`@dnd-kit/core`/`@dnd-kit/sortable` — this codebase's first dnd library; the old Customizer's up/down-arrow reorder is untouched for its own simpler list).

**Per-element animation — 14 real, GSAP-backed presets** (`lib/dstudio-animations.ts`, `components/motion/AnimatedElement.tsx`): entrance/scroll reveals (Fade Up/In, Slide In, Scale In, Stagger Reveal), micro-interactions (Hover Lift, Magnetic Button), image/text (Ken Burns, Text Split Reveal), scroll (Parallax Drift), glass/gradient (Glass/Blur Reveal, Gradient Shift), section transition (Sticky Pin), and Lottie Playback. **Runs for real on the live storefront**, not just the Studio preview — a seller's chosen preset is a genuinely shipped feature the moment they save, unlike Coded Mode's stored-but-inert `customCode`. **Honest gap:** "Lottie Playback" has no real `.json` asset upload anywhere in v1 (no per-section Lottie-asset field was built), so it's implemented as a clearly-commented placeholder (a scale+fade entrance) rather than silently faking real Lottie playback — flagged in-code and here, not hidden.

**Layout variants — real, not just accepted-and-ignored props:** the original 5 sections (Hero/Product grid/About/Newsletter/FAQ) keep their own bespoke per-template look across all 4 templates + blank-start, now with real distinct variants added (variant index 0 is always each template's pre-existing rendering — verified this matters: the catalog's first draft put "Image left" at index 0 for About, which would have silently changed every already-published store's About section layout the moment this shipped, since a pre-D-Studio row has no `variant` field and defaults to 0; caught before it landed and reordered so index 0 stays "Text only"). The 17 new section types are a shared, theme-token-driven component library (`templates/dstudio-sections/`) used identically across all templates — the only tractable way to ship 22 sections × 5 templates without ~90 bespoke components; documented tradeoff, not an oversight.

**Template gallery:** the same 4 built-ins + "Start from blank," tier/category-tagged, in a modal — swaps `themeId` directly.

**Visual customization:** a Style tab with a native color-swatch picker for primary/background/text (same 3-color model the old Customizer already had). **Real gap, not built this pass:** a font-pairing/typography selector and logo/media upload — both still only live on the old `/customizer` page (linked from within D-Studio's Style tab for now), since no seller-facing typography-choice system exists in the theme model yet.

**Custom CSS (RISE+):** a dedicated panel, same `theme.coded_mode_enabled` gate and same "scoped, presentation-only, never touches cart/checkout/account" guarantee as the old Customizer's Coded-mode card — this is genuinely the same backend feature, just surfaced in the new shell instead of a second implementation.

**Guardrails carried over unchanged:** THE ISOLATION RULE (`check-template-isolation.js` + `templates-isolation.e2e-spec.ts`) — re-verified passing after adding `templates/dstudio-sections/` (living *under* `templates/` means the existing scan covers it for free, zero script changes needed, confirmed: "8 file(s) scanned, 0 violations"). "Managed by UZEYN" mark stays mandatory below FLY, resolved server-side, unaffected by anything in this shell. No free-form code/script input exists anywhere — Custom CSS only.

**Premium Motion Templates (founder-approved scope addition) — backend purchase-flow groundwork only, no frontend yet:** the founder's pre-launch ask for 2-3 new purchasable, heavier-motion templates was slotted here (this module) rather than a new one, since it's built entirely from D-Studio's existing section/animation-preset architecture (no new rendering engine). What's shipped this pass is deliberately backend-only, per explicit instruction to pause the actual template designs for the founder's own visual pass: `Theme.price` (null = not purchasable in-app), a new `TemplatePurchaseRequest` model + RLS policy (`seller_id`-scoped, same shape as `TemplateEntitlement`), a seller-facing `POST/GET /sellers/me/template-purchases` (reuses `WalletService.topUpInstructions()` for the exact same manual bank/Easypaisa/JazzCash instructions text already shown for plan-fee payments — no second payment system), and an admin verification queue (`GET/POST /admin/template-purchases/:id/verify|reject`) that grants a real `TemplateEntitlement` (`source: platform_purchase`, deliberately distinct from the external Template Store's own `marketplace_purchase` grant) on confirm. 5 new e2e tests cover the full request → duplicate-rejection → admin-verify → entitlement-granted → theme-selectable chain, and the reject/already-owned/list-is-own-only edge cases. **Not yet built:** the 2-3 actual template designs themselves, and any seller-facing UI to browse/buy them (paused, per the founder).

**Explicitly NOT in v1 — documented "D-Studio v2" roadmap, not an oversight:** free-form drag-drop canvas/block placement (this v1 is strictly section-based, reordering existing sections — not building new layout structure), arbitrary custom code/script execution, a third-party plugin/embed system, real-time multi-user collaborative editing, AI-assisted design generation. Per the founder's own plan, these are intended to eventually become the seed of a separate external SaaS product, not features to retrofit into this shell.

**Verification:** full `apps/web` typecheck + `next build` clean; real authenticated Playwright click-through against the live dev stack for a GO seller (8 unlocked / 14 locked-with-upgrade-prompt sections, confirmed zero dashboard chrome) and a RISE seller (added a RISE-only section, set a RISE-only animation preset, saved, reloaded — persisted correctly through the real backend validation).

- **Empty state:** "No visible sections yet - add one from the library." **Loading:** a full-bleed dark spinner state, matching the shell's own chrome (not the dashboard's `PageSpinner`). **Icons:** lucide, consistent stroke width. **Modal:** section library + template gallery, both dark-chrome-styled to match the shell (not the light dashboard `Dialog`).

### 8.1 Tab: Customizer (now secondary — kept for controls D-Studio v1 doesn't cover yet)
`customizer/page.tsx` (~420 lines) · Module 4/58.

**Gating, three distinct, real:**
- Theme selection: `marketplace`-tier themes need a purchased `TemplateEntitlement` (never plan-gated); `premium`-tier themes need `theme.premium_tier_enabled`, **RISE+FLY**.
- Branding removal ("Managed by UZEYN" mark): `branding.powered_by_removable`, real only on individual **FLY** (or any team tier). A downgrade off the qualifying tier always reverts the mark to visible regardless of the seller's stored preference.

**Layout (two-column, controls | live preview using the *actual production* storefront section components):** Theme select → Premium-templates card (conditionally rendered only if a showcase URL is configured — **does not render at all in v1.0**) → Storefront branding checkbox → Colors (3 native color swatches: primary/background/text) → Sections (checkbox + reorder, **Fixed (Phase 4): lucide `ChevronUp`/`ChevronDown` icons** with `aria-label`s, was ↑/↓ text glyphs — **fixed 5-item bounded set**: hero/featured_products/about/newsletter/faq — no add/remove beyond this) → Announcement bar → WhatsApp button → FAQ (repeating Q&A rows) → Save. Controls column now has a one-time Reveal entrance on load (re-renders from typing don't re-trigger it).

**4 built-in themes + "Start from blank," confirmed exact defaults:**

| Theme | Tier | Default sections |
|---|---|---|
| Editorial | free, default | hero, featured_products, about, newsletter |
| Atelier | free | hero, featured_products |
| Studio | premium | featured_products, hero, newsletter |
| Market | premium | featured_products, hero |
| Start from blank | free | none (empty) |

**Coded-mode — Fixed (Phase 4 close-out), editor only, shipped honest:** `theme.coded_mode_enabled` (real, **RISE+FLY**) is enforced server-side as before. New "Coded mode" card: RISE+FLY sellers get a real `customCode` Textarea + independent "Save code" button (a PATCH with only `{customCode}` in the body — Prisma treats the omitted `themeId`/`settings` fields as "don't touch," so this never clobbers theme/section state saved via the main Save button); GO/RUN sellers see an `UpgradeLockedCard`. **Still no storefront-side execution path** — this pass deliberately did not build one, and the editor discloses that honestly in-UI (a standing `Alert`: "Saved here, but not yet rendered on your live storefront in this release … Use this as a staging area; nothing you write here is visible to buyers today"). `getForStore()` now also returns `codedModeEnabled` so the frontend can render the gate in one round-trip.

**Store branding/logo upload — real gap:** `ThemeSettings.logoUrl`/`.bannerUrl` exist in the data model and are read at render time, but **the Customizer has no upload control for either field**, and no dedicated logo-upload backend endpoint was confirmed. (Note: §16 Settings' "Store branding" card *does* have a real logo upload/remove flow via `POST/DELETE /stores/:id/logo` — separate from this `ThemeSettings.logoUrl` field; worth reconciling which is canonical.)

- **Empty state:** not handled distinctly. **Loading:** `PageSpinner`. **Icons:** section reorder now lucide (see above). **Modal:** none.

### 8.2 Tab: Navigation
`navigation/page.tsx`. Header/Footer toggle → repeating item editors (Link/Text block/Social links — the last a fixed 4-platform set: facebook/instagram/tiktok/twitter) → Add item / Save (whole-array replace, no per-item endpoint). **Fixed (Phase 4): real loading state** (`items` starts `null`, `PageSpinner` while fetching, re-triggered on location switch) **and real empty-state copy** (`EmptyState`, "No header/footer items yet") — was previously indistinguishable from "loaded, genuinely empty." Item list now has Reveal entrance motion. Plan-gating not independently confirmed in this pass — flagged for a follow-up read before finalizing.

---

## 9. Shipping & Tracking

**File:** `shipping-tax/page.tsx` · **Nav:** Operations → Shipping & tracking (`Truck`) · **Gating:** none.

**Redesigned (Phase 5b) into a real two-part hub, matching what the nav label always promised:** a **Tracking** tab (default) — bucket-count tiles for all 7 buckets (read-only summaries; full filter/bulk-action/CSV-import stays on the Orders page, linked out via "View all orders" rather than duplicated) → an **Awaiting tracking** list, each row with inline tracking-ID/carrier entry (same action as the Orders page's per-order tracking form) and a "Flagged - missing tracking" badge driven directly by `Order.missingTrackingAlertedAt` (see below) → a **Shipping & tax** tab holding the pre-existing two settings cards unchanged.

**"Orders Command Center" is still not a separate screen** — it *is* the Orders list's bucket-tile strip (§2a). This hub's tiles are a second read-only rendering of the same `orders/overview` data, not a third source of truth.

**Missing-tracking alerts: now built (Phase 5a, this SRS §14.68/Module 88 item).** `MissingTrackingAlertService.runSweep()` (hourly BullMQ sweep, check-interval and alert-threshold both Settings-Registry-driven — `orders.missing_tracking_sweep_check_hours`/`orders.missing_tracking_alert_hours`, global-only, default 1h/24h) flags any order still in the `awaitingTracking` bucket (reusing `orderBucketWhereClause` exactly, so this can never drift from what the bucket tile counts) whose most recent `status_changed` event is older than the threshold, emails the responsible party — the seller for a self-fulfilled item, the fulfilling supplier for a supplier-fulfilled one, both for a mixed order — and sets `missingTrackingAlertedAt` once, ever, per order (no reset/expiry logic needed: leaving the bucket, e.g. by shipping, naturally stops it matching the sweep's query again). Surfaced on this page as the badge above, per the founder's own framing ("surfacing as an overdue state on the existing bucket," not a new page).

**Delivery-time badges (Module 29): no seller-facing settings section anywhere.** The feature is entirely buyer-facing (storefront `DeliveryBadge` component), sourced from **admin-configured platform-wide Settings Registry defaults** for the Printify adapter (not real per-shipment data, not seller-editable at any tier).

**Shipping-cost-calculator display toggle: NOT FOUND** (Module 84, Buyer Experience Batch, not built — zero Settings Registry key, zero toggle).

---

## 10. Suppliers

**File:** `suppliers/page.tsx` · **Nav:** Operations → Suppliers (`Handshake`), **conditional** — sidebar item only appears once ≥1 supplier link exists (explicit "SIMPLICITY INVARIANT" comment).

Invite form (email) → list (Card rows) with status Badge (`pending_seller_review`/`active`/`revoked`) → **Approve** (pending only) / **Revoke** (active only), both **no confirm step.** Empty state real: *"No suppliers connected — Selling entirely your own products? You can ignore this screen..."* **Fixed (Phase 5e):** each row now shows the supplier's real `businessName` (`supplier-links.service.ts`'s `list()` now `include`s it) instead of a truncated UUID.

**Supplier portal connection flow:** the supplier-side login is a wholly separate app surface (`supplier-portal.controller.ts`), out of scope for the seller dashboard beyond the invite-by-email above.

**Printify adapter status: not seller-facing at all** — adapter registration/health is **admin-only** (`admin/supplier-adapters`); the seller's own row is fully adapter-agnostic, showing nothing about which adapter or its health.

**Listing review/approval queue — built (Phase 5e), closing the confirmed gap.** New "Listing reviews" section on this same page: pending queue (listing title, supplier business name, price + shipping cost, Approve/Reject) → a recent-decided history (approved/rejected Badge). `listing-reviews.service.ts`'s `list()` now `include`s the listing/supplier so a seller can actually see what they're deciding on, rather than an opaque review ID. Verified live end-to-end: a real supplier submission approved into a real live storefront product.

**Delivery-badge data source:** traced end to end — Printify adapter → platform Settings Registry defaults → `SupplierListing` rows → storefront `DeliveryBadge`. No seller UI anywhere in this chain.

---

## 11. Payments

**Extracted (Phase 5f) into its own route, `payments/page.tsx`** — no longer a `/settings#payments` anchor. **Nav:** Operations → Payments (`CreditCard`), now a real link.

**Two cards, real, reordered so the gateway (the thing this redesign is actually about) leads:**

**A — "Payment gateway"** (Module 62, auto-confirm path, ungated on every plan): connections list (provider, merchant ID, Active toggle, Test button — result not persisted, lost on reload, Remove **no confirm**) → connect form (Provider select, Merchant ID optional, API key required/password-masked, API secret optional/password-masked). **Copy reframed per the founder's locked directive** (previously recorded here, now applied verbatim): *"so we can verify your buyer's payment was received and confirm the order automatically"* — order-verification framing, no mention of commission (there isn't one under the subscription-only model). **Fixed (Phase 5e):** a per-provider hint line under the form (`GATEWAY_PROVIDER_HINT`) now tells a seller which real-world credential to go find for their selected provider — still not a provider-accurate field set (the connect DTO is still one generic shape for all 4 providers; a real JazzCash hash-key field etc. would need backend DTO work, out of scope here) — flagged, not silently left as before.

**B — "Payment instructions"** (manual/COD path): Bank title/number/name, JazzCash number/title, Easypaisa number/title, "registered in my own legal name" checkbox (triggers admin review if inconsistent), "Accept Cash on Delivery" checkbox. `PATCH .../payment-instructions`.

**Connection health / "gateway health monitoring": built backend-side (Module 67)**, still correctly NOT rendered on this page — it's an **admin-facing, aggregate** rollup (`AdminSystemStatusService.paymentGatewayHealth`), never seller-facing by design. The seller still only ever sees the one-off, non-persisted "Test" result here.

**Screenshots/video help content for each provider's connection flow — still not built.** The founder's directive also asked for this; out of scope for this pass (content, not code) - flagged for whoever owns help-content authoring.

**Alert history: NOT FOUND** — no persisted test/alert log model exists.

**Manual mark-as-paid fallback — real, confirmed to be the same "Mark as paid" button already documented on Order detail (§2b) and the Orders bulk-action bar (§2a) — not a separate toggle.** It's the built-in fallback for sellers using instructions-only (no gateway).

**Module 76 Prepaid Partial-Advance — built (Phase 5c/5d), correctly NOT on this card.** Now a real 5th option on the Order Verification channel dropdown (§2c), RUN+ gated via the standing `UpgradeLockedCard` pattern (locked-not-disabled: stays in the select with a "(requires RUN or above)" suffix, never hidden), with the buyer-facing deposit-payment flow built on the order-status page. This card was always the wrong home for it (order-verification channel choice is store-level, not gateway-connection-level) - confirmed correct by not building it here.

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

**Fixed - launch blocker, treated as such rather than ordinary Phase 5 scope.** Found while building the Module 76 checkout UI above: **the buyer-facing verification flow didn't exist for ANY channel**, not just partial-advance - no OTP entry, no resend, nothing, anywhere on the storefront, for `whatsapp_otp`/`email_otp` either. Any seller already using those two channels had every order permanently stuck "awaiting verification" with no way for a buyer to ever clear it. New `OrderVerificationPanel` (mounted on both order-confirmation and order-status, below) now handles all four channels: OTP code entry + resend (respecting the existing cooldown) for `whatsapp_otp`/`email_otp`, a status-only message for `prepaid_confirmation`, and the prepaid partial-advance deposit-payment flow (gateway options → provider pick → real charge via the existing `verifyPartialAdvanceByToken()`) for `prepaid_partial_advance`. `OrderStatusLookupService.lookup()` now includes `verification: {channel, status}` in its buyer-facing response (previously omitted entirely) to drive it. Verified live end-to-end: a real OTP requested, a wrong code rejected with the real error, the correct code accepted into a real "Verified" state.

**Shipping-cost calculator: NOT FOUND** on checkout either — same static disclaimer sentence, no live recompute.

## Order-status / tracking page

Status line (`pending` relabeled "Awaiting payment") → **new `OrderVerificationPanel`** (see the fixed launch-blocker note under Checkout, above) → real order timeline (5-stage dot list, Module 27) → items/tracking → totals → conditional invoice-PDF link → **static** "how to pay" block (only place payment info ever surfaces to a buyer) → shipping address → **Return & refund form** (real, textarea + submit, or a read-only status view once a request exists) → **Review form** (see below).

**UZEYN brand disclosure: present, but only via the shared footer mark**, gated by the same plan-based `poweredByVisible` flag as every other page — no additional disclosure specific to this page beyond that.

## Order confirmation page

Reuses the same order-status fetch. Explicit banner: "Thank you for your order! Your order is **awaiting payment** — it isn't confirmed yet." (Financial Truth Invariant enforced in copy, not just data.) Also mounts `OrderVerificationPanel` (the buyer's first touch with it, right after checkout) - same component, same fix as the order-status page above.

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

**Phase 6 update (this pass):** all 29 pages under `apps/web/app/(admin)/admin/**/page.tsx` have been re-skinned onto the dashboard's `DashCard`/`PageHeader`/`Field`/`Button`/`Badge`/`Alert` component kit and design tokens, consistent with the rest of the platform. This was explicitly a **restyle, never a capability removal** (founder's standing directive) — every action, form, table, and confirm-gate documented below is unchanged in behavior; only the visual chrome changed, plus a small number of founder-approved **deepenings** noted inline where a page now surfaces backend capability that previously had no frontend at all (Settings Registry expiry, System Status's payment-gateway health). The paragraphs below (written before this pass, for the original bare-HTML state) are otherwise left as the accurate functional/gap record they still are.

**Shared chrome** (`admin/layout.tsx` + `components/admin/AdminSidebar.tsx`): a proper sidebar (desktop static aside + mobile Radix drawer, mirroring the seller dashboard's `Sidebar.tsx`), with the same wordmark placeholder. **Notification bell is real and functioning** (`GET /admin/notifications`, dropdown with `{label,count}` items linking to queues) — this directly answers the founder's original open question; it is a different thing from `admin/messages` (an outbound seller-facing broadcast tool). Nav is now grouped into 6 labeled sections (`components/admin/nav-items.ts`) — **Overview** (Home, Search, Analytics, System status) · **Commerce & Finance** (Sellers, Finance Terminal, Wallet top-ups, Payment instructions, Commission invoices, Plans, Categories, Supplier adapters) · **Orders, Trust & Safety** (Returns & Refunds, Verified Store, Moderation, Trust & Safety) · **Growth Programs** (3× Growth queues, Careers) · **Platform** (Settings Registry, Audit log, External API clients) · **Content & Comms** (Content pages, Messages, Email, Newsletters). Every one of the same 26 links still points to the same destination — this grouping is purely presentational, not a new information-architecture decision.

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

**Wallet top-ups** — legacy-named route (real invoices live at Commission invoices instead); bulk Verify/Reject (Module 89, SRS FR-8.17: `POST admin/wallet-topups/bulk-decide`, one request per batch, per-item try/catch, real `{succeeded, failed}` response, one batch-summary audit-log entry — replaces the old client-side `Promise.all` fan-out) **now `useConfirm()`-gated** (danger tone on reject), per-row Verify/Reject unchanged — **no confirm/reason on either** (only the bulk actions were in scope for FR-8.16).

**Payment instructions** (new, v0.41 audit fix, SRS FR-6.23) — `/admin/payment-instructions`. Fixes a real, confirmed gap: `ManualBankTransferTopUpAdapter.instructionsFor()` previously returned a hardcoded placeholder sentence ("...the platform's business bank account...") with **zero real account details anywhere** and no admin-configurable mechanism at all — a seller submitting a subscription/plan-fee payment genuinely had no way to know where to send it. Now backed by a real Settings Registry key (`billing.platform_payment_instructions`, `requiresConfirmation: true`), editable via a dedicated form (bank title/number/IBAN/bank name, Easypaisa number, JazzCash number, each independently enabled) rather than the generic Settings Registry editor's raw-JSON textarea. A disabled or blank method is never shown to a seller; with nothing configured at all, the seller sees a clear "haven't been configured yet - contact support" message, never a fabricated detail. Surfaces on the seller's Billing & Plan page (§15) the moment they view their plan-fee payment preview, and on the supplier top-up flow too (same underlying adapter). **Fixed**: now linked from the Finance Terminal hub (below) as its existing page, not duplicated.

**Platform merchant connection** (new, founder-directed scope) — `/admin/platform-gateway`. UZEYN itself as the connected merchant, reusing Module 62's exact seller-gateway-adapter architecture (`SellerPaymentGatewayAdapter`/`GatewayVerifyContext`/`GatewayVerifyResult`, the same AES-256-GCM credential encryption, the same `PROVIDER_PRIORITY` ordering) rather than a parallel implementation — but backed by its own `PlatformGatewayConnection` model and a standalone `platform-gateway` module (kept separate from `PaymentGatewayModule` specifically to avoid a `BillingModule → PaymentGatewayModule → OrdersModule → BillingModule` circular-import chain). Connect form (provider/merchant ID/API key/API secret) + per-connection Test connection / Activate-Deactivate / Remove, all through the same admin API used by the seller side. **Same "mechanism now, real activation later" discipline used everywhere else in this project (Safepay, disbursement):** the schema defaults `isActive` to `false` (the opposite of the seller-side default), so a fresh connection is always saved dormant, and `useConfirm()` (danger tone) is required to flip it active — the copy in that dialog states plainly that doing so makes a matching seller plan-fee payment or Premium Motion Templates purchase verify and grant AUTOMATICALLY, no admin step. Until the founder completes the NTN + merchant application and connects real credentials, this stays dormant in production and the existing manual bank-instructions + admin-confirm flow (Payment instructions, above; Wallet top-ups' verify queue) remains the only active path — `tryAutoVerify()` returns `null` (never throws) whenever no active connection exists, so `WalletService.requestPlanFeePayment()` and `TemplatePurchaseService.requestPurchase()` fall back to the unchanged manual flow identically. An auto-verified grant is traceably distinct from a human-confirmed one in both the audit log and the events stream (`actorType: "system"` vs `"admin"`).

**Finance Terminal** (new, founder-approved scope) — `/admin/finance`. One platform-wide financial hub, own nav item, re-embedding/linking existing surfaces rather than duplicating them: (1) Revenue overview — `MrrAnalyticsService.compute()`'s existing MRR/subs/renewals/churn/ARPS/LTV fields, extended with `realizedRevenueThisMonth`/`realizedRevenueThisQuarter` (sum of verified plan-fee `WalletTopUpRequest.planFeePortion` within the calendar month-to-date/quarter-to-date window — genuinely new, the field previously only existed as a private `trailing30dRevenue` never returned). (2) Pending payment verification queue — re-embeds `GET admin/wallet-topups` (top 5 + count), links to the full `/admin/invoices` verify/reject workflow rather than rebuilding it. (3) Refund history & totals — new `GET admin/finance/refunds` (paginated), the first platform-wide (not per-seller/per-order-scoped) list+sum of `refund_adjustment` ledger entries. (4) Growth-program obligations — new `GET admin/finance/growth-program-obligations`, outstanding (requested/approved/processing) `PayoutRequest` amounts grouped by the seller's own `ProgramParticipant.programType` (a seller with participation in more than one program buckets under "multiple" rather than guessing/double-counting; a payout with no matching participation row buckets under "unattributed" — both edge buckets keep the grand total exact). (5) Platform payment instructions — links to `/admin/payment-instructions`, not duplicated. (6) Commission status by tier — new `GET admin/finance/commission-by-tier`, the optional convenience read looping `billing.commission_rate_percent` resolution across all four individual tiers (GO/RUN/RISE/FLY) in one call, alongside the global default. (7) Financial export — `GET admin/finance/export.csv`/`.pdf`, reusing the existing `toCsv()` utility and `InvoicePdfService`'s Playwright-based HTML→PDF renderer verbatim (no new export format or PDF engine). Bare view, same precedent as the rest of this section.

**Commission invoices** — table + "Mark paid" (**now `useConfirm()`-gated**) + a "Waive a commission line" form (Seller ID/Order ID/Amount, all raw free-text, **now `useConfirm()`-gated**, danger tone, shows the waived amount).

**Returns & Refunds (admin override)** — Approve (no confirm) / Reject (reason required) / "Complete refund" (amount input defaulting to order total, **now `useConfirm()`-gated**, danger tone, shows the refund amount — Approve/Reject were not in scope for FR-8.16 and remain unconfirmed).

**Verified Store** — Pending-applications cards (Approve / "Reject (refunds fee)" — label documents the side-effect, **neither has a confirm dialog**) + Re-review cards ("Clear - keep verified" / "Confirm - revoke," revoke requires a reason). One of the few pages with genuine, real empty-state copy for both lists.

**Moderation queue** — REVIEWER-sub-role-accessible. "Force remove/restore" direct-lookup tool (raw product-ID text field, reaches *any* product; **Force remove now `useConfirm()`-gated**, danger tone — Restore is non-destructive and stayed ungated) + bulk Approve/Reject (Module 89, SRS FR-8.17: `POST admin/moderation/queue/bulk-decide`, one request per batch, per-item try/catch, real `{succeeded, failed}` response, one batch-summary audit-log entry — replaces the old client-side `Promise.all` fan-out; Reject requires shared notes, explicitly disclosed as buyer/seller-visible; **both now `useConfirm()`-gated**) + per-row queue table (per-row Approve/Reject unchanged, not in scope). Real empty-state copy: "The queue is empty."

**Trust & Safety** — Payment-instrument review queue (Approve/Reject, no reason field, no confirm) + 5 read-only risk-monitor tables (cancellation-rate, pending-forever-rate, signup-velocity, bypass-attempts, self-referral — none link through to Seller-360 despite showing seller IDs) + Seller Agreement version publish form (**no confirm despite being a legal-document publish affecting every seller**).

**Growth: applications / content-submissions / withdrawals** — three separate queue pages, each Approve/Reject (or a processing→paid state machine for withdrawals) with optional notes, **no confirm dialogs anywhere**, no seller-ID linking to Seller-360.

**Careers** — postings table (draft/open/closed) + expandable per-posting applicant sub-table (status change via an **instant-commit dropdown**, no explicit Save button, no confirm) + create-posting form (always created as draft).

**Plans** — new (v0.41, founder request) **"Pause new subscriptions"** section at the top: a checkbox + admin-editable message, `useConfirm()`-gated (danger tone when turning it on). Backed by `billing.new_subscriptions_paused`/`billing.new_subscriptions_paused_message` (Settings Registry). When on: blocks a new seller signup (503, the custom message) and a first-cycle plan-fee submission (400, same message) — an existing seller's renewal payment, dashboard, and stores are completely unaffected; a supplier signup is unaffected too (seller-scoped). The pricing page (`/pricing`) shows the same message in a callout near the top when paused, via `GET /plans/pricing-copy`'s new `newSubscriptionsPaused`/`newSubscriptionsPausedMessage` fields. Deliberately distinct from `platform.maintenance_mode_enabled` (`MaintenanceModeMiddleware`), which blocks every request platform-wide including existing sellers — that one is unchanged.

Then: 3 grouped tables (individual/team/supplier) → Create-tier form → **Grant a plan to a seller** (raw seller-ID text, bypasses billing/checkout entirely, no confirm — not in scope for FR-8.16) → Create promo code form. "Retire" button per active plan, **now `useConfirm()`-gated**, danger tone. Widest table in the terminal (13 columns), zero responsive handling.

**Categories** — deliberately append-only (no rename/delete, disclosed in-page). Writes to `/categories`, not `/admin/categories` — a real backend-naming inconsistency worth flagging.

**Supplier adapters** — per-adapter enable/disable toggle (**now `useConfirm()`-gated**, danger tone on disable) + raw-JSON config textarea (validates "is it valid JSON," not schema-correctness) + register-new form (free-text adapter type, no dropdown of known types).

**Settings Registry editor** — the flagship write UI. Definitions table (unsorted/unsearchable at ~90 keys) → detail panel: precedence-chain table (winning scope bold), type-aware Save form with real client-side validation mirroring server rules. **High-impact confirm — fixed (FR-8.16):** detection is now the data-driven `requiresConfirmation` boolean on `SettingsDefinition` (seeded `true` on the same 29 keys the old `billing.`/`commission`/`platform.maintenance` string-match covered), resolved via `GET /admin/settings/resolve` and shown through the shared `useConfirm()` dialog (old→new value) instead of a native `window.confirm()`. A future equally-sensitive key no longer needs to match a frontend string pattern — it just needs the field set true. Seller-360's own settings-override mini-editor now reads the same field and shows the same gate, closing the prior inconsistency. **Deepened (Phase 6f):** `resolveWithChain()` has returned a per-entry `expiresAt` since the D-Studio close-out's time-limited-grants work, but no generic editor ever showed or set it — every scoped override in the precedence-chain table now shows its expiry as a badge ("until {date}" / "no expiry"), and the Set-a-value form has an optional "Expires at" field for any non-global scope on any key, live-verified end to end (a store-scoped override with a real expiry round-trips correctly through a fresh page reload).

**Audit log** — genuinely read-only (DB-grant-enforced insert-only), single "last N" limit filter, no date/action/admin/target filters, no search. Before/after diffs in a native `<details>` disclosure. Impersonation-session column lets an admin trace exactly what happened during any support session.

**System status** — Core services list (DB/Redis/storage/email/backups — backups line is a **documented, founder-authorized stub**, not fake data but not real monitoring either) + background-queue-depth table (Failed count is the only conditional-tone styling here, now a `Badge`). **One-shot fetch, no auto-refresh/polling** despite "live infrastructure health" framing — founder should decide if this needs one. **Deepened (Phase 6b):** `AdminSystemStatusService`'s `paymentGatewayHealth` field (Module 67) had no UI consumer anywhere in the admin terminal until this pass — added as its own "Payment gateway health" DashCard on this page, the first time this rollup is surfaced anywhere in the frontend.

**Analytics** — real-time GMV/revenue table + top-sellers-by-commission table + unit-economics table (admin-entered infra cost, break-even calc). **No charts anywhere** — every figure is plain HTML text. **MRR/subscription analytics (Module 63) and seller health funnel (Module 69) are now real, e2e-tested backend endpoints** — `GET admin/analytics/mrr` and `GET admin/analytics/seller-funnel` on this same `AdminAnalyticsController` both exist and work — **but this page has no UI consumer for either yet**; adding them here is the natural next step once Phase 4 (Analytics) design begins. Support SLA queue view (Module 68/90) and payment-gateway health monitoring (Module 67, see System Status above) are likewise backend-complete with no admin page surfacing them yet.

**External API clients** — register/enable-disable/regenerate-secret for the two SaaS integration hooks. "Regenerate secret" **now `useConfirm()`-gated**, danger tone (the new one is still shown once in a copy-now banner after confirming).

**Content pages & brand assets** — 5 fixed legal/info page editors (plain textarea, deliberately not WYSIWYG) + 3 fixed brand-asset URL-reference fields (no actual file-upload widget — URL-paste only). 8 independent save buttons, **zero confirm steps** despite being public-facing legal/brand content.

**Messages** (seller-facing banners/popups/in-app) — target All/Plan/Seller (raw ID fields, no lookup), scheduled window — table + create form + Delete (**now `useConfirm()`-gated**, danger tone). Not the same as the admin's own notification bell (see chrome, above).

**Email** — UZEYN's own unified inbox: link IMAP+SMTP accounts (native `FormData` form, the only one built this way; plain-text password fields with **no masking toggle**) → merged inbox → reply (fixed "To," pre-filled subject). "Unlink" is **now `useConfirm()`-gated**, danger tone. A failed reply-send blanks the *entire* inbox view rather than showing an inline error — a real UX gap.

**Newsletters** — compose (native form) → save as draft → **Send** (an irreversible broadcast to every seller on the platform — the single highest-blast-radius action in the whole admin terminal, and now protected accordingly: `useConfirm()`, danger tone, **and a typed "SEND" confirmation** before the button enables — the strongest gate in the terminal). Live status tracking (sent/failed counts, failure reason).

**Login** — credentials step → mandatory TOTP MFA step, including automatic first-time enrollment. **MFA setup shows the raw `otpauthUrl` as plain text, not a scannable QR code** — a real usability gap worth a design decision. The only page with a clean, consistent inline error pattern in the whole terminal.

**Impersonation flow (cross-cutting, not its own nav page)** — start (reason prompt → new tab bridge, stores the impersonation token under the same `accessToken` key a normal seller session uses so every dashboard screen works unmodified) → transparency banner (`SupportModeBanner`, "Exit support mode" is a **local-only soft exit** — real termination happens from the admin's original tab) → **real, server-enforced blocked-writes guard** (`@BlockDuringImpersonation()`) confirmed applied to real money-adjacent routes across payment-gateway, wallet, orders (mark-as-paid), growth-program withdrawals, payment-instructions, and subscriptions controllers → full audit-log traceability via a real `impersonationSessionId` column. This is one of the most thoroughly implemented, end-to-end mechanisms in the entire admin terminal.

# Part 6 — Mobile-Responsive Audit (Phase 7)

A real 375px-viewport Playwright sweep, not a code-reading exercise — every finding below was reproduced with a screenshot before the fix and reproduced clean after it.

**Critical, found and fixed — admin shell (`admin/layout.tsx`):** the outer wrapper was plain `flex` (row direction) with no mobile-stacking fallback, unlike the seller dashboard's proven `flex flex-col md:flex-row`. At 375px this turned the mobile top bar (wordmark + hamburger) into a flex-row *sibling* of the page content instead of a bar stacked above it — every single admin page rendered with a large blank left gutter and all real content crushed into a narrow right-hand column (confirmed via screenshot on Admin Home and Sellers). This was a regression introduced during Phase 6a's layout rewrite, not a pre-existing issue. Fixed by changing the wrapper to `flex flex-col md:flex-row`, matching the dashboard's own pattern exactly. The seller dashboard shell itself was checked first and confirmed clean — this bug was admin-only.

**Secondary, found and fixed — 6 form/filter rows across 4 pages** (`admin/email`, `admin/messages`, `admin/settings`, `admin/sellers/[sellerId]`): a `flex flex-wrap` row containing a fixed-width sibling (`w-NN`) next to a `flex-1` sibling never actually wraps at mobile widths — a flex item's default `min-width: auto` lets the `flex-1` sibling shrink indefinitely instead of the row wrapping, so both siblings end up squeezed onto one illegible line. Fixed by making each row `flex flex-col gap-N sm:flex-row` and the fixed-width child `sm:w-NN` (full-width stacked on mobile, fixed-width in the row at `sm:` and up). A repo-wide grep across all ~25 `flex flex-wrap` rows in `apps/web` found these were the only ones with the actual fixed-width+flex-1 failure signature; the rest wrap fine as-is (equal-width or all-fixed-width siblings, or a `flex-1` sibling with no fixed-width sibling to fight over space with).

**Table-to-card reflow — audited, not converted, tracked as a backlog item:** only 4 files in the whole app use a real `<table>` element (`admin/settings`, `admin/trust-safety`, `admin/plans`, `admin/status`) — every admin list elsewhere already uses the div/`DashCard` row pattern, which reflows naturally. All 4 tables are already wrapped in `overflow-x-auto` (confirmed: zero page-level horizontal overflow on any of them at 375px — `document.documentElement.scrollWidth` stayed exactly 375 on every one, including Settings Registry's ~90-row definitions table). This is a working, contained-scroll mobile pattern, not a broken one — genuinely converting the widest of these (Plans' 13-column tier-comparison table) into a stacked-card layout is a real design decision (which columns matter most on a small screen), not a mechanical fix, and wasn't attempted here to avoid guessing at that call. Flagged for the founder's discretion alongside the other tracked-not-fixed items in this doc.

**Storefront buyer funnel — confirmed clean, zero fixes needed:** a full add-to-cart → cart → checkout flow, plus home and search, tested at 375px against a real store/product/variant. Every page rendered correctly on the first pass with no code changes: full-width CTAs, clean stacked forms, zero horizontal overflow, zero console errors. The D-Studio section architecture's mobile behavior (already built with a device-size preview toggle in the Studio shell, per §8.0) carried through correctly to the real rendered storefront.

**Verification method:** real Playwright browser at a 375×812 viewport throughout (not a resize of a desktop screenshot) - `document.documentElement.scrollWidth` checked against the viewport width on every page (`>375` = a real overflow bug) - the mobile drawer nav opened/closed and a nav-and-close-on-click cycle exercised on both shells - the storefront's tenant-hostname resolution exercised for real (a Chromium `--host-resolver-rules` remap to get a real, correctly-formatted Host header, not a header-spoofing hack that Chromium's network stack actually rejects for the `Host` header specifically) rather than testing against `localhost` (which only ever hits the platform's own marketing site, never a tenant storefront).
