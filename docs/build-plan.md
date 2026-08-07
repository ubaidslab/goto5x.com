# goto5x.com — Build Plan

Companion to `docs/SRS.md` (v0.6, approved). This document is the build-phase
reference: the full module sequence, and each module's detailed implementation
plan before code is written. Updated as each module is approved and built.

**Binding process (per founder, SRS §3.7/§14):** one module at a time. After each
module: a verification report mapping every relevant §14 checklist item to
evidence. Founder approves before the next module starts. No scope drift — if
something in the SRS turns out wrong or underspecified mid-build, stop and flag it
here rather than improvising in code.

---

## Full Module Sequence (build order)

**v0.15 renumbering note (read this before citing any module number below):**
the payment-model pivot (SRS v0.15 changelog) removes the former **Payouts &
Disbursement** module entirely from the active v1.0 sequence (its content is
dormant, not deleted — SRS §5.6d) and inserts a new **Trust & Safety System**
module in its place, net module count unchanged (still 20). Concretely:
old Module 11 (Payments & Ledger) is renamed **Commission & Invoicing
Engine** and shrinks to match SRS §5.6c; old Module 12 (Seller Account
Security: 2FA + Devices) becomes Module 13; old Module 13 (Payouts &
Disbursement) is **removed from the active sequence** (dormant, reactivated
only alongside SRS §5.6d); a **new Module 12 (Trust & Safety System)** takes
its numeric slot; old Modules 14–20 are otherwise unchanged in content, only
shifted where their dependency list referenced the old Module 13. Any
verification report or prior build-plan section citing "Module 11/12/13"
from before this amendment is describing the **old** numbering — cross-check
against this table, not memory.

**v0.20 renumbering note:** a new **Module 20 (Supplier Portal Completion &
Plan-Fee Collection)** is inserted ahead of the former Module 20 (Hardening &
Launch Readiness), which becomes **Module 21** — the only shift this causes.
See "Amendment approved after Module 14, ahead of Module 15" below for why.

