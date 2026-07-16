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
| 2 | Catalog & Media | 1 | Partial 14.1 (data layer only), 14.9 |
| 3 | Custom Domain & TLS | 1 | 14.11 |
| 4 | Theme Engine & Storefront Rendering v1.0 | 2 | 14.1 |
| 5 | Discovery & Merchandising | 2, 4 | 14.16 |
| 6 | Shipping, Tax & Discounts | 2 | Partial 14.2, 14.19 (tax) |
| 7 | Suppliers & Printify Adapter | 2 | 14.3, 14.4 |
| 8 | Orders, Cart & Checkout | 2, 5, 6, 7 | 14.5, 14.15, 14.17 |
| 9 | Payments & Ledger | 8 | 14.6 (payments/ledger half) |
| 10 | Payouts & Disbursement | 9 | 14.6 (payout half) |
| 11 | Plans, Pricing & Business Guard-Rails | 1, 9 | 14.7, 14.21 |
| 12 | Customers, Reviews & Data Portability | 8 | 14.13, 14.14, 14.18, 14.19 (invoice) |
| 13 | Seller Onboarding Wizard | 4, 8 | 14.20 |
| 14 | Admin Control Plane completion | 1, 9, 10, 11 | Remainder of 14.8 |
| 15 | External-SaaS Bridges | 4, 2 | 14.22 |
| 16 | Platform's Own Site — premium pass | — (content/visual, blocked on branding assets) | 14.0 (remainder) |
| 17 | Hardening & Launch Readiness | all above | 14.12 (remainder), full cross-tenant sweep |

**Notifications is not its own module** — it is cross-cutting. Each module that
produces a notification-worthy event (order confirmed in Module 8, payout status
in Module 10, review-moderation outcome in Module 12, etc.) adds its own email
trigger inside that module. Calling this out explicitly rather than silently
folding it into "later."

**Known sequencing risk:** Module 16 (and to a lesser extent Module 4's final
visual sign-off) depends on final branding assets, which SRS §13 open question 3
records as not yet delivered. Modules 4–15 can proceed on functional
templates/placeholder branding; the *founder sign-off* checklist items in 14.0/14.1
that require the actual premium visual bar cannot close until assets land. This
isn't a blocker for starting the build — it's a known gate later.

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
- **Settings Registry precedence:** `seller > plan > category > store > global`
  (flagged above — proposed, not yet founder-confirmed).

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

*Update this document as each module is approved and built — it is the running
build-phase index, the same discipline as `docs/SRS.md` itself.*
