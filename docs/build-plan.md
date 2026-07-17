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
| 10 | **Seller Dashboard UI** (new, v0.12) | 2, 4, 7, 9 | 14.26 — the actual rendered screens for product/media (Module 2), shipping/tax/discount (Module 7), and order management (Module 9), governed by the SIMPLICITY INVARIANT (SRS §3.13) |
| 11 | Payments & Ledger | 9 | 14.6 (payments/ledger half) |
| 12 | **Seller Account Security: 2FA + Devices** (new, v0.10) | 1 | 14.24 |
| 13 | Payouts & Disbursement | 11, 12 | 14.6 (payout half) — depends on 12 so `required_for_payout_actions` MFA enforcement (FR-25.6) exists before a payout-request gate can check it |
| 14 | Plans, Pricing & Business Guard-Rails | 1, 11 | 14.7, 14.21 |
| 15 | Customers, Reviews & Data Portability | 9 | 14.13, 14.14, 14.18, 14.19 (invoice) |
| 16 | Seller Onboarding Wizard | 4, 9, 10 | 14.20, plus 14.0 regional-gating items (FR-25.5, new in v0.7) — depends on 10 now, since the wizard links a new seller into real dashboard screens rather than placeholders |
| 17 | Admin Control Plane completion | 1, 6, 11, 13, 14 | Remainder of 14.8, incl. in-app messaging (FR-8.15) and brand assets (FR-12.3, both new in v0.7), and the Listing Moderation Engine's bare functional queue admin page (FR-27.6, new in v0.11) |
| 18 | External-SaaS Bridges | 4, 2 | 14.22, incl. referral attribution + discount eligibility (FR-24.13–24.14, new in v0.7) |
| 19 | Platform's Own Site — premium pass | — (content/visual, blocked on branding assets) | 14.0 (remainder) |
| 20 | Hardening & Launch Readiness | all above | 14.12 (remainder), full cross-tenant sweep |

**Two modules inserted in v0.10** (see the SRS's own v0.9→v0.10 changelog for
the full reasoning, this is just the sequencing consequence): **Listing
Moderation Engine** slots right after Discovery & Merchandising because it's a
launch-blocking legal-safety requirement, not a Discovery feature — Discovery
itself still ships first, unmodified, with the moderation-status filter added
as a small follow-up when Module 6 lands. **Seller Account Security** slots
immediately before Payouts & Disbursement (not alongside Seller Onboarding,
Module 16, despite both touching seller-facing auth/account concerns) because
`required_for_payout_actions` MFA enforcement is meaningless if 2FA doesn't
exist yet by the time a seller can request a payout — Module 16 comes after
Payouts in this table, which would be too late.

**One module inserted in v0.12** (see the SRS's own v0.11→v0.12 changelog):
**Seller Dashboard UI** slots immediately after Orders, Cart & Checkout
(Module 9) — the last of the three already-built-API-only modules (2, 7, 9)
whose screens it builds — and before Seller Onboarding Wizard (now Module
16, which gained a dependency on Module 10 for exactly this reason: it links
a new seller into real screens, not placeholders).

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

---

*Update this document as each module is approved and built — it is the running
build-phase index, the same discipline as `docs/SRS.md` itself.*