| # | Module | Depends on | SRS §14 checklist(s) it primarily targets |
|---|---|---|---|
| 1 | **Foundation** (this plan) | — | Partial 14.0, 14.8, 14.12 |
| 2 | Catalog & Media | 1 | Partial 14.2 (FR-2.1 product/variant/inventory CRUD only — the rest of 14.2 ships in later modules, e.g. Module 7's shipping/discount items), 14.9 |
| 3 | Custom Domain & TLS | 1 | 14.11 |
| 4 | Theme Engine & Storefront Rendering v1.0 | 2 | 14.1 |
| 5 | Discovery & Merchandising | 2, 4 | 14.16 |
| 6 | **Listing Moderation Engine** (new, v0.10) | 2, 5 | 14.25, plus a follow-up amendment to Module 4's storefront and Module 5's Discovery queries (moderation-status filter) |
| 7 | Shipping, Tax & Discounts | 2 | Partial 14.2, 14.19 (tax) |
| 8 | Suppliers & Printify Adapter | 2 | 14.3, 14.4 |
| 9 | Orders, Cart & Checkout | 2, 6, 7, 8 | 14.5, 14.15, 14.17 |
| 10 | **Seller Dashboard UI** (new, v0.12; scope extended v0.15) | 2, 4, 7, 9 | 14.26 — the actual rendered screens for product/media (Module 2), shipping/tax/discount (Module 7), and order management (Module 9), plus **dashboard personalization (FR-28.4, new v0.15)** — all governed by the SIMPLICITY INVARIANT (SRS §3.13) |
| 11 | **Commission & Invoicing Engine** (renamed + rescoped v0.15, was "Payments & Ledger") | 9 | 14.6c — Direct Seller Collection payment instructions (FR-6.14), invoice-based commission ledger (FR-6.16), monthly invoicing + manual verification (FR-6.17), grace-period auto-suspension (FR-6.18). **Does not build §14.6's dormant Safepay/hold/reserve/payout content** — that's §5.6d's reactivation scope, not v1.0's |
| 12 | **Trust & Safety System** (new, v0.15 — replaces the former Payouts & Disbursement module in this numeric slot) | 1, 6, 9, 11 | 14.29 — versioned Seller Agreement (FR-29.1/29.2), the rule-based T&S engine extending Module 6 moderation + FR-23.5 signup-velocity + Module 11's cancellation-rate/pending-forever-rate monitors (FR-6.19/29.3), and the enforcement ladder on top of Module 1's existing seller-lifecycle admin controls (FR-29.4) |
| 13 | **Seller Account Security: 2FA + Devices** (new, v0.10; renumbered v0.15 from 12) | 1 | 14.24 — **sequencing rationale changed:** no longer gated by a Payouts module (dormant), stands on its own as general account-security hardening |
| 14 | Plans, Pricing & Business Guard-Rails (scope extended v0.15) | 1, 11 | 14.7, 14.21 — plus **Supplier Premium Plan (FR-7.10, new v0.15)** |
| 15 | Customers, Reviews & Data Portability — **built** | 9 | 14.13, 14.14, 14.18, 14.19 (invoice; FR-19.2's founder sign-off still outstanding) |
| 15.5 | **Storefront Buyer Purchase Flow & Store Branding** (new, v0.22) | 2, 9, 15 | 14.32 — launch-blocking (nothing sells without buyer-facing cart/checkout), built immediately after 15, before the SaaS-bridges module |
| 16 | Seller Onboarding Wizard — **built** | 4, 9, 10 | 14.20, plus 14.0 regional-gating items (FR-25.5, new in v0.7) — depends on 10 now, since the wizard links a new seller into real dashboard screens rather than placeholders |
| 17 | Admin Control Plane completion — **built** | 1, 6, 11, 12, 14 | Remainder of 14.8: general admin-editable content pages (FR-12.1) plus platform brand assets built on the same mechanism (FR-12.3); in-app messaging (FR-8.15); the real-time analytics + unit-economics dashboard UI (FR-8.10, on top of Module 14's data-only `UnitEconomicsService`); seller impersonation/view-any-store with the founder-approved impersonation-transparency additions (FR-8.4 — support-mode banner, `platform_event` on session start, seller-visible support-access history, blocked high-risk writes during impersonation); the Listing Moderation Engine's bare functional queue admin page + REVIEWER negative-access confirmation (FR-27.6, new in v0.11); commission-invoice verification screen (Module 11). **T&S enforcement/risk-view screens were already built in Module 12 — removed from this row, not remaining work here.** |
| 18 | External-SaaS Bridges — **built** | 4, 2 | 14.22, incl. referral attribution + discount eligibility (FR-24.13–24.14, new in v0.7) |
| 19 | Platform's Own Site — premium pass | — (content/visual, blocked on branding assets) | 14.0 (remainder) |
| 20 | **Supplier Portal Completion & Plan-Fee Collection, revised v0.24 into Prepaid Credits Wallet** — **built** | 8, 9, 11, 14 | §14.6e (wallet, publish gate, grace ladder, negative-float floor — floor-enforcement fix v0.25), remainder of 14.3 (supplier dashboard UI), FR-7.10's Supplier Premium Plan gate, 14.7's plan-fee-via-wallet line |
| 21 | Hardening & Launch Readiness (renumbered v0.20 from 20) | all above | 14.12 (remainder), full cross-tenant sweep |
| 22 | **Growth & Partner Programs** (new, v0.26) | 1, 6 (signup-velocity extension), 8/§5.6b (dormant disbursement reactivation), 11 (ledger), 12 (T&S engine extension), 14 (plan-tier eligibility gate), §5.6e/Module 20 (wallet), 17 (content-pages system for Careers, admin queue pattern) | §14.33 — see "Growth & Partner Programs slotting" below for the fuller reasoning and why it sits *after* 21, not before |

**Two modules inserted in v0.10** (see the SRS's own v0.9→v0.10 changelog for
the full reasoning, this is just the sequencing consequence): **Listing
Moderation Engine** slots right after Discovery & Merchandising because it's a
launch-blocking legal-safety requirement, not a Discovery feature — Discovery
itself still ships first, unmodified, with the moderation-status filter added
as a small follow-up when Module 6 lands. **Seller Account Security**
(Module 13 as of v0.15's renumbering, originally Module 12) no longer has a
Payouts dependency to justify its position — see the v0.15 note below.

**One module inserted in v0.12** (see the SRS's own v0.11→v0.12 changelog):
**Seller Dashboard UI** slots immediately after Orders, Cart & Checkout
(Module 9) — the last of the three already-built-API-only modules (2, 7, 9)
whose screens it builds — and before Seller Onboarding Wizard (now Module
16, which gained a dependency on Module 10 for exactly this reason: it links
a new seller into real screens, not placeholders).

**v0.15 payment-model pivot — module sequence consequence (see SRS's own
v0.14→v0.15 changelog for the full business-model reasoning):** the former
Module 13 (Payouts & Disbursement) built nothing in v1.0 — it disbursed money
the platform never held, under Direct Seller Collection — so it is removed
from the active sequence entirely (its full content is preserved, unbuilt,
as SRS §5.6d for a future reactivation). The former Module 12 (Seller Account
Security: 2FA + Devices) shifts to Module 13, since its original reason for
sitting immediately before Payouts (`required_for_payout_actions` MFA
enforcement) no longer applies — it now sits wherever is convenient, kept
adjacent to Module 12 for topical proximity (both are account/trust-adjacent
hardening), not because of a hard dependency. The former Module 11 (Payments
& Ledger) is renamed **Commission & Invoicing Engine** and rescoped to
exactly SRS §5.6c/§14.6c — materially smaller than before (no gateway
integration, no hold/reserve engine, no payout queue). A **new Module 12
(Trust & Safety System)** fills the vacated numeric slot, since it is the
compensating control the pivot specifically requires and depends on Module
11 existing first (its anti-underreporting monitors read Module 11's
invoice/commission data). Module 17 (Admin Control Plane completion)'s
dependency list is updated from "1, 6, 11, 13, 14" to "1, 6, 11, 12, 14"
accordingly.

**Notifications is not its own module** — it is cross-cutting. Each module that
produces a notification-worthy event (order confirmed in Module 9, payout status
in Module 13, review-moderation outcome in Module 15, etc.) adds its own email
trigger inside that module. Calling this out explicitly rather than silently
folding it into "later."

**Known sequencing risk:** Module 19 (and to a lesser extent Module 4's final
visual sign-off) depends on final branding assets, which SRS §13 open question 3
records as not yet delivered. Later modules can proceed on functional
templates/placeholder branding; the *founder sign-off* checklist items in 14.0/14.1
that require the actual premium visual bar cannot close until assets land. This
isn't a blocker for starting the build — it's a known gate later. **Reaffirmed
in v0.10 (SRS FR-1.1):** the bar is concretely apple.com-level minimalism and
horizonx.so-level motion, including video hero banners in themes.

---

## Flags surfaced while planning Module 1 — resolved by founder

1. **Settings Registry cross-scope precedence — RESOLVED.** Pinned in SRS §3.8 as
   `seller > store > plan > category > global` (most-specific-wins; corrected from
   this document's original proposal, which had `plan` ranked above `store`). A
   given key only participates at the scopes in its `allowed_scopes`; irrelevant
   scopes are skipped, never reordered. `SettingsService.resolve()` implements
   this exact order.
2. **Password reset — RESOLVED, approved as a genuine SRS gap.** Added as SRS
   §5.25 (FR-25.1–25.4): emailed single-use time-limited token
   (`auth.password_reset_token_ttl_minutes`, Settings Registry-tunable), rate
   limiting on both request and completion, an audit trail via a new
   `user_security_events` table (deliberately separate from `admin_audit_logs`,
   which is platform-admin-control-plane-scoped, not general account security),
   and full session invalidation on completion. **Built in Module 1**, alongside
   signup/login/verification, since it's the same auth surface.
3. **Feature-flags-as-Settings-Registry — RESOLVED, acknowledged correct.** No
   separate table or mechanism; unchanged from the original plan.

---

## Amendments approved before Module 2 (SRS v0.7)

Documentation-only pass, no Module 1 code touched. Seven items, each slotted into
the module table above rather than creating a new module. **Module numbers in
the table below are as they stood at v0.7** (Onboarding Wizard = 13, Plans = 11,
Admin Control Plane completion = 14, Platform's Own Site = 16, External-SaaS
Bridges = 15) — v0.10 inserted two new modules (Listing Moderation Engine,
Seller Account Security), shifting these to 15, 13, 16, 18, and 17
respectively; v0.12 then inserted a third (Seller Dashboard UI, after Module
9), shifting them again to 16, 14, 17, 19, and 18 respectively in the module
sequence table above. Not renumbered here to keep this a historical record
of what was decided and why, not a second copy of the current sequence table.

| # | Item | SRS FR(s) | Slotted into |
|---|---|---|---|
| 1 | Regional launch gating (PK-only seller signup, allowed-countries Settings Registry entry, waitlist for blocked attempts) | FR-25.5 | Module 13 (Onboarding Wizard) — the signup endpoint itself is Module 1's, already approved/closed, so this ships as a Module 13 addition rather than reopening Module 1 |
| 2 | Admin-granted plans + platform-level subscription promo codes | FR-7.8–7.9 | Module 11 (Plans, Pricing & Guard-Rails) — same module that already owns the plan editor |
| 3 | In-app messaging: banners/popups/notifications, targeted + scheduled | FR-8.15 | Module 14 (Admin Control Plane completion) — extends FR-8.7, already slotted there |
| 4 | Platform brand-asset management (logo/favicon/hero swaps); confirmed no gap in per-plan template-tier gating | FR-12.3 | Module 16 (Platform's Own Site — premium pass) — same branding-asset dependency already noted for that module |
| 5 | Mobile-app-readiness NFR (API as single source of truth) | §6 NFR | No module — a standing architectural discipline from now on, not a deliverable; verified by code review each module, not a checklist item |
| 6 | Region-sharded deployments (per-region DB/stack + global admin aggregation view) | §3.6 architecture note | No module — Phase 4+ roadmap note only, not a v1.0 build item |
| 7 | Referral attribution + cross-SaaS discount eligibility for both SaaS hooks | FR-24.13–24.14 | Module 15 (External-SaaS Bridges) — same module that owns both hooks |

**One inconsistency caught and fixed during this pass:** the Settings Registry
precedence line in this document's own "Foundational architecture decisions"
section (Module 1 plan, below) still read the original *proposed* ordering after
the founder had already corrected it — fixed in place, see that section.

---

## Module 1 — Foundation: Implementation Plan

### Scope (as given)
Project scaffolding, docker-compose stack, Postgres/Prisma initial migrations
(users/auth, stores/tenancy, settings registry, plans, admin audit log),
authentication (signup/login/email verification, JWT + Redis sessions),
tenant-scoping middleware + RLS with mandatory negative tests, Settings Registry
service (cached reads + admin CRUD), feature-flag resolution, immutable audit-log
service, health-check endpoint. Explicitly **not** in Module 1: storefront/theme,
products, orders, payments, suppliers, or polished admin UI (bare functional
endpoints/pages only).

### Repository & package structure

```
goto5x.com/
├── apps/
│   ├── api/                        # NestJS modular monolith
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/
│   │   │   │   ├── middleware/tenant-context.middleware.ts
│   │   │   │   ├── guards/jwt-auth.guard.ts
│   │   │   │   ├── guards/admin-auth.guard.ts       (requires MFA-verified session)
│   │   │   │   ├── decorators/current-user.decorator.ts
│   │   │   │   ├── decorators/current-seller.decorator.ts
│   │   │   │   ├── filters/http-exception.filter.ts
│   │   │   │   └── logging/pii-redaction.interceptor.ts
│   │   │   ├── config/env.validation.ts             (fails fast on missing/malformed env)
│   │   │   ├── prisma/prisma.service.ts             (two clients: runtime role, admin role)
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts               (POST /auth/signup, /login, /verify-email, /refresh, /logout)
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   ├── session.service.ts               (Redis-backed refresh tokens)
│   │   │   │   ├── email-verification.service.ts
│   │   │   │   ├── admin-auth.controller.ts         (separate login route + MFA enrollment/verify)
│   │   │   │   └── dto/*.dto.ts                     (class-validator DTOs)
│   │   │   ├── tenancy/
│   │   │   │   ├── tenancy.module.ts
│   │   │   │   ├── stores.controller.ts             (bare CRUD: create/list-own/get-own/update-own)
│   │   │   │   ├── stores.service.ts
│   │   │   │   └── tenancy.test-utils.ts            (reusable cross-tenant test harness for later modules)
│   │   │   ├── settings-registry/
│   │   │   │   ├── settings.module.ts
│   │   │   │   ├── settings.service.ts              (resolve(), cache invalidation)
│   │   │   │   ├── settings-admin.controller.ts     (bare CRUD for definitions/values, admin-only)
│   │   │   │   └── settings.seed.ts                 (registers Module 1's real settings keys)
│   │   │   ├── admin/
│   │   │   │   ├── admin.module.ts
│   │   │   │   ├── audit-log.service.ts              (insert-only; every mutation above calls this)
│   │   │   │   └── audit-log.controller.ts           (bare read endpoint, admin-only)
│   │   │   ├── notifications/
│   │   │   │   └── email.service.ts                  (minimal: verification email only; full module later)
│   │   │   ├── health/health.controller.ts
│   │   │   └── worker/worker.main.ts                 (BullMQ worker entrypoint; no processors registered yet)
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/                            (see Migration List below)
│   │   ├── scripts/bootstrap-db.sql                    (one-time: creates app_runtime/app_admin roles)
│   │   ├── test/
│   │   │   ├── unit/
│   │   │   └── e2e/                                    (real Postgres + Redis via docker-compose test profile)
│   │   ├── Dockerfile
│   │   └── package.json
│   └── web/                         # Next.js — bare pages only in Module 1
│       ├── app/(auth)/signup/page.tsx
│       ├── app/(auth)/login/page.tsx
│       ├── app/(auth)/verify-email/page.tsx
│       ├── app/(admin)/login/page.tsx
│       ├── app/(admin)/settings/page.tsx              (bare table view/edit, no design polish)
│       ├── Dockerfile
│       └── package.json
├── docker-compose.yml                 (production topology: postgres, redis, minio, api, web, worker, traefik)
├── docker-compose.override.yml        (dev-only overrides: hot reload, exposed ports, local TLS)
├── .env.example
├── pnpm-workspace.yaml
├── README.md
└── docs/                              (existing SRS/schema/architecture/etc.)
```

Package manager: **pnpm workspaces** (no Turborepo yet — one build tool is enough
until build times actually justify a second one).

### Foundational architecture decisions this module locks in
- **Two Postgres roles**, created once by `scripts/bootstrap-db.sql` (not by
  Prisma, which can't safely grant itself privileges): `app_runtime` (RLS-
  restricted, used for every tenant-facing request) and `app_admin` (`BYPASSRLS`,
  used only on request paths already gated by `AdminAuthGuard` — RLS bypass is a
  DB-level capability reserved for a narrow, already-authorized path, not a
  general-purpose escape hatch).
- **Tenant/session context propagation:** `TenancyContextMiddleware` reads the
  verified JWT, extracts `sellerId` (and, from Module 2 onward, `storeId` where
  relevant), and sets it via `SET LOCAL app.current_seller_id = '...'` inside the
  request's Prisma transaction — RLS policies key off this. This is the pattern
  every later tenant-scoped table reuses; Module 1 proves it once, cleanly, on
  `stores`.
- **RLS policies live as raw SQL** inside the Prisma migration folder (Prisma's
  schema DSL can't express `CREATE POLICY`/`GRANT`/`REVOKE`) — checked into the
  same migration history, not a separate undocumented script.
- **Settings Registry precedence:** `seller > store > plan > category > global`
  (most-specific-wins; founder-confirmed, see "Flags surfaced" above — this was
  a stale, already-superseded line left over from before that decision, caught
  and fixed during the v0.7 documentation pass).

### Migration list (Prisma, in order)

| # | Migration | Contents |
|---|---|---|
| 0 | `bootstrap-db.sql` (not a Prisma migration — run once per environment) | Creates `app_runtime` and `app_admin` roles |
| 1 | `users` | `id, email (unique), phone?, password_hash?, role_flags text[], mfa_enabled bool default false, email_verified_at?, email_verification_token_hash?, email_verification_expires_at?, password_reset_token_hash?, password_reset_expires_at?, created_at, updated_at` |
| 2 | `sellers` | `id, user_id (FK users, unique), business_name, kyc_status enum(unverified,pending,verified) default unverified, kyc_verified_at?, created_at, updated_at` |
| 3 | `admin_users` | `id, user_id (FK users, unique), role enum(super_admin,support), mfa_enabled bool` |
| 3a | `user_security_events` | `id, user_id (FK users), event_type, ip_address, created_at` — append-only (FR-25.3) |
| 4 | `stores` (Module-1 shape only — see note below) | `id, seller_id (FK sellers), name, slug (unique), status enum(active,suspended,banned,archived) default active, currency default 'PKR', created_at, updated_at` + `ENABLE ROW LEVEL SECURITY` + policy `USING (seller_id = current_setting('app.current_seller_id')::uuid)` for `app_runtime`; no policy restriction for `app_admin` (BYPASSRLS) |
| 5 | `plans` | `id, name, price, currency default 'PKR', billing_interval enum(monthly,yearly,none), yearly_discount_percent?, is_active default true, sort_order` + seed one `Free` row (price 0, billing_interval `none`) |
| 6 | `settings_definitions` + `settings_values` | Full shape per `docs/database-schema.md`; seeded with the real Module-1 keys: `auth.signup_rate_limit_per_hour`, `auth.password_reset_token_ttl_minutes`, `auth.password_reset_rate_limit_per_hour` (proves the mechanism drives real behavior, not an empty shell) |
| 7 | `admin_audit_logs` | `id, admin_user_id (FK admin_users, nullable), action, target_type, target_id, before_value?, after_value?, created_at` (**no** `impersonation_session_id` column yet — that table doesn't exist until the module that builds impersonation) + `REVOKE UPDATE, DELETE ON admin_audit_logs FROM app_runtime, app_admin; GRANT INSERT, SELECT ...` |

**Note on `stores`:** only the columns Module 1 actually uses are created now
(`access_mode`, `access_password_hash`, `last_active_at`, `dormant_warning_sent_at`
are NOT in this migration — they belong to the Discovery and Guard-Rails modules
that actually consume them). This mirrors the SRS's own explicit precedent
(`orders.manual_payment_link_token` deliberately absent until its feature ships)
— no dead columns, ever.

### Endpoints delivered (bare, functional — no design work)
- `POST /auth/signup` (email, password, business_name → creates `users` + `sellers`
  rows, sends verification email)
- `POST /auth/verify-email` (token → sets `email_verified_at`)
- `POST /auth/login` (returns JWT access token + sets Redis-backed refresh session)
- `POST /auth/refresh`, `POST /auth/logout`
- `POST /auth/password-reset/request` (email → sends reset link if the account
  exists; always returns a generic success response either way, to avoid
  leaking account existence), `POST /auth/password-reset/complete` (token +
  new password → resets, invalidates the token, invalidates all sessions)
- `POST /admin/auth/login` (separate flow) + MFA enrollment/verification endpoints
- `GET /stores`, `POST /stores`, `GET /stores/:id`, `PATCH /stores/:id` — all
  scoped to the authenticated seller via RLS + middleware, not just app-layer
  filtering
- `GET/POST/PATCH /admin/settings-definitions`, `GET/PUT
  /admin/settings-values` — bare CRUD, admin-only, MFA-gated
- `GET /admin/audit-logs` — bare read, admin-only
- `GET /health` — DB, Redis, MinIO connectivity check

### Test list, mapped to §14 checklist items

| Test | §14 item it evidences |
|---|---|
| E2E: signup → verify-email → login → land in an authenticated session | 14.0: "Signup flow works end-to-end: create account → verify email → land in dashboard" |
| Unit: `SettingsService.resolve()` returns correct value at each precedence level, and correctly skips unsupported scopes | 14.8: "A Settings Registry write is visible to a module's very next read..." (partial — cache-invalidation timing test below covers the rest) |
| Integration: writing an out-of-range value (e.g. a percentage-typed setting > 100) is rejected by `settings_definitions.validation` before reaching the DB | 14.8: "An out-of-range value...is rejected by `settings_definitions` validation before reaching the database" |
| Integration: a `settings_values` write invalidates the Redis cache key, and the very next `resolve()` call reflects it (timed) | 14.8: "A Settings Registry write is visible to a module's very next read within one cache-invalidation cycle" |
| Integration: creating/using an admin account without completing MFA enrollment fails | 14.8: "Admin MFA is mandatory..." |
| Integration: `UPDATE`/`DELETE` on `admin_audit_logs` fails at the DB grant level (attempted directly, not just through the app) | 14.8: "Audit log immutability..." / 14.12: same, restated |
| **Cross-tenant negative test (release gate):** Seller A's session cannot read, list, or update Seller B's `stores` row via any endpoint | 14.2 (partial — establishes the pattern later modules extend) / 14.12: "The full automated cross-tenant test suite passes as a release gate" |
| **DB-level negative test:** with the Postgres session variable set to Seller A's id, a direct query against `stores` returns zero rows for Seller B's store, independent of the application layer | 14.12 (same item — this is the "backstop" half of §3.2's two-layer enforcement, tested independently of the app-layer test above) |
| Rate-limit test: N+1 signup attempts from the same IP within the configured window are rejected | 14.12: "Rate limiting verified on auth endpoints..." |
| Log-inspection test: a test user's email/phone does not appear in raw application logs after a signup/login flow | 14.12: "PII redaction verified in application logs" (partial — full coverage grows as more PII-bearing modules ship) |
| CI: dependency-vulnerability scan step exists and fails the build on a deliberately-introduced known-vulnerable package | 14.12: "A dependency-vulnerability scan runs in CI..." |
| Config test: app fails to start with a missing/malformed required env var, rather than starting in a broken state | Not a named §14 item — a foundational safety net worth having from Module 1 |
| E2E: request reset → complete with the emailed token → old sessions invalidated → login with new password succeeds | 14.0: "Password reset works end-to-end..." |
| Unit: a reset token is rejected after its TTL expires, and again after first successful use (single-use) | 14.0: "A reset token is rejected after its configured expiry and after first use" |
| Rate-limit test: repeated reset requests for the same account/IP beyond the configured threshold are rejected | 14.0: "Repeated reset requests...are rate-limited" |
| Integration: a reset request and a reset completion each produce a `user_security_events` row | 14.0: "Every reset request and completion produces a `UserSecurityEvent` row" |
| Security test: `POST /auth/password-reset/request` returns the same response shape/timing for an existing vs. non-existent email (no account-enumeration signal) | Not a named §14 item — a concrete instance of §6.5's general security discipline |

### Explicitly NOT covered by Module 1 (so the checklist gate is honest)
- 14.0's premium-visual-bar and page-load items (no visual design work yet).
- 14.8's plan editor, commission/hold/reserve settings, seller lifecycle
  (suspend/ban/impersonation), template management, maintenance mode, listing
  moderation, external-API client registry, and unit-economics dashboard — none
  of the underlying features exist yet.
- 14.12's rate limiting on listing-submission, payout-request, Product Feed API,
  and Template Install API endpoints — those endpoints don't exist yet.
- Full cross-tenant coverage — Module 1 proves the pattern on `stores` only;
  each later module adds its own tenant-isolation tests for the tables it
  introduces (Rule 4: tests ship with the module that owns the table).

### Docker Compose (production topology, day 1)
Services: `postgres`, `redis`, `minio`, `api` (NestJS), `web` (Next.js), `worker`
(BullMQ entrypoint, zero processors registered in Module 1 — a real, running
skeleton, not a stub that lies about existing), `traefik` (routes `api.localhost`
/ `app.localhost` in dev via labels; real ACME config arrives with Module 3's
custom-domain work). A `docker-compose.override.yml` carries dev-only concerns
(hot reload volumes, exposed ports); the base file is what the VPS runs.

### Secrets (Rule 5)
`.env.example` ships with every required variable named and a placeholder value,
plus a comment on where each one comes from (`DATABASE_URL`, `REDIS_URL`,
`JWT_SECRET`, `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`, `EMAIL_PROVIDER_API_KEY`,
`ADMIN_MFA_ISSUER_NAME`). `README.md` documents how to obtain/generate each one
for local dev, and states plainly that production secrets are never committed —
they're injected at deploy time.

---

## Module 2 — Catalog & Media: built

Scope: FR-2.1 (product/variant CRUD, inventory tracking), FR-9.1/9.2 (Google
Drive OAuth import + direct upload, both landing in self-hosted object
storage). See the Module 2 verification report for the full test/checklist
mapping. Architecture decisions worth carrying into later modules:

- **RLS pattern for non-root tenant tables:** `products`/`product_variants`/
  `media_assets` are keyed by `store_id`, not `seller_id` directly, so their
  RLS policies resolve ownership through a `stores` subquery rather than a
  bare column comparison (see the Module 2 migration). Every later module
  with a tenant table one level below `stores` reuses this exact shape.
- **App-layer store-boundary check, not just RLS:** RLS only proves "not
  another seller's data." A seller who owns two stores could otherwise reach
  store B's products through a URL naming store A - every service method
  additionally checks the resolved row's `storeId` against the URL's
  `storeId` explicitly. This is a distinct, necessary check RLS cannot
  express, and every later module needs it too.
- **`ObjectStorageService`** (thin `@aws-sdk/client-s3` wrapper, S3-compatible
  so MinIO/Cloudflare R2/AWS S3 are a config change) is the one place any
  future module writes a file - reused as-is, not re-implemented, whenever a
  later module needs storage (PDF invoices, CSV import/export files).
- **Adapter pattern extended to Google Drive** (`IDriveClient`): the same
  shape as the Supplier Adapter interface (§3.5), now proven on a second,
  unrelated integration - real implementation behind an interface, fakeable
  in tests.
- **Flagged, not built:** a full `categories` admin CRUD (rename/retire) -
  Module 2 ships only list + create, since no FR requires more yet and no
  later module in this table currently claims ownership of it either. Worth
  a founder decision on which module (if any) picks this up before it's
  needed for real.

---

## Module 3 — Custom Domain & TLS: built

Scope: FR-11.1 (confirmed already satisfied by Module 1's `stores.slug` -
no new code needed for the free-subdomain half) and FR-11.2 (attach an owned
custom domain, DNS-verify it, get TLS issued). See the Module 3 verification
report for the full test/checklist mapping. Architecture decisions worth
carrying into later modules:

- **DNS/TLS adapter pattern**, third instance of the same shape as the
  Supplier Adapter (§3.5) and Module 2's `IDriveClient`: `IDnsResolver` and
  `ITlsProber` wrap real Node `dns`/`https` calls behind an interface. Unlike
  Google's OAuth APIs, this sandbox genuinely has DNS and HTTPS egress to the
  public internet - verified directly before writing either interface - so
  both real implementations are tested against real, stable, well-known
  public hostnames (not a founder-owned domain, which stays a pre-launch
  smoke-test item alongside Docker/MinIO/Google Drive).
- **Traefik owns ACME, the app only writes config files:** `TraefikDynamicConfigService`
  writes one YAML file per verified domain into a directory Traefik's file
  provider watches (`docker-compose.yml`, new in this module). The app never
  implements ACME itself (docs/tech-stack.md already committed to Traefik
  for this). A file-provider router referencing the Docker-provider's `web`
  container needs the explicit cross-provider form `web@docker`, not a bare
  `web` - a real Traefik v3 namespacing rule, not a typo.
- **Worker gets its first real job:** the BullMQ processor skeleton from
  Module 1 ("no processors registered yet") now runs `domain-verification`'s
  scheduled recheck, resolved through `NestFactory.createApplicationContext`
  so the worker process shares the exact same DI-resolved services an HTTP
  request would use. The repeatable job's own scheduling
  (`Queue.upsertJobScheduler`) happens from the API process at boot and is
  idempotent, so it's safe to run on every deploy without accumulating
  duplicate schedules.
- **A second BYPASSRLS use case, documented on `PrismaAdminService` itself:**
  `DomainsService.resolveStoreIdByHostname` (hostname → store, for a future
  module's request routing) inherently precedes any tenant session existing
  to key RLS off - `app_runtime` cannot serve this query at all, so BYPASSRLS
  is correct here, not a shortcut. `PrismaAdminService`'s doc comment now
  states both legitimate uses explicitly.
- **Small schema fix:** `domains.created_at` was missing from every version
  of `docs/database-schema.md` through v0.7 - every other table has it; this
  was an oversight, not a deliberate omission like `stores.access_mode`'s
  documented one. Added directly, noted here rather than treated as a stop-
  and-ask gap (no design ambiguity, unlike Module 2's Drive-token-storage gap).
- **Lean v1.0 scope, stated plainly:** a domain that verifies once is never
  automatically downgraded by a later failed recheck (a seller breaking their
  own DNS after verifying is out of scope), and `tls_status` only ever
  transitions `pending` → `issued` in v1.0 - the `error` status exists in the
  enum for a future module, not produced here.

---

## Module 4 — Theme Engine & Storefront Rendering: built

Scope: FR-1.1–FR-1.6 (theme catalog, bounded-token customizer, live preview,
mobile-responsive, SEO controls, coded-mode escape hatch gated off in v1.0)
and FR-1.5/v0.9's pulled-forward sitemap/robots requirement. See the Module 4
verification report for the full test/checklist mapping. Architecture
decisions and disclosed scope boundaries worth carrying into later modules:

- **Multi-tenant storefront routing via Host header, not path prefix:**
  `apps/web` serves the platform's own site and every tenant storefront from
  one deployment. Next.js middleware rewrites any hostname that isn't the
  platform's own under `/storefront`; the page itself resolves the real store
  through the public `/storefront/*` API. `app/sitemap.ts`/`app/robots.ts`
  read the Host header directly (excluded from the middleware rewrite) since
  they're Next.js special files, not composable route targets.
- **One hostname resolver, reused by both the seller-facing domain feature
  and the public storefront:** `StorefrontService.resolveStoreIdByHostname`
  checks Module 3's `domains` table (verified only - an unverified custom
  domain never resolves, matching what Traefik would actually do in
  production) before falling back to the `<slug>.<platform_root_domain>`
  free subdomain. `canonicalHostname` in the public store response is the
  one source of truth both product-page `<link rel=canonical>` tags and the
  sitemap generator read from - never two independent guesses at the
  "real" URL.
- **`stores.access_mode` pulled forward from Module 5** (documented reason
  on the column itself, `docs/database-schema.md`): only the column and the
  noindex/no-sitemap read-side behavior are in scope here. The coming-soon
  page content and password-gate flow are still Module 5's job (FR-16.5,
  §14.16) - exposing the column now does not imply that feature is built.
- **Scope boundary, disclosed rather than silently substituted:** the SRS
  vision and `docs/mvp-v1-cutlist.md` both describe hand-built, motion-rich
  premium templates (FR-1.1). True premium-bar *visual* design work is
  gated on branding assets not yet delivered (this table's own "Known
  sequencing risk" note above). Module 4 ships one real, fully functional,
  componentized storefront rendering engine with three *structurally*
  distinct built-in themes (different default section order/color scheme -
  `apps/api/src/theme-engine/themes.seed.ts`, `apps/web/lib/theme-presets.ts`)
  rather than three bespoke hand-designed visual templates. The founder
  sign-off checklist item in §14.1 requiring the actual premium visual bar
  cannot close until branding assets land - same gate this table already
  flagged for Module 16, not a new one.
- **No plan-based theme-tier gating enforced yet:** `themes.tier` exists on
  the catalog (free/premium/marketplace) for Modules 11/14 to wire to real
  plan/entitlement state later; §14.1 explicitly requires every v1.0 theme
  be selectable regardless of plan, so v1.0 enforces none of it - same
  "off for every seller in v1.0" precedent as `theme.coded_mode_enabled`.
- **Pre-existing Module 1 bug fixed in passing, not a Module 4 change:**
  `app/(admin)/login` and `app/(admin)/settings` both resolved to bare
  `/login`/`/settings` (a route group doesn't add a path segment) rather
  than the `/admin/login`/`/admin/settings` the platform home page's own
  link already expected - undetected until this module's `next build`
  verification, the first time anyone had run a production web build. Fixed
  by moving both under a real `admin/` path segment; no behavior change to
  Module 1's actual admin auth/settings logic.
- **Testing boundary, stated plainly:** `apps/web` has no unit-test harness
  in this repo (no prior module needed one). The SEO fallback chain and
  hostname/canonical-domain resolution - the parts of "sitemap/robots
  correctness" that can actually go wrong - are unit- and e2e-tested in
  `apps/api` instead, where the real logic lives; `app/sitemap.ts`/
  `app/robots.ts` are thin passthroughs over that already-tested data,
  verified manually (`next build` + a live dev-server smoke test against
  both a platform hostname and a tenant subdomain, including the noindex/
  no-sitemap path) rather than by an automated web-side suite.

---

## Amendment approved before Module 4 (SRS v0.8): Platform Event Log

Documentation + a small backfill into already-built Modules 1–3, not a new
module in the sequence table above — every module from here on emits its own
events as part of its own build (a new §14 checklist line, not a follow-up
pass).

- **`platform_events`** (global, append-only): same insert-only-grant
  immutability as `admin_audit_logs`, added via its own migration + RLS-free
  grants (it's global, not tenant-scoped, though `store_id` is nullable and
  populated where relevant).
- **Lean taxonomy, enforced by review not by schema:** `event_type` is free
  text; the binding gate is SRS §3.11's "would this appear on a growth or
  unit-economics report" test, applied by whoever reviews the module's PR,
  not a fixed enum that would need a migration for every new module's events.
- **Non-blocking emission:** every emission call site is wrapped so a failed
  write is caught and logged, never allowed to fail or roll back the action
  it describes - see `EventsService.emit()`.
- **Backfilled emission points (Modules 1–3):** `seller.signup`,
  `store.created`, `product.created`, `media.imported`, `domain.attached`,
  `domain.verified` — six call sites added to already-approved code, no
  redesign of any of it.
- **Zero dashboard work:** FR-8.10/FR-23.4 are unchanged; this is the
  substrate they'll read from once a later module actually builds that
  dashboard.

## Amendment made mid-Module 4 (SRS v0.9): SEO field placement + sitemap scope

Genuine schema gap found while planning Module 4, flagged before being
improvised, resolved by the founder, applied to `docs/SRS.md` (FR-1.5) and
`docs/database-schema.md` before any Module 4 code was written.

- **`seo_title`/`seo_description`** land as nullable columns directly on
  `stores` and `products` (built in Module 4); `collections` gets the same
  pair when that table is built in Module 5 — no separate SEO table.
- **Fallback chain (binding):** null `seo_title` → entity's own name/title;
  null `seo_description` → entity's own description (truncated), or the
  store-level default if the entity has neither.
- **Sitemap/robots.txt scope pulled forward into Module 4** (previously
  unscheduled): per-store, generated dynamically per request from live data —
  no static file, no cron. Correct per-domain URLs (verified custom domain
  first, free subdomain fallback). A `coming_soon`/`password_protected` store
  serves `noindex` and no sitemap. Module 5 only has to extend the generator
  with collection pages, not redesign it.
- **`stores.access_mode`** (originally slated for a later module per FR-16.5)
  is confirmed already present in the schema as of this amendment — no schema
  change needed to support the noindex requirement above, only the app-layer
  logic that reads it.

---

## Amendments approved before Module 5 (SRS v0.10)

Four items, documentation-only this pass — none built yet, each slotted into
the module sequence table above. Full FR text lives in `docs/SRS.md`'s
v0.9→v0.10 changelog and the new §3.12/§5.25/§5.27/§4 sections. **Module
numbers below are as they stood at v0.10** (Seller Account Security = 11,
Payouts = 12, Seller Onboarding = 15, Platform's Own Site = 18) — v0.12's
Seller Dashboard UI insertion shifted these to 12, 13, 16, and 19
respectively in the current sequence table above; not renumbered here for
the same historical-record reason as the Module 2 amendments section.

1. **Seller Account Security: 2FA + Devices (new Module 11).** TOTP 2FA
   reuses `users.mfa_secret`/`mfa_enabled` and the `otplib` enroll/verify
   flow Module 1 already built for admins — a second controller, not new
   infrastructure. Enforcement mode and the concurrent-device limit are both
   Settings Registry keys; the device limit's `seller` scope override *is*
   the paid extra-device-slot add-on mechanism (no new scope type, no
   billing UI built now). Session/device metadata extends the existing
   Redis session store (§3.2a) — no new Postgres table. Inserted before
   Payouts (Module 12), not alongside Seller Onboarding (Module 15), because
   `required_for_payout_actions` enforcement needs 2FA to already exist.
2. **Financial Truth Invariant (SRS §3.12) — no module of its own, a
   cross-cutting NFR pinned now.** An order/sale exists anywhere
   seller/admin-visible only after payment is verified (signed webhook) or a
   manual order is explicitly marked paid. Pinned before Modules 9 (Orders/
   Cart/Checkout) and 10 (Payments & Ledger) are designed specifically so
   those two modules' schemas are built around it, not retrofitted. Every
   money-adjacent module's checklist (14.5, 14.6, 14.8, 14.21, 14.23) gains a
   line requiring a test that proves an unpaid order is excluded from every
   count.
3. **Listing Moderation Engine (new Module 6).** Zero-cost, rule-based:
   Settings-Registry-backed banned/restricted keyword lists and restricted-
   category rules, new-seller probation, admin-granted trusted-seller
   bypass (`sellers.is_trusted`), a moderation queue, and a narrowly-scoped
   REVIEWER admin sub-role (§4) — moderation-queue-only access, every
   decision logged through the existing `admin_audit_logs` mechanism (no new
   audit table). Products under review are not publicly visible
   (`products.moderation_status`). Inserted right after Discovery &
   Merchandising because it's a launch-blocking legal-safety requirement,
   not a Discovery feature. **Requires a small follow-up amendment** to
   already-built Module 4's public storefront product query and Module 5's
   Discovery search/collection queries, adding the moderation-status filter
   — flagged now, to be applied when Module 6 itself is built, not a silent
   gap in either already-approved module.
4. **Premium UI bar, reaffirmed (SRS FR-1.1):** apple.com-level minimalism,
   horizonx.so-level motion, video hero banners in themes — still gated on
   founder-delivered branding assets, same dependency this document already
   flags above (Module 18, and Module 4's founder visual sign-off).

---

## Module 5 — Discovery & Merchandising: built

Scope: FR-16.1–FR-16.9 (collections, full-text search + filters, header/
footer navigation, announcement bar, coming-soon/password mode, structured
data + sitemap collection pages, WhatsApp button, social links, FAQ
accordion). See the Module 5 verification report for the full test/checklist
mapping. Architecture decisions worth carrying into later modules:

- **`products.search_vector`, deferred since Module 2, finally built:** a
  raw-SQL `GENERATED ALWAYS AS ... STORED` column (`coalesce(description,
  '')` guards against NULL propagating through `||`) - Prisma cannot manage
  a generated column through its normal migration diffing (confirmed the
  hard way: `prisma migrate dev` twice tried to auto-generate a corrective
  migration that failed against a generated column), so this and the
  `stores.access_password_hash` column were both applied via hand-written
  migrations plus `prisma migrate deploy`/`migrate resolve --rolled-back`,
  never `migrate dev`, once a schema contains anything Prisma represents as
  `Unsupported(...)`. Worth remembering for any future generated/unsupported
  column.
- **The coming-soon/password gate is enforced in the API, not just
  apps/web** (SRS mobile-app-readiness NFR, v0.7): `StorefrontService`
  checks `stores.access_mode` on every products/search/collections call and
  returns 403 directly; a signed, store-scoped JWT (reusing
  `JWT_ACCESS_SECRET`, no new secret) is the password-unlock credential,
  minted by `POST /storefront/unlock` and verified by every gated endpoint
  - a future mobile app hits the same guarantee, not a web-only check.
- **`stores.access_password_hash` never leaves `StoresService`:** every
  query that could return a `Store` row explicitly strips the hash before
  the method returns (Prisma's `omit` API turned out to be unavailable in
  this Prisma client's generated types despite the version supposedly
  supporting it - a plain destructure-and-strip helper was used instead,
  with no dependency on that API working).
- **One resolver, reused twice:** the storefront's public categories/search
  endpoints reuse the same hostname-resolution path Module 3/4 already
  built (`resolveStoreIdByHostname`) - no second lookup mechanism.
- **Follow-up amendment delivered as promised:** Module 4's storefront
  product listing and this module's Discovery search/collection endpoints
  do **not** yet filter on a moderation status - the Listing Moderation
  Engine module (inserted after this one, v0.10) is what adds that filter,
  exactly as flagged in the v0.10 amendment note above; not applied here to
  avoid building ahead of a module that doesn't exist in the codebase yet.
- **Testing boundary, same as Module 4:** apps/web still has no automated
  test harness. The new pages (collections, search, the coming-soon/
  password gate, navigation/announcement-bar/WhatsApp/FAQ chrome) were
  verified the same way Module 4's were - a production `next build`, then a
  live dev-server smoke test with `curl -H "Host: ..."` proving the
  storefront home/search/collection pages, the sitemap's new collection
  entries, and the coming-soon gate all render correctly against a real
  store created through the real API.

## Module 6 — Listing Moderation Engine: built

Scope: FR-27.1–FR-27.7 (banned/restricted keyword lists, restricted
categories, new-seller probation, trusted-seller bypass, moderation queue +
visibility gate, REVIEWER admin sub-role, zero-cost/rule-based only). See
the Module 6 verification report for the full test/checklist mapping.
Architecture decisions worth carrying into later modules:

- **`Product` has no explicit Prisma relation to `Store`** (only the scalar
  `storeId` column, unlike `Collection`/`Domain`) - discovered mid-build
  when `ModerationService`'s seller-scoped approved-count query and the
  queue's store-name lookup both failed to compile against a `store`
  relation that doesn't exist. Fixed by resolving the seller's store ids
  first (`store.findMany({ where: { sellerId } })`) and filtering/joining on
  `storeId` directly, rather than adding a new relation field for one
  module's convenience. Worth remembering: any future code that needs
  `Product -> Store` must do the same two-step lookup, not assume a
  relation exists.
- **Pure decision function, gathered inputs:** `decideModerationStatus()`
  (`moderation-decision.util.ts`) takes plain data in and returns a plain
  decision out - no DB or Settings Registry access inside it - so the rule
  logic (trusted bypass, banned-keyword block, probation, restricted
  keyword/category) is unit-tested in isolation, with `ModerationService`
  doing the gathering (Settings reads, seller/store lookups) and the
  BadRequestException translation.
- **One guard, one opt-in decorator, zero changes to existing controllers:**
  the shared `AdminAuthGuard` now denies `adminRole === "reviewer"` by
  default and only allows through a route explicitly marked
  `@AllowReviewer()` (checked via injected `Reflector`). Every pre-existing
  admin controller (audit logs, settings, domains, etc.) stays
  reviewer-blocked with no per-controller edits - only
  `ModerationQueueController` carries the decorator.
- **Non-blocking vs. blocking side-effect writes, same discipline as the
  Platform Event Log:** `recordQueued()` (triggered by a seller's product
  creation) is best-effort/swallow-on-failure, because a bookkeeping write
  must never block a legitimate listing; `approve()`/`reject()` (admin-
  initiated) let audit-log errors propagate normally, matching the
  precedent elsewhere in the codebase for who-triggered-it determining
  blocking behavior.
- **The moderation-status filter now covers every public product surface
  from Modules 4-5, as required:** `StorefrontService.listProducts()`,
  `getProduct()`, `search()` (the raw-SQL `p.moderation_status IN
  ('not_required', 'approved')` condition), and `getCollection()`'s product
  list all exclude `pending`/`rejected` products; `listCategories()`'s facet
  list is filtered too for consistency. The sitemap and product JSON-LD (in
  apps/web) are downstream of `listProducts()`/`getProduct()` respectively.
  and therefore inherit the filter with no separate apps/web change needed
  - proven by the e2e test asserting a pending product is invisible in the
  list, detail (404), search, and collection-detail responses simultaneously.
- **Pre-existing Module 4/5 e2e tests needed a one-line fix, not a
  redesign:** `storefront.e2e-spec.ts` and `storefront-gating.e2e-spec.ts`
  create products and assert they're immediately storefront-visible - true
  before this module, no longer true by default now that a non-trusted
  seller's first `new_seller_probation_count` (default 10) listings queue
  automatically. Both files' shared `signupLoginAndCreateStore()` helper now
  marks the test seller trusted (FR-27.4) immediately after signup, since
  neither file is testing moderation and a trusted seller is a legitimate,
  realistic precondition - not a workaround. `discovery.e2e-spec.ts` and
  `catalog.e2e-spec.ts` needed no change (seller-side CRUD only, never read
  through the storefront's public filter).
- **Testing boundary, same as Modules 4-5:** apps/web has no automated test
  harness; the queue itself is API-only in this module (no dashboard UI),
  so no apps/web change was needed here.

## Amendment approved before Module 7 (SRS v0.11)

One slotting confirmation, no behavior change, nothing built yet this pass.
Full text lives in `docs/SRS.md`'s v0.10→v0.11 changelog and the amended
FR-27.6/§14.8. **Module 16 below is the number as it stood at v0.11** —
v0.12's Seller Dashboard UI insertion shifted Admin Control Plane completion
to Module 17 in the current sequence table above.

1. **Listing Moderation Engine's queue admin page, slotted into Module 16
   (Admin Control Plane completion).** Module 6 built the queue's four API
   endpoints only (list, approve, reject, plus the REVIEWER role/guard) —
   deliberate, since §14.25 is entirely backend-behavioral and never
   required rendering anything to pass. That left no module on the books
   actually building the page a REVIEWER account would use day to day.
   Rather than leave it implicit, it's now an explicit Module 16 deliverable
   (row updated above, depends-on list gains Module 6) and §14.8 gains one
   checklist line: a bare functional page (list the queue, view a product,
   approve/reject with notes) with a REVIEWER account confirmed to see only
   this page — the same negative-access guarantee §14.25 already proved at
   the API layer, now proved at the UI layer too.

## Module 7 — Shipping, Tax & Discounts: built

Scope: FR-2.10 (store shipping settings), FR-2.11 (discount code CRUD),
FR-19.3 (store tax settings). See the Module 7 verification report for the
full test/checklist mapping. Architecture decisions worth carrying into
later modules:

- **Explicit `store Store @relation(...)` field added to all three new
  models**, unlike `Product` (see Module 6's note above on the bug that
  caused). `StoreShippingSettings`/`StoreTaxSettings`/`DiscountCode` all
  follow `Collection`/`Domain`'s pattern instead, specifically to avoid
  repeating that class of compile error in a future module that needs to
  traverse from one of these to `Store`.
- **Auto-created with v1.0 defaults at store-creation time**, same
  discipline as `StoreThemeSettings` (Module 4): `StoresService.create()`
  now also creates a `store_shipping_settings` and `store_tax_settings` row
  in the same transaction. Module 9 (Orders, Cart & Checkout) can therefore
  assume both rows always exist for any store - no "no settings configured
  yet" state to special-case at checkout.
- **Scope boundary, deliberately not built here:** validating a discount
  code at checkout (expiry/usage-limit/store match, FR-5.5) and
  incrementing `usage_count` atomically, and the actual tax computation +
  invoice itemization (FR-19.3) are Modules 9 and 14's job respectively,
  once checkout/invoicing exist. This module ships the seller-configured
  CRUD + tenant isolation only - §14.2's "shipping settings... applied
  correctly at checkout" and "a code created for store A cannot be applied
  to a checkout on store B" checklist lines will be re-verified end-to-end
  once Module 9 exists, not silently skipped now.
- **`code`/`type` are not editable on an existing discount code** (v1.0
  scope call, not in the SRS text) - a seller who wants a different
  code/type deactivates the old one (`isActive: false`) and creates a new
  one. `value`/`expiresAt`/`usageLimit`/`isActive` remain editable.
- **Percentage-value cap (≤100) is a service-layer check, not a DTO
  decorator** - `class-validator`'s `@ValidateIf` would have skipped the
  unconditional `@IsNumber`/`@IsPositive` checks on the same field when the
  type is `fixed_amount`, so the cross-field rule (percentage only) lives in
  `DiscountCodesService` instead, checked on both create and update.
- **Migration workflow, same as Module 5's:** `prisma migrate diff --script`
  again proposed the same bogus `DROP INDEX "idx_products_search"` /
  `ALTER COLUMN "search_vector" DROP DEFAULT` lines against the generated
  column; stripped, hand-written, applied via `migrate deploy` as the
  Postgres superuser (not `app_runtime`/`app_admin` - see README's local
  setup step 6 for why).
- **Testing boundary, same as Module 6:** apps/web has no automated test
  harness and this module shipped no apps/web changes (no seller-dashboard
  UI for shipping/tax/discount settings yet - that's a later dashboard-
  completion pass, not blocking since the API is the deliverable here).

## Amendment approved before Module 8 (SRS v0.12)

One new module inserted, no behavior change to anything already built.
Full text lives in `docs/SRS.md`'s v0.11→v0.12 changelog and the new
§3.13/§5.28/§14.26 sections.

1. **Seller Dashboard UI (new Module 10), plus the SIMPLICITY INVARIANT
   (§3.13, binding NFR).** Reviewing the sequence after Module 7 surfaced
   that Modules 2 (Catalog & Media) and 7 (Shipping, Tax & Discounts) both
   shipped API-only by deliberate precedent, but **no module actually owned
   building the seller-facing screens** for either — §14.2's checklist
   tests backend behavior, not a rendered page, and Seller Onboarding
   Wizard (old Module 15) assumes those screens already exist to link a new
   seller into. Closed with a dedicated module, inserted immediately after
   Module 9 (Orders, Cart & Checkout) so order-management screens are
   included too, and before Seller Onboarding Wizard (renumbered to Module
   16, which now also depends on Module 10). Every module number from 10
   onward in the sequence table above shifted by one to make room - see
   that table's own historical-record notes on the two older amendment
   sections above for the specific old→new mappings.
   The SIMPLICITY INVARIANT is a binding design constraint on this module
   and every seller-facing screen built after it: the dashboard must be
   **more readable and beginner-friendly than Shopify's, never more
   complex** - glanceable screens, progressive disclosure (advanced options
   behind expanders), zero-documentation core tasks, consistent layout
   patterns, and purposeful empty states. §14.26 (new) is this module's
   Acceptance Checklist, including a "beginner walkthrough" review against
   these five rules for each core task (add a product, set shipping,
   create a discount, view orders) - not a subjective design-taste check,
   a testable requirement.

## Module 8 — Suppliers & Printify Adapter: built

Scope: FR-2.6/FR-3.1-3.4 (Supplier Portal - registration, seller/supplier-
initiated links, listing review queue, adapter registry) and FR-4.1/4.3/
4.6/4.9 (Printify Adapter - the only v1.0 implementation of the Supplier
Adapter interface, §3.5). See the Module 8 verification report for the
full test/checklist mapping. Architecture decisions worth carrying into
later modules:

- **A genuine sequencing gap, flagged rather than silently built around:**
  §14.3/§14.4's checklist requires several behaviors that need `order_items`
  to exist - the multi-store dashboard's order aggregation (FR-3.3), the
  fulfillment checklist (FR-3.4), tracking-triggered buyer notification
  (FR-5.2), checkout blocking on an unsupported delivery country (FR-4.7),
  checkout-time price re-validation (FR-4.8), and wiring oversell protection
  (FR-4.5) into a live order. None of this can exist before Module 9
  (Orders, Cart & Checkout) does, yet Module 9 depends on Module 8. Handled
  the same way the Financial Truth Invariant already established for every
  money-adjacent module: build what's real now (the mechanism/data layer),
  defer the checkout-time enforcement, and disclose the split explicitly
  rather than stub it silently. Concretely, this module built and tested:
  the full Supplier Portal (registration/links/review queue), the Printify
  Adapter's real methods, storefront transparency rendering (FR-4.6), the
  adapter registry (FR-4.9), and the oversell-protection *mechanism*
  (`SupplierListingsService.decrementStock()`, an atomic conditional
  UPDATE, unit- and e2e-tested in isolation) - not yet wired into a live
  checkout, which is Module 9's job.
- **`Supplier`/`StoreSupplierLink`/`SupplierListing`/`ListingReview` all
  carry an explicit `store`/`supplier` relation field**, same reasoning as
  Module 7's note above - `Product`'s missing relation (Module 6) is the
  cautionary precedent, not the pattern to repeat.
- **Two different tenancy answers for the same table shape:**
  `store_supplier_links`/`listing_reviews` are RLS-protected the normal way
  (store_id-keyed), which correctly protects the *seller's* isolation
  guarantee. A *supplier's* own multi-store view (FR-3.3) necessarily spans
  multiple sellers' stores at once - no single-seller-keyed RLS policy can
  express that, so `SupplierPortalService` uses `PrismaAdminService`
  (BYPASSRLS) with an explicit `WHERE supplier_id = ...` filter instead -
  now the third documented legitimate BYPASSRLS use case (see that
  service's doc comment). `suppliers`/`supplier_adapters`/
  `supplier_listings` are global tables (no RLS at all), same category as
  `categories`/`themes`.
- **v1.0 simplification, disclosed:** one platform-level Printify API
  credential (`PRINTIFY_API_KEY` env var) plus a single non-secret
  `suppliers.printify_shop_id` field, rather than a full per-supplier
  Printify OAuth connect flow (which would mirror Module 2's Google Drive
  OAuth - a substantial feature of its own). Flagged in
  `docs/database-schema.md`'s note on that column, not silently assumed.
- **Corrected before Module 9 (SRS v0.13, FR-27.8) - originally shipped
  wrong, fixed in the same branch history:** this section first shipped
  with approved supplier listings bypassing Module 6's moderation engine
  entirely (`moderationStatus: "not_required"` set unconditionally),
  reasoning that the seller's own listing-review approval already served a
  launch-blocking-legal-safety purpose. On review, that conflated a
  fulfillment-quality decision ("I want to sell this") with the platform's
  own legal-safety check. `ListingReviewsService.approve()` now calls the
  same `ModerationService.evaluateNewProduct()` self-fulfilled products go
  through, with `applyProbation: false` (probation stays scoped to
  self-fulfilled listings - a supplier listing already passed the seller's
  own review gate, so counting it toward "first N products" would
  double-gate the same decision). Banned keyword blocks the approval
  outright; restricted keyword/category still lets the seller approve but
  queues the product for platform moderation; a trusted seller's approval
  bypasses the engine entirely, same as self-fulfilled. `SupplierListing`
  has no `description`/`categoryId` fields in v1.0's schema, so only the
  title is scanned and the restricted-category rule can never fire for a
  supplier listing yet - a real, disclosed limitation, not a bug.
- **`PrintifyAdapter`/`PrintifyHttpClient` unverified against the real live
  API** - no Printify test account/credentials exist in this environment,
  same disclosure as Module 2's Google Drive client. `PrintifyHttpClient`
  is shaped from Printify's public v1 API documentation; e2e tests seed a
  `supplier_listings` row directly (bypassing sync) and unit tests
  (`printify.adapter.spec.ts`) inject a fake `IPrintifyClient`, mirroring
  the exact pattern Module 2 established for `IDriveClient`.
- **`AuthService.signup()`/`login()`/`refresh()` extended, not duplicated:**
  a supplier is created through the same `/auth/signup` endpoint (a new
  optional `role` field, default `seller`) rather than a second signup
  flow, reusing every existing mechanism (rate limiting, email
  verification, session/JWT issuance) - same "second controller, not new
  infrastructure" discipline as Module 6's 2FA reuse.
- **Sandbox note, not a code issue:** mid-build, an earlier `prisma migrate
  reset` (needed to fold in the `printify_shop_id` column before this
  branch was committed) silently wiped the `app_runtime`/`app_admin` schema
  grants `scripts/bootstrap-db.sql` sets up - manifesting as every e2e test
  file's `beforeAll` hanging/failing with `permission denied for schema
  public`. Fixed by re-running `bootstrap-db.sql` plus the immutability
  `REVOKE`s (`admin_audit_logs`, `user_security_events`, `platform_events`)
  against the local dev DB - exactly the remediation the script's own
  comments already document. Not a lasting change to any migration file;
  worth remembering for any future `migrate reset` in this same sandbox.
- **Testing boundary, same as Modules 6/7:** apps/web has no automated test
  harness and this module shipped no apps/web changes (no seller/supplier-
  dashboard UI yet - Module 10, Seller Dashboard UI, is where that lands,
  per the v0.12 amendment above).

## Amendment approved before Module 9 (SRS v0.13)

One correction, applied directly to the Module 8 code already merged into
this branch history (see that section's "Corrected before Module 9" note
above) rather than left as a future TODO. Full text lives in `docs/SRS.md`'s
v0.12→v0.13 changelog and the new FR-27.8.

1. **Supplier-sourced listings now run through the Listing Moderation
   Engine (Module 6), not just the seller's own listing-review gate.**
   Founder review of Module 8 caught that a seller's approval of a
   supplier's listing had been treated as a substitute for the platform's
   own legal-safety check - it isn't; it's a fulfillment-quality decision.
   Fixed in `ListingReviewsService.approve()` (no schema change, no new
   module): banned keyword blocks the approval outright, restricted
   keyword/category still lets the seller approve but queues the resulting
   product for platform moderation, trusted-seller bypass applies
   identically to self-fulfilled, and new-seller probation is explicitly
   scoped to self-fulfilled listings only (a supplier listing already
   passed one human gate - the seller's own review - so counting it a
   second time toward probation would double-gate the same decision, not
   add a distinct check).

## Module 9 — Orders, Cart & Checkout: built

Scope: FR-5.1-5.6 (Order & Fulfillment Management), FR-15.1/15.2 (Cart
Persistence & Abandoned Carts), FR-17.1-17.5 (Manual/Draft Orders & Order
Management Enhancements) - §14.5/§14.15/§14.17. Per this module's own
dependency table, **§14.6 (Payments, Commission, Ledger & Payout Engine)
was never in scope** - `ledger_entries` doesn't exist until Module 10/11.
Architecture decisions worth carrying into later modules:

- **`placeOrder()` is the one place an Order/OrderItem row is ever
  created** - both `CheckoutService.checkout()` (storefront, buyer-facing)
  and `CheckoutService.createManualOrder()` (FR-17.1, seller dashboard) call
  the same private method, so a manual order and a storefront order can
  never independently drift into different shapes. `computeOrderTotals()`
  (`order-totals.util.ts`) is a second shared, pure function - used by both
  order creation and `OrdersService.editOrder()` (FR-17.5) for the same
  reason, and is exhaustively unit-tested in isolation (mirrors Module 6's
  `decideModerationStatus()` precedent).
- **Financial Truth Invariant, concretely enforced:** every order this
  module creates starts `status: 'pending'`; `OrdersService.markAsPaid()`
  is the *only* code path that ever writes `status: 'confirmed'`, and
  correspondingly the only place `order.placed` (SRS §3.11) is ever
  emitted - `CheckoutService.placeOrder()` emits no platform event at all.
  Proven directly in the e2e suite: an order stays absent from
  `platform_events` until marked paid.
- **FR-4.5/4.7/4.8 wired into a live checkout**, completing what Module 8
  built and tested only in isolation: `OrderPricingService` always resolves
  a supplier item's *current* `supplier_listings.price`/`shippingCost`/
  `supportedCountries` (no caching layer to go stale, so FR-4.8 is
  satisfied by construction, not a special re-check step); the country
  check is a hard `BadRequestException` before any stock is touched; stock
  reservation (`SupplierListingsService.decrementStock()`) is attempted
  item-by-item and any failure - or any later failure, including an
  invalid discount code - unwinds every reservation this same request
  already made (`incrementStock()`, new this module) before the checkout
  fails, so a rejected order can never leave phantom stock missing.
- **FR-2.7/FR-3.2 completeness fix, found while wiring checkout against a
  real approved supplier listing:** `ListingReviewsService.approve()` (Module
  8) was creating the `products` row but never a `product_variants` row -
  every cart/order line references a `variantId`, so an approved
  supplier-sourced product was silently unpurchasable end-to-end, and
  nothing in Module 8's own test suite exercised an actual purchase to
  catch it. Fixed by creating exactly one variant per approved listing
  (v1.0 supplier listings have no options); its stored `price`/
  `stockQuantity` are cosmetic display values only - checkout always reads
  the live `supplier_listings` row for a supplier item, never this
  variant's.
- **FR-3.3/FR-3.4 completed, not newly designed:** `SupplierOrdersService`
  (new, `suppliers/` module) gives a supplier their own multi-store order
  view and a tracking-upload endpoint, deliberately a separate BYPASSRLS
  code path from `OrdersService`'s seller-scoped equivalent (same
  isolation-model split StorefrontService already established for public
  reads vs seller CRUD) rather than a shared import - avoids a
  cross-module circular dependency between `OrdersModule` and
  `SuppliersModule` for no real benefit.
- **FR-5.3 fixed at its actual root, `StorefrontService.loadActiveStoreOrThrow()`:**
  previously collapsed every non-active store status into the same generic
  404. A `suspended` store now resolves to `403 { code: 'store_suspended' }`
  - distinct from a truly missing/banned/archived store (still 404) - so
  the storefront can render "temporarily unavailable" instead of a broken
  page. New carts/checkouts are blocked for a suspended store; the seller
  dashboard's `OrdersService` never checks `store.status` at all, so
  existing orders stay fully fulfillable, per the FR's own text. One
  pre-existing Module 4/5 e2e assertion (`storefront.e2e-spec.ts`) asserted
  the old, less-correct 404-for-everything behavior - updated to assert the
  new distinct code, plus a new assertion that banned/archived stores keep
  the plain 404.
- **FR-17.5 ("Basic order editing") bounded scope, disclosed:** only
  existing line-item quantities and the shipping address are editable, and
  only while `pending`/`confirmed` - matches the FR text's own "Basic"
  framing, same bounding precedent as FR-17.1's mark-as-paid-only scope.
  Quantity changes adjust `product_variants.stock_quantity` in both
  directions and the order's totals are correctly recomputed through the
  same `computeOrderTotals()` checkout itself uses. **The FR's
  "compensating ledger entry" clause is not implemented** - `ledger_entries`
  doesn't exist until Module 10/11; that module closes this the same way
  Module 9 closed Module 8's FR-4.5/4.7/4.8 deferral.
- **`order.placed`'s forwarding side-effect:** `OrdersService.markAsPaid()`
  also forwards each supplier-fulfilled line to `PrintifyAdapter.forwardOrder()`
  (FR-3.4) - directly injected, same "no registry indirection until a
  second adapter exists" reasoning as `SupplierSyncService`. Per-item
  failures are caught and logged, never thrown - a supplier network
  hiccup must never undo a payment confirmation that already succeeded
  (proven in the e2e suite: a real 403 from Printify's live API, since no
  test credential exists in this sandbox, is swallowed and mark-as-paid
  still returns 201). `pullTrackingUpdate()` remains built-and-tested in
  isolation (Module 8) but unwired - v1.0's documented tracking UX is a
  supplier's manual upload (§5.3 FR-3.4's own text: "supplier uploads
  tracking ID"), not adapter-side polling, so there is no live caller for
  it yet.
- **Cart abandonment (FR-15.2)** mirrors the exact `SupplierSyncScheduler`/
  `Worker` BullMQ pattern (`CartAbandonmentScheduler` + a third worker
  registered in `worker.main.ts`) - ships the flagging mechanism and
  `carts.status = 'abandoned'` only; recovery emails are v1.1 (§5.22,
  FR-22.2), per the FR's own text.
- **Testing boundary, same as Modules 6/7/8:** apps/web has no automated
  test harness and this module shipped no apps/web changes - Module 10
  (Seller Dashboard UI) is where order/cart screens land, per the v0.12
  amendment.

## Amendment approved before Module 10 (SRS v0.15) — major business-model pivot

A founder-directed pivot, deliberately timed before Payments/Ledger (old
Module 11) was built - the founder's own words: "good timing since payments
aren't built yet." Full text lives in `docs/SRS.md`'s v0.14→v0.15 changelog
and the new §5.6c/§5.29/FR-7.10/FR-28.4. Summary for this document's own
purposes:

1. **Payment model: Direct Seller Collection replaces platform-collected
   payments for v1.0.** Buyers pay sellers directly (seller-configured bank
   transfer/JazzCash/Easypaisa instructions, plus unconditionally-permitted
   COD); Module 9's already-built `OrdersService.markAsPaid()` is unchanged
   and is now the universal payment-confirmation path. Commission becomes
   invoice-based (default 1%, down from 3%): accrued per confirmed sale,
   billed monthly, manually verified by an admin in v1.0, with automated
   store suspension (reusing Module 9's existing FR-5.3 mechanism) for
   non-payment past a grace period.
2. **Safepay/hold/reserve/payout-disbursement (old Module 11's gateway half
   + old Module 13 entirely) become dormant, not deleted** — SRS §5.6d,
   the exact specification for a future reactivation (international
   expansion, a regulatory requirement, or scale). See the "v0.15
   renumbering note" at the top of this document's module-sequence table
   for the concrete module-number consequences.
3. **New Trust & Safety System (Module 12, new numeric slot)** compensates
   for the accountability a payment gateway used to provide for free: a
   versioned Seller Agreement (timestamp+IP acceptance), a rule-based T&S
   engine extending Module 6's moderation history + FR-23.5's signup-
   velocity limiting + new cancellation-rate/pending-forever-rate monitors,
   and an enforcement ladder built entirely on Module 1's existing seller-
   lifecycle admin controls (FR-8.4) — no parallel permissions system.
4. **Supplier Premium Plan (FR-7.10)** — folds into the existing Plans
   module (14): a new `supplier` plan type, the multi-store aggregated
   dashboard (FR-3.3, already built in Module 8/9) becomes the paid tier's
   flagship feature. **Confirmed, no gap:** a seller's own multi-supplier
   management was already fully covered by FR-2.6/FR-2.7 and Module 8/9's
   store-scoped design before this amendment — only the supplier's own
   cross-store view needed a new FR.
5. **Dashboard personalization (FR-28.4)** folds into Module 10 (Seller
   Dashboard UI, not yet built) — plan-gated themes/wallpapers, reusing the
   Settings-Registry plan-gating mechanism FR-7.1 already established.
6. **`docs/legal/*.md` updated** (terms-of-service.md, refund-policy.md,
   privacy-policy.md) to reflect the facilitation-workspace/seller-
   responsibility/indemnification framing and the versioned-agreement
   mechanism — still flagged for human counsel review, same discipline as
   every prior legal draft.

No code was written for this amendment - it is a pure design/SRS revision
ahead of Module 10, per the founder's explicit "wait for my approval before
starting the revised Module 10" instruction.

## Amendment approved during Module 10's rollout (SRS v0.16) — Seller Identity & Commission-Fraud Defense

Slotted into **Module 12 (Trust & Safety System)**, extending it rather than
adding a new numbered module — full spec in `docs/SRS.md` §5.30/FR-30.1–30.6,
checklist in §14.30. Module 12 has not started (Module 10 is in progress);
this is documentation only, staged for when Module 12's turn comes:

1. **CNIC at seller activation** (FR-30.1) — required, format/checksum
   validated, encrypted at rest (`sellers.cnic_encrypted`), unique via a
   deterministic hash (`sellers.cnic_hash`) spanning every seller regardless
   of lifecycle state so a banned seller's CNIC can never re-register.
2. **Name-consistency rule** (FR-30.2) — a self-declared account title +
   explicit ownership checkbox on every payment instrument
   (`store_payment_instructions`, itself still an **outstanding
   implementation gap from Module 9's v0.15 pivot** — see the flag below),
   with a string-similarity mismatch routed to the existing admin
   review-queue pattern, never a hard block.
3. **Payment-account uniqueness** (FR-30.3) — hashed-fingerprint unique
   constraint per instrument type, hard block on reuse.
4. **Title-verification adapter** (FR-30.4) — a `TitleVerificationAdapter`
   interface, one v1.0 implementation (`ManualReviewAdapter`); Raast/1Link
   documented as the first paid T&S upgrade, same adapter-swap discipline
   as the Payment Gateway and Supplier adapters.
5. **Risk score** (FR-30.5) — rule-based, Settings-Registry-weighted,
   three outcomes only (auto-approve/manual review/block); reuses
   `user_security_events` (new `device_fingerprint` column, new `signup`
   event type) rather than a new table.
6. **Re-registration check** (FR-30.6) — ties into the existing FR-6.18
   invoice-suspension mechanism.

**Flagging a pre-existing gap surfaced while writing this amendment:**
`store_payment_instructions` (Direct Seller Collection's payment-instruction
table, SRS §5.6c, v0.15) is fully specified in `docs/database-schema.md` but
was **never actually implemented** — no Prisma model, no migration, no
controller — despite Module 9 (Orders, Cart & Checkout) having already been
built and approved on top of the v0.15 pivot. This amendment's name-
consistency fields (FR-30.2) extend that same not-yet-built table. This is
not new scope creep from this amendment; it is a gap in already-approved
scope, surfaced here because Module 12 now depends on it. It needs to be
built — likely as a small Module 9 follow-up or pulled into Module 12
directly — before FR-30.2/30.3 can be implemented.

No code was written for this amendment.

## Prerequisite fix approved alongside Module 11 (SRS v0.15's `store_payment_instructions` gap)

The founder confirmed the gap flagged above and directed it be fixed at the
start of Module 11, before the invoicing engine itself, since Module 11's
own checkout/order-confirmation flow depends on it. Scope is deliberately
the **original v0.15 fields only** (`bank_account_title`, `bank_account_number`,
`bank_name`, `jazzcash_number`, `easypaisa_number`, `cod_enabled`) — the
v0.16 Trust & Safety additions (account-title fields per instrument, name-
consistency status, fingerprint uniqueness columns) are Module 12's own
`ALTER TABLE` when it lands, not built here, per FR-30.2/30.3's "checks run
when Module 12 lands" framing. Covers: the Prisma model + migration + RLS,
the seller-dashboard settings screen (Module 10's design system), the
storefront checkout/order-confirmation surfacing, the buyer order-status
page's payment-instructions display, and the confirmation email content —
plus the FR-6.14 store-readiness gate (a store cannot go live without at
least one payment method or COD enabled).

## Amendment approved alongside Module 11 (SRS v0.17) — Teams & Community Sponsorship

Full spec in `docs/SRS.md` §5.31/FR-7.11–7.16, schema in
`docs/database-schema.md` (`teams`, `team_members`, `subscriptions.sponsored_by_team_id`).
Slotted into **Module 14 (Subscription Plans, Pricing & Billing)** — Module
14 has not started; this is documentation only, staged for that module's
turn. Reuses the existing plan mechanism (FR-7.1–7.10) and Module 11's
invoice machinery verbatim: a leader's group sponsorship invoice and their
own commission invoice are two separate documents using the identical
manual-verification/grace-period mechanism, and non-payment of either never
crosses the team boundary (a member's own store, a teammate's store, and
the leader's own store are each suspended only by their own non-payment).
The leader's team dashboard is read-only analytics only, gated by a
binding pre-acceptance consent screen (FR-7.12) — no store access, no
editing, no customer PII, enforced the same way a supplier's session is
already scoped to only its own linked stores. No code was written for this
amendment.

## Amendments approved alongside Module 12 kickoff (SRS v0.18) — Domain Upsell Referral + Template Package Spec

1. **Domain Upsell Referral** (`docs/SRS.md` §5.11 FR-11.3, §14.11) — a
   "get a domain" affiliate link block on the custom-domain dashboard
   screen; URL, partner name, and enabled flag are Settings Registry
   entries. **Built now** (not deferred) — small addition to already-shipped
   Module 3, gated by its own §14.11 checklist line.
   - **Gap surfaced and fixed alongside it:** Module 3 (Custom Domain & TLS)
     shipped its backend only (`DomainsController`/`DomainsService`) —
     `apps/web` never got a seller-facing Domains screen, so Module 10's
     later dashboard rollout never covered it either. Built the minimal
     screen to FR-11.2's already-approved shape (attach/list/verify/remove)
     to host the new referral block — not new scope, closing a build gap,
     same "surface it, fix it inline" precedent as the
     `store_payment_instructions` gap fixed alongside Module 11.
2. **Template Package Spec** (`docs/architecture.md`, Template Store Hook
   section; pointer in `docs/SRS.md` §5.24a) — architecture decision, pinned
   now: every template is a self-contained frontend package (markup/styles/
   scripts, preview assets, a manifest declaring name/version/settings-
   schema), validated at install against the Template Install/License API
   (FR-24.3), with a structural isolation rule (one template's code can
   never affect another template or the dashboard). Governs Module 15's
   Template Store hook and every future template; the three built-in v1.0
   themes are unaffected and not rebuilt. **Documentation only, no code.**

Then proceeds to **Module 12 (Trust & Safety System)** — full scope in
`docs/SRS.md` §5.29/§5.30, checklists §14.29/§14.30. Module 12 now also owns
FR-6.19 (anti-underreporting monitors, deferred from Module 11) and every
FR-30.x item (CNIC/name-consistency/risk score, deferred from the v0.16
amendment) — all threads converge here.

## Module 12 (Trust & Safety System) — built

Full scope: `docs/SRS.md` §5.29/§5.30, checklists §14.29/§14.30 (both now
checked, with disclosed simplifications inline). Covers: versioned Seller
Agreement acceptance (FR-29.1/29.2), CNIC at seller activation (FR-30.1),
payment-instrument name-consistency + account-number uniqueness (FR-30.2/
30.3), the `TitleVerificationAdapter` seam (FR-30.4), the rule-based risk
score (FR-30.5) and re-registration check (FR-30.6), the T&S engine and
anti-underreporting monitors (FR-29.3/FR-6.19), and the enforcement ladder
(FR-29.4).

**Two dependency gaps surfaced and fixed as prerequisites, same "surface it,
fix it inline" precedent as `store_payment_instructions` (Module 11):**
1. **FR-8.4 (seller lifecycle control)** was specified in the SRS's Admin
   Control Plane section but never built by any prior module, despite this
   build-plan's own module-sequence table describing Module 12 as built "on
   top of Module 1's existing seller-lifecycle admin controls." Built here,
   scoped narrowly to what the T&S ladder actually needs: activation
   approval and lifecycle-status changes (`SellerLifecycleService`,
   `AdminSellerLifecycleController`). **Deliberately not built:** "view any
   store" read-only access, "login as seller" impersonation, instant
   single-store force-disable — none are T&S-ladder prerequisites; left for
   the Admin Control Plane completion module (Module 17).
2. **FR-12.1 (versioned content pages)**, which FR-29.1 says to reuse, has
   also never been built (no `ContentPage`/`LegalContent` model exists, and
   no module slots it). Rather than building that full general-purpose
   system now — real scope expansion beyond Module 12's boundary — a
   minimal, purpose-scoped `SellerAgreementVersion` table was built instead,
   satisfying exactly FR-29.1's versioned-acceptance requirement for the
   Seller Agreement specifically. **The general content-pages system
   (ToS/Privacy/Refund/About/Contact, brand assets FR-12.3) remains
   unbuilt** and should be slotted into a future module.

**A third gap surfaced while building the bypass-attempt monitor:** a
banned-keyword block (`ModerationService.evaluateNewProduct`) previously
wrote nothing persistent at all — the product was never created and no
audit/event record existed either. Fixed with one new `platform_events` emit
call (`product.moderation.blocked`) using the existing `EventsService`
mechanism — zero new infrastructure, per FR-29.3's own discipline.

Migration: `20260718010000_trust_safety_system` (Seller CNIC/activation/
lifecycle/agreement columns, `store_payment_instructions`'s v0.16 columns,
`user_security_events.device_fingerprint`, the new `seller_agreement_versions`
table). Tests: 2 new unit spec files (cnic/string-similarity utils) + a
20-test e2e suite (`trust-safety.e2e-spec.ts`) covering every §14.29/§14.30
item, plus fixture updates across the existing suite (every seller signup
now sends `agreementAccepted: true`; every checkout-touching test's shared
helper sets a synthetic CNIC hash). Full suite: 21 e2e files / 178 tests,
18 unit files / 100 tests, all green.

## Amendment approved after Module 12, ahead of Module 14 (SRS v0.19) — Plan Architecture

Full spec: `docs/SRS.md` §5.7 FR-7.17/FR-7.18 (new), FR-7.15 revised (§5.31),
schema in `docs/database-schema.md`'s `plans` table note. **Documentation
only, no code** — Module 14 has not started; this pins the architecture for
that module's own build, per the founder's explicit request to confirm/amend
Module 11's group-invoice math before Module 14 begins.

1. **Plan groups and tiers (FR-7.17)** — a Cursor-style structure: named
   plan groups (Individual, Team, Supplier), each an ordered list of
   founder-editable tiers. Every plan-gating mechanism (feature flags,
   inverse commission laddering, developer perks, dashboard-personalization
   gating) now resolves against a `(plan_group, tier_order)` pair instead of
   a flat plan id — no behavior change to those FRs, only the addressing
   scheme. The pricing page and in-dashboard upgrade prompts render
   entirely from this data.
2. **Team per-seat pricing (FR-7.18, revises FR-7.15)** — a Team tier
   carries a `seat_price`; a leader's group invoice is
   `N sponsored members × seat_price`, uniform across every seat on that
   team — **not** "that member's own individually-chosen plan price" as
   the v0.17 Teams amendment originally specified. While sponsored, a
   member's individual plan becomes whatever their team tier grants;
   FR-7.13's downgrade-to-Free-on-leave rule is unchanged.
3. **Cross-checks flagged for Module 14's own report** (not resolved here):
   confirm developer perks (FR-7.16) and dashboard-personalization gating
   (FR-28.4, an open item since Module 10 — no real seller→plan assignment
   has existed until now) bind correctly to the new tier structure; confirm
   the next-cycle upgrade/downgrade rule (FR-7.5) and launch-campaign
   pricing (FR-7.7) apply correctly per-tier.

`plans.plan_type` (v0.15) is superseded by `plan_group` (a rename, `seller`
→ `individual`, `team` added) — a one-time backfill migration when Module 14
builds this, not a parallel column.

## Module 13 (Seller Account Security: 2FA + Devices) — built

Full scope: `docs/SRS.md` §5.25, checklist §14.24 (now checked, with
disclosed simplifications inline). **Scoping finding from research:**
FR-25.1-25.4 (password reset) were already built in Module 1 and untouched
here; FR-25.5 (regional launch gating) belongs to Module 16 (Seller
Onboarding Wizard) and is untouched here. Module 13's actual new scope is
just FR-25.6 (seller TOTP 2FA) and FR-25.7 (session/device management).

1. **FR-25.6 (TOTP 2FA)** reuses `User.mfaSecret`/`User.mfaEnabled` —
   confirmed unused anywhere else in the codebase before this module (only
   `AdminUser.mfaEnabled` was in use), matching the FR's "shared, not
   duplicated" instruction. New `auth.seller_mfa_enforcement` Settings
   Registry key (`optional` | `required_for_payout_actions` |
   `required_always`, global/plan scope only per the FR's literal text,
   default `optional`). Login (`AuthService.login()`) now returns either
   full tokens directly (common case) or a `{preAuthToken, mfaEnrolled}`
   step, mirroring `AdminAuthService`'s existing pattern exactly.
2. **Voluntary opt-in gap found and fixed before it reached a test:** the
   login-time pre-auth flow only ever triggers when 2FA is already required
   — under the default `optional` mode, an unenrolled seller's login never
   returns a `preAuthToken`, so there was no way to voluntarily turn 2FA on,
   contradicting FR-25.6's "seller's own choice" language. Fixed with a
   second, fully separate authenticated enroll/verify path
   (`POST /sellers/me/mfa/enroll`, `POST /sellers/me/mfa/verify`, using the
   seller's own valid JWT) alongside the login-time pre-auth path
   (`POST /auth/mfa/enroll`, `POST /auth/mfa/verify`).
3. **FR-25.7 (session/device management)** stays 100% Redis-only — no new
   Prisma model or migration. `SessionService` now tracks device label
   (parsed from the User-Agent by a small new regex util,
   `device-label.util.ts` — no new dependency), IP, first-seen, and
   last-active (touched on refresh-token use, not on every request, to
   avoid a write per API call platform-wide). Device identity carries
   forward across refresh-token rotation (same session continuing, not a
   new device). New `auth.max_concurrent_devices` key (global/plan/seller
   scope, default 3 — the seller-scope override represents a purchased
   extra-device-slot add-on) is checked before a new session is created;
   over the limit, the login is rejected with a clear reason and no
   existing session is evicted. New `auth.extra_device_slot_price`
   (global only) is a stored mechanism only — no billing flow reads it yet.
4. **Disclosed limitation:** `required_for_payout_actions` has no real
   gate-point in v1.0 — Direct Seller Collection has no payout-request or
   payout-account-change endpoint (payouts are dormant), so this
   enforcement value is accepted/stored but doesn't currently gate
   anything.

No migration — Module 13 reused existing `User` columns and Redis-only
session storage entirely. New seller-dashboard "Security" card (2FA
enroll/verify UI, session list with device/IP/last-active and per-session
revoke). Tests: new `account-security.e2e-spec.ts`, 8 tests covering every
§14.24 item. Full suite: 22 e2e files / 186 tests, 18 unit files / 100
tests, all green, zero regressions.

## Module 14 (Plans, Pricing & Guard-Rails) — built

Full scope: `docs/SRS.md` §5.7 (FR-7.1-7.10, FR-7.17-7.18), §5.23
(FR-23.1-23.5, Business Guard-Rails), §5.31 (FR-7.11-7.16, Teams &
Community Sponsorship — slotted in here per its own section header),
checklists §14.7/§14.21/§14.31 (all now checked, disclosed simplifications
inline). Larger than any prior module — three FR blocks converge here.

**Foundational piece: a real seller→plan assignment finally exists.**
`settings.types.ts`'s `SettingsContext.planId` existed since Module 1 with
nothing ever populating it — every plan-scoped Settings Registry key
silently fell through to its global default for every seller until now.
New `Subscription` model (`SubscriptionsService`) assigns every seller the
Free plan at signup and is the one place every other module's plan-gated
check now resolves against.

1. **Plan groups/tiers as data (FR-7.17).** `plans` gains `plan_group`
   (individual/team/supplier)/`tier_order`/`seat_price`, superseding the
   never-shipped v0.15 `plan_type` column. Admin CRUD (`PlansService`,
   scoped to what this module needs — the rest of FR-8.2's terminal is
   Module 17's), a public `/plans` endpoint, and both the pricing page and
   the seller-dashboard "Plans & Billing" screen render entirely from it.
2. **Founder-flagged cross-checks, all four closed:**
   - Developer perks (FR-7.16) and dashboard-personalization (FR-28.4, an
     open item carried since Module 10) now resolve against the seller's
     real plan — previously always fell through to the global default.
   - Next-cycle upgrade/downgrade (FR-7.5) and launch-campaign pricing
     (FR-7.7) both apply correctly per-tier (`SubscriptionsService`/
     `LedgerService`).
   - Group-invoice math (FR-7.15/7.18) — see Teams below.
3. **Teams & Community Sponsorship (FR-7.11-7.16).** New `Team`/
   `TeamMember` models. A leader's eligibility to create a team is gated
   by their own individual-plan tier (`teams.leader_eligible`, bundled
   alongside developer perks on qualifying tiers per FR-7.16) — separate
   from which of the 3 Team tiers the team itself bills at (`teams.plan_id`,
   a small schema gap found and fixed while building this: the original
   v0.17 design never gave `teams` its own plan reference). Invite mirrors
   `StoreSupplierLink`'s pattern; binding consent (FR-7.12) is enforced at
   the API layer via the partial unique index
   `idx_team_members_one_active_sponsorship`, whose violation is caught
   and returned as a clean 409. Leaving (FR-7.13) is always available and
   never a penalty — a sponsored member's subscription has no
   `current_period_end` (billing flows through the group invoice only), so
   the graceful downgrade applies at the same "no cycle to wait for"
   moment FR-7.5's own edge case establishes.
   - **Gap surfaced and fixed as a prerequisite** (same "surface it, fix
     it inline" precedent as `store_payment_instructions`, Module 11):
     FR-7.14's leader team-dashboard text assumes "the same sales/order-
     count/growth-trend summary Module 10's own dashboard-home screen
     already computes" — no such computation ever existed. Built once,
     inside `TeamsService`, reused identically for every member.
4. **Group invoicing (FR-7.15/7.18).** `seller_invoices` gains an
   `invoice_type` discriminator (`commission`/`plan_subscription`/
   `group_sponsorship`) so a team's monthly group invoice
   (`InvoicesService.generateMonthlyGroupInvoices`) reuses the identical
   table and manual-verification mechanism as commission invoicing — total
   = active sponsored member count × the leader's Team tier seat price.
   Overdue handling is branched: a group invoice never suspends any store;
   it gracefully downgrades sponsored members instead, exactly like a
   voluntary leave. `plan_subscription` is schema-only in v1.0, same
   "dormant, not deleted" precedent as the Payouts fields — no live
   seller-side plan-fee billing flow exists yet to generate one against.
5. **Business Guard-Rails (FR-23.1-23.5).** Product-count limit (FR-23.1)
   enforced at creation; storage-quota metering added
   (`media_assets.size_bytes`). Dormant-store lifecycle job (FR-23.2)
   progresses warn→suspend→archive, each stage measured from the
   *previous* stage's own trigger (`dormant_warning_sent_at` anchors
   suspend; `updated_at`, bumped automatically the moment the job
   suspends a store, anchors archive — no third timestamp column needed
   beyond the two already reserved on `stores`). Per-identity Free-store
   limit (FR-23.5) via `FreeStoreLimitService`, checked before
   `StoresService.create()`'s tenant transaction opens (cross-tenant by
   design, same pattern as Module 12's `cnic_hash` uniqueness check).
   Unit-economics (FR-23.4) built as **data only** — `UnitEconomicsService`/
   `GET /admin/unit-economics` — no dashboard UI, since FR-8.10 (the
   real-time analytics dashboard this extends) isn't built until Module 17.
6. **Promo codes (FR-7.9) and admin-granted plans (FR-7.8)** — both fully
   real. Promo-code redemption mechanics (limits/expiry/targeting/one-per-
   seller) are tested and correct; applying the discount to an actual
   invoice amount is deferred alongside the `plan_subscription` invoicing
   gap above, for the same reason.
7. **Supplier Premium Plan (FR-7.10) — data only, disclosed.** Free/Premium
   Supplier tiers exist as plan rows, satisfying FR-7.17's "three groups"
   requirement. The feature this would gate (the supplier's own
   aggregated multi-store dashboard) has never been built by any module
   through v0.19 — no supplier-facing portal exists at all — and
   `SettingsContext` has no `supplierId` field yet. `Subscription` is
   seller-only (`seller_id`) for the same reason. A real supplier plan
   assignment is deferred to whichever future module builds that portal.

**Fixture fix in an existing suite:** `trust-safety.e2e-spec.ts`'s
name-consistency test created a second store for the same (CNIC-less)
seller purely to test payment-instrument matching across two stores —
FR-23.5's newly-enforced one-Free-store-per-identity default (1) now
rejects that, so the test explicitly raises the limit for itself via
`SettingsService.setValue` (not a raw DB write, so the cache the first
store's creation already populated is actually invalidated).

Migrations: `20260718124301_plans_pricing_guardrails` (the bulk of the
schema above), `20260718130000_teams_plan_id` (the `teams.plan_id`
follow-up found while building Teams). Tests: three new e2e files —
`plans-pricing.e2e-spec.ts` (13 tests, §14.7 + all four cross-checks),
`guardrails.e2e-spec.ts` (6 tests, §14.21), `teams.e2e-spec.ts` (9 tests,
§14.31) — plus a unit spec for the yearly-price calculation. Full suite:
25 e2e files / 214 tests, 19 unit files / 103 tests, all green.

## Amendment approved after Module 14, ahead of Module 15 (SRS v0.20)

Full spec: `docs/SRS.md`'s v0.20 changelog note, FR-7.2 (revised), FR-7.10
(supplemented), §14.3/§14.7's updated checklist lines. **Documentation
only, no code** — closes two dangling threads the founder flagged on
Module 14's approval, both given explicit homes rather than built now.

1. **Plan-fee collection at launch (FR-7.2, revised).** Module 14 left
   `seller_invoices.invoice_type = 'plan_subscription'` schema-ready but
   never built the invoice-generation job — until now, a paid plan was
   reachable only via an admin grant (FR-7.8). Pinned: a seller on a paid
   plan gets a monthly `plan_subscription` invoice via the identical
   manual-verification/grace-period mechanism as commission invoicing
   (FR-6.16–18) and the Teams group invoice (FR-7.15/7.18) — a third type
   on the same engine. Non-payment past grace **downgrades to Free**
   (FR-7.13's mechanism), **never suspends the store** — an unpaid plan
   fee is the seller declining to afford the tier, not a debt tied to
   store operations the way commission is.
2. **Supplier Premium Plan's full stack (FR-7.10, supplemented).** Three
   pieces, two already exist: the plan DATA (Free/Premium supplier tiers,
   Module 14) and the aggregation API/data (FR-3.3, `SupplierOrdersService`/
   `SupplierPortalController`, Module 9). Missing: the actual gate between
   them (`Subscription`/`SettingsContext` support a seller, not a
   supplier, today) and the supplier-facing dashboard UI itself — no
   supplier login/dashboard surface has ever existed in `apps/web`.

Both slot into a **new Module 20 (Supplier Portal Completion & Plan-Fee
Collection)**, depending on 8/9/11/14 — not folded into Module 17 (Admin
Control Plane completion), since a supplier-facing login/dashboard build
is a different surface than that module's admin-terminal identity, and
folding it in would blur what Module 17 actually is. The former Module 20
(Hardening & Launch Readiness) is renumbered to **Module 21** — the only
renumbering this causes.

**Superseded by SRS v0.24, approved before Module 20 — see the amendment
note below.** Point 1 above (monthly `plan_subscription` invoice) is no
longer what Module 20 builds; the founder finalized the actual v1.0
collection mechanism as a **prepaid wallet** instead (SRS §5.6e), and the
plan-fee/Teams-group-total/device-slot debits described here now debit
that wallet rather than generating an invoice. Point 2 (Supplier Premium
Plan's full stack) is unchanged and still Module 20's job, supplemented
with its own supplier-scoped wallet (SRS FR-7.10). Kept verbatim above
for the historical record of what was actually decided at the time, per
this project's no-silent-rewrite discipline.

## Amendment approved before Module 20 (SRS v0.24) — Prepaid Credits Wallet

Full spec: `docs/SRS.md`'s v0.24 changelog note, new §5.6e (FR-6.21–6.28),
FR-7.2 (revised again), FR-7.10 (supplemented), new §14.6e, §14.6c/§14.7's
updated lines. **Documentation only, no code yet** — a founder-driven
business-model finalization, applied ahead of Module 20's build per the
same "amend the SRS first, then build" discipline used throughout.

The monthly commission-invoice mechanism (§5.6c, Module 11) becomes
**dormant** (preserved, unscheduled — not deleted) and is replaced as
v1.0's active mechanism by a **prepaid wallet**: a seller tops up before
publishing (minimum Rs. 500, Settings Registry), commission debits the
wallet directly on each confirmed sale instead of accruing toward a
monthly invoice, and a new low-balance grace ladder (warning → grace
days → `orders_paused`, a new store state distinct from admin
`suspended` — storefront stays browsable, checkout blocked) replaces the
old grace-then-suspend flow. Plan fees, Team seat totals, and the
extra-device-slot add-on (FR-25.7) all debit the same wallet instead of
generating their own invoice rows. A separate, supplier-scoped wallet
(no commission/team/device entry types) collects the Supplier Premium
Plan's fee. Full detail in SRS §5.6e — not restated here to avoid the two
documents drifting; this note exists so the module-sequence record shows
*when* and *why* the mechanism changed. Module 20's build-plan scope
(stated separately, pending founder confirmation before code starts)
covers: the wallet backend (ledger extension, publish gate, top-up
flow/`TopUpAdapter`, grace ladder, `orders_paused`), the wallet
dashboard UI (Balance, top-up screen, transaction history), repurposing
Module 17's admin invoice-verification screen into a top-up-verification
screen, the supplier wallet + `Subscription`/`SettingsContext` supplier
support, and the supplier-facing aggregated dashboard UI (FR-3.3/FR-7.10).

## Module 20 (Supplier Portal Completion & Plan-Fee Wallet) — built

Full scope: `docs/SRS.md` §5.6e (FR-6.21-6.28), revised FR-7.2, supplemented
FR-7.10, checklist §14.6e. Built exactly as scoped in the founder-approved
plan above, with one found-during-build fix disclosed rather than silently
patched: `WalletGraceLadderService` depends on `EmailService` (the
low-balance warning email) but `BillingModule` never registered it as a
provider — caught by the new e2e spec's first test run (NestJS DI
resolution error), fixed by adding `EmailService` to `BillingModule`'s
providers.

1. **Seller wallet** (`apps/api/src/billing/wallet.service.ts`,
   `wallet-grace-ladder.service.ts`) — balance computed from `LedgerEntry`,
   new entry types `wallet_topup_credit`/`wallet_plan_fee_debit`/
   `wallet_team_seat_fee_debit`/`wallet_device_slot_fee_debit` alongside the
   existing `commission_accrued`/`commission_waived`. Publish gate
   (`StorePublishController`, `stores/:id/publish`) checks payment method +
   CNIC + minimum top-up. Low-balance grace ladder
   (`WalletLowBalanceSweepScheduler`) tracks warning/grace state on `Seller`
   (not `Store` - the wallet's real owner), transitions a seller's active
   stores to the new `orders_paused` `StoreStatus` value, restores instantly
   on a verified top-up.
2. **Top-up flow** (`TopUpAdapter`/`ManualBankTransferTopUpAdapter`,
   `WalletTopUpRequest` model, shared by seller and supplier via an
   `ownerType`/`ownerId` pair) - the Module 17 admin invoice-verification
   screen is repurposed (`admin/wallet-topups`, same list-and-verify
   pattern) rather than rebuilt.
3. **Plan-fee/Team-seat/device-slot debits** (`PlanFeeDebitService`) -
   the piece FR-7.2 flagged as "schema-ready, job never built" since Module
   14, now built as a wallet debit and the thing that finally advances
   `Subscription.currentPeriodEnd` for an unchanged plan (nothing did
   before). Insufficient balance downgrades to Free, never
   `orders_paused`/suspension - that ladder is strictly the commission
   wallet's concern.
4. **Supplier wallet + plan gate** (`SupplierWalletService`,
   `SupplierWalletEntry` model) - closes the Module 14 build-plan note
   ("Subscription is seller-only... for the same reason"): `Subscription`
   gained a nullable `supplierId` (exactly one of `sellerId`/`supplierId`,
   enforced by a hand-written CHECK constraint), `SettingsContext` gained a
   real `supplier` scope (resolves above `plan`, mirroring FR-8.1's
   `seller > plan` precedence). `suppliers.aggregated_dashboard_enabled`
   gates `SupplierOrdersService.listOwnOrderItems()`'s cross-store merge -
   a free-tier supplier linked to more than one store must pass a
   `storeId` filter.
5. **Supplier portal frontend** (`apps/web/app/(supplier)/`) - the surface
   that never existed in `apps/web` at all: plan/wallet status, connected
   stores, per-store or aggregated order queue. Signup form gained a
   Seller/Supplier role toggle (supplier signup was API-reachable since
   Module 8, never exposed in the UI).
6. **Dormant, not deleted (FR-6.28):** `InvoiceGenerationScheduler`/
   `InvoiceOverdueScheduler` removed from `BillingModule`'s providers and
   `worker.main.ts`'s consumers - `InvoicesService`'s methods are
   untouched and still callable, simply unscheduled.

Migrations: `20260720090000_module20_wallet_supplier_portal` (wallet/
supplier schema, the `orders_paused`/`supplier` enum values, the exactly-
one-owner CHECK constraint) and `20260720091500_module20_wallet_grace_ladder_tracking`
(the two grace-ladder tracking columns on `sellers`, added in a follow-up
migration rather than editing the first after it had already been applied
locally). Tests: one new e2e file, `module20-wallet-supplier-portal.e2e-spec.ts`
(9 tests, §14.6e), plus every existing checkout-completing e2e test's
helper updated to set `publishedAt` directly (mirroring the existing
CNIC-bypass precedent) now that a real publish gate exists. Full suite:
31 e2e files / 270 tests, 22 unit files / 122 tests, all green.

**Post-delivery fix (v0.25):** the founder's own direct repo verification
caught a real gap this module's own testing missed —
`billing.wallet_negative_float_floor` was seeded but never read by any
debit/sweep path, so it bounded nothing. Fixed: `WalletGraceLadderService
.checkImmediateFloorPause(sellerId)` (new method, plus a shared
`pauseActiveStores()` helper extracted from the existing sweep's pause
branch) — called non-blockingly from `OrdersService.markAsPaid()` right
after the commission debit commits, and from `runSweep()`'s first check
per seller (ahead of the warning/grace branches). Crossing the floor
pauses active stores immediately, bypassing the grace ladder entirely;
restore reuses the existing instant-restore path, no second threshold.
One new e2e test added to the existing file (floor-breach → immediate
pause → verified top-up restores). §14.6e/§14.7 checklist items also
retroactively checked off in this fix's commit — the original Module 20
commit built everything but never flipped the SRS checkboxes to match.

---

## Module 21 (Hardening & Launch Readiness) — built

Full scope: founder-approved with scope additions beyond the original
8-item proposal (SRS §14.12, this module is the launch gate so it grew).
No schema/migrations — this module is CI, hardening, and tooling, not
product surface.

1. **CI required-checks** (`.github/workflows/ci.yml`) — 5 jobs:
   `typecheck`, `unit-tests`, `e2e-tests` (real Postgres 16/Redis 7 service
   containers, `bootstrap-db.sql` + `prisma migrate deploy` as superuser,
   full suite run on every push), `dependency-audit`, `web-build`. Marking
   these as GitHub branch-protection *required* status checks is a
   separate one-time repo-admin action this file doesn't itself do.
2. **Rate-limit audit** against the SRS §14.12 endpoint list — see the
   checklist entry below for the full breakdown. The one real gap found
   and closed: login (seller and admin) had never used
   `RateLimitService` despite `app.module.ts`'s own comment implying it
   should; fixed with the same dual-key (per-account + per-IP) pattern
   signup/password-reset already used, new Settings Registry key
   `auth.login_rate_limit_per_hour`.
3. **PII-redaction verification** — `PiiRedactionInterceptor` already
   existed (logs method/path/status/duration, never body/query/headers);
   `pii-redaction.interceptor.spec.ts` is the new test proving it, against
   a hand-built fake `ExecutionContext`/`CallHandler`.
4. **Dependency-audit step** — `pnpm audit --audit-level=critical`
   (CI-blocking, currently 0 findings) plus an informational
   `--audit-level=high` report, and
   `scripts/verify-dependency-audit-blocks-vulnerable-package.sh` (proves
   the scanning mechanism itself works via a throwaway fixture pinning a
   real known-vulnerable package). One real fix landed alongside this:
   `multer` was resolving to a vulnerable 2.0.2 via
   `@nestjs/platform-express`'s own semver ceiling — `pnpm update` alone
   couldn't get past it, so a root `pnpm.overrides` entry
   (`"multer": "^2.2.0"`) was added, closing 4 real high-severity multer
   DoS CVEs. The remaining ~15 high-severity findings (mostly a Next.js
   14→15 major bump, plus several transitive deps) are a disclosed
   founder-decision item in `docs/launch-runbook.md`, not silently forced
   or silently ignored — this sandbox has no automated `apps/web` test
   suite to verify a Next.js major bump this close to launch.
5. **Secrets-store deployment doc** — folded into
   `docs/launch-runbook.md`'s Secrets section rather than shipped as a
   separate document, since it's one step in the same ordered launch
   sequence.
6. **Load/soak simulation tooling** (`apps/api/scripts/simulate/`) — a
   `seed`/`run`/`report`/`teardown` CLI (`pnpm run simulate <command>`)
   that creates N dummy sellers/stores through the **real running API**
   (never raw SQL bulk-insert, so every business invariant — Financial
   Truth Invariant, moderation, wallet gates, publish gate — is satisfied
   for free by reusing already-tested code paths), then drives concurrent
   storefront + dashboard traffic for a configurable duration and reports
   error counts by type, p50/p95/p99 latency per endpoint group, slowest
   DB queries (via `pg_stat_statements`, with a graceful fallback message
   if it isn't enabled), and two concrete SQL-provable invariants
   (duplicate commission-ledger entries per order; cross-tenant
   `order_items`/`media_assets`). Refuses to run against a
   `NODE_ENV=production` box without an explicit `--i-know` flag
   (`safety.ts`). Teardown is a scoped, manifest-driven delete (never a
   blind wipe — this tool may run against a real pre-launch environment
   with genuine Settings Registry/plan configuration worth preserving),
   using `SET LOCAL session_replication_role = replica` since this schema
   has no `ON DELETE CASCADE` anywhere.

   **Found and fixed while smoke-testing this tool end-to-end (the
   founder's own item 8 requirement) — three real, load-bearing bugs that
   unit tests and typechecking alone could not have caught:**
   - A new seller's first `moderation.new_seller_probation_count` products
     (10 by default, FR-27.3) are queued `pending` regardless of keyword
     content — since every simulated seller only creates 3-6 products,
     **100% of simulated orders failed at any N** until `seed.ts` was
     fixed to approve each product via `POST
     /admin/moderation/queue/:id/approve` right after creating it
     (deliberately leaving the one flagged-title product per ~8% of
     sellers pending, to still exercise the moderation queue on purpose).
   - `app_admin` is `BYPASSRLS` but not Postgres superuser, and
     `SET ... session_replication_role` is superuser-only by default in
     stock Postgres — `teardown.ts` failed with "permission denied" on
     every run. Fixed with a new `bootstrap-db.sql` grant
     (`GRANT SET ON PARAMETER session_replication_role TO app_admin`,
     PG15+), the narrowest privilege that unblocks it.
   - `teardown.ts` tried to delete from `seller_agreement_versions` by
     `seller_id` — that table has no such column at all; it's the global,
     shared table of published agreement *text* versions
     (`schema.prisma`'s `SellerAgreementVersion`), not a per-seller
     acceptance record (that's 3 columns directly on `sellers`). Fixed by
     removing the erroneous delete entirely.
   - Two further issues surfaced only under concurrent traffic, not seed:
     the global `ThrottlerGuard` (100 req/60s/IP) and the new
     `auth.login_rate_limit_per_hour` limit both correctly do their job
     against a load-generator that — by construction — looks like one
     source IP, drowning the report in `429`s instead of real latency
     data. Fixed the tool itself (`traffic.ts`'s `dashboardWorker` now
     logs in once per simulated session instead of once per loop
     iteration — more realistic *and* stops needlessly burning the login
     limit) and added a documented, temporary
     `THROTTLE_LIMIT_PER_MINUTE` env override
     (`app.module.ts`, `.env.example`) for real large-N runs, spelled out
     in `docs/launch-runbook.md`'s simulation section.
7. **Founder launch runbook** (`docs/launch-runbook.md`) — the ordered,
   checkbox-per-item, end-to-end launch-day sequence: VPS provisioning,
   DNS, secrets, bringing the stack up, seeding reference data, backup
   verification (including an actual restore test, not just a `pg_dump`),
   founder verification items (carrying forward README's existing list
   plus a new Rich Results Test check for FR-16.6's Product JSON-LD,
   not previously an explicit checklist item), the simulation run + report
   review, then real launch Settings values to configure (commission %,
   grace thresholds, banned-keyword lists, plan/pricing, rate limits).
8. **Final reconfirmation** — full green run of typecheck, the unit suite
   (26 suites / 134 tests), the e2e suite (31 suites / 274 tests, real
   Postgres/Redis), the web build, and a local simulation smoke at
   `--count 5` (seed → run → report → teardown, against a real locally
   running API instance) — the three bugs listed above were found and
   fixed by this exact step, not left for the founder's real-hardware run
   to discover first.

Migrations: none. Tests: `safety.spec.ts` (3), `stats.spec.ts` (3),
`pii-redaction.interceptor.spec.ts` (2) new unit tests; two new e2e tests
(seller/admin login rate-limit). Full suite: 26 unit files / 134 tests, 31
e2e files / 274 tests, all green.

---

## Growth & Partner Programs slotting (Module 22, v0.26 — plan stated, build pending founder confirmation)

Full scope: `docs/SRS.md` §5.33/§14.33 (FR-33.1–33.12). Four founder-specified
programs (Certified Ambassador, Student Referral, Creators, Careers), all
gated the same way (eligibility → application → admin approval), all
crediting the existing wallet/ledger, all reusing the existing T&S engine.

**Slotting: after Module 21 (Hardening & Launch Readiness), as its own
Module 22 — not folded into, or ahead of, the launch-readiness gate.**
Reasoning:

1. **Nothing about core marketplace function depends on it.** A seller can
   sign up, publish a store, sell, and get paid (Modules 1–20) with zero
   input from any referral/ambassador/careers program. This is acquisition
   tooling, not commerce plumbing — it doesn't belong on the critical path
   to a sellable, launchable platform.
2. **Module 21 is described as "all above… full cross-tenant sweep."**
   Inserting a brand-new module ahead of it would mean Module 21's own
   dependency list grows to include Growth & Partner Programs, and its
   security sweep would need to cover a feature that reactivates a
   previously-dormant money-movement path (disbursement, §5.6b) — new
   attack surface (self-referral fraud, fake-account clusters, clawback
   edge cases) landing *inside* the hardening pass meant to close out
   everything that came before it. Cleaner to let Module 21 harden the
   platform as it stands through Module 20, ship, and bring Growth &
   Partner Programs in afterward as its own self-contained, separately
   hardened addition.
3. **Reactivating dormant disbursement machinery deserves its own
   scrutiny, not a rider on the launch gate.** §5.6b has sat dormant and
   unbuilt since the v0.15 payment-model pivot; the first thing that ever
   exercises it moving real money *out* of the platform is exactly the
   kind of change that should land, and be verified, on its own — not
   bundled into the same push as the final pre-launch sweep.
4. **`UI stays bare-functional` (founder's own instruction) is itself a
   signal this isn't launch-blocking polish** — every other genuinely
   launch-blocking module in this sequence (15.5, for instance) got a
   real design bar specifically *because* it's launch-blocking. This one
   doesn't get that treatment because it isn't.

**The one exception — FR-33.1 (referral-source attribution at signup)
should NOT wait for Module 22.** The founder's own callout is correct:
this data is unbackfillable, and real seller signups may start arriving
as soon as Module 21 clears, well before Module 22's full engine exists.
Recommendation: ship FR-33.1 as a small, standalone amendment (one
nullable column + one write path, no program tables required to exist
yet) immediately after whichever module is currently in flight when this
is confirmed — not gated on Module 22's approval, and not skipped while
waiting for it.

**Shipped (v0.26, standalone, ahead of the rest of Module 22):**
`Subscription.referralSource` (migration
`20260723083536_module22_referral_source_attribution`), captured from
`SignupDto.referralCode` via `resolveReferralSource()`
(`apps/api/src/plans/referral-source.util.ts` — shape-validates only, no
program table to resolve against yet, never blocks signup on a bad code).
Wired through both `assignFreePlanAtSignup`/`assignFreeSupplierPlanAtSignup`
so seller and supplier signups both capture it. §14.33's FR-33.1 line
checked off; the rest of §14.33 stays pending Module 22.

**Internal split within Module 22 (build order, once confirmed):**
Programs 1–3 (Ambassador/Student/Creator) share one engine — application/
approval, `ReferralAttribution`, commission calculation, wallet ledger
entries, withdrawal/disbursement reactivation, T&S fraud hooks — and
should be built together first. Careers (Program 4) touches none of that
machinery (no referral, no commission, no wallet) and reuses the content-
pages system almost as-is; it can be built either alongside or
immediately after the referral engine without blocking on it, and would
be the first candidate to defer if the module needs splitting further for
checklist-gating purposes.

**v0.27 slotting decision — Store Health Score, Verified Store Program,
and Data Export do NOT fold into Module 22; they become two new sibling
modules built immediately after it, in this order: Module 22 (Growth &
Partner Programs, exactly as scoped above, unchanged) → Module 23 (Store
Health Score & Verified Store Program, §5.34/§5.35) → Module 24 (Seller
Data Export to Personal Cloud Storage, §5.36).** Reasoning:

1. **Thematically distinct from Growth & Partner Programs.** Module 22 is
   acquisition tooling (referral/ambassador/creator/careers) — none of it
   touches order fulfillment data, T&S risk scoring, or domain tenure.
   Store Health Score and the Verified Store Program are a trust/quality
   surface reading from Orders (§5.9), Trust & Safety (§5.29/§5.30), and
   Domains (§5.3) — different data, different admin workflow (a health-
   driven eligibility portal and a mandatory audit queue, vs. an
   application/approval queue for a referral program). Folding them
   together would produce one oversized module with two unrelated §14
   checklists to gate at once, working against the "one module at a time"
   discipline this whole engagement runs on.
2. **Store Health Score and the Verified Store Program are tightly
   coupled to each other and belong together.** §5.35's first eligibility
   criterion reads §5.34's score directly, and its revocation trigger
   (FR-35.5) fires *from* a health-score drop — building them apart would
   mean shipping half a feature (a score with no consumer, or a
   verification flow with no health signal to gate on). One module,
   Module 23, covers both.
3. **Data Export is fully independent of both** — no shared code, no
   shared eligibility logic, reuses only already-built mechanisms (CSV
   export, PDF generation, Google Drive integration). It's the smallest
   of the three by a wide margin and could in principle build in any
   order relative to 22/23; slotting it last (Module 24) keeps the
   trust-surface pair (23) together as one clean unit and leaves Data
   Export as the easy, low-risk module to build whenever schedule
   pressure favors a quick win.
4. **The new `Store.policyText` schema addition (FR-34.1) lands in
   Module 23, not Module 22** — it's needed for Store Health Score's
   profile-completeness input, has nothing to do with Growth Programs,
   and this SRS's "amend first, don't improvise" discipline means a
   schema change ships in the module whose FR actually requires it.

## Module 22 Phase A (Growth & Partner Programs — shared referral engine) — built

Full scope: `docs/SRS.md` §5.33 FR-33.2-33.4/33.9-33.12 (FR-33.1 already
shipped standalone), checklist §14.33 (all items checked except FR-33.8
Careers, Phase B, next). New module `apps/api/src/growth-programs/`.

1. **Schema** — migration `20260723172749_module22_growth_partner_programs_phase_a`:
   `ProgramParticipant` (one row per seller per program, `@@unique` on
   `[sellerId, programType]`, `referralCode` issued only on approval),
   `ReferralAttribution` (`@@unique` on `referredSellerId` — FR-33.3's
   single-source guarantee enforced at the database layer, not just
   application logic; `commissionWindowEndsAt` locked in at attribution
   time from whatever Settings Registry window value was live then),
   `ProgramContentSubmission` (Creators' manual view-verification queue),
   `PayoutRequest` (reactivating the dormant §5.6b engine), and three new
   `LedgerEntryType` values (`program_commission_credit`/
   `program_reward_credit`/`program_clawback_debit` — `payout_debit` was
   already reserved in the original schema, unused until now).
2. **Application/eligibility/approval** (`program-application.service.ts`,
   FR-33.2) — the one shared shape every program follows: apply → pending
   → admin approve/reject, plus admin suspend/terminate on an already-
   approved participant, at any time. Ambassador's application gate (an
   eligible paid plan, FR-33.5) reuses `SubscriptionsService.getPlanContext()`
   + a new `growth.ambassador_eligible` Settings Registry key (`plan`
   scope) — no new eligibility mechanism.
3. **Attribution** (`referral-attribution.service.ts`, FR-33.1/33.3) —
   resolves a just-captured `Subscription.referralSource` against an
   approved participant's `referralCode` at signup, tolerating every
   non-match case silently (null, stale, unapproved) since signup must
   never fail because of this. Wired into `AuthService.signup()` right
   after `assignFreePlanAtSignup`.
4. **Commission** (`apps/api/src/billing/program-commission.service.ts` —
   lives in `BillingModule`, not `GrowthProgramsModule`, specifically to
   avoid a circular module dependency: it reads the new
   `referral_attributions`/`program_participants` tables directly via
   `PrismaAdminService`, needing no cross-module DI, while
   `GrowthProgramsModule` imports `BillingModule` one-directionally for
   `WalletService` in the withdrawal flow) — called from **exactly one**
   site, `PlanFeeDebitService.debitDuePlanFees()`'s successful-debit
   branch (FR-33.4, binding: never from team-seat/device-slot debits or
   wallet top-ups). `WalletService.getBalance()`'s `signedContribution()`
   map (the "one place that knowledge lives") updated for the three new
   credit types plus `payout_debit`.
5. **Ambassador/Student Referral/Creator** (`program-reward.service.ts`,
   FR-33.5-33.7) — Ambassador's monthly performance-reward sweep (a new
   `runMonthlyAmbassadorRewardSweep()`, same idempotent-per-calendar-month
   pattern as `PlanFeeDebitService`'s team-seat debit) and live
   certificate-tier lookup (never cached — thresholds are admin-editable
   Settings Registry data); Creator content submission + **mandatory
   manual** admin verification before any view-based reward is computed,
   capped per-creator per-calendar-month.
6. **Withdrawal** (`program-withdrawal.service.ts`, FR-33.9) — the Payout
   Request & Disbursement Engine's first real implementation:
   `requested → approved → processing → paid`/`rejected`. Requesting/
   approving never touch the ledger; only `paid` creates the real
   `payout_debit` entry, so a rejected request needs no reversal — the
   balance was never touched. Clawback (FR-33.10) reuses §5.6e's existing
   negative-balance mechanism verbatim (a plain debit, no balance check),
   calling `WalletGraceLadderService.checkImmediateFloorPause()` after,
   mirroring `OrdersService.markAsPaid()`'s own pattern.
7. **Fraud** (FR-33.10) — a new `selfReferralFlags()` method added to the
   *existing* `TrustSafetyMonitorsService`/`AdminTrustSafetyController`
   (no new admin screen), comparing CNIC hash, store payment-instrument
   hashes, and signup IP/device fingerprint between a referrer and their
   referred seller — same comparison shape `RiskScoreService`'s own
   `matchesSuspendedSellerCluster()` already established.
8. **Admin queues + reports** (FR-33.11) — application queue and content-
   verification queue are `@AllowReviewer()` (same sensitivity tier as the
   moderation queue); the withdrawal queue and clawback endpoint are
   deliberately **not** `@AllowReviewer()`, same discipline as
   `AdminTrustSafetyController`/`AdminSellerLifecycleController` — this
   moves real money. A new `ProgramReportService` computes referrals/
   conversions/payouts/rejection-rate per program, read-only.
9. **Legal draft** (FR-33.12) — `docs/legal/growth-partner-programs-terms.md`
   (Ambassador/Student Referral/Creator only; Careers gets its own terms
   in Phase B), flagged for human legal review.

Tests: one new e2e file,
`module22-growth-partner-programs.e2e-spec.ts` (13 tests) — including,
per the founder's explicit two reminders, a full withdrawal negative-space
suite (threshold not met, an unapproved participant, a suspended
participant, a double-request on the same outstanding balance, an admin
rejection correctly restoring the requestable balance, and a clawback
after an already-paid withdrawal going negative with its natural recovery
path exercised directly) and an attribution-locking suite (a direct second
`ReferralAttribution.create()` for the same referred seller asserted to
throw a real Postgres unique-constraint violation, not just an
application-layer check; commission asserted to never accrue from a
wallet top-up or a GMV-driven `commission_accrued` entry, only from the
referred seller's own plan-fee debit, at the correct rate).

## Module 22 Phase B (Growth & Partner Programs — Careers) — built (Module 22 complete)

Full scope: `docs/SRS.md` §5.33 FR-33.8, checklist §14.33's Careers line
(now the last item checked — Module 22 is complete end to end). New
module `apps/api/src/careers/`, migration
`20260723180000_module22_growth_partner_programs_phase_b_careers`.

- `JobPosting` (role/description/status: draft/open/closed) and
  `JobApplication` (applicant name/email/phone, `cvUrl`, a fixed 5-value
  status enum) — a new, minimal admin-editable content type reusing
  FR-12.1's discipline (admin-managed, a data write not a deploy) rather
  than literally overloading `ContentPage`, which has no status/pipeline
  shape a job posting needs.
- `careers.controller.ts` (public, no auth) — `GET /careers` lists only
  `open` postings; `POST /careers/:id/apply` accepts a CV upload via
  `FileInterceptor`, its own dedicated 5MB/PDF-or-Word limit (distinct
  from `MediaUploadController`'s 25MB image/clip limit for the same
  object-storage substrate, §3.3) — a wrong-type or oversized file is
  rejected with a clear error, never silently accepted.
- `admin-careers.controller.ts` (`AdminAuthGuard`) — posting CRUD/status,
  the per-posting application pipeline, and application status updates.
  Applicant data (contact details, CV) never appears on any public
  endpoint - structurally, since only this admin controller ever queries
  `JobApplication`.
- Stage labels (`received → reviewing → interviewing → rejected/hired`)
  are Settings-Registry-editable display text
  (`careers.application_stage_labels`, JSON) — the fixed enum stays the
  real state machine, only the outward label is admin data, same split
  FR-33.5's certificate-tier naming already established.

Tests: `module22-careers.e2e-spec.ts` (3 tests) — only-`open`-postings
public listing, a full apply→pipeline→status-advance flow including an
explicit wrong-file-type rejection and a direct assertion the public
listing response never contains applicant name/email, and a closed
posting rejecting new applications.

## Module 23 (Store Health Score + Verified Store Program) — built

Full scope: `docs/SRS.md` §5.34 (FR-34.1-34.3), §5.35 (FR-35.1-35.7),
checklists §14.34/§14.35. Two new modules, tightly coupled per the
founder-approved v0.27 slotting note (Verified Store's eligibility gate
reads the health score; the health-drop re-review trigger is checked by
its own sweep rather than a cross-module call, avoiding any circular
dependency): `apps/api/src/store-health/` and `apps/api/src/verification/`
(`VerificationModule` imports `StoreHealthModule` one-directionally).
Migration `20260724120000_module23_store_health_verified_store`.

- `StoreHealthScoreService.computeForStore()` — seven inputs, each a
  Settings Registry weight: on-time fulfillment (confirmed→shipped
  `OrderTimelineEvent` gap vs. a configurable target), cancellation rate,
  pending-forever rate, dispute/refund signals (`disputed` orders +
  `commission_waived` ledger entries), profile completeness (logo,
  payment method via the existing `hasAnyPaymentMethod()` helper, CNIC,
  and the new `Store.policyText`), account age (capped by weight, never
  dominates), and moderation/risk history (reused directly from §5.30's
  Risk Score Engine + `lifecycleStatus`). The composite score normalizes
  by the actual sum of the (editable) weights, not an assumed 100 — a
  disclosed robustness choice so admin drift in one weight can never push
  the score outside 0-100.
- `Store.policyText` (the one real schema gap FR-34.1 itself calls out) —
  editable from the store Settings page's new "Store policy" card.
- `StoreHealthScoreHistory` + `StoreHealthSweepScheduler`
  (`store-health-sweep` BullMQ queue, worker-registered,
  `storehealth.recompute_interval_hours`) — one row per run; the seller
  dashboard (`/stores/:id/health`) renders a trend plus a plain-language
  breakdown naming the specific inputs dragging the score down, never raw
  weights/math (Simplicity Invariant §3.13).
- `VerificationEligibilityService.check()` — the five default criteria,
  each Settings-Registry-driven; the SAME function backs both the
  seller-facing live portal (`GET /stores/:id/verification/eligibility`)
  and `apply()`'s server-side gate, so the two structurally cannot drift
  (closing the "bypass via direct API call" risk by construction, not by
  a second parallel check). "Same custom domain, 6+ months" reads the
  store's most-recently-attached `Domain` row's own `verifiedAt` — no new
  field, and attaching a different domain naturally resets the clock
  since it's a fresh row.
- `VerificationApplicationService` — `apply()` (re-checks eligibility,
  debits the Settings-driven fee as a `verification_fee_debit` ledger
  entry before any admin decision exists, opens the mandatory audit-queue
  row), `approve()`/`reject()` (reject refunds the fee per
  `verification.refund_on_reject`, default true), `revoke()` (a standing,
  any-time admin override requiring a reason), `clearReReview()` (resolves
  a flagged re-review with no action).
- `VerificationReReviewService.runSweep()` (scheduled,
  `verification-re-review-sweep` queue) — independently checks every
  `verified` store for a health-score drop below threshold OR a T&S
  enforcement action (`lifecycleStatus != active`), flagging either
  trigger alone (never auto-revoking - a human confirms via the admin
  queue); separately expires annual re-verification (Settings toggle,
  default on) at 12 months, requiring a full fresh application - the
  reverification fee (`verification.reverification_fee_pkr`, default 0)
  is charged instead of the original fee when a prior approval exists for
  the store.
- Two new `LedgerEntryType` values (`verification_fee_debit`,
  `verification_fee_refund_credit`) wired into `WalletService`'s
  `DEBIT_TYPES`/`CREDIT_TYPES` sets and `labelFor()` - the one place that
  knowledge lives, per Module 20's own documented invariant.
- Badge wiring: `StorefrontService.getStorePublic()` now returns
  `verified: store.verifiedStatus === "verified"`; the web app's
  `SiteHeader` component renders it once and is reused by both the
  storefront header (every page) and the checkout page - one code change
  satisfies both required render points, reading live (no cache) on every
  request.
- Admin queue: `AdminVerificationController`, `AdminAuthGuard`-only (no
  `@AllowReviewer()`) - money-adjacent (fee refund on reject), matching
  the existing "money-moving admin actions are admin-only" precedent.
- Seller-facing pages: `/stores/:id/health` (score, breakdown,
  suggestions, history) and `/stores/:id/verification` (eligibility
  criteria, apply action, application history, current status) - both
  added to `nav-items.ts`. Admin page: `/admin/verification` (bare
  functional view, no design pass yet, same discipline as the other admin
  screens) - application queue with the frozen eligibility snapshot, and
  the re-review queue.
- `docs/legal/verified-store-program-terms.md` (draft, flagged for legal
  review, same discipline as every other `docs/legal/*.md` draft).

Tests: `module23-store-health-verification.e2e-spec.ts` (14 tests) -
Settings-Registry-driven weights (zeroing a poorly-scoring input's weight
measurably changes the next score), profile completeness partial credit,
idempotent recompute + history-backed dashboard, plain-language
suggestions; the eligibility portal changing live with a threshold, an
actual domain-swap resetting the tenure clock, the fee debiting before
any decision exists, the eligibility gate rejecting a direct API bypass,
a fully-eligible application still being rejectable (with a full refund),
the badge appearing/disappearing immediately across storefront+checkout,
the health-score-drop and T&S-enforcement re-review triggers each tested
in isolation, a direct admin revoke (audit-logged), and annual
re-verification expiry forcing a genuine new application (at the
Settings-default zero reverification fee).

## Module 19 (Product Design System) — Phase 1 of 8, checkpoint reported

The design phase this whole build deferred, per the "known sequencing risk"
noted at the top of this document: founder branding sign-off finally landed
(platform name is now official — **eyosto**, lowercase wordmark), unblocking
the visual pass every module before this one built functionally but left at
"bare, no design pass yet." Founder-directed 8-phase execution, one
checkpoint per phase. This entry covers **Phase 1 (design system
foundation)** only — Phases 2-8 (marketing site, auth/onboarding, dashboard
core + remaining, buyer surfaces, admin terminal, final pass) are not yet
started.

**Tokens** (`apps/web/app/globals.css`) — the monochrome premium direction
from Module 10 already had a correct, hue-free grayscale ramp and a single
restrained accent; Phase 1 filled in what was actually missing rather than
redoing what worked:
- A real type scale (`--text-display` through `--text-eyebrow`, using
  Tailwind v4's paired `--text-*--line-height`/`--letter-spacing`/
  `-weight` properties) — large sizes get tight negative tracking (a
  headline reads as one gesture), body sizes stay roomy (1.5-1.6 line
  height).
- Two semantic spacing tokens (`--spacing-section`/`-lg`) for marketing-page
  rhythm from Phase 2 onward — Tailwind's own default 4px-based scale
  already was the systematic ramp for everything else, no reinvention.
- `--shadow-xl` (the one missing step, for the highest-layer dialog/scrim
  case) and `--radius-full`.
- Motion: added `--ease-in` (fast accelerate, exits only) and
  `--ease-emphasized` (rare overshoot) alongside the existing
  `--ease-standard`; `--duration-slower` for hero-level reveals. Mirrored
  as JS constants in the new `apps/web/lib/motion.ts` so GSAP timelines and
  CSS transitions read the exact same numbers.
- Base layer promoted from dashboard-only (`.app-shell-surface`) to
  product-wide: `body` now sets the font/background/ink globally, headings
  (`h1-h4`) default to the display face, `:focus-visible` is a real ring
  everywhere (not just inside the dashboard shell), and a
  `prefers-reduced-motion` block zeroes every animation/transition
  duration site-wide.
- New Radix overlay keyframes (`overlay-in`/`-out`, `fade-in`/`-out`,
  `scrim-in`) driving three reusable animation classes
  (`.eyosto-overlay`/`.eyosto-fade`/`.eyosto-scrim`) so Dialog/DropdownMenu/
  Tooltip/Toast all animate in with `ease-standard`, out with `ease-in`,
  from one shared definition.

**Typography** (`apps/web/app/layout.tsx`) — Plus Jakarta Sans added via
`next/font/google` as the display face (headlines, hero copy, the
wordmark); Inter kept as the body/UI face rather than replaced site-wide —
it's already proven legible at 13-14px across every dense dashboard table
this product has shipped, and premium-design-taste's own pairing rule caps
a system at two families. Queried `ui-ux-pro-max`'s typography domain for a
premium-dashboard-appropriate pairing candidate list before deciding.

**Wordmark** (`apps/web/components/dashboard/Sidebar.tsx`) — replaced the
old "goto5x" glyph-mark + text lockup with a plain typographic "eyosto"
lockup in the display face (no logo/icon design work, per CLAUDE.md's
Design Direction — the name is now official, not a placeholder, but a
visual mark is still future work). Root layout metadata updated to match.
Deliberately NOT a site-wide find/replace of "goto5x" — the ~9 remaining
hard-coded copy occurrences (marketing homepage, signup page, storefront
verified-store chrome) are plain page copy belonging to their own later
phases (2, 3, 6 respectively), not this foundation phase.

**Component kit** (`apps/web/components/ui/`) — installed the shadcn/ui
stack (Radix primitives, `class-variance-authority`, `clsx` +
`tailwind-merge` via a new `cn()` helper in `apps/web/lib/utils.ts`,
`lucide-react`, `gsap`) rather than continuing purely hand-rolled
components, per the founder's brief. Existing components
(`Button`/`Card`/`Badge`/`Alert`/`Field`(`Input`/`Textarea`/`Select`)/
`EmptyState`/`PageHeader`/`Spinner`/`Disclosure`) were upgraded in place —
same import paths and prop APIs (21-25 pages each already depend on these,
confirmed by grep before touching anything), full hover/focus-visible/
active/disabled/loading/error states added, restyled through `cn()` against
the token file. Twelve new Radix-based primitives added
(`Label`/`Checkbox`/`Switch`/`Tabs`/`Table`/`Dialog`/`DropdownMenu`/
`Avatar`/`Progress`/`Skeleton`/`Tooltip`/`Separator`), plus a toast system
(`Toast`/`Toaster` + `apps/web/lib/use-toast.ts`'s shared queue, mounted
once in the root layout). Two reusable motion primitives added
(`apps/web/components/motion/Reveal.tsx` — GSAP + ScrollTrigger
scroll-reveal wrapper, a no-op under `prefers-reduced-motion`;
`Magnetic.tsx` — cursor-follow hover, reserved for a page's single primary
CTA per the skill's own restraint rule).

**`/design-system` preview page** — the contract page every later phase is
checked against: identity/hero, color, typography, spacing & radii, depth,
motion (with a live magnetic-CTA demo and the three easing curves
explained), then every component in the kit with as many of its 8 states
demonstrated as a static page can show (default/hover/focus-visible/active/
disabled/loading are all genuinely interactive on the live page; error is
shown explicitly on a form field). Verified via Playwright screenshots at
1440px desktop and 390px mobile (see checkpoint report) — full reveal
animations confirmed with `prefers-reduced-motion` emulation to check the
page's real, un-animated layout at every section.

**Deliberately out of scope for Phase 1:** no page outside `/design-system`
was restyled yet (Phases 2-8's job); no Radix `Select` (the existing native
`<select>` wrapper already covers current needs; a richer picker can be
added when a specific screen needs it); the ~9 remaining "goto5x" copy
occurrences noted above.

### Phase 1 redo (v1.1) — founder-rejected visual direction, corrected

The checkpoint above was **rejected on visual direction**: Plus Jakarta Sans
read as "friendly startup," not "premium minimal," and the founder ordered a
redo before Phase 2 could start. Same phase, same checkpoint gate — this is
not a new phase.

- **Typography** — Plus Jakarta Sans replaced with **Geist** (Vercel's own
  family, via the `geist` npm package's `next/font/local` export — not
  available through `next/font/google`) as the display face in
  `apps/web/app/layout.tsx`. Inter unchanged as the body/UI face. A new
  `/design-system/type` page presents Geist alongside exactly one
  alternative (Instrument Sans, tightened) at identical scale/tracking/
  weight, per the founder's explicit instruction not to swap unilaterally
  without showing the comparison — Geist is marked chosen, Instrument Sans
  rejected, with the reasoning written out on the page itself.
- **Tokens hardened** (`globals.css`) — neutrals rewritten to an
  ink-on-paper palette (`--color-canvas: #faf9f6`, `--color-ink: #0a0a0a`,
  real contrast jumps at every step, no accent-tinted grays); the entire
  type scale rebuilt with bigger clamps (`--text-display` up to
  `clamp(3.5rem, 2.25rem + 6vw, 7.5rem)`), tighter large-size tracking
  (-0.02em to -0.04em), and one uniform heading weight (700 everywhere,
  replacing the prior 600/700 mix); `--spacing-section`/`-lg` doubled
  (6→12rem, 9→18rem); shadows halved in opacity with larger blur/offset
  ("distance, not drama").
- **`/design-system` page rebuilt** to the new tokens — swatches, type
  labels, and section copy all corrected to match; every section's
  Tailwind spacing classes doubled to match the token-level whitespace
  change (the page wasn't breathing before, only its tokens were).
- **Real proof page**: the founder's brief was explicit that "a design
  system can't be judged from swatches — the hero is the taste test."
  `apps/web/app/page.tsx` (the platform's actual marketing homepage route)
  now has a real hero section — eyosto wordmark in nav, a staggered-entrance
  GSAP headline (`Reveal` with `stagger`), sub-line, a `Magnetic`-wrapped
  primary CTA, and a subtle scroll cue.
- **Bug found and fixed during this pass**: the scroll cue was first built
  using `Reveal` (GSAP ScrollTrigger) on a `position: fixed` element. On a
  page that doesn't scroll, ScrollTrigger can never resolve a valid "enters
  viewport" position for a fixed element, so it stayed at `opacity: 0`
  forever — invisible in every screenshot until caught. Fixed by rendering
  it with a plain CSS fade-in instead (`motion-reduce:` variants respect
  `prefers-reduced-motion`); `Reveal`/`ScrollTrigger` remains correct for
  in-flow content, just not fixed-position chrome.
- Verified via Playwright at 1440px desktop and 390px mobile, both
  no-preference and `prefers-reduced-motion: reduce`, across all three
  pages (`/`, `/design-system`, `/design-system/type`).

## Module 19 (Product Design System) — Phase 2 of 8, checkpoint reported

Marketing site, per the founder's ambition-raised brief: judged against
dayos.com/tasteskill-class landing pages, not "clean minimal." Full
scroll-driven storytelling (GSAP ScrollTrigger reveals throughout, one
signature WebGL moment in the hero), mandatory real imagery (device-mockup
frames around actual screenshots of the seeded "Northline Goods" store —
no stock photos, no lorem ipsum), and the full page set: homepage,
pricing, about, careers, legal.

**Infrastructure first** — native Postgres/Redis dev stack stood up, the
Module 21 simulation CLI (`apps/api/scripts/simulate/`) run to seed a
realistic demo store ("Northline Goods"), then real dashboard/storefront
screenshots captured through a local Host-header-spoofing reverse proxy
(Playwright/Chromium can't override the protected `Host` header directly
for navigation) and cropped into `apps/web/public/marketing/`.

**Homepage** (`apps/web/app/page.tsx`, fully rewritten) — nav → hero
(`Hero3D.tsx`: raw WebGL1, no Three.js, a small confined noise-gradient in
ink/accent tones behind the headline, gated behind `IntersectionObserver`
+ `prefers-reduced-motion` + WebGL-availability checks, always mounted
*behind* a static SVG gradient fallback that's the real LCP candidate) →
social proof (`LogoStrip`) → problem→solution narrative → a pinned
horizontal-scroll feature-card rail (`HorizontalScrollCards.tsx`,
gsap-animations pattern 6) → real-screenshot product showcase
(`DeviceMockup` × 3) → templates teaser → stat counters → live `/plans`
pricing → testimonials (explicitly labeled placeholder — no fake company
names presented as real) → FAQ → final CTA band → footer. `/pricing`
rebuilt the same way (live `/plans` across Individual/Team/Supplier, own
FAQ set).

**New marketing primitives** (`apps/web/components/marketing/`):
`MarketingNav` (scroll-shrinking glass pill), `MarketingFooter`,
`SectionTitle`, `FeatureCard`, `PricingCard`, `TestimonialCard`,
`FAQAccordion`, `StatCounter` (GSAP count-up), `DeviceMockup`,
`ImageStack`, `LogoStrip`, `HorizontalScrollCards`, `AbstractGraphic`
(code-generated SVG gradient mesh/dot grid built from the token file's own
CSS custom properties, never a stock asset).

**`/about`** — mission/values/stats shell in the same design language,
final CTA into `/careers`.

**`/careers`** — the founder flagged this had a real, unused backend
(`GET /careers`, `POST /careers/:id/apply` — Module 22 Phase B, no auth).
Built the public listing against it plus an apply-with-CV dialog
(`Dialog` primitive, multipart `FormData` upload) rather than placeholder
copy — verified end-to-end against two seeded job postings.

**`/legal/[slug]`** — renders the real drafts already in `docs/legal/*.md`
(terms-of-service → `/legal/terms`, privacy-policy → `/legal/privacy`,
refund-policy → `/legal/refund-policy`, plus the two growth/verified-store
terms docs at their own filename slugs) through a small purpose-built
markdown renderer (`apps/web/lib/legal-markdown.tsx` — headings/
blockquote/list/bold/inline-code only, the actual subset those five
documents use; a full markdown library would be a dependency for a
problem five small, structurally-simple documents don't have). Reads the
on-disk drafts directly rather than through the `ContentPage` API
(FR-12.1) — these are still counsel-unreviewed drafts (each carries its
own "DRAFT — NOT LEGAL ADVICE" banner, preserved verbatim), not
admin-editable copy yet; wiring them into the live content-page system is
future work once counsel signs off.

**Color A/B** (`/design-system/color-ab`, not linked from nav/footer) —
the founder's requested comparison: hero + one more section rendered
twice, the shipped monochrome default against a warmer "energy" accent
(`#ff4d1c`, `[data-marketing-theme="energy"]` in `globals.css` — same
scoped-CSS-variable mechanism already proven by the dashboard-theme
presets a few sections up in this file). `Hero3D` took an optional
`accentHex` prop (default unchanged) so the WebGL shader's hardcoded
uniform can mirror whichever accent the wrapping scope is using. A
screenshot-comparison surface only — the shipped homepage's code has no
A/B toggle logic.

**Bug found and fixed during this pass**: `PricingCard`s inside a `Reveal
stagger` on `/pricing` stayed permanently stuck at `opacity: 0` even after
a real scroll. Root cause: `.transition-smooth(-fast)` (used by the CTA's
own hover/press feedback) sets `transition-duration`/`-timing-function`
but never `transition-property`, which defaults to `all` — including
`opacity`/`transform`, the exact two properties GSAP's reveal tween
drives. The CSS transition engine and the tween fought over ownership of
those properties and the reveal lost permanently. Fixed inside
`Reveal.tsx` only (`gsap.set(targets, { transition: "none" })` before the
tween, `clearProps: "transition"` in `onComplete`) rather than at the
`.transition-smooth` utility level — scoping that utility's
`transition-property` away from `transform`/`opacity` would have silently
undone transform-based hover/press feedback on Button, PricingCard's CTA,
FAQAccordion, MarketingNav's CTA, and the homepage's own CTAs (confirmed
by grep before choosing the fix site). Verified against the isolated
repro, the real `/pricing` page, and the homepage's own pricing section,
all now correctly settling at `opacity: 1`.

**Also fixed**: `next/image`'s optimizer makes an internal re-entrant
request for local images that was getting caught by the multi-tenant
storefront rewrite in `middleware.ts`; added `marketing` to the exclusion
matcher (already excludes `_next`/`favicon.ico`/etc.) alongside installing
`sharp` (a hard requirement for Next 14's image optimizer, not just a
recommendation).

**Deliberately out of scope for Phase 2:** Phases 3-8 (auth/onboarding,
dashboard core + remaining, buyer storefronts, admin terminal, final
pass); wiring the legal drafts through `ContentPage` (pending counsel
review); a real markdown library (five small documents don't need one).

Verified via Playwright at 1440px desktop and 390px mobile, plus a
`prefers-reduced-motion: reduce` pass, across `/`, `/pricing`, `/about`,
`/careers`, `/legal/terms`, and `/design-system/color-ab` — full-page
screenshots use genuine incremental scroll (`page.mouse.wheel()`), not
just reduced-motion emulation, since native image lazy-loading and
ScrollTrigger reveals only fire on a real scroll.

## Module 25 (Admin Terminal Completion) — built (P0 + P1 + P2)

Founder-directed, not an SRS-FR-driven module — triggered by a completeness
audit (research-only, no code) evaluating every admin capability against
"a solo founder operating the entire platform daily with zero developer
intervention." The audit found: 10 of 16 admin queues were API-only (no
frontend page); 0 of ~90 Settings Registry keys had a write UI (read-only
list only); no admin HOME page, no global search, no unified per-seller
view, no system status page, no admin notification center existed; and
four seller-facing money-write endpoints had never been wired to the
`@BlockDuringImpersonation()` mechanism Module 17 already built. Founder
approved the full P0+P1+P2 gap-table scope as one module, sequenced
P0-first, with a checkpoint report after P0. New
`apps/api/src/admin-completion/` module (`AdminCompletionModule`).
Migration `20260726090000_module25_admin_completion`.

- `AdminOverviewService`/`AdminOverviewController` (`GET admin/overview`)
  — today's signups/orders/GMV (fresh "today" filtering) plus every
  pending-queue count, each with a jump-link. All-time GMV/revenue/
  active-store count reuse `UnitEconomicsService.computeRealTimeAnalytics()`
  as-is (FR-8.10, already built Module 17) rather than a second analytics
  engine. Every queue count mirrors the exact filter its own admin page
  already uses (e.g. `moderationStatus: "pending"`, `status:
  "pending_review"`) — a fan-out, not a second copy of any business rule.
- `AdminSearchService`/`AdminSearchController` (`GET admin/search?q=`) —
  partial name/email/ID across sellers/stores/orders/suppliers. Built on
  raw `$queryRaw` + `Prisma.sql` (this codebase's existing precedent from
  `StorefrontService`'s ranked full-text search), not the Prisma query
  API's typed `contains` filter — a `@db.Uuid` column has no native
  Postgres `LIKE` support without an explicit `::text` cast, which the
  typed API can't express.
- `AdminSellerOverviewService`/`AdminSellerOverviewController` (`GET
  admin/sellers/:id/overview`) — the seller-360 page's data source.
  Aggregates across every module that already holds a slice of "this one
  seller's data" (profile+`WalletService`+`InvoicesService`+
  `StoreHealthScoreService`+`TrustSafetyMonitorsService`+`SessionService`+
  `ProgramParticipant` rows) rather than a new denormalized table. T&S
  flags are filtered client-side (in the service) from the existing
  monitor methods' full-list results by `sellerId` — those methods have
  no per-seller query parameter, and adding one would have meant touching
  Module 12's already-shipped, already-tested T&S code for a read this
  module can get more simply by filtering. The timeline merges
  `AdminAuditLog` (`targetId: sellerId`) with `PlatformEvent`
  (`entityId: sellerId`), sorted together, rather than a new audit
  concept.
- `SettingsAdminController` gained `GET admin/settings/resolve` — walks
  the same `PRECEDENCE` order `SettingsService.resolve()` already uses,
  but returns every allowed scope's own row (or its absence) instead of
  stopping at the first hit, plus each row's `updatedBy` resolved to the
  acting admin's email. The write UI's client-side validation
  (type-check + `min`/`max`) mirrors `SettingsService.validateValue()`'s
  server-side rules exactly, so a rejected value never round-trips to
  the API only to bounce.
- `WalletService.adminManualAdjust()` — the seller-360 page's "adjust
  wallet" action. Two new `LedgerEntryType` values
  (`admin_manual_credit`/`admin_manual_debit`) wired into `WalletService`'s
  `DEBIT_TYPES`/`CREDIT_TYPES` sets and `labelFor()`, per Module 20's own
  documented invariant (the one place that knowledge lives). New endpoint
  `POST admin/wallet-topups/sellers/:sellerId/adjust` on the existing
  `AdminWalletController` (billing module already owns `WalletService`,
  avoiding a new cross-module import).
- **Genuine gap closed, not just new-module scope:** the audit's research
  phase discovered `POST sellers/me/wallet/topup-requests`, `POST
  sellers/me/subscription/change`, `POST
  sellers/me/subscription/redeem-promo`, and `POST
  sellers/me/growth-programs/withdrawals` had shipped in earlier modules
  without the `@BlockDuringImpersonation()` + `ImpersonationWriteGuard`
  pair Module 17 built specifically for this class of endpoint (mark-
  as-paid and payment-instruction changes already had it). All four now
  carry it — a one-line addition per endpoint, reusing the exact existing
  mechanism rather than building a parallel one (an earlier draft of this
  module did build a redundant ad-hoc guard before this was discovered
  mid-build and reverted).
- Frontend: shared `apps/web/app/(admin)/admin/layout.tsx` (nav sidebar
  linking every existing + new admin page — this section had no shared
  layout or nav at all before) and `apps/web/lib/admin-api.ts` (a shared
  fetch wrapper mirroring the seller dashboard's `dashboard-api.ts`,
  since every admin page before this hand-rolled its own
  `localStorage.getItem("adminAccessToken")` + header plumbing). Three
  new pages: `/admin` (home), `/admin/search`, `/admin/sellers/[sellerId]`
  (seller-360). `/admin/settings` substantially rewritten for the write
  UI described above.

Tests: `module25-admin-completion.e2e-spec.ts` (6 tests) - the overview
endpoint reflecting a same-day signup and a pending top-up in its queue
counts; global search finding a seller/store/order/supplier each by a
partial substring (name, email, and a partial-UUID match for the
seller); the seller-360 endpoint's every section present and correctly
scoped; the settings-resolve endpoint reporting the correct winning
scope/effective-value/last-changed-by after a seller-scoped override;
the wallet-adjust action's both directions plus its two rejection cases
(zero amount, missing reason) plus an audit-log-row assertion; and all
four newly-decorated endpoints returning 403 under an impersonation
token.

### Module 25 P1/P2 (built, continuation of the same module)

**Frontend for the 8 previously API-only surfaces.** All 8 pages call
already-built, already-tested backend endpoints (this phase found no new
FR-level gap to close in them):
- `apps/web/app/(admin)/admin/growth-programs/applications/page.tsx`,
  `.../content-submissions/page.tsx`, `.../withdrawals/page.tsx` —
  three admin queue pages for Module 22's growth-partner-programs
  backend. The applications page only offers approve/reject
  (`ProgramApplicationService.listQueue()` returns `pending` rows only —
  suspend/terminate on an already-approved participant has no queue to
  render it in, so those two actions were added to the seller-360 page
  instead, alongside a clawback form using `POST
  admin/growth-programs/withdrawals/sellers/:sellerId/clawback`).
- `apps/web/app/(admin)/admin/careers/page.tsx` — job postings CRUD +
  an expandable per-posting applicant pipeline (status dropdown per
  applicant, CV link) — applicant PII only ever rendered here.
- `apps/web/app/(admin)/admin/commission-invoices/page.tsx` — the real
  commission/group-sponsorship invoice list (`GET admin/invoices`,
  `AdminInvoicesController` — already existed and was already correct;
  only the frontend screen was missing) with mark-paid + waive-commission
  actions. This resolves the founder's "fix the `/admin/invoices`
  mislabeling" item: `/admin/invoices` (`apps/web/.../admin/invoices/`)
  was already correctly Module 20's wallet-top-ups screen (the nav
  already labeled it "Wallet top-ups") — the actual gap was the missing
  commission-invoices screen, now filled by this new page at a distinct
  route rather than reusing the `/admin/invoices` path.
- `apps/web/app/(admin)/admin/supplier-adapters/page.tsx` — list/
  register/enable-disable/reconfigure (JSON config textarea) against
  `SupplierAdapterRegistryService`.
- `apps/web/app/(admin)/admin/audit-log/page.tsx` — read-only list view
  over `AuditLogService.listRecent()`; no write actions exist to render
  (the table is insert-only by DB grant).
- Admin-granted-plan + platform promo codes — added as two new forms to
  the existing `apps/web/app/(admin)/admin/plans/page.tsx` rather than a
  new page (`POST admin/sellers/:sellerId/plan`, `POST
  admin/promo-codes`).
- `apps/web/app/(admin)/admin/categories/page.tsx` — category list +
  create form against `categories.controller.ts` (list needs
  `JwtAuthGuard` not `AdminAuthGuard`, but an admin's JWT satisfies a
  plain passport-jwt guard the same as any other authenticated user's).
- T&S self-referral monitor panel — added as a new table section to the
  existing `apps/web/app/(admin)/admin/trust-safety/page.tsx` (the
  backend endpoint, `GET admin/trust-safety/monitors/self-referral`,
  already existed from Module 22 with no UI consumer until now).

**System status page** (`apps/api/src/admin-completion/
admin-system-status.service.ts` + `.controller.ts`, `GET
admin/system-status`, `/admin/status`) — genuinely new instrumentation:
`Promise.all` across a DB `SELECT 1`, a Redis `PING`, a new
`ObjectStorageService.checkReachable()` (`HeadBucketCommand`, never a
full bucket listing), and `getJobCounts()` against 12 read-only BullMQ
`Queue` clients (one per existing scheduler's queue name constant,
opened in `onModuleInit`/closed in `onModuleDestroy`, same construction
pattern every scheduler already uses — this service is never a worker).
Email delivery failures and backups are disclosed stub lines rather than
fabricated: `EmailService` has no real provider in this environment
(console-log fallback only, throws for anything else configured), and
the founder explicitly authorized a "backups: not yet configured" line
until the OPS Security Hardening pass lands.

**Admin notification center** (`admin-notifications.service.ts` +
`.controller.ts`, `GET admin/notifications`, `POST
admin/notifications/mark-seen`) — a new `AdminUser.
lastSeenNotificationsAt` column (migration
`20260726150000_module25_p1_notification_center`) plus a diff of every
row-based admin queue (wallet top-ups, Verified Store applications,
moderation, growth-program applications/content/withdrawals, career
applicants) created since that timestamp. Deliberately excludes the T&S
monitor views the HOME overview already surfaces — those are
live-computed aggregates with no per-row creation timestamp, so "new
since last seen" doesn't apply to them. Frontend: a badge + dropdown in
`apps/web/app/(admin)/admin/layout.tsx`'s shared nav.

**Bulk actions** — checkbox multi-select on the moderation queue
(`apps/web/app/(admin)/admin/moderation/page.tsx`) and wallet top-ups
(`apps/web/app/(admin)/admin/invoices/page.tsx`), each with "approve/
reject selected" or "verify/reject selected" firing `Promise.all` across
the existing single-item endpoints — no new bulk backend endpoint,
since each underlying action was already idempotent and already
audit-logged individually.

Tests: `module25-admin-completion.e2e-spec.ts` gained a new "Module 25
P1" describe block (10 tests) covering the two surfaces that had NO e2e
coverage anywhere before this phase (Creator content-submission verify/
reject including the reward computation and its audit-log row; category
creation), plus new coverage for the supplier-adapter registry's CRUD,
the audit-log list endpoint's ordering/limit, the system status
endpoint's three infra checks + queue-count shape, and the notification
center's create-then-see / mark-seen-clears-it / new-row-reappears flow.
Every other endpoint the 8 new pages call was already covered by its own
module's e2e spec (careers: `module22-careers.e2e-spec.ts`;
growth-programs applications/withdrawals/clawback:
`module22-growth-partner-programs.e2e-spec.ts`; admin-grant-plan/
promo-codes: `plans-pricing.e2e-spec.ts`) and was not re-tested here.

## Module 24 (Seller Data Export to Personal Cloud Storage) — built

Full scope: `docs/SRS.md` §5.36 (FR-36.1-36.5), checklist §14.36. New
`apps/api/src/data-export/` module (`DataExportModule`). Migration
`20260725090000_module24_seller_data_export`.

- `DataExportService` — owns its own BullMQ queue (`data-export`,
  `DataExportService.onModuleInit()`/`onModuleDestroy()` construct/close
  it directly, same pattern as `ImportJobsService`, not a separate
  Scheduler class). `enqueue()` computes `periodStart` from the seller's
  last **completed** export (or the seller's `createdAt` if none exists)
  through `periodEnd = now`, then creates a `pending` `SellerDataExport`
  row and queues a job carrying only its ID — the worker resolves
  everything else from the row (`processExport(exportId)`, matching every
  other per-job processor in this codebase).
- Two triggers (FR-36.1): `triggerRenewalExport(sellerId)`, called from
  the worker's `plan-fee-debit` processor for each ID in
  `PlanFeeDebitService.runMonthlyDebitSweep()`'s new `renewedSellerIds`
  return value (never a direct `BillingModule` -> `DataExportModule`
  import — that edge would complete a real cycle through `MediaModule` ->
  `AuthModule` -> `GrowthProgramsModule` -> `BillingModule`, so the
  cross-service call is deliberately pushed to the worker's
  `NestApplicationContext` orchestration layer instead, which can resolve
  either service regardless of which module structurally imports which);
  and `requestOnDemandExport(sellerId)`, rate-limited to once per
  `data_export.on_demand_min_interval_hours` (Settings Registry) via a
  rolling check against the export table's own most recent `createdAt` —
  not the existing fixed-clock-hour `RateLimitService`, which is a
  differently-shaped limiter.
- `generateBundle()` — fresh, date-ranged queries across **all** of the
  seller's stores (the trigger is per-seller; `Subscription.sellerId` is
  `@unique`, so a seller has exactly one renewal cycle regardless of
  store count) for products/orders/customers, written via `toCsv`
  (FR-18.2's existing primitive) into three CSVs. Deliberately a fresh
  code path rather than an extension of the single-store, no-date-filter
  `CsvExportService` — extending it risked regressing its already-shipped
  FR-18.2 behavior for a different concept.
- Summary PDF: `InvoicePdfService.renderToBuffer(html): Promise<Buffer|null>`
  (new) renders the existing Playwright pipeline to a buffer without
  uploading, so `DataExportService` can upload it once via
  `ObjectStorageService.putObject()` and reuse the same buffer for the
  Drive-upload path — avoids the wasteful double-render an earlier draft
  had (render-and-upload, then re-render for the in-memory buffer).
- Delivery (FR-36.3): `DriveConnectionsService.canUploadExports()` gates
  on the new `DRIVE_FILE_SCOPE` (`drive.file`) being present in
  `GoogleDriveConnection.grantedScopes` — connections made before this
  module only have `drive.readonly` and correctly degrade to email rather
  than attempting an upload the grant can't support.
  `ensureExportFolderId()` creates (once) a dedicated app-owned folder via
  the new `IDriveClient.createFolder`/`uploadFile` methods; a Drive
  upload failure mid-flight (revoked token, API error) falls back to
  email rather than leaving the export undelivered.
- Non-blocking guarantee (FR-36.4): `processExport()` wraps its entire
  body — including the initial `SellerDataExport` row lookup — in one
  try/catch; any failure records `status: "failed"` + `failureReason` on
  the row (itself wrapped in a no-op `.catch()`, so even a doubly-broken
  export can't propagate). `triggerRenewalExport()` additionally wraps
  its own enqueue call so a queueing failure can never affect the
  renewal that triggered it.
- Seller-facing UI: a "Data export" card on the store Settings page —
  request-on-demand button plus per-file download links, per the
  security fix below.

**v0.28 security fix (same day, before the checklist could be approved
final):** the first draft stored export bundles — customer-PII-bearing
CSVs and a summary PDF — as plain, permanent, unsigned public MinIO
URLs, following the existing (but here-inappropriate) pattern every
other file link in this app uses. Migration
`20260725100000_module24_security_private_exports` renames
`SellerDataExport`'s `*CsvUrl`/`summaryPdfUrl` columns to
`*CsvKey`/`summaryPdfKey`; every export file now writes under a
`private-exports/` object-storage prefix that is never returned as a
public URL. The sole read path is a new endpoint,
`GET sellers/me/data-export/:exportId/download/:file`
(`JwtAuthGuard` + an ownership check — a non-owner's ID gets 404, not the
file), streaming bytes via a new `ObjectStorageService.getObject()`
(`GetObjectCommand` + a stream-to-buffer helper). `listOwn()` now maps to
a safe DTO (`hasProductsCsv`/`hasOrdersCsv`/`hasCustomersCsv`/
`hasSummaryPdf` booleans, no key/URL fields at all) so the raw storage
key can never leak through the history endpoint either. The email
fallback (`EmailService.sendDataExportReadyEmail`) now links to
`${APP_BASE_URL}/login` instead of a file URL — the seller logs in, then
opens the dashboard's Data export card, which now renders a "Download"
link per file that fetches the bytes with the same Bearer-token auth
every other dashboard request uses (`dashboard-api.ts` gained a
`download()` helper returning a `Blob`, since a plain `<a href>` can't
attach an Authorization header) and triggers the browser's save flow via
a short-lived blob object URL. Google Drive delivery is entirely
unaffected — that path never touched a public URL to begin with.
**Flagged, not fixed:** `Order.invoicePdfUrl` shares the original
plain-public-URL pattern; lower severity (one buyer's own order vs. a
seller's full customer/order list) and deliberately left out of scope
here — see `docs/SRS.md` §14.19's new hardening note.
**Disclosed limitation:** the fix guarantees the *application* never
emits a fetchable raw link (proven by e2e test — the list response's
serialized JSON contains neither the prefix nor anything URL-shaped); it
cannot prove a direct HTTP GET at the underlying MinIO object is
rejected, since that depends on the production bucket policy denying
anonymous reads on `private-exports/`, which the e2e test double
(`s3rver`) doesn't model realistically. Added as a required, verifiable
step to `docs/launch-runbook.md`.

Tests: `module24-seller-data-export.e2e-spec.ts` (7 tests) - a real
subscription renewal producing an export whose three CSVs and one PDF
each contain exactly the trailing-period rows, fetched via the
authenticated download endpoint; an on-demand request inside the
rate-limit window correctly rejected with no new row created; a
Drive-connected, upload-scoped seller's files landing in Drive (verified
against the fake `IDriveClient`'s recorded calls) with the email
fallback's link spied and asserted to be a login link, never a raw
storage reference; a connection made under the old `drive.readonly`-only
scope correctly falling back to email; a forced failure against a
nonexistent export ID proven not to throw, with the triggering renewal
itself unaffected; the list/history response's JSON proven to never
contain the private-exports prefix or a URL; and the download endpoint
proven to reject an unauthenticated request (401) and a non-owning
seller's token (404) while accepting the true owner's (200).

## Module 15 (Customers, Reviews & Data Portability) — built

Full scope: `docs/SRS.md` §5.13 (FR-13.1-13.3), §5.14 (FR-14.1-14.4), §5.18
(FR-18.1-18.3), §5.19 (FR-19.1-19.3), checklists §14.13/§14.14/§14.18/§14.19
(all checked except FR-19.2's founder sign-off, which cannot be self-
certified). New Prisma migrations `20260719070000_customers_reviews_data_portability`
and `20260719120000_import_jobs` — both RLS-enabled (`..._seller_isolation`
policies, same store_id-through-stores-subquery pattern since Module 2).

1. **Customers CRM (FR-13.1-13.3).** `CustomersService.findOrCreateForOrder()`
   runs inside `CheckoutService.placeOrder()`'s existing transaction — one
   insertion point covers both storefront and manual (FR-17.1) order
   sources. Per the Financial Truth Invariant (§3.12), the customer row is
   created/matched at order *placement*, but `orders_count`/`total_spent`
   only increment at payment *confirmation* (`OrdersService.markAsPaid()`),
   the same split every other financial write in this codebase already
   uses. Dashboard list (search/sort by spend/order count) + detail (order
   history) screens built.
2. **Product Reviews & Ratings (FR-14.1-14.4).** New `ProductReview` model.
   Public submission endpoint keyed by the order-status token (FR-5.4),
   no account; `is_verified_purchase` requires both a real order reference
   *and* `order.status === 'confirmed'` (Financial Truth Invariant again —
   a still-pending order is not yet a real purchase). Seller moderation
   (approve/hide) recomputes `Product.averageRating`/`reviewCount` (fields
   pre-scaffolded since Module 2, never written to until now) immediately
   after every status change.
3. **PDF invoices (FR-19.1-19.3).** `InvoicePdfService` renders the one v1.0
   template (HTML/CSS via `invoice-template.ts`) to PDF with a headless
   Chromium worker (Playwright, per `docs/tech-stack.md`'s pinned choice),
   generated once at order-placement time (same moment the confirmation
   email already sends) and cached on `Order.invoicePdfUrl` — never
   regenerated. Tax itemized correctly for both inclusive/exclusive store
   settings. Best-effort: a rendering failure never blocks the order itself
   (same discipline as `EventsService`, FR-26.3). **Flagged decision:** no
   store-logo-upload capability exists anywhere in the platform, so the
   "branded" header is the store name in a designed typographic mark, not
   an uploaded image — see `docs/SRS.md`'s v0.21 changelog note.
4. **CSV import/export (FR-18.1-18.3).** New `ImportJob` model (schema
   already fully pre-specified in `docs/database-schema.md`, unused until
   now) tracks all three job types. Import: an uploaded Shopify-format CSV
   is parsed (`csv-parse`, per `docs/tech-stack.md`) by a pure, unit-tested
   grouping function (`parseProductImportCsv` — Shopify repeats a
   product's `Handle` across one row per variant/image), then processed as
   a BullMQ background job (`ProductImportService`, new `product-import`
   queue/worker) that reuses `ProductsService`/`ProductVariantsService`
   directly so an imported product passes through the exact same
   moderation/plan-limit gates a manually-created one does — CSV import is
   never a way around them. A bad row is logged to `error_log` and skipped,
   never failing the whole import. Unmapped CSV columns are surfaced
   explicitly, never silently dropped. **Flagged decision:** the CSV's
   `Image Src` is stored as-is (hotlinked via a new `MediaSource.csv_import`
   enum value), never fetched server-side and re-hosted into MinIO —
   fetching an arbitrary seller-supplied URL from the backend would be an
   SSRF vector this importer deliberately avoids. Export (products, orders)
   runs synchronously (FR-18.2's "background job" requirement is scoped to
   import specifically) and produces the same core-field CSV shape the
   importer reads, so a self-export round-trips through this platform's
   own importer.
5. **Gap discovered and closed: the buyer order-status page.** FR-19.1
   (invoice download link) and FR-14.1 (review submission) both hard-depend
   on the buyer order-status page (FR-5.4) existing — it turned out **no
   such page was ever built in `apps/web`**, despite being scoped into
   Module 11's own prerequisite fix. Built the minimal page now
   (`app/storefront/order-status/[token]/page.tsx`): status, items,
   totals, payment instructions, invoice download link, and the review
   form. The review form submits through a Next.js Server Action
   (`app/storefront/order-status/actions.ts`), not a direct client-side
   fetch to the API — a tenant storefront's dynamic subdomain/custom domain
   can never be pre-listed in the API's static `CORS_ALLOWED_ORIGINS`
   allowlist, so the submission has to be a server-to-server call, same
   reasoning as every other storefront data fetch in this app already
   being server-side. **Not fixed here (separate, larger, still-open
   gap):** the storefront **cart and checkout pages** — Module 9's
   cart/checkout APIs are fully built and tested, but no `apps/web`
   buyer-facing cart/checkout UI was ever built either. Needs its own
   founder decision on which module absorbs it.

Tests: 5 unit tests (`product-import.util.spec.ts`, the CSV-grouping pure
function) + 10 e2e tests (`module15-customers-reviews-data-portability.e2e-spec.ts`)
covering all four FR blocks plus tenant isolation. Full suite (108 unit +
224 e2e across all 26 e2e files) passes. Frontend verified live against a
real running API + MinIO stand-in + headless-Chromium: seller dashboard
screens (Customers, Reviews, Import & export) and the buyer order-status
page were all exercised end-to-end in an actual browser (checkout → PDF
invoice generated and downloadable → review submitted via the real form →
visible in the seller's moderation queue; CSV uploaded → job processed →
product/variant/media created and visible in the Products list).

## Module 15.5 (Storefront Buyer Purchase Flow & Store Branding) — built

Founder approved Module 15's checklist and, in the same approval, slotted
the flagged buyer-storefront-UI gap as a new **Module 15.5**, built
immediately — before Module 18 (External-SaaS Bridges) — since it's
launch-blocking (nothing sells without it). Store logo upload bundled
into the same module's scope (a second small gap Module 15's invoice
template surfaced). Full spec: `docs/SRS.md` §5.32/FR-32.1-32.5, checklist
§14.32 (all checked). FR-19.2's invoice-template founder sign-off stays a
separate, explicit item — added to `README.md`'s founder pre-launch
verification list per the founder's own instruction, not folded into this
module. New Prisma migration `20260719140000_store_logo` (adds
`stores.logo_media_id`, FK to `media_assets`, no new RLS policy needed —
it's a column on an already-RLS-protected table).

1. **Store logo upload (FR-32.5).** `StoresService.setLogo()`/`.removeLogo()`
   reuse the existing `MediaAssetsService.uploadDirect()`/`.remove()`
   pipeline (Module 2's quota-metered upload) rather than a new upload
   path; replacing a logo best-effort cleans up the previous object.
   Consumed by `GET /stores/:id` (dashboard), the public
   `GET /storefront/store` endpoint, and `InvoiceData.logoUrl` (the invoice
   header renders the logo image in place of the typographic store-name
   mark). **Flagged decision:** not wired into transactional emails —
   `EmailService` (Module 1) is a deliberately plain-text-only placeholder
   with no HTML template surface to place an image into; FR-32.5's own
   wording ("wherever each surface can practically render an image")
   anticipates exactly this boundary. Real HTML email wiring is deferred to
   when a real email provider is integrated. `SiteHeader`'s pre-existing
   latent gap (it rendered nothing at all when a store had no header
   navigation configured, meaning no brand identity ever showed) was fixed
   as a prerequisite for the typographic fallback to have anywhere to
   render.
2. **Buyer purchase flow (FR-32.1/32.2/32.3).** FR-15.1's email-first lock
   (`POST /storefront/cart` hard-requires `buyerEmail`) means a cart can
   only be persisted server-side once email is captured — so "add to cart"
   on the product page is purely client-side (`lib/local-cart.ts`, a
   `localStorage` cart namespaced per storefront hostname) until checkout's
   email step. Built: product-page add-to-cart, `/cart` (view/edit/remove,
   reactive to local-cart changes), `/checkout` (two-step: email only, then
   shipping address + optional discount code — no shipping/payment field is
   ever shown before email), and `/order-confirmation/[token]`. The
   confirmation page reuses the existing `fetchStorefrontOrderStatus()`
   fetch (keyed by the order's `statusLookupToken`) rather than a second
   totals calculation — zero new backend surface, and no risk of the UI's
   numbers drifting from `computeOrderTotals`'s. Payment framed as "pay the
   seller directly... once they confirm receipt, your order moves to
   confirmed" (direct-collection framing, never implying the platform holds
   payment); the confirmation page shows a `pending` order as "awaiting
   payment", never "paid"/"confirmed" (Financial Truth Invariant, §3.12).
   All buyer-facing API calls route through Next.js Server Actions
   (`app/storefront/checkout/actions.ts`), never a direct client-side fetch
   — same CORS reasoning as Module 15's review-submission form (a tenant's
   dynamic subdomain/custom domain can never be pre-listed in the API's
   static CORS allowlist). A small cart-count link (`CartLink`, reads
   `window.location.host` client-side) was added to `SiteHeader` for buyer
   discoverability.
3. **Tenant isolation.** Unchanged from Module 9's own cart/checkout
   tenant-isolation guarantees (`hostname` resolves to exactly one store;
   `PrismaAdminService` reads are always scoped by that store's id) — this
   module's UI calls into those endpoints as-is, adding no new
   cross-tenant surface.

Tests: 3 new unit tests (`invoice-template.spec.ts`, the logo/fallback
rendering) + 3 new e2e tests (`module15.5-storefront-branding.e2e-spec.ts`:
logo upload/replace/remove round-trip through both the dashboard and public
storefront endpoints, cross-tenant logo isolation, and logo-plus-checkout
integration). Full suite (111 unit + 227 e2e across all 27 e2e files)
passes. Frontend verified live against a real running API + a standalone
s3rver stand-in for MinIO + headless Chromium: full buyer journey exercised
end-to-end in an actual browser — logo uploaded via store settings and
confirmed rendered, add-to-cart on the product page, cart page showing the
item, checkout's email-first step verified to show no shipping field before
email, shipping step, order placed, confirmation page showing the honest
"awaiting payment" status and linking correctly to the order-status page,
and the storefront header showing the uploaded logo.

## Module 18 (External-SaaS Integration Hooks) — built

Full scope: `docs/SRS.md` §5.24/FR-24.1-24.14 + FR-8.14, checklist §14.22
(all checked). Both hooks are goto5x.com's own side only, per the founder's
own binding instruction — the Template Store and Social Media SaaS
themselves are never built, mocked, or assumed beyond what §5.24 specifies.
New Prisma migration `20260719160000_external_saas_hooks`
(`external_api_clients` — global registry, mirrors `supplier_adapters`;
`template_entitlements`/`seller_api_tokens` — seller-scoped directly, RLS
with a direct `seller_id = ...` predicate, same shape as
`google_drive_connections`).

1. **Template Install/License API (FR-24.3-24.7).** `POST
   /external/template-store/install` and `.../revoke`, both verified via an
   HMAC-SHA256 signature (`external-api/signature.util.ts`) over the exact
   raw request bytes (`app.rawBody`, enabled in `main.ts`) plus a 5-minute
   replay-tolerance timestamp — never a re-serialized/re-parsed body, which
   could silently differ from what was actually signed. A `themes` row is
   matched by `(name, version)` — the Template Package Spec's own manifest
   identity — reused if it already exists, created as `tier: marketplace`
   otherwise; `template_entitlements` grant/revoke is an upsert (idempotent
   re-install, correct re-grant after a prior revoke). Every grant/revoke is
   audit-logged as a system actor (`adminUserId: null`), with a
   `referralAttributed: true` marker folded into the same write (FR-24.13 -
   no second log entry). Import-only (FR-24.4): no code path ever returns a
   downloadable template file.
2. **Product Feed API (FR-24.9-24.11).** `GET
   /external/social-media/product-feed`, authenticated by a seller-scoped
   bearer token (`seller_api_tokens.token_hash`, SHA-256, reusing
   `auth/token.util.ts`'s existing "shown once" discipline) - not a second
   HMAC layer on top, since the token itself already proves origination for
   one specific, already-onboarded seller (disclosed design decision:
   layering client-level signing on top would be redundant complexity, not
   additional security). Tenant isolation comes from the same
   `TenantPrismaService.run(sellerId, ...)`/RLS mechanism every other
   tenant read uses — no hand-written `storeId` filter exists to get wrong.
   A revoked token, or a token whose owning `external_api_clients` row an
   admin has disabled (FR-8.14), is rejected on its very next use.
3. **Cross-SaaS discount eligibility (FR-24.14).** `GET
   /external/eligibility?sellerId=...`, client-level HMAC-signed (a GET has
   no body, so the canonical query string is the signed payload instead).
   Returns only `{ eligible: boolean }` — "is this seller on a paid plan"
   (`subscription.plan.tierOrder > 0`) — never discount terms.
4. **Marketing SSO handoff (FR-24.8).** `POST /sellers/me/marketing-handoff`
   mints a short-lived (5 min) JWT signed with the same `JWT_ACCESS_SECRET`
   every seller access token already uses — reusing §3.2a's existing SSO
   hook, not a second scheme — and records one referral-attribution audit
   entry per handoff (a seller navigating to Marketing is low-frequency,
   not per-request noise). `social_media_saas.marketing_handoff_base_url`
   defaults to empty, so the handoff is a documented 400 until the founder's
   Social Media SaaS actually exists and an admin configures it.
5. **External API client registry (FR-8.14).** Admin can register, enable,
   disable, and rotate the signing secret for either client
   (`admin/external-api-clients`), mirroring `SupplierAdapterRegistryService`
   exactly. The secret is AES-256-GCM encrypted at rest (new
   `EXTERNAL_API_SECRET_ENCRYPTION_KEY`, same mechanism/key-management
   discipline as the Drive refresh token and CNIC), shown to the admin in
   plaintext exactly once, at creation/regeneration.
6. **Closes a real, disclosed Module 4 gap (FR-24.5).** `themes.tier`'s
   plan-based gating had zero enforcement since Module 4 — the model's own
   doc comment: "no gating enforced yet — Module 11/14's job." Two premium
   themes ("Modern", "Minimal") already exist in the seed data, so this
   wasn't a hypothetical gap. New `theme.premium_tier_enabled` setting
   (default `false`, same "off for every seller in v1.0" precedent as
   `theme.coded_mode_enabled`) makes the premium-tier gate real;
   `StoreThemeSettingsService.update()` now checks it for `premium` themes
   and checks a live `TemplateEntitlement` for `marketplace` themes — the
   two gates are independent, exactly as FR-24.5 requires. The pre-existing
   Module 4 e2e test that selects "Modern" was updated to explicitly enable
   the setting first, since its own intent (settings persistence) isn't
   what it now needs to prove.
7. **Frontend.** Customizer: a "Premium templates" showcase card (FR-24.1/
   24.2, hidden entirely when `template_store.showcase_url` is unset — no
   hard dependency on the Template Store existing) and the theme dropdown
   marks a non-entitled marketplace theme "(locked - purchase required)".
   New "Marketing" dashboard section (FR-24.8/24.10): connect/list/revoke
   Social Media SaaS tokens, trigger the SSO handoff. New bare-functional
   admin "External API Clients" page (FR-8.14), same "no design pass yet"
   precedent as `/admin/plans`/`/admin/sellers`.

Tests: 9 new unit tests (`signature.util.spec.ts` — HMAC compute/verify,
tamper detection, replay-window edges) + 13 new e2e tests
(`module18-external-saas-hooks.e2e-spec.ts` — signed/unsigned/wrong-secret
install, disabled-client rejection, revoke isolation, the FR-24.5
independent-gates test, Product Feed tenant isolation + revoked/disabled
token rejection, seller token list/revoke, eligibility paid-vs-free +
unsigned rejection, SSO handoff configured/unconfigured + audit entry,
admin registry list/toggle). Full suite (122 unit + 240 e2e across all 28
e2e files) passes. Frontend verified live against a real running API + a
standalone s3rver stand-in for MinIO + headless Chromium: the customizer's
showcase panel and locked-theme state, the Marketing page's connect → token
shown once → list → revoke flow and the SSO handoff opening a correctly
signed URL in a new tab, and the admin registry's list/toggle, all
exercised end-to-end in an actual browser.

---

## v0.29 slotting decision — Order Verification, Orders Command Center,
and Inventory Management become three new sibling modules, in this order:
**Module 26 (Order Verification Channel Adapter, §5.37)** → **Module 27
(Orders Command Center, §5.38)** → **Module 28 (Inventory Management,
§5.39)**

Reasoning:

1. **Order Verification (Module 26) is the largest and most structurally
   independent of the three** — new models (`OrderVerification`,
   `SellerVerificationEmail`), a new encryption key, a new adapter
   interface with three implementations, and a real extension to the
   Financial Truth Invariant (§3.12) that every later module touching
   order state must respect. It goes first both because it's the
   founder's stated priority and because Modules 27/28 are easier to
   reason about once the "what counts as confirmed" surface is settled —
   building Command Center's bucket aggregation before Order Verification
   existed would mean redefining "awaiting-verification" as a bucket
   after the fact instead of designing it in from the start.
2. **Orders Command Center (Module 27) depends on Module 26 only for one
   new bucket label** (awaiting-verification) **and one new channel
   label** (prepaid-received) **— everything else it reads already
   exists** (`OrderStatus`, `OrderItemFulfillmentStatus`, the supplier
   fulfillment checklist from Modules 8/9). Sequencing it right after
   Module 26 means its bucket list is correct from day one rather than
   needing a follow-up migration once verification landed.
3. **Inventory Management (Module 28) is fully independent of both** — no
   shared code with either, reuses only already-built mechanisms
   (`stockQuantity`, existing oversell protection, Module 15's CSV import,
   Module 24's Data Export bundle). It's last because it's genuinely
   separable and, like Data Export was relative to Modules 22/23,
   the natural "quick win" to build whenever schedule pressure favors
   one — not because it matters less.
4. **All three ship bare-functional UI now, per the founder's explicit
   instruction** — premium visual treatment for all three is deferred to
   Module 19's dashboard design phase (Phase 4), the same "functional
   first, designed later" posture every module since the design system's
   founder-approval has followed. Module 27's backing aggregation
   endpoint is the one piece of this trio explicitly called out to ship
   now even though its frontend polish waits — the founder's own framing
   ("the data exists since Module 9, the consolidated screen doesn't").
5. **New standing process rule, effective this module onward (founder-
   directed):** each module auto-pushes to `origin` the moment it is
   genuinely push-ready — tests green, typecheck/build clean, its own
   §14 checklist verified — without waiting for a separate push
   instruction. `main` stays the single source of truth and must remain
   fresh-clone-runnable at all times; nothing ships half-done or with a
   failing suite.

### Module 26 (Order Verification Channel Adapter) — scope summary
`docs/SRS.md` §5.37, FR-37.1-37.9. New Prisma models: `OrderVerification`
(one row per order that needs verification — channel, OTP hash, expiry,
attempt count, status) and `SellerVerificationEmail` (a seller's connected
SMTP sender accounts, 1-5 per seller, credentials AES-256-GCM-encrypted
under a new `SMTP_CREDENTIAL_ENCRYPTION_KEY`, daily send-count tracking for
the rotation/cap logic). New `VerificationChannelAdapter` interface
(mirrors `TopUpAdapter`/`TitleVerificationAdapter`'s established one-
interface-per-integration-point shape) with three v1.0 implementations:
`WhatsAppOtpAdapter` (manual/link-assisted `wa.me` deep link),
`EmailOtpAdapter` (seller's own rotating SMTP senders), and
`PrepaidConfirmationAdapter` (manual "mark deposit received," mirroring
`OrdersService.markAsPaid()`'s existing shape). New Settings Registry keys
(`orders.verification_channel` — `store` scope — plus OTP TTL/cooldown/
retry-cap/daily-send-cap, all `global` defaults with `store` overrides
where the SRS specifies). Extends (never duplicates) the Financial Truth
Invariant: a store with verification enabled gates its orders' `confirmed`
transition on verification success, exactly as it already gates on
payment. Seller-facing UI: a Settings sub-screen for channel selection,
connected-email management, and the message template editor — bare
functional, no design pass.

### Module 27 (Orders Command Center) — scope summary
`docs/SRS.md` §5.38, FR-38.1-38.3. One new read-only aggregation endpoint
(`OrdersOverviewService`) computing live bucketed counts (pending,
awaiting-verification, prepaid-received, awaiting-tracking, shipped,
delivered, cancelled/returned) plus the existing supplier fulfillment
checklist, entirely derived from state Modules 8/9/26 already track — no
new Prisma model, no new source of truth. Bare functional frontend reuses
the existing `/stores/:id/orders` route, each bucket count linking into
the existing filtered order list; premium treatment deferred to Module 19
Phase 4.

### Module 28 (Inventory Management) — scope summary
`docs/SRS.md` §5.39, FR-39.1-39.7. New `StockAdjustment` model (append-
only: seller-account user, timestamp, before/after quantity, required
reason) — the only new schema in this module. New Settings Registry key
(`inventory.low_stock_threshold`, `store` scope). Bulk stock edits reuse
Module 15's existing CSV import machinery in a stock-only mode; the
inventory export reuses Module 24's `SellerDataExport` bundle via one new
`inventoryCsvKey` column, under FR-36.5's existing non-substitution
statement. No change to Module 9's checkout-time oversell-protection
decrement logic — this module is a read/adjust surface over the existing
`stockQuantity` field, never a second stock-mutation path. New dedicated
`/stores/:id/inventory` seller page (bare functional) + nav item, distinct
from the existing Products catalog page. **No third-party AI integration
anywhere in this module** (FR-39.7) — documented roadmap note only.

## v0.30 slotting decision — Tracking Timeline, Delivery-Time Badges,
WhatsApp Semi-Automation, Automated P&L Engine

1. **Module 27 absorbs the tracking-timeline ask rather than spawning a
   new module.** Investigated before writing the SRS amendment: role-
   based tracking upload (seller for self-fulfilled, supplier for their
   own, ownership-checked) has been fully correct since Module 8/9 — no
   rework needed there. The actual gap is that the public order-status
   page and the seller's order-detail view only ever showed a flat status
   string, never a stage timeline. Since Module 27 already owns the
   Command Center's order-state read surface, the timeline (§5.38's new
   FR-38.4-38.6) is the same kind of derived read and belongs in the same
   module, built from the same data.
2. **Delivery-Time Badges (Module 29) is nearly pure frontend.** Module
   8's delivery-estimate/supported-countries data is already computed
   per-request into `StorefrontService`'s `supplierShipping` payload
   field — it has simply never been rendered. No dependency on 27 or 28;
   slotted right after Inventory to keep momentum with a fast, low-risk
   module between two heavier builds.
3. **WhatsApp Semi-Automation (Module 30) depends on Module 27's tracking
   surface** (for the shipping-update trigger) and reuses Module 9/15.2's
   existing abandoned-cart flagging (write-only until now — this module
   gives it its first seller-facing list) and §5.37's WhatsApp OTP
   Adapter's exact `wa.me` link-construction pattern. One schema gap
   closed in passing: `Cart.buyerWhatsapp` was added in Module 26's
   migration batch but never wired to capture — it's needed now for
   cart-recovery messages.
4. **The Automated P&L Engine (Module 31) is placed last, after Inventory,
   per explicit founder instruction** — it reads cost data that lives
   naturally near inventory, and benefits from every other module's
   revenue/commission/discount data already being in place. It's the one
   genuinely new financial-data surface among the four; the other three
   are closer to "surface data/machinery that already exists."
5. **Build order: 27 (expanded) → 28 (unchanged) → 29 → 30 → 31.** Same
   standing rhythm as v0.29: SRS amendment first (done), build-plan
   updated (this section), commit/push docs, then build → verify → push
   automatically per module, never half-done or with a failing suite.

### Module 27 (Orders Command Center + Tracking Timeline) — scope summary
`docs/SRS.md` §5.38, FR-38.1-38.6. Bucketed order-state aggregation
(`OrdersOverviewService`) as originally planned in v0.29 — no change to
that scope. New in v0.30: a computed `placed → confirmed → shipped →
delivered` (+ cancelled) timeline derived from `Order.status`/
`Order.placedAt`/`OrderTimelineEvent`/`TrackingUpdate` — no new table,
no new upload path (both seller- and supplier-side `uploadTracking`
methods are reused verbatim). Rendered on both the public
`storefront/order-status/:token` page and the seller's order-detail view
from the same computed source, so the two surfaces can never drift.

### Module 29 (Delivery-Time Badges) — scope summary
`docs/SRS.md` §5.40, FR-40.1-40.3. No new schema, no new backend read —
`StorefrontService`'s existing `supplierShipping` field is already
attached to every product payload. Adds badge rendering to the storefront
product card and product detail page, shown only when `supplierShipping`
is present and its fields are populated.

### Module 30 (WhatsApp Semi-Automation) — scope summary
`docs/SRS.md` §5.41, FR-41.1-41.4. `Cart.buyerWhatsapp` wired to capture
at cart creation (schema column already existed, unused since Module 26).
New Settings Registry keys for three seller-editable message templates
(`whatsapp.order_confirmation_template`, `whatsapp.shipping_update_template`,
`whatsapp.cart_recovery_template`, `store`/`global` scope). New service
generating on-demand `wa.me` deep links (reusing §5.37's WhatsApp OTP
Adapter's link-construction pattern, generalized beyond a single `{{otp}}`
token) for three seller-clicked triggers: order confirmation, shipping/
tracking update, and abandoned-cart recovery. New seller-facing abandoned-
carts list (first-ever surface over Module 9/15.2's existing flagging).
**Explicitly deferred:** automated WhatsApp Business API sequences
(paid, Meta-gated) — documented roadmap note only.

### Module 31 (Automated Profit & Loss Engine) — scope summary
`docs/SRS.md` §5.42, FR-42.1-42.7. New: `ProductVariant` base-cost field
(optional, un-costed variants visibly flagged rather than treated as
zero), optional per-order courier/handling cost fields on `Order`, and a
new `AdSpendEntry` model (manual/CSV, period-scoped, tenant-isolated).
New `ProfitLossService` computing per-order and per-period true net profit
from existing revenue/commission (`LedgerEntry`)/discount/shipping/tax
data minus these seller-entered costs — reuses `computeOrderTotals()`'s
existing conventions rather than reimplementing subtotal math. Financial
Truth Invariant applies unchanged: only `confirmed`+ orders ever count.
Ad-spend entry is a documented extension point (not a full Adapter-
pattern build) for a future automated ad-account API sync. **Explicitly
deferred:** automated Facebook/TikTok ad-account API sync and automated
local-courier-API cost sync — both roadmap notes only, no schema gap
blocking them later.

---

## v0.31 slotting decision — Built-in Email Verification, Shopify
Migration, Cost-Savings Calculator, Trust & Achievement Badges,
Emotional & Retention Layer, Community & Belonging

Six founder-requested acquisition/retention features, slotted **after**
the already-approved Modules 28-31 (Inventory, Delivery-Time Badges,
WhatsApp Semi-Automation, P&L Engine — unchanged). Reasoning:

1. **None of the six have a hard blocking dependency on 28-31** — they
   extend Module 26 (verification), Module 15 (CSV import), Module 14
   (plans/pricing), Module 23 (Store Health Score), Module 39/22 (growth
   programs), and Module 9's confirmed-sale data, all already built. They
   could technically slot earlier, but 28-31 were already founder-
   approved and queued before this request — no reason to leapfrog work
   already in flight.
2. **Module 38 (Built-in Email Verification) first among the six** —
   smallest, most self-contained: a fourth adapter implementation inside
   an interface that already exists (§5.37), no new UI surface beyond an
   existing settings screen.
3. **Module 39 (Shopify Migration) second, deliberately after 28** —
   both Module 28's stock-only CSV bulk-edit (FR-39.3) and this module
   extend the *same* underlying CSV import engine (Module 15). Building
   the narrower extension (28) first, then the far larger one (Shopify's
   multi-entity format), means the second extension inherits a stable,
   already-proven-in-production import path rather than two extensions
   landing on the same engine simultaneously.
4. **Module 40 (Cost-Savings Calculator) third** — a self-contained
   marketing-site widget over Settings Registry data; zero dependency on
   anything else in this batch, a good low-risk "quick win" once the
   backend-heavy Modules 32/33 are done.
5. **Module 41 (Trust & Achievement Badge Engine + public badges)
   fourth, deliberately built as its own module rather than folded into
   the retention layer** — because §5.47's private dashboard achievement
   badges (originally listed as part of the founder's item #4) are
   architected to reuse the *same* `BadgeEvaluationService` this module
   builds for public storefront badges (originally item #6). Building
   one shared engine once, with two thin consumers, is the correct
   sequencing even though it reorders the founder's own numbering —
   flagged explicitly here rather than silently reordered.
6. **Module 42 (Emotional & Retention Layer) fifth** — depends on
   Module 41's badge engine for its own private achievement badges
   (FR-47.4); the onboarding-reframe and milestone-celebration halves of
   this module have no such dependency and could theoretically ship
   earlier, but are kept together as one module per the founder's
   original framing (one cohesive "retention layer").
7. **Module 43 (Community & Belonging) last** — explicitly the
   founder's own "long-term retention/scaling" framing, and its
   Featured Sellers surface optionally references Module 41's public
   badges (§5.48 FR-48.3) — sequenced after that dependency exists.

**Build order: 28 → 29 → 30 → 31 → 38 → 39 → 40 → 41 → 42 → 43.** (Module
numbers 38-43 per the v0.32 slotting decision below, which inserts the
founder's Pre-Launch Enhancements batch as Modules 32-37 ahead of this
batch — this batch's own internal ordering/reasoning below is otherwise
unchanged from when it was numbered 32-37.) Same standing rhythm
throughout: SRS amendment first (done, v0.31), build-plan updated (this
section), commit/push docs, then build → verify → push automatically per
module. Bare-functional UI throughout — premium redesign is a later,
separate design phase. Platform stays English-only in v1.0 (no
Urdu/Hinglish); §3.9's i18n-readiness discipline (translation-key/locale
layer, no hard-coded strings) stays binding regardless, so this is a
scope decision, not a technical regression.

### Module 38 (Built-in Email Verification Service) — scope summary
`docs/SRS.md` §5.43, FR-43.1-43.5. New `PlatformEmailOtpAdapter`
implementing the existing `VerificationChannelAdapter` interface (§5.37)
— a fourth per-store channel choice alongside WhatsApp OTP, seller-SMTP
Email OTP, and Prepaid Confirmation. New `EmailServiceProvider` interface
(one concrete implementation over the platform's existing `EmailService`)
as the documented future-SaaS-extraction seam. New Settings Registry key
(`verification.platform_email.monthly_quota`, per plan tier) plus a new
per-seller monthly-counter model (reset each billing period, same
discipline as Module 20's existing counters). No change to WhatsApp OTP
or seller-SMTP Email OTP — both remain fully first-class.

### Module 39 (One-Click Shopify Migration) — scope summary
`docs/SRS.md` §5.44, FR-44.1-44.6. Extends Module 15's `ImportJob` engine
(FR-18.1/18.3) with new Shopify-format CSV parsers (products+variants+
images, customers, orders) and a guided upload → mapping-preview →
validation-preview → import → per-row-error-report flow. Reuses the
existing Moderation Engine (§5.27) and plan-limit gates verbatim — no
migration-specific bypass path. Imported orders are written directly in
their final historical status, excluded from the Orders Command Center's
action-needed buckets and from commission calculation. Direct Shopify API
connect (OAuth/live sync) is a documented roadmap note, not built in v1.0.

### Module 40 (Cost-Savings Calculator) — scope summary
`docs/SRS.md` §5.45, FR-45.1-45.4. New marketing-site widget (homepage
and/or `/pricing`), public, no auth. New Settings Registry keys for every
comparison figure (Shopify plan tiers/fees, typical-app-cost estimate,
eyosto's own plan fee/commission) — admin-editable, never hard-coded.
Output always carries a visible "estimated" disclaimer.

### Module 41 (Trust & Achievement Badge Engine + Public Store Badges) — scope summary
`docs/SRS.md` §5.46, FR-46.1-46.5. New `BadgeEvaluationService` — a
single derived-read engine (no new source of truth) computing earned,
auto-revocable badges from existing Store Health Score (§5.34),
fulfillment-speed, order-volume, and tenure data, against new Settings-
Registry-driven thresholds (`badges.*`). Public storefront rendering
(product/store pages + checkout) reuses the existing Verified Store
badge's (§5.35) placement precedent. Distinct from Module 29's
logistics-only Delivery-Time Badges. This engine is the shared dependency
Module 42's private dashboard badges are built on.

### Module 42 (Emotional & Retention Layer) — scope summary
`docs/SRS.md` §5.47, FR-47.1-47.5. Onboarding wizard (existing FR-20.1
progress state) reframed presentation-wise as a guided tour with a
completion celebration — no new backend model. New Settings-Registry-
driven milestone thresholds (`milestones.*`) plus a new append-only
milestone-event model (fires once per store per threshold, only on
`confirmed`+ orders — Financial Truth Invariant reaffirmed). Private
dashboard achievement badges built on Module 41's `BadgeEvaluationService`
— a distinct, seller-only badge set never rendered publicly. Existing
dashboard personalization (themes/wallpapers) reaffirmed as part of the
same ownership feeling, not rebuilt.

### Module 43 (Community & Belonging) — scope summary
`docs/SRS.md` §5.48, FR-48.1-48.5. New seller success-story submission
flow (dashboard) + admin curation queue (reuses Module 25's admin-queue UI
precedent and §5.27/§5.33's submit → moderate → publish shape). New
opt-in Featured Sellers public surface, optionally cross-referencing
Module 41's public badges and Module 22's existing Growth & Partner
Programs (Ambassador/Teams) infrastructure. No PII beyond seller-published
storefront content is ever surfaced. Richer community features (forums,
seller-to-seller messaging) are an explicit roadmap note, not v1.0 scope.

---

## Design phase — Built-in Store Templates (built, v0.31)

First deliverable of the design phase, which begins now that Modules 1-31
(feature-complete v1.0) are all built and CI-green. `docs/SRS.md` §5.1
FR-1.1/FR-1.9/FR-1.10; docs/architecture.md's Template Package Spec. Four
hand-designed built-in templates (Editorial/Studio/Market/Atelier)
replace the original three structurally-only-distinct placeholders, a
"Start from blank" option, and a mandatory-on-Free/removable-on-paid
storefront branding mark. THE ISOLATION RULE (template/customization
affects presentation only, never functional logic) is enforced
structurally, by a static CI check, and by a template-invariance e2e
proving byte-identical order totals/commission/wallet-delta/P&L across
every template. Bare-functional-but-real visual design for this pass —
premium visual/motion polish is the founder's own later Figma-involved
pass, per the phased design-phase order already agreed (design system →
marketing → auth/onboarding → dashboard core → dashboard rest → buyer
surfaces → admin → final pass); this templates work is part of that
design-system foundation.

---

## v0.32 slotting decision — Gift Cards, Customer Segments, Email
Campaigns, Staff Accounts, Admin Email Section, Advanced Granular Admin
Control ("Pre-Launch Enhancements" batch)

The founder's explicit instruction after approving Templates: resume
FEATURE work before the design phase resumes (so new features don't force
a UI redesign later), then a deep audit, then the design phase. This
batch is slotted as **Modules 32-37 — ahead of** the already-SRS'd v0.31
batch (Built-in Email Verification/Shopify Migration/Cost Calculator/
Badges/Retention/Community), which shifts to **Modules 38-43** (renumbered
above; those six features' own SRS §5.43-5.48 section numbers are
unchanged — only their build-slot label moved, per this project's
additive-only numbering discipline). Reasoning:

1. **Build order matches the founder's own listed order exactly** — it
   already respects the one real dependency (§5.51 Email Campaigns reads
   segments from §5.50 Customer Segments; Customer Segments has no
   dependency on Gift Cards, so Gift Cards' position ahead of it is
   arbitrary-but-harmless, kept in the founder's given order rather than
   reordered for no reason).
2. **Module 32 (Gift Cards) first** — self-contained, extends existing
   `DiscountCode`/wallet-ledger patterns already built (Module 7/Module
   20); no dependency on anything else in this batch.
3. **Module 33 (Customer Segments) second, before Module 34** — Email
   Campaigns' only real dependency in this batch; segments must exist
   before a campaign can target one.
4. **Module 34 (Email Campaigns) third** — depends on Module 33; reuses
   Module 26's connected-SMTP machinery (already built), so no new
   credential-storage mechanism is introduced.
5. **Module 35 (Staff Accounts) fourth** — self-contained relative to
   32-34; deliberately built as its own module rather than folded into
   Module 37's admin-control work, since it's seller-side (a plan-tier
   feature staff log into) while Module 37 is entirely admin-terminal-
   side — different actors, different surfaces, no shared code between
   them beyond the general audit-logging discipline both already follow.
6. **Module 36 (Admin Email Section) fifth** — self-contained (admin-
   global, no seller-facing surface); ordered before Module 37 only
   because it's the smaller of the two remaining admin-terminal features.
7. **Module 37 (Advanced Granular Admin Control) last** — the largest
   admin-terminal surface in this batch (four distinct controls); no
   dependency on 32-36, sequenced last simply as the biggest remaining
   piece.

**Build order: 32 → 33 → 34 → 35 → 36 → 37 → 38 → 39 → 40 → 41 → 42 → 43.**
Same standing rhythm throughout: SRS amendment first (done, v0.32),
build-plan updated (this section), commit/push docs, then build → verify
→ real-CI-green → docs → commit/push → report, repeated once per module.
Bare-functional UI throughout — premium redesign remains the later,
separate design phase (which resumes once Modules 32-43 and the deep
audit are complete).

### Module 32 (Gift Cards) — scope summary
`docs/SRS.md` §5.49, FR-49.1-49.7. New `GiftCard` (mirrors
`DiscountCode`'s store-scoped unique-code pattern, `initialValue` +
optional `expiresAt`/`isActive`) and `GiftCardRedemption` (append-only,
derived-balance discipline mirroring `WalletService.getBalance()`)
models + RLS. Purchase path is Financial-Truth-gated (balance activates
only once the purchase order is `confirmed`+); seller-issued path never
touches revenue/commission. Checkout gains a redemption step
(`Order.giftCardAmount` alongside existing `discountAmount`), still
routed through the existing Direct Seller Collection confirm/mark-as-paid
flow (§5.6c) for any remaining balance.

### Module 33 (Customer Segments) — scope summary (built)
`docs/SRS.md` §5.50, FR-50.1-50.6. New `CustomerSegment` model + RLS.
Built with typed nullable bound columns (`minOrders`/`maxOrders`/
`minTotalSpent`/`maxTotalSpent`/`lastOrderAfter`/`lastOrderBefore`/
`locationCity`/`locationCountry`) rather than the structured-JSON
criteria this scope summary originally sketched — a deliberate, disclosed
refinement, since the filter dimension set is small and fixed and this
codebase reserves JSON for genuinely free-form data. No new source of
truth — member lists are derived live from `Customer.ordersCount`/
`totalSpent`/`lastOrderAt` (existing since FR-13.x); location derived
from each customer's most recent order's shipping address (no new
`Customer` column). Seller-dashboard CRUD screen with a live member list
and member-count preview.

### Module 34 (Email Campaigns) — scope summary (built)
`docs/SRS.md` §5.51, FR-51.1-51.7. Depends on Module 33. Reuses Module
26's `SellerVerificationEmail` connected-sender record and
`smtp-credential-crypto.util.ts` encryption utility for sending — no new
credential store or encryption key. New plan-tier numeric Settings
Registry key (`email_campaigns.monthly_send_limit`), resolved via the
same `getPlanContext(sellerId)` pattern `catalog.product_limit` already
established; the quota check runs BEFORE the campaign row exists or
anything is queued, so an over-quota send is rejected entirely, never
partially sent. New unsubscribe mechanism (first in this codebase) - a
per-recipient unsubscribe link (raw token stored directly on `Customer`,
not hashed like password-reset tokens - it must be re-derivable so the
same link keeps working for a customer's lifetime, and the worst case of
it leaking is an unwanted unsubscribe, not an account takeover) + a
store-scoped `unsubscribedAt` suppression flag, re-checked live at actual
send time (not only at campaign-creation time). Campaign sends run as a
background job (existing BullMQ infra, `email-campaigns` queue,
`EmailCampaignsService.processCampaign()` - e2e tests call it directly,
same precedent as `DataExportService.processExport()`) and are logged to
the existing Platform Event Log as `campaign.sent`. No AI (composer is
seller-authored only); the composer UI carries an explicit, honest
deliverability disclaimer. The unsubscribe link itself resolves through a
new `/unsubscribe` page in `apps/web` (mirrors the existing
`/verify-email`/`/reset-password` token-link pattern) rather than a raw
API endpoint.

### Module 35 (Staff Accounts, plan-tier) — scope summary (built)
`docs/SRS.md` §5.52, FR-52.1-52.6. New `StaffAccount` model with a fixed
set of coarse, explicit permission scopes (never `billing`/`payment-
instructions`/`wallet`/`plan`). JWT/session shape modeled on
impersonation's existing `impersonatingAdminUserId`/
`impersonationSessionId` additive-field pattern (a new, purpose-built
mechanism, not a repurposing of impersonation itself), with a scope-
checking route decorator mirroring `@BlockDuringImpersonation()`. New
plan-tier numeric Settings Registry key (`staff.max_accounts`), same
resolution pattern as Module 34's send quota and the existing
`catalog.product_limit`. Every staff write is tagged and logged to the
Platform Event Log (§14.23) — deliberately not `AdminAuditLog`, which
stays reserved for platform-admin actions. Free plan defaults to zero
staff accounts.

### Module 36 (Admin Email Section) — scope summary (built)
`docs/SRS.md` §5.53, FR-53.1-53.5. New `AdminEmailAccount` model,
admin-global (no RLS, same category as `AdminAuditLog`/
`ImpersonationSession`). SMTP+IMAP credentials encrypted at rest under a
new, independent `ADMIN_EMAIL_CREDENTIAL_ENCRYPTION_KEY` (mirrors the
existing SMTP credential AES-256-GCM utility, rotated independently per
the established convention). New admin terminal section: link/unlink
accounts (audit-logged via the existing `AuditLogService`), unified
inbox merging linked accounts, reply via the originating account's own
SMTP credentials. No AI (founder replies personally) — AI-assist is a
roadmap-only note (§5.22 FR-22.19).

### Module 37 (Advanced Granular Admin Control) — scope summary (built)
`docs/SRS.md` §5.54, FR-54.1-54.6. Four narrow, audit-logged admin
controls, all reusing existing mechanisms rather than introducing new
ones: (1) block a seller's new-product-listing ability via a new
seller-scope Settings Registry flag (`catalog.listing_blocked`, checked
in `ProductsService.create()` alongside `catalog.product_limit`) —
`PUT /admin/settings/values` already accepted `scopeType: "seller"`
generically (proven by an existing Module 25 e2e test and reachable from
the standalone `/admin/settings` page), so this module's real new
surface is the key itself plus a Seller-360-scoped convenience UI, not
first-time wiring; (2) instant single-product takedown via a new
`admin_removed` `ModerationStatus` value — `ModerationService.approve()`/
`reject()` both hard-require the product be `pending`, so this needed new
`forceRemove()`/`restore()` methods (any status → `admin_removed` →
`approved`) on a new, non-`@AllowReviewer()` controller
(`POST /admin/products/:id/remove|restore`); storefront exclusion is
automatic since `admin_removed` is deliberately never added to
`PUBLIC_MODERATION_STATUSES`, no per-query-site changes needed; (3)
supplier-listed-product block/approve via the existing Moderation Queue
(§5.27/Module 6, unmodified) — a supplier-sourced listing already lands
in the same `pending` queue as a self-fulfilled one, so the actual gap
was the admin terminal not surfacing which queued products are
supplier-attributed (`sourceType` added to the queue table's UI); (4)
per-seller feature-flag override via the Settings Registry's existing
seller-scope precedence, surfaced as a new section on the Seller 360 page
(Module 25). All four call the existing `AuditLogService.record()` with
before/after values. Additive to, not a replacement for, the existing
`SellerLifecycleStatus` ladder (§5.29).

---

## UZEYN rename (built)

Full rename pass — `goto5x`/`eyosto` → **UZEYN** — across repo, docs,
code, and storefront branding ("Managed by UZEYN"). Slotted as its own
commit immediately after Module 37 (the batch turned out to end there,
not at Module 43 as originally estimated), before the deep audit and the
design phase resume, so it never tangles with feature-work diffs.
`uzeyn.com` business email setup (Cloudflare Email Routing + Gmail "send
as" for v1, self-hosted Mailcow/Mailu noted as a later option) is
documented as a new section in `docs/launch-runbook.md` — founder-ops
documentation, not application code, shipped alongside this commit but
not itself a code change.

**Execution notes:**
- Package identity (`@goto5x/api`/`@goto5x/web`/root `goto5x` →
  `@uzeyn/api`/`@uzeyn/web`/`uzeyn`), all env-encoded names (`POSTGRES_DB`,
  `MINIO_ROOT_USER`/`MINIO_BUCKET`, `ADMIN_MFA_ISSUER_NAME`,
  `EMAIL_FROM_ADDRESS`, the Compose project name), and every
  `goto5x.com`/`eyosto.com` domain reference renamed. The local dev/test
  Postgres database was renamed in place (`ALTER DATABASE goto5x RENAME TO
  uzeyn`) since it's disposable local state, not a migration-tracked
  identifier; CI's ephemeral service containers needed no such step.
- The "Powered by eyosto" storefront mark is now "Managed by UZEYN" —
  wording changed, not just the name, per the founder's explicit
  instruction — updated everywhere it's rendered, described in a Settings
  Registry description, or referenced in a comment/test name.
- Confirmed via grep before starting that no table/column/enum name,
  migration filename, or Settings Registry key ever contained the old
  name — this was a pure rename with zero schema/data-migration surface.
- **This document's own existing content is unchanged** — every
  `goto5x`/`eyosto` mention still in the Phase 1/2 narrative above
  describes what was literally named/decided at that point in the
  project's history (choosing "eyosto" as the wordmark, deferring a
  site-wide rename, this file's own `goto5x.com/` repository-structure
  tree, which is still the repo's real folder name). Rewriting that
  history would misrepresent it, so only `CHANGELOG.md` gained a new
  entry describing this pass; nothing already written in either document
  was edited.
- The GitHub repository itself (`ubaidslab/goto5x.com`) was **not**
  renamed — that's an infrastructure/ownership action outside what a
  commit can do, not a code change.
- Verified: full local typecheck (api + web), full local e2e suite, and a
  real CI-verified green run on the pushed commit.

---

## Deep-Audit Phase A: launch blockers (Modules 44-48)

A full pre-audit sweep of the built platform against `docs/SRS.md` found
six places where a business decision changed in discussion but never
reached the code. SRS v0.33 documents the corrected spec (see its own
changelog paragraph for the full FR-by-FR detail); this section is the
build-order/slotting record. Founder-specified severity order, confirmed
as the right order after research — no changes:

- **Module 44 — No Free Plan; First Month paid entry; full pricing
  data; pricing page (🔴 CRITICAL, items 1+2 combined). BUILT.** Combined
  into one module because item 2's pricing figures are literally the data
  item 1's plan seed needs — they were never separable work. Touches the
  most call sites of any module in this batch (five `Plan` lookups
  across signup/downgrade, three of which are the audit's flagged
  Free-plan fallbacks; the `Subscription`/`Plan` schema; the wallet grace
  ladder; the guardrails module) and every other module in this batch
  either reads plan/commission data this module seeds (45, 48) or is
  independent of it (46, 47) — building it first means nothing downstream
  is built against a plan model about to change.
  - New `Plan.regularPrice` column (nullable, migration
    `20260806100000_module44_first_month_pricing`); `SubscriptionsService.
    assignFirstMonthAtSignup()`/`scheduleDowngradeToStarterAtPeriodEnd()`
    replace the removed Free-Plan methods; `PlanFeeDebitService.
    debitDuePlanFees()` now calls `WalletGraceLadderService.
    pauseActiveStores()` (made public) on insufficient balance instead of
    a Free-Plan fallback — the founder's explicit "unify the two
    mechanisms" instruction; `debitDueSupplierPlanFees()`'s silent
    Free-tier reassignment removed too (no replacement enforcement built —
    disclosed scope decision); `FreeStoreLimitService` and
    `plans.free_store_limit_per_identity` deleted outright;
    `UnitEconomicsService.computeSummary()`'s free-vs-paid split replaced
    with a single total.
  - Full v0.33 launch pricing seeded (First Month/Starter/Growth/Pro:
    price, regularPrice, 16.67% yearly discount, per-tier
    `billing.commission_rate_percent`/`catalog.product_limit` overrides);
    `staff.max_accounts`/`branding.powered_by_removable` re-mapped to the
    new tier names. New `marketing.most_popular_individual_tier_order`
    Settings Registry key drives the pricing page's badge (launch
    default: Growth) — never hard-coded.
  - `apps/web/app/pricing/page.tsx` rebuilt: struck-through regular
    pricing, data-driven "Most Popular" badge, long per-tier feature
    copy, a Shopify-comparison line. Admin plan editor gained a
    regular-price column/input.
  - Disclosed scope decisions (not built, beyond the six named audit
    items): no new store-count-per-plan enforcement (the "1 store"
    pricing-table language is descriptive copy only); no retroactive
    plan-gating for the ~10 other named marketing features (pricing-page
    copy only — only commission %, product limit, staff accounts, and
    branding removal got real per-tier enforcement, since those already
    had functioning gating mechanisms); no new supplier-dashboard
    enforcement for supplier plan-fee non-payment.
  - New `test/e2e/module44-first-month-pricing.e2e-spec.ts` covering the
    founder's explicit test list; every pre-existing e2e test whose
    fixtures assumed a Free-Plan signup default or the old 1%
    global-default commission rate updated for First Month's real 2%
    plan-scoped override and real billing cycle.
  - Verified: full local typecheck (api + web), full local e2e suite, and
    a real CI-verified green run on the pushed commit.
  - Follow-up (founder-requested verification, commit `b227002`): a
    targeted audit for any surviving Free-Plan resolution found one real
    bug - `CrossSaasEligibilityController` (FR-24.14) still gated on
    `tierOrder > 0` meaning "paid," wrongly marking every First-Month
    seller ineligible since First Month is tierOrder 0. Fixed to check
    `subscription.status === "active"`. Also fixed two stale UI strings
    ("downgrade to Free", "Mandatory on the Free plan"); confirmed the
    `price === "0" ? "Free"` price-label helpers are not a leftover
    (correct for Team plans' genuine Rs 0 base + per-seat pricing).
    Re-verified full suite + real CI green on the follow-up commit.
- **Module 45 — Commission rate hard cap (🟠). BUILT.** Small and
  isolated (a `SettingsDefinition.validation.max` change plus a rejection
  test) — research confirmed both the generic min/max validation
  mechanism and the admin high-impact-confirmation UI already exist and
  already cover this exact key, so this is genuinely a data/seed fix, not
  new mechanism. Slotted right after Module 44 since it shares the same
  `billing.seed.ts` file and per-tier commission values Module 44 is
  already touching.
  - `billing.commission_rate_percent`'s `validation.max` tightened
    100 → 2 in `billing.seed.ts`. Unlike every other `SettingsDefinition`
    seed in the codebase, this one's `upsert` gets a real `update:` block
    (not the usual no-op `update: {}`) so the tightened cap retroactively
    applies to an already-provisioned environment, not only a fresh DB —
    a disclosed, deliberate deviation from the established seed
    convention, justified by this being a launch-blocker financial
    guarantee rather than an ordinary tunable.
  - Zero new mechanism: `SettingsService.validateValue()`'s existing
    generic min/max check and the admin settings screen's existing
    `isHighImpact()` (already matching every `billing.`-prefixed key)
    both needed no code changes.
  - New e2e test proving a write above 2% is rejected (400) at both
    seller and global scope, and never persisted. Fixed one pre-existing
    test that exercised the override mechanism with a since-invalid 48%
    value (moved to 1.5%, same proof, now within the cap).
  - Verified: full local unit suite (38/38, 186/186), full local e2e
    suite, and a real CI-verified green run on the pushed commit.
- **Module 46 — Self-fulfilled stock protection (🟠, real oversell
  bug). BUILT.** Independent of Modules 44/45 — touches checkout/
  inventory, not plans/billing. Kept in the founder's given order (before
  wallet balance) since it's a correctness bug with direct customer-facing
  impact (double-selling the last unit), same severity class as the
  commission cap.
  - New `ProductVariant.trackInventory` boolean (`@default(true)`) plus
    migration; `true` means checkout's atomic conditional-decrement
    pattern (`updateMany` gated on `stockQuantity >= quantity`, the exact
    mechanism FR-4.5 already used for supplier items) now applies to that
    variant too; `false` opts a variant out to untracked/unlimited-stock,
    unchanged from pre-Module-46 behavior.
  - `CheckoutService` gained `reserveSelfFulfilledStock()` /
    `releaseSelfFulfilledStock()`, mirroring the existing supplier
    reservation/release pair exactly, wired into `placeOrder()` so a
    mixed cart (supplier + self-fulfilled) stays atomic across both
    fulfillment paths — a failure on either side releases both.
  - `trackInventory` exposed on the variant create/update DTOs and the
    Module 28 Inventory screen's `listInventory()` response;
    `isLowStock` now additionally requires `trackInventory`.
  - Three new e2e tests (concurrent self-fulfilled oversell, untracked-
    variant unlimited stock, mixed-cart partial-release-on-failure); one
    pre-existing test (`FR-17.5`) fixed — its own comment had documented
    the exact bug this module closes, so its stock-quantity assertions
    were updated to the corrected checkout-decrement behavior. Swept
    every other e2e file for a self-fulfilled stock assertion made after
    checkout; `orders.e2e-spec.ts` was the only one.
  - Verified: full local unit suite (38/38, 186/186 tests) and full local
    e2e suite (50/51 suites — the one unrelated failure,
    `domains.e2e-spec.ts`'s real HTTPS handshake to `www.github.com`, is
    a pre-existing sandbox network limitation confirmed by isolated
    re-run, not a Module 46 regression), plus a real CI-verified green
    run on the pushed commit.
- **Module 47 — Wallet running balance + reconciliation (race fix +
  scaling). BUILT.** Depends on nothing built in 44-46, but is naturally
  after them since Module 44's plan-fee/`orders_paused` unification and
  Module 45's commission cap both flow through the same wallet debit path
  this module is hardening — sequencing it last among the correctness
  fixes means it's hardening a wallet-debit surface that's already
  reached its final v0.33 shape, not a moving target. Flagged by the
  founder as the highest-risk change in the batch (it touches money);
  built with five explicit requirements, each proven directly.
  - New `WalletBalance` (running-total cache, one row per seller) and
    `WalletReconciliationDrift` (append-only findings log) tables, same
    direct seller-scoped RLS as `ledger_entries`.
  - `WalletService.postLedgerEntry(tx, data)` — the ONE function that
    creates a wallet-relevant `LedgerEntry`; writes the ledger row and
    atomically `increment`s `WalletBalance.balance` (a single DB-level
    `UPDATE`, never read-then-write) in the same caller-supplied
    transaction. Every one of the 15 prior direct
    `prisma.ledgerEntry.create()` call sites across billing/,
    growth-programs/, and verification/ was refactored to call this
    instead — architecturally, no write path can bypass the cache update.
  - Migration backfills `wallet_balances` from every seller's ledger sum,
    then runs a hard-failing verification `DO` block (rolls back the
    whole migration on any mismatch) before the column is trusted.
  - `WalletReconciliationService` + a new daily BullMQ sweep (same
    queue/scheduler/worker pattern as the existing plan-fee-debit/
    low-balance sweeps): recomputes each seller's true ledger sum,
    compares to the cache, and — critically — never auto-corrects a
    mismatch, only logs it, records a `WalletReconciliationDrift` row,
    and surfaces it as a new admin-notification-center line.
  - Real-concurrency race-fix test: two commission debits fired via
    `Promise.all` (real HTTP `mark-as-paid` requests, not sequential
    calls) both land exactly once each with no lost update, and the
    negative-float floor correctly detects a combined-but-not-individual
    crossing.
  - Research-first discipline surfaced a real gap: 10 pre-existing e2e
    test call sites across 4 files seeded `LedgerEntry` rows directly via
    the superuser Prisma client (a legitimate test shortcut the old
    re-aggregating `getBalance()` was immune to), which the cache swap
    silently broke. Fixed with a new shared `seedLedgerEntry()` test
    helper (`test/e2e/setup.ts`) that keeps the cache in sync using the
    same exported `signedContribution()` sign-mapping production code
    uses — not two parallel implementations that could drift apart.
  - Verified: full local unit suite (38/38, 186/186 tests) and full local
    e2e suite, plus a real CI-verified green run on the pushed commit.
- **Module 48 — Facebook/Instagram Shop feed + WhatsApp catalog links
  (Growth+).** The only net-new feature in this batch (the other five are
  fixes/corrections) — correctly last, and its Growth-tier gate depends
  on Module 44's tier data existing first.

### Phase B — remaining pre-launch audit findings (smaller, sequenced after Phase A)

Founder-ordered list of five smaller pre-launch findings, built and
CI-verified one at a time:

1. **Rate-limit re-audit (Modules 22-47) — BUILT.** Full controller inventory
   against `RateLimitService.enforcePerHour` coverage; 11 gaps found and
   closed (checkout — highest severity, cart create, storefront unlock,
   gift-card purchase, seller+admin MFA verify, campaign creation, admin
   email test-connection/reply, review submission, careers apply), each
   with a new Settings-Registry-tunable limit. Staff login reconfirmed
   already adequate; order-verification OTP and data-export cooldowns
   reconfirmed as already-adequate equivalent mechanisms. Three low-severity
   findings deliberately left as-is with reasoning recorded (SRS §14.12).
   7 new e2e tests proving each new limit fires a real 429.
2. **CNIC trust messaging — BUILT.** Copy-only change to the Identity
   verification card (Module 12's dashboard settings screen): explains why
   the CNIC is required (fraud prevention + payout compliance), that it's
   encrypted at rest, never shown to anyone in full, never shared, only
   last-4 ever displayed, and what completing it unlocks. No backend change.
3. **Wallet transaction history pagination — BUILT.** `WalletService.
   getTransactionHistory()` (and `SupplierWalletService`'s equivalent) now
   take `page`/`limit` (default 20, capped 100) and return `{items, page,
   limit, total, totalPages}` via real `skip`/`take` + `count()`, not a
   client-side slice. Seller wallet dashboard screen gained Previous/Next
   controls; the admin Seller-360 page's recent-activity panel updated to
   the new signature. New e2e pagination test.
4. **RLS defense-in-depth tests — BUILT.** New `tenant-prisma.service.spec.ts`
   (16 unit tests, no DB required) proves `TenantPrismaService.run()`'s
   UUID guard rejects 14 malicious/malformed `sellerId` inputs (SQL
   fragments, empty/whitespace, null/undefined, unicode homoglyphs,
   oversized strings, malformed hyphenation, embedded quotes/newlines) and
   that `$transaction()` is never called for any of them, plus 2 positive
   controls proving valid UUIDs still work correctly. No production code
   changed — the mechanism was already correct, now it's pinned by tests.
5. **Key rotation + breach runbook — BUILT.** New generic
   `scripts/rotate-encryption-key.ts` (decrypt-with-old/re-encrypt-with-new,
   `--dry-run`, non-zero exit on any row failure) covers all five encrypted
   domains, since they all turned out to share one AES-256-GCM
   implementation under independent keys. 9 round-trip unit tests. New
   `docs/launch-runbook.md` §3a: routine-rotation checklist + full
   breach-response checklist (maintenance mode, Redis session flush, key
   rotation, downstream plaintext rotation, JWT secret rotation, audit
   review, writeup).

---

## Professional Seller Readiness (Modules 49-58)

Founder rationale: positioning is beginner-friendly, but revenue comes from
Growth/Pro sellers, and the platform can't yet handle their daily workload.
Ships before the UI/design phase. SRS v0.34 documents the full FR-by-FR
detail (§5.56-5.65, §14.55-14.64); this section is the build-order/slotting
record, researched against the live codebase before sequencing — four
parallel research passes covered all ten founder-specified items before any
FR was written, so every dependency claim below is grounded in what the
code actually does today, not assumption.

The founder's own numbering (1-10) is **not** the build order — it's
reordered here purely on dependency grounds, confirmed safe by research
(no item skipped ahead of a prerequisite it turned out to actually need):

- **Module 49 — Multi-Store Per Seller (§5.56, item 1).** Built first: it's
  the most self-contained item in the batch (research confirmed the
  schema/RLS/URL-routing already fully support it — this module is a
  plan-limit gate plus a switcher UI, not new tenancy work) and touches
  nothing any other module in this batch depends on.
- **Module 50 — Product Organization at Scale (§5.57, item 6, reordered
  ahead of item 2).** Built before bulk product operations deliberately —
  both modules touch the same product-list page and endpoint; adding
  filters/search/pagination first, then bulk-select on top of an
  already-filterable list, avoids re-touching the same frontend page twice
  with potentially conflicting layouts.
- **Module 51 — Bulk Product Operations (§5.58, item 2).** Depends on
  Module 50's filtered/paginated list (a bulk action's confirmation count
  needs to reflect a filtered selection accurately). Also closes the
  pre-existing `ProductsService.update()` moderation gap found during
  research (FR-58.3) — bulk operations multiply that gap's exposure, so
  it's closed here rather than filed as a separate item.
- **Module 52 — Bulk Order Operations, Tracking Entry & Advanced Search
  (§5.59, item 3).** Independent of 49-51; the first module to touch
  `Order.status` transitions formally (new `orderNumber` schema field,
  first centralized transition map). Sequenced here, before returns,
  because Module 53 needs that transition map to add
  `refunded`/`partially_refunded` safely.
- **Module 53 — Returns & Refunds Workflow (§5.60, item 4).** Depends on
  Module 52's transition-map groundwork. The most financially sensitive
  module in the batch — promotes the `return_requests` table already
  reserved in `docs/database-schema.md`'s v1.1-ahead section and wires the
  long-dormant `refund_adjustment` ledger enum value into
  `WalletService`'s sign-convention sets for the first time. Built with
  the same discipline as Phase B's key-rotation/RLS-defense work: every
  reversal path proven against the Financial Truth Invariant explicitly,
  not assumed correct by construction.
- **Module 54 — Analytics Depth (§5.61, item 5, reordered after item 4).**
  Depends on Module 53: return rate (overall and per-product) is one of
  the founder's explicitly requested metrics, and there is no return data
  to rate until Module 53 exists. Building analytics before returns would
  mean either shipping an incomplete metric or redoing this module later —
  research confirmed no other item in the batch has this kind of hard
  data dependency, so this is the one deliberate reordering beyond the
  page-sharing logic above.
- **Module 55 — Seller Notifications (§5.62, item 7, reordered after item
  5).** The daily sales summary email is explicitly meant to reuse
  Module 54's new time-bucketed queries rather than duplicate them —
  sequencing after 54 means there's something to reuse when this module
  starts.
- **Module 56 — One-Click Full Export, Pro Gate (§5.63, item 8).** Small
  and fully independent (confirmed by research: Module 24's export engine
  already does everything except the plan-tier check) — slotted here as a
  fast, low-risk module between the two remaining larger, independent
  items.
- **Module 57 — Invoice/Receipt Customization, limited (§5.64, item 9).**
  Independent; small (three new `Store` fields plus wiring one already-
  existing-but-unused `Seller.businessName` field into the template).
- **Module 58 — Advanced Store SEO Control (§5.65, item 10).** Built last
  — the largest remaining item and the only one requiring genuinely new
  infrastructure with no in-repo precedent (an HTML-sanitization
  allowlist utility; research confirmed none exists anywhere in this
  codebase today). Independent of every other module in this batch, so
  its position is pure sizing/risk sequencing, not a dependency
  requirement.

**Confirmed by research, stated once here rather than repeated in every
module below:** none of the ten items require a UI/design-system change —
this entire batch ships on the existing (pre-design-pass) component set,
consistent with the founder's instruction that it ships *before* the
UI/design phase. Two items introduce genuinely new tooling with no
existing pattern to extend: Module 54 needs a frontend charting library
(none installed in `apps/web` today), and Module 58 needs an HTML-
sanitization dependency (none installed anywhere today) — both flagged
explicitly in SRS §5.61/§5.65 so neither is mistaken for reusing an
existing mechanism.

### Phase C — remaining pre-launch/pre-design audit items (unaffected)

Modules 38-43 and 48 (Built-in Email Verification, Shopify Migration,
Cost-Savings Calculator, Badge Engine, Retention Layer, Community &
Belonging, Facebook/Instagram Shop Feed) remain pending, unaffected by this
insertion — they stay queued after Module 58 unless the founder resequences
them.

---

*Update this document as each module is approved and built — it is the running
build-phase index, the same discipline as `docs/SRS.md` itself.*
