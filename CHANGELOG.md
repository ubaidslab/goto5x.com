# Changelog

All notable changes to UZEYN (formerly developed under the working names
"goto5x" and "eyosto" — see the rename entry below), reconstructed
retroactively from the module-by-module build history in
`docs/build-plan.md` and the SRS's own amendment changelog (`docs/SRS.md`).
Versions here track the SRS/build-plan version number (not npm semver) —
each entry is either a specification amendment (docs only) or a shipped
module (code + tests). Maintained on every future change.

## SRS v0.34: Professional Seller Readiness (docs-only amendment)

Ten new FR groups (§5.56-5.65, `docs/SRS.md`) plus matching §14.55-14.64
checklists and a new `docs/build-plan.md` slotting section (Modules
49-58), specifying multi-store per seller, product tags/filters, bulk
product operations, bulk order operations + tracking entry + advanced
search, a returns/refunds workflow, seller-facing analytics depth, seller
notifications (transactional + admin newsletter), a Pro-gated one-click
full export, limited invoice/receipt customization, and advanced store
SEO control — all researched against the live codebase (four parallel
research passes) before being specified, so each FR states precisely what
already exists vs. what's genuinely new. Build order is dependency-driven,
not the founder's original 1-10 listing — see `docs/build-plan.md` for the
full reasoning. Docs-only; no code changed in this commit.

## UZEYN rename pass

Full rename pass — `goto5x`/`eyosto` → **UZEYN** — across the repo: code,
docs, config, and storefront branding. Dedicated commit, slotted
immediately after Module 37, before the deep audit and design-phase
resume, per the founder's instruction.

### Changed
- npm workspace package names (`@goto5x/api` → `@uzeyn/api`, `@goto5x/web`
  → `@uzeyn/web`, root package `goto5x` → `uzeyn`); no import paths broke
  since neither package is ever imported by its scoped name (only
  referenced via `pnpm --filter`).
- `docker-compose.yml`'s Compose project name; all env var values that
  encode the old name (`POSTGRES_DB`, `MINIO_ROOT_USER`, `MINIO_BUCKET`,
  `ADMIN_MFA_ISSUER_NAME`, `EMAIL_FROM_ADDRESS`) in `.env.example`,
  `apps/api/.env.test.example`, and `.github/workflows/ci.yml` — CI spins
  up fresh ephemeral service containers per run, so nothing there depended
  on prior state.
- The storefront's "Powered by eyosto" mark is now **"Managed by UZEYN"**
  (`apps/web/app/storefront/chrome.tsx`'s `PoweredByMark` component and
  every settings-description/comment referencing it) — both the name and
  the verb changed, per the founder's explicit wording.
- The dashboard/marketing/design-system wordmark, page titles, and all
  storefront-template fallback SEO copy ("_store_ is a store on eyosto")
  now read **UZEYN**. Three shared CSS animation classes renamed
  (`.eyosto-overlay`/`.eyosto-fade`/`.eyosto-scrim` →
  `.uzeyn-overlay`/`.uzeyn-fade`/`.uzeyn-scrim`) in `globals.css` and its
  four consuming components (Dialog/DropdownMenu/Toast/Tooltip).
  `goto5x.com`/`eyosto.com` domain references throughout dashboard/signup/
  storefront copy and legal docs became `uzeyn.com`.
- Internal identifiers with no user-facing surface: the external-API
  request-signing headers (`x-goto5x-client-type/-timestamp/-signature` →
  `x-uzeyn-*`, both the controllers that read them and the e2e specs that
  set them), the local-cart `localStorage` key prefix and event name, the
  Google Drive export folder name a seller sees in their own Drive
  (`"goto5x Data Exports"` → `"UZEYN Data Exports"`), and every e2e
  spec/unit-test literal that mirrors a renamed env var or header so
  fixtures stay consistent with the code they exercise.
- `docs/SRS.md`, `docs/architecture.md`, `docs/database-schema.md`,
  `docs/tech-stack.md`, `docs/mvp-v1-cutlist.md`, `docs/page-inventory.md`,
  `docs/launch-runbook.md`, and `docs/legal/*.md` — living documents, so
  every occurrence renamed for current accuracy.

### Deliberately left unchanged
- **`CHANGELOG.md`'s own past entries** (this document) and **all of
  `docs/build-plan.md`'s existing per-module narrative** — both are
  historical build records describing what was literally named/decided at
  each point in time (e.g. build-plan.md's Phase 1 section narrates
  choosing "eyosto" as the wordmark, and explicitly explains why a
  site-wide rename was deferred then). Rewriting that history to say
  "UZEYN" would misrepresent what was actually shipped at each step, so
  only new entries are added; nothing already written is edited.
- **The GitHub repository's own name** (`ubaidslab/goto5x.com`) and the
  local repo folder path — renaming a GitHub repository is an
  infrastructure/ownership action outside what a commit can do, and
  `docs/build-plan.md`'s repository-structure tree (`goto5x.com/...`) is
  therefore still factually correct and untouched.
- **Applied Prisma migration files and every DB-persisted identifier**:
  no table/column/enum name, migration filename, or Settings Registry key
  (e.g. `branding.powered_by_removable`/`branding.powered_by_hidden`)
  contained the old name in the first place — confirmed by grep before
  starting — so none needed touching or a data migration.
- The local dev/test Postgres database itself was renamed
  (`ALTER DATABASE goto5x RENAME TO uzeyn`) since it's a disposable local
  instance, not a migration-tracked identifier.

### Verified
Full local typecheck (`apps/api` + `apps/web`), full local e2e suite, and
a real CI-verified green run on the pushed commit — see the module report
for the exact `Test Suites:`/`Tests:` summary lines.

## v0.33 — No Free Plan / First Month entry pricing, full pricing data, commission cap, stock protection, wallet running balance, Meta/WhatsApp catalog (SRS amendment ahead of Modules 44-48)

A founder-directed deep audit of the built platform against the SRS found
six places where a business decision changed in discussion but never
reached the code — most critically, a Free Plan that had quietly become
load-bearing architecture (signup default, plan-fee-failure fallback,
guard-rail target) despite the founder's actual model never having one.
Docs-only; slotted as Modules 44-48, in severity order. See
`docs/build-plan.md`'s "Deep-Audit Phase A" section for the full slotting
rationale, including why items 1 and 2 below are combined into a single
module (Module 44).

### Changed
- FR-7.1-7.4/7.8 rewritten: there is no Free Plan and no free trial. New
  sellers start on First Month — a real, tracked, paid first billing cycle
  at a steep discount off Starter, carrying Starter's full feature set —
  and auto-transition to Starter at the cycle's end via the existing
  next-cycle mechanism. Plan-fee non-payment pauses orders (unifying with
  the existing wallet low-balance grace ladder) instead of falling back to
  a Free Plan; new FR-7.19 seeds a `regularPrice` column for
  struck-through pricing and the launch pricing table for all four real
  tiers (First Month/Starter/Growth/Pro).
- FR-6.21/6.29 (new) — commission rate gets a hard 2% cap in Settings
  Registry validation, bound to the admin high-impact confirmation step.
- FR-23.1-23.5 reworded to drop Free-Plan framing; the now-purposeless
  free-store velocity limit (FR-23.5) is retired outright.
- FR-7.13/§5.39 — self-fulfilled stock protection: the existing atomic
  conditional-decrement pattern (already used for supplier listings)
  extends to `ProductVariant.stockQuantity` at checkout.
- New §5.55 — wallet balance becomes a maintained running-total column,
  updated atomically alongside every ledger write, with a new daily
  reconciliation job comparing it against the ledger's true sum.
- New Meta-compatible product catalog feed (extending the existing
  Product Feed API) and a 4th WhatsApp deep-link generator, both
  Growth+-plan-gated.

## Phase B item 5: Key Rotation + Breach Runbook

Pre-launch audit finding. There was no documented procedure if an
encryption key leaked, and no utility to actually rotate one. Every
encrypted-at-rest domain (CNIC, Google Drive refresh tokens, external-API
client secrets, seller SMTP credentials, admin email credentials) turned
out to already share the exact same AES-256-GCM implementation under five
independent keys, so one generic rotation utility covers all five domains
rather than five near-duplicate scripts.

### Added
- `apps/api/scripts/rotate-encryption-key.ts` — `npx ts-node scripts/
  rotate-encryption-key.ts <domain> <oldKeyBase64> <newKeyBase64>
  [--dry-run]`. Decrypts every row for the given domain with the old key
  and re-encrypts with the new key, one atomic operation per row/column —
  a decrypt/encrypt failure on one row is logged and skipped, never
  partially written, and the process exits non-zero if any row failed.
  `--dry-run` decrypts with the old key and reports success/failure
  without writing, so the key you have on hand can be confirmed correct
  before touching production data. Connects directly via
  `DATABASE_ADMIN_URL` (the same BYPASSRLS role `PrismaAdminService`
  uses) since it must touch every seller's/admin's row, not one tenant's.
- `apps/api/scripts/rotate-encryption-key.spec.ts` (9 tests) — proves the
  decrypt-with-old/re-encrypt-with-new/decrypt-with-new round trip for
  all three distinct crypto implementations in the codebase (the five
  domains map onto three; CNIC/Drive-token/external-API-secret all reuse
  `encryptDriveToken`/`decryptDriveToken` verbatim), plus that the old key
  can no longer decrypt post-rotation ciphertext and the new key can't
  decrypt not-yet-rotated ciphertext (proves rotation actually changes
  something, not a silent no-op).
- `docs/launch-runbook.md` new "§3a Encryption Key Rotation + Breach
  Response" section: a domain/env-var/table.column inventory table, a
  routine-rotation checklist (dry-run first, backup, rotate, restart,
  verify, destroy the old key), and a breach-response checklist covering
  enabling maintenance mode (`platform.maintenance_mode_enabled`, existing
  FR-8.7 mechanism), force-logging-out every session platform-wide (Redis
  `FLUSHALL` — sessions live in the same Redis store as the rate-limiter/
  settings cache, both of which regenerate harmlessly), rotating the
  leaked key, rotating anything the leaked plaintext itself could unlock
  (Drive token, external API secret, SMTP passwords) domain by domain,
  rotating `JWT_ACCESS_SECRET` if the breach extended beyond the
  encryption keys, an audit-log review, disabling maintenance mode, and a
  writeup step.

## Phase B item 4: RLS Defense-in-Depth Tests

Pre-launch audit finding. Tenant isolation rests on `TenantPrismaService.
run()` validating a `sellerId` as a syntactically-correct UUID before
interpolating it into a raw `SET LOCAL app.current_seller_id = '...'`
statement — the one place in the codebase that builds SQL by string
concatenation, because Postgres's wire protocol can't parameterize `SET
LOCAL`. It was already correctly guarded, but had no dedicated test — a
future refactor could weaken or remove the guard with nothing failing.

### Added
- `apps/api/src/prisma/tenant-prisma.service.spec.ts` (new, 16 tests, unit-
  level with a fake Prisma client — no real DB needed since the guard
  throws before ever opening a transaction). Proves 14 malicious/malformed
  inputs are rejected (SQL fragment, valid-UUID-then-SQL-fragment, empty
  string, whitespace, `null`, `undefined`, a Cyrillic-homoglyph string
  shaped like a UUID, a 10,000-character oversized string, malformed
  hyphenation, a bare numeric id, an embedded quote, a trailing newline, a
  leading space) and — for every one — that `$transaction()` is never even
  called, not just that the eventual query fails. Two positive controls
  (lowercase/uppercase valid UUIDs) confirm the guard doesn't over-reject
  and that the exact expected value reaches `$executeRawUnsafe()`.

No production code changed — the mechanism was already correct.

## Phase B item 3: Wallet Transaction History Pagination

Pre-launch audit finding. `WalletService.getTransactionHistory()` returned
every `LedgerEntry` for a seller with no limit — fine at today's volume,
but degrades for a high-volume seller who accumulates thousands of
commission/fee rows over the store's lifetime.

### Changed
- `WalletService.getTransactionHistory(sellerId, page, limit)` now takes
  optional `page`/`limit` (default 1/20, `limit` capped at 100) and returns
  `{ items, page, limit, total, totalPages }` instead of a bare array —
  real offset pagination (`skip`/`take` + a parallel `count()`), not a
  client-side slice.
- `SupplierWalletService.getTransactionHistory()` — same fix, same shape,
  for consistency (the supplier wallet has no frontend history view today,
  but carries the identical unbounded-growth risk).
- `GET /sellers/me/wallet/transactions` and `GET /suppliers/me/wallet/transactions`
  accept `?page=&limit=` query params.
- `AdminSellerOverviewService` (Seller-360 page) updated to call the new
  signature directly (`getTransactionHistory(sellerId, 1, 20)`) instead of
  fetching everything and slicing to 20 client-side.
- Seller dashboard wallet screen (`apps/web/.../wallet/page.tsx`) — added
  Previous/Next controls and a "Page X of Y" indicator; requests one page
  at a time instead of every transaction on load.

### Tests
- New pagination test in `test/e2e/module20-wallet-supplier-portal.e2e-spec.ts`:
  5 distinct-amount top-ups, `limit=2`, proves `total`/`totalPages` are
  correct, each page returns the right newest-first slice with no overlap,
  and a past-the-end page returns empty (not an error) with `total`/
  `totalPages` still correct.

## Phase B item 1: Rate-Limit Re-Audit (Modules 22-47)

Pre-launch audit finding. Rate limiting was last audited at Module 21;
~15 modules shipped since. A background research pass produced a full
controller inventory across every module built since then, cross-referenced
against `RateLimitService.enforcePerHour()` coverage, and found 11 real
gaps — most severe: `POST /storefront/checkout` had **no rate limit at
all**, despite being public, unauthenticated, and creating a real order
(decrements stock, sends email, renders a PDF invoice, and is the entry
point for gift-card/discount-code guessing).

### Added
- Eleven new `enforcePerHour()` call sites, each keyed the same way existing
  ones are (account/seller/admin id and/or IP, dual-keyed where the
  existing login pattern warrants it) and each limit resolved from a new
  Settings Registry key rather than hardcoded:
  - `orders.checkout_rate_limit_per_hour` — `POST /storefront/checkout`
    (highest severity: public, unauthenticated, real order creation).
  - `orders.cart_create_rate_limit_per_hour` — `POST /storefront/cart`.
  - `storefront.unlock_rate_limit_per_hour` — `POST /storefront/unlock`
    (password-gate brute force, dual-keyed IP + store).
  - `gift_cards.purchase_rate_limit_per_hour` — `POST /storefront/gift-cards/purchase`.
  - `auth.mfa_verify_rate_limit_per_hour` — `POST /auth/mfa/verify` and
    `POST /admin/auth/mfa/verify` (a 6-digit TOTP code is a genuinely
    guessable space with a valid pre-auth token; admin is the more
    sensitive of the two given BYPASSRLS access).
  - `email_campaigns.create_rate_limit_per_hour` — `POST /stores/:storeId/campaigns`
    (bounds burst/cadence — the existing `email_campaigns.
    monthly_send_limit` bounds total volume but not how fast a full-quota
    send can fire).
  - `admin_email.test_connection_rate_limit_per_hour` and `admin_email.
    reply_rate_limit_per_hour` — `POST /admin/email/accounts/:id/test-connection`
    and `POST /admin/email/reply` (real IMAP/SMTP connections and a real
    outbound email send via a linked account's own credentials, previously
    uncapped beyond the generic 100/min IP throttle).
  - `reviews.submission_rate_limit_per_hour` — `POST /storefront/order-status/:token/reviews`.
  - `careers.apply_rate_limit_per_hour` — `POST /careers/:jobPostingId/apply`.

### Verified adequate, no change
- Staff login (Module 35) was already correctly rate-limited, dual-keyed,
  confirmed by direct code citation.
- Order-verification OTP resend cooldown/attempt-cap (Module 26) and
  on-demand data-export cooldown (Module 24) are functionally equivalent
  mechanisms to `enforcePerHour`, already adequate.
- Email-verification tokens (256-bit, brute force infeasible), the
  cross-SaaS eligibility endpoint (HMAC-signed), and a seller's own
  order-verification resend (requires seller auth) were deliberately left
  unthrottled — low severity, reasoning recorded in SRS §14.12.

### Tests
- New `test/e2e/phaseb-item1-rate-limits.e2e-spec.ts` — 7 tests, each
  lowering the relevant Settings Registry key's default to a small number
  directly on its `SettingsDefinition` row, then proving the endpoint
  returns a real HTTP 429 once exceeded (checkout, storefront unlock, gift
  card purchase, admin MFA verify, campaign creation, admin email
  test-connection, admin email reply).

## Phase B item 2: CNIC Trust Messaging

Pre-launch audit finding (psychology fix, tiny effort, high impact). The
CNIC-capture step (Module 12, FR-30.1) was already correctly built — encrypted
at rest, never returned in full by any API response, masked to last-4 in the
seller's own view — but the seller was never told any of that at the point
they're asked to hand over a national ID number, a widely distrusted request.

### Changed
- `apps/(dashboard)/stores/[storeId]/settings/page.tsx` — the Identity
  verification card now states, before the CNIC is entered: why it's required
  (fraud prevention + payout compliance), that it's encrypted at rest, never
  shown to anyone in full, never shared, only the last 4 digits are ever
  displayed, and what completing it unlocks (checkout for the store). The
  `Field`'s own `hint` text carries the encrypted/last-4 line so it's visible
  on every visit, not just the first.

No backend/schema change — copy-only, reusing the existing `Field` component's
`hint` slot.

## Module 47: Wallet Balance Running Total & Reconciliation

SRS §5.6e, FR-6.21 amended, new FR-6.29 (v0.33). The highest-risk module in
the deep-audit Phase A batch — it touches money. `WalletService.getBalance()`
re-summed a seller's entire ledger history from scratch on every call (nine
read call sites: checkout's floor check, the grace-ladder sweep, the publish
gate, the withdrawal request gate, and the seller-360/wallet-screen reads) —
both a scaling problem and a correctness one, since two concurrent debits
reading the same stale re-aggregated balance could both pass a check that
only one should have.

### Added
- `WalletBalance` (one row per seller, `balance` running total) and
  `WalletReconciliationDrift` (append-only findings log) Prisma models, both
  with the same direct seller-scoped RLS policy as `ledger_entries`.
- `WalletService.postLedgerEntry(tx, data)` — the one function that creates
  a wallet-relevant `LedgerEntry`. It writes the ledger row and atomically
  increments/decrements `WalletBalance.balance` (via Prisma's `increment`,
  a single database-level `UPDATE`, never a read-then-write) in the same
  transaction, always caller-supplied so it composes with whatever else that
  transaction is doing. Every one of the 15 prior direct
  `prisma.ledgerEntry.create()` call sites across `billing/`,
  `growth-programs/`, and `verification/` was refactored to call this
  instead, so the cache can never drift from a write path that forgot to
  update it.
- `WalletService.computeLedgerBalance()` — the old from-scratch
  re-aggregation, retained but now used only by the reconciliation sweep,
  never on a hot path.
- `WalletReconciliationService` + a settings-driven daily sweep
  (`billing.wallet_reconciliation_interval_hours`, default 24h, same
  BullMQ queue/scheduler/worker pattern as the existing plan-fee-debit and
  low-balance sweeps): recomputes every seller's true ledger sum and
  compares it to the cached column. A mismatch is **never auto-corrected**
  — only logged, recorded as a `WalletReconciliationDrift` row, and
  surfaced as a new "wallet balance drift detected" line in the admin
  notification center and the system-status queue list, for a human to
  review.
- `test/e2e/setup.ts`'s `seedLedgerEntry()` — a test-only helper that seeds
  a `LedgerEntry` directly (several existing e2e specs do this to set up
  scenario state quickly) while also keeping `WalletBalance` in sync, using
  the exact same `signedContribution()` sign-mapping `postLedgerEntry()`
  uses (exported from `wallet.service.ts` for this purpose, so the two can
  never drift apart). Every pre-existing direct-seed call site (10 of them
  across 4 test files) was migrated to it — a real gap this refactor
  surfaced: a raw ledger insert that bypasses `postLedgerEntry()` now
  silently leaves the cache stale, which the old re-aggregating
  `getBalance()` was immune to by construction.

### Migration
- Backfills `wallet_balances` for every existing seller from their ledger
  sum, then runs a hard-failing verification `DO` block that recomputes the
  same sum independently and rolls back the entire migration if even one
  row doesn't match exactly — the cached column is never considered "live"
  without this passing.

### Tests
- Four new e2e tests: balance correctness after mixed credits/debits
  (matches an independent `computeLedgerBalance()` recomputation); the race
  fix, proven with two real concurrent HTTP `mark-as-paid` requests via
  `Promise.all` (not sequential calls) — both debits land exactly once each
  with no lost update, and the negative-float floor correctly detects the
  combined-but-not-individual crossing; the reconciliation sweep detecting
  a deliberately-introduced drift and never auto-correcting it; and the
  publish gate / low-balance grace ladder still reading correct values off
  the new cache.
- Fixed 10 pre-existing direct-ledger-seed call sites across
  `module20-wallet-supplier-portal`, `module22-growth-partner-programs`,
  `module25-admin-completion`, and `guardrails` e2e specs (see `Added`
  above) — all were genuinely broken by the cache swap until migrated to
  `seedLedgerEntry()`.

Verified: full local unit suite (38/38 suites, 186/186 tests) and full
local e2e suite, plus a real CI-verified green run on the pushed commit.

## Module 46: Self-Fulfilled Stock Protection

SRS §5.39, FR-39.5 corrected (v0.33). Checkout's atomic oversell-protection
decrement — `updateMany({ where: { stockQuantity: { gte: quantity } },
data: { stockQuantity: { decrement: quantity } } })`, checking
`result.count` — was wired only to supplier-fulfilled items
(`SupplierListing.stockQuantity`); a self-fulfilled item's
`ProductVariant.stockQuantity` was never checked or decremented at
checkout at all, so two concurrent buyers could both "successfully"
order the last unit of a self-fulfilled product. Closes that gap with
the exact same mechanism, now applied to `ProductVariant.stockQuantity`
too.

### Added
- `ProductVariant.trackInventory` (`Boolean @default(true)`) — an
  opt-out: `true` (default) means checkout enforces oversell protection
  on that variant exactly like a supplier item; `false` marks it
  untracked/unlimited-stock, preserving the pre-Module-46 behavior for
  sellers who don't want stock enforcement on a given variant (e.g.
  made-to-order items).
- `CheckoutService.reserveSelfFulfilledStock()` /
  `releaseSelfFulfilledStock()` — mirror the existing
  `reserveSupplierStock`/`releaseSupplierStock` pair. Runs after
  supplier reservation in `placeOrder()`; on its own failure it releases
  both its own partial reservations and the already-successful supplier
  reservation, and the outer catch block calls it too, so a mixed cart
  (supplier + self-fulfilled items) stays atomic across both fulfillment
  paths.
- `trackInventory` exposed on the variant create/update DTOs and on the
  Module 28 Inventory screen's `listInventory()` response;
  `isLowStock` now additionally requires `trackInventory` so an
  untracked variant is never flagged low-stock.

### Tests
- Three new e2e tests (`orders.e2e-spec.ts`): concurrent checkout against
  the last unit of a self-fulfilled item (only one succeeds, loser never
  decremented stock); a `trackInventory: false` variant has unlimited
  stock and is never checked/decremented; a mixed cart with one oversold
  self-fulfilled item rejects the whole order and leaves every variant's
  stock untouched.
- Fixed one pre-existing test (`FR-17.5`) whose own comment literally
  documented the bug this module fixes ("checkout of a self-fulfilled
  item doesn't reserve stock up front") — updated its stock-quantity
  assertions to the corrected checkout-decrement behavior.
- Swept every other e2e spec file for a self-fulfilled-item stock
  assertion made after a checkout call; `orders.e2e-spec.ts` was the
  only file with one.

Verified: full local unit suite (38/38 suites, 186/186 tests) and full
local e2e suite (50/51 suites; the one unrelated failure,
`domains.e2e-spec.ts`'s real HTTPS handshake to `www.github.com`, is a
pre-existing sandbox network limitation confirmed by isolated re-run —
not a Module 46 regression, since that file never touches
orders/checkout code), plus a real CI-verified green run on the pushed
commit.

## Module 45: Commission Rate Hard Cap

SRS §5.7, FR-7.4 amended (v0.33). `billing.commission_rate_percent`'s
`SettingsDefinition.validation.max` tightens from 100 to a real business
ceiling of **2** — a data/seed change, not new mechanism:
`SettingsService.validateValue()` already enforces `validation.min`/`max`
generically at every scope (global/plan/seller), and the admin settings
screen's existing `isHighImpact()` check already matches every
`billing.`-prefixed key, so a bad edit already surfaces an old-vs-new
confirm dialog before it applies. Unlike every other `SettingsDefinition`
seed in the codebase (which use a no-op `update: {}` so re-seeding never
touches an already-provisioned row), this one's `update` block refreshes
`validation` on every boot — the 2% ceiling is a launch-blocker guarantee
that must retroactively tighten an environment that already ran the old
seed once, not just apply to a fresh database.

### Tests
- New e2e test (`module25-admin-completion.e2e-spec.ts`): an
  admin-initiated write above 2% is rejected with a 400 at both seller
  and global scope, and the rejected value is never persisted (confirmed
  via a follow-up resolve call still showing `winningScope: "default"`).
- Fixed one pre-existing test that exercised the settings-override
  mechanism using a since-invalid value (48%) for this key — moved to
  1.5%, still within the new cap, no change to what the test proves.

Verified: full local unit suite (38/38 suites, 186/186 tests) and full
local e2e suite, plus a real CI-verified green run on the pushed commit.

## Module 44: No Free Plan — First Month Entry Pricing

SRS §5.7/§5.23/§5.39, FR-7.1-7.4/7.8/7.19, FR-23.1-23.5 (v0.33). Retires
the Free Plan everywhere it had become load-bearing and replaces it with
First Month, a real paid entry tier — first module of the deep-audit
Phase A launch-blocker batch. (Commit `48cd391`; CI run for that commit
never registered due to a missed webhook delivery, so this follow-up
no-op commit re-triggers it — no functional change.)

### Added
- New `Plan.regularPrice` column (nullable `Decimal(12,2)`) — the
  struck-through "was" price shown beside `price` whenever set and
  higher; `price` remains the only field actually billed.
- New Settings Registry key `marketing.most_popular_individual_tier_order`
  — which individual tierOrder gets the pricing page's "Most Popular"
  badge, data-driven (launch default: Growth) rather than a hard-coded
  tier name.
- Full v0.33 launch pricing data seeded for all four individual tiers
  (First Month/Starter/Growth/Pro): price, regularPrice, a 16.67%
  yearly-discount (= 10 months' price for 12), and per-tier
  `billing.commission_rate_percent`/`catalog.product_limit` Settings
  Registry overrides (2%/2%/1.5%/1%, 100/100/500/unlimited-sentinel).
  `staff.max_accounts` and `branding.powered_by_removable` re-mapped to
  the new tier names (Growth gets 3 staff accounts, Pro gets 10 and
  branding removal — Starter/Growth keep the "Managed by UZEYN" mark
  mandatory).
- `apps/web/app/pricing/page.tsx` — struck-through regular pricing,
  Settings-Registry-driven "Most Popular" badge, a long value-stacked
  feature list per tier, and a Shopify-comparison line. Admin plan editor
  gained a regular-price column/input.
- New `SubscriptionsService.assignFirstMonthAtSignup()` (replaces
  `assignFreePlanAtSignup()`) — assigns First Month with a real
  `currentPeriodEnd` and `pendingPlanId` already pointing at Starter, so
  the existing `applyDueCycleChanges()` sweep (FR-7.5) auto-transitions
  the seller with no new transition mechanism.
- New `SubscriptionsService.scheduleDowngradeToStarterAtPeriodEnd()`
  (replaces the Free-Plan version) for the team-leave/group-invoice-
  non-payment path — the entry paid tier, never a Free Plan, since it no
  longer exists.
- `WalletGraceLadderService.pauseActiveStores()` made public and reused
  directly by `PlanFeeDebitService.debitDuePlanFees()` on insufficient
  balance — unifies plan-fee-non-payment pausing with the existing
  wallet-low-balance grace ladder into one mechanism, per the founder's
  explicit instruction. The subscription is left overdue on its current
  plan, never reassigned.

### Removed
- `FreeStoreLimitService` and the `plans.free_store_limit_per_identity`
  Settings Registry key deleted outright — the per-identity Free-store
  velocity limit (FR-23.5) has no purpose once there is no Free Plan to
  limit.
- All three silent Free-Plan `Plan.findFirst()` fallbacks the audit
  found: `debitDuePlanFees()`'s seller-side downgrade,
  `scheduleDowngradeToFreeAtPeriodEnd()`, and the seller-signup
  assignment. The supplier-side equivalent
  (`debitDueSupplierPlanFees()`) had its silent Free-tier reassignment on
  non-payment removed too (per the founder's literal "three" count) — a
  disclosed scoping decision: no new supplier-dashboard enforcement was
  built for the resulting overdue-but-unenforced state, since that's new
  scope beyond the six named audit items.
- `UnitEconomicsService.computeSummary()`'s free-vs-paid store split —
  every store's seller is on a paid plan now, so a single total replaced
  it (API response shape changed: `freeStoreCount`/`paidStoreCount`/
  `commissionFromFreeStores`/`commissionFromPaidStores` →
  `storeCount`/`totalCommission`).

### Disclosed scope decisions (explicitly NOT built, beyond the six named audit items)
- No new store-count-per-plan enforcement — the "1 store" language in the
  founder's pricing table is pricing-page descriptive copy only; no
  existing mechanism enforces it and it wasn't one of the six items.
- No retroactive plan-gating added for the ~10 other named marketing
  features (order verification, P&L, custom domain, templates, WhatsApp
  tools, email campaigns, gift cards, customer segments, D-Studio,
  inventory management, priority support, advanced analytics) — these
  are pricing-page copy only in this module; only commission %,
  `catalog.product_limit`, `staff.max_accounts`, and
  `branding.powered_by_removable` got real per-tier values wired, since
  those already had functioning plan-gating mechanisms.

### Tests
- New `test/e2e/module44-first-month-pricing.e2e-spec.ts` covering the
  founder's explicit list: no Free plan exists anywhere in seeded data;
  signup assigns First Month with a real cycle and Starter already
  queued; the pendingPlanId sweep auto-transitions First Month → Starter;
  plan-fee expiry pauses orders (never a Free-Plan reassignment); a
  verified top-up restores a plan-fee-paused store through the existing
  grace-ladder restore path; the old Free-Plan methods no longer exist on
  `SubscriptionsService`.
- Every pre-existing e2e test whose fixtures assumed a Free-Plan signup
  default or a 1% global-default commission rate updated for First
  Month's real 2% plan-scoped override and its real billing cycle
  (`billing.e2e-spec.ts`, `plans-pricing.e2e-spec.ts`,
  `module20-wallet-supplier-portal.e2e-spec.ts`,
  `module22-growth-partner-programs.e2e-spec.ts`,
  `module32-gift-cards.e2e-spec.ts`, `guardrails.e2e-spec.ts`,
  `teams.e2e-spec.ts`, `branding.e2e-spec.ts`, `trust-safety.e2e-spec.ts`).

### Follow-up (founder-requested verification pass, commit `6a03467`+)
Founder asked for explicit confirmation that no code path still resolves
or depends on a "Free" plan - a targeted audit (not an assumption) found
one genuine functional bug and several stale UI strings, both fixed here:
- **Bug**: `CrossSaasEligibilityController` (FR-24.14) still gated on
  `plan.tierOrder > 0` to mean "on a paid plan" - since First Month is now
  tierOrder 0 and paid, this incorrectly marked every seller in their
  first month as ineligible for the cross-SaaS discount. Fixed to check
  `subscription.status === "active"` instead, since every plan is paid
  now and the distinction collapses to active vs. cancelled.
- **Stale copy** (no behavior change, just wrong text): the team-leave
  page said a member "downgrades to Free" (now Starter, matching
  `scheduleDowngradeToStarterAtPeriodEnd`); the customizer branding
  toggle said branding removal was "Mandatory on the Free plan" (now
  correctly states Pro/Team-only, matching the Module 44 branding fix).
- **Not changed** (confirmed correct, not a Free-Plan leftover): the
  `price === "0" ? "Free" : ...` price-label helpers on the marketing/
  pricing/billing pages - these remain accurate for Team plans, which
  are genuinely seat-priced with a Rs 0 base price by design (unrelated
  to the retired individual Free Plan); no individual plan has price 0
  anymore, so this branch is simply unreachable for individual plans.
- Test coverage: rewrote `module18-external-saas-hooks.e2e-spec.ts`'s
  eligibility test to assert active-vs-cancelled instead of the retired
  free-vs-paid distinction; verified full suite (51/51 suites, 396/396
  tests) plus unit suite (38/38 suites, 186/186 tests) still green.

## Module 37: Advanced Granular Admin Control

SRS §5.54/§14.54, FR-54.1-54.6. Four narrow, audit-logged admin controls
beyond the existing suspend/ban ladder, all reusing existing mechanisms.
Sixth and final module of the "Pre-Launch Enhancements" batch (v0.32) -
the UZEYN rename pass is next.

### Added
- **Seller-scope listing block** (FR-54.1) - new `catalog.listing_blocked`
  Settings Registry key (`["global", "seller"]`), checked in
  `ProductsService.create()` alongside the existing
  `catalog.product_limit` check. Blocks only NEW product creation; a
  blocked seller's already-listed products are untouched.
- **Instant single-product takedown** (FR-54.2) - new `admin_removed`
  `ModerationStatus` value. `ModerationService.approve()`/`reject()` both
  hard-require the product be `pending`, so this needed two new methods,
  `forceRemove()`/`restore()`, with no precondition on the product's
  current status - an admin can remove/restore a product regardless of
  whether it was approved, pending, or anything else
  (`POST /admin/products/:id/remove`/`restore`, a new controller
  deliberately NOT decorated with `@AllowReviewer()`, since this is a
  stronger action than the REVIEWER sub-role is scoped to). Storefront
  exclusion is automatic and required no changes to any existing
  storefront query - `admin_removed` is deliberately never added to
  `PUBLIC_MODERATION_STATUSES`, the existing allowlist every
  storefront-visible product query already filters through.
- **Supplier-listed product block/approve** (FR-54.3) - reuses the
  existing Moderation Queue (Module 6) exactly as built; a
  supplier-sourced listing already lands in the same `pending` queue as
  a self-fulfilled one. The real gap closed here was visibility: the
  admin terminal's queue view now shows each queued product's source
  (self vs. supplier-listed), so an admin can identify and act on
  supplier-attributed listings via the same existing approve/reject
  buttons - no new queue.
- **Per-seller feature-flag override** (FR-54.4) - a new "Settings
  overrides" section on the Seller 360 page (Module 25), a
  seller-pre-filled convenience over the already-generic
  `PUT /admin/settings/values`/`GET /admin/settings/resolve` endpoints
  (the seller-scope write path itself was already proven end-to-end by
  an existing Module 25 e2e test and reachable from the standalone
  `/admin/settings` page - this module's real new surface is the
  Seller-360-scoped UI, not first-time wiring).
- Every action across all four controls calls the existing
  `AuditLogService.record()` with before/after values (FR-54.5).
- Additive to, not a replacement for, the existing `SellerLifecycleStatus`
  ladder (active→warned→restricted→suspended→banned) - untouched by
  anything in this module (FR-54.6).
- e2e coverage: a listing-blocked seller can't create a new product but
  keeps its existing listings visible; force-removing an approved
  product makes it instantly storefront-invisible and restoring it
  brings it back, both audit-logged; a supplier-listed product surfaces
  with `sourceType: "supplier"` in the existing queue and can be
  approved through it with no new queue; a seller-scope override on
  `catalog.listing_blocked` blocks one seller while a second seller on
  the same plan is provably unaffected.

## Module 36: Admin Email Section

SRS §5.53/§14.53, FR-53.1-53.5. UZEYN's own unified inbox in the admin
terminal - link SMTP+IMAP email accounts, read/reply across all of them
from one place. Fifth module of the "Pre-Launch Enhancements" batch
(v0.32).

### Added
- `AdminEmailAccount` model (new `admin_email_accounts` table),
  admin-global - same "no RLS, gated by `AdminAuthGuard`, inherently
  precedes tenant context" category as `AdminAuditLog`/
  `ImpersonationSession`, since this is the founder's own inbox, not a
  seller-facing feature.
- **IMAP+SMTP credentials encrypted at rest** under their own
  independent `ADMIN_EMAIL_CREDENTIAL_ENCRYPTION_KEY` - same AES-256-GCM
  `iv:authTag:ciphertext` shape as `smtp-credential-crypto.util.ts`, kept
  as its own key so it rotates independently (FR-53.2).
- **Unified inbox** (`AdminMailService`) - connects to each linked
  account's real IMAP server (via `imapflow`) on demand, merges the most
  recent messages from every linked account into one date-sorted list
  (FR-53.3).
- **Reply always via the originating account's own SMTP credentials**
  (`nodemailer`), never a shared/default sender - the founder replies
  personally as themself from the correct address (FR-53.3).
- **No AI** in v1.0 - no summarization, suggested replies, or
  auto-triage; AI-assist for this section is a roadmap-only note (§5.22)
  (FR-53.4).
- Every link/unlink action is recorded to `AdminAuditLog` (not the
  Platform Event Log - this is a genuine admin action on an admin-scoped
  resource, distinct from Staff Accounts' seller-side logging) with
  before/after values (FR-53.5). A separate on-demand test-connection
  endpoint checks both IMAP and SMTP connectivity without gating
  account creation on it.
- Bare functional admin terminal screen (`/admin/email`) - link/unlink
  accounts, test connection, unified inbox, reply.
- e2e coverage (against real in-process IMAP servers via
  `hoodiecrow-imap` and real SMTP test servers, not mocks): credentials
  never appear in plaintext in an API response, two linked accounts'
  messages merge into one date-sorted list, a reply uses the originating
  account's own SMTP server, and every link/unlink is audit-logged with
  before/after values.

## Module 35: Staff Accounts, plan-tier

SRS §5.52/§14.52, FR-52.1-52.6. Scoped, role-based, audit-logged staff
sub-accounts for a seller, gated by plan-tier capacity. Fourth module of
the "Pre-Launch Enhancements" batch (v0.32).

### Added
- `StaffAccount` model (new `staff_accounts` table, seller-scoped, no
  RLS - same "explicit `sellerId` filter via `PrismaAdminService`"
  discipline as `SellerVerificationEmail`, since a staff account's access
  spans every store the owner has, not one store).
- Fixed, explicit permission scopes: `orders`, `catalog`, `discounts`,
  `customers`, `design` - deliberately excludes `billing`/`payment-
  instructions`/`wallet`/`plan`, which stay owner-only regardless of a
  staff session's assigned scopes (FR-52.2/52.3). The `design` scope
  exists specifically so a seller can hand a designer store-design-only
  access to the theme customizer, without exposing orders or customer
  data - the intended on-ramp to a future D-Studio designer-access flow.
- **Plan-tier staff capacity** (`staff.max_accounts`, resolved via
  `SubscriptionsService.getPlanContext()`, same check-then-act shape as
  `catalog.product_limit`) - Free defaults to zero staff accounts
  (FR-52.5/52.6).
- Staff sessions authenticate via their own login endpoint
  (`POST /staff/auth/login`) and carry a JWT issued with the *owner's*
  `sellerId` plus new `staffAccountId`/`scopes` claims - every existing
  `@CurrentSellerId()`-based controller and RLS policy resolves tenant
  scope correctly with zero code changes, same precedent as impersonation
  session tokens.
- `@RequireStaffScope()`/`StaffScopeGuard` (opt-in allowlist, applied to
  `OrdersController` for `orders` and to the theme-settings/branding
  controllers for `design`) and `@BlockStaffSessions()`/
  `BlockStaffSessionsGuard` (explicit hard block, applied to
  wallet/invoices/payment-instructions/subscriptions controllers) - two
  complementary mechanisms rather than a global default-deny guard, which
  NestJS's guard execution order (global guards run before controller-
  level `JwtAuthGuard`) would make silently ineffective.
- Every write a staff session performs is tagged to the Platform Event
  Log as `staff_account.action` (actor = the staff account, not the
  owner) via a generic HTTP-layer interceptor, same approach as
  `ImpersonationAuditInterceptor` (FR-52.4).
- Owner-only staff management screen (`/stores/:storeId/staff-accounts`)
  - create with a scope picker, list with live status, revoke.
- e2e coverage: zero capacity on Free with plan-tier limit raising it,
  scope-based route access (orders vs. design, each way), owner-only
  surfaces staying unreachable even for a staff session scoped to
  everything assignable, Platform Event Log tagging on writes (not
  reads), and login failing after revocation.

## Module 34: Email Campaigns

SRS §5.51/§14.51, FR-51.1-51.7. Basic campaign/newsletter sends to exactly
one saved segment (Module 33), via the seller's own connected SMTP
sender. Third module of the "Pre-Launch Enhancements" batch (v0.32) - the
dependency the founder called out ("Customer Segments before Email
Campaigns") now pays off directly.

### Added
- `EmailCampaign` model (new `email_campaigns` table, RLS-isolated) -
  reuses Module 26's `SellerVerificationEmail` connected-sender record
  and `smtp-credential-crypto.util.ts` for sending (FR-51.1); no new
  credential store or encryption key.
- **Plan-tier monthly send quota** (`email_campaigns.monthly_send_limit`,
  resolved via `SubscriptionsService.getPlanContext()`, same pattern as
  `catalog.product_limit`) - the check runs before the campaign row
  exists or anything is queued, so an over-quota send is rejected
  entirely, never partially sent (FR-51.2).
- **Unsubscribe handling** - the first such mechanism in this codebase.
  `Customer` gains `unsubscribedAt`/`unsubscribeToken`; the raw token is
  stored directly (not hashed like password-reset tokens) since it must
  keep working for the customer's lifetime and the worst case of it
  leaking is an unwanted unsubscribe, not an account takeover.
  Suppression is re-checked live at actual send time, not only against
  the count captured at campaign creation (FR-51.3). Resolves through a
  new `/unsubscribe` page in `apps/web`, mirroring the existing
  `/verify-email`/`/reset-password` token-link pattern.
- **Honest deliverability note**, always visible in the campaign
  composer: sends go through the seller's own SMTP credentials with no
  platform-level sender-reputation warming (FR-51.4).
- **No AI** - campaign subject/body is entirely seller-authored (FR-51.5).
- Campaign sends run as a BullMQ background job
  (`EmailCampaignsService.processCampaign()`, new `email-campaigns`
  queue) and are logged to the Platform Event Log as `campaign.sent`
  (FR-51.6/51.7).
- Seller dashboard screen (`/stores/:storeId/campaigns`) - compose and
  send a campaign to a segment via a connected sender, recent-campaigns
  list with live send/fail counts.
- e2e coverage (against a real in-process SMTP server, not a mock): send
  via connected sender as a background job with a Platform Event Log
  assertion, monthly quota blocking a whole campaign before anything
  sends, unsubscribe excluding a still-matching customer from a
  subsequent send (link extracted from the actual sent email), RLS
  cross-tenant isolation.

## Module 33: Customer Segments

SRS §5.50/§14.50, FR-50.1-50.6. Saved filters over the existing CRM
customer list (order count, total spent, last-order date, location).
Second module of the "Pre-Launch Enhancements" batch (v0.32) - the
founder's one explicit dependency ("Customer Segments before Email
Campaigns") - built as the foundation the next module's send targeting
will read from.

### Added
- `CustomerSegment` model (new `customer_segments` table, RLS-isolated) -
  a saved filter only, holding typed nullable bound columns
  (`minOrders`/`maxOrders`/`minTotalSpent`/`maxTotalSpent`/
  `lastOrderAfter`/`lastOrderBefore`/`locationCity`/`locationCountry`).
  Deliberate refinement over the SRS's looser "structured JSON criteria"
  wording: the dimension set is small and fixed, so typed columns match
  this codebase's existing convention of reserving JSON for genuinely
  free-form data.
- **Membership is always resolved live**, never stored: every read
  (list/get/preview) re-queries `Customer.ordersCount`/`totalSpent`/
  `lastOrderAt` (tracked since Module 15) plus each candidate's most
  recent order's `shippingAddress` for the location filter, through one
  shared `matchesSegmentCriteria()` pure-function so "matches this
  segment" has exactly one definition regardless of caller.
- `POST/GET/PATCH/DELETE /stores/:storeId/customer-segments`,
  `POST /stores/:storeId/customer-segments/preview` (member count for
  unsaved criteria, before committing to a segment).
- Seller dashboard screen (`/stores/:storeId/customer-segments`) - create
  a segment from any combination of the filters above, view its live
  member list inline, delete.
- e2e coverage: CRUD + tenant isolation, live re-derivation as a
  customer's order count crosses a segment's threshold (no change to the
  segment row itself), location filter resolving from each customer's
  most-recent (not first) order, RLS cross-tenant 404s.

## Module 32: Gift Cards

SRS §5.49/§14.49, FR-49.1-49.7. Purchasable and seller-issued store gift
cards, redeemable at checkout with partial redemption and a
ledger-derived balance. First module of the "Pre-Launch Enhancements"
batch (v0.32), built before the design phase resumes.

### Added
- `GiftCard`/`GiftCardRedemption` models (new `gift_cards`/
  `gift_card_redemptions` tables, RLS-isolated) - mirrors `DiscountCode`'s
  store-scoped unique-code pattern; balance is atomically guarded on
  redemption (same idiom as `DiscountCode.usageCount`) and always
  reconcilable against `initialValue - sum(redemptions)`.
- Two issuance paths: buyer-purchased (`POST /storefront/gift-cards/purchase`,
  public, creates a `pending_payment` card) and seller-issued
  (`POST /stores/:storeId/gift-cards`, active immediately, never a
  revenue event).
- **Financial Truth Invariant applies**: a buyer-purchased card is
  unusable at checkout until the seller confirms payment
  (`POST /stores/:storeId/gift-cards/:id/confirm-paid`) - the sole path
  from `pending_payment` to `active`.
- Checkout redemption (`giftCardCode` on `POST /storefront/checkout`/manual
  orders) - a new `Order.giftCardAmount` field reduces the buyer's
  amount-due without touching `totalAmount` or `computeOrderTotals()`'s
  tax/shipping math, so commission continues to accrue on the full order
  total exactly as before. Reservation/release mirrors the existing
  supplier-stock reservation discipline if order creation fails after a
  redemption was reserved.
- Seller dashboard screen (`/stores/:storeId/gift-cards`) - issue, list,
  confirm payment.
- e2e coverage: issuance, Financial-Truth-gated purchase confirmation,
  partial redemption across two orders with commission verified
  unaffected, RLS tenant isolation, duplicate-code rejection.

## Built-in Store Templates (v0.31 design phase)

SRS §5.1 FR-1.1/FR-1.9/FR-1.10, docs/architecture.md's Template Package
Spec. First deliverable of the design phase (post feature-complete
Modules 1-31): four genuinely distinct, hand-designed built-in templates
replacing the original three structurally-only-distinct placeholders, a
"Start from blank" option, storefront branding, and THE ISOLATION RULE
enforced three separate ways.

### Added
- Four built-in templates - **Editorial** (serif display type, generous
  whitespace, lifestyle photography; free), **Studio** (geometric/grotesque
  sans, bold color-blocking; premium), **Market** (dense grid, utilitarian,
  many-SKU scanning; premium), **Atelier** (monochrome, minimal, restrained
  accent; free) - each its own section-component set under
  `apps/web/app/storefront/templates/`, selected via `registry.ts`'s
  name -> component-set mapping. The storefront page and the customizer's
  live preview both call the same registry function, so preview always
  matches published output by construction.
- **"Start from blank"** (free) - every section hidden by default; the
  seller composes from scratch using the same bounded customizer, not a
  different/freer system. A real free-form page-builder stays FR-1.6's
  Phase 2 coded-mode escape hatch, deliberately still deferred.
- **Storefront branding mark** ("Powered by eyosto") - mandatory on Free
  (the platform's own free organic marketing), removable only on a paid
  plan. New `BrandingModule`/`BrandingService`, two independent Settings
  Registry keys (`branding.powered_by_removable`, plan-scoped capability;
  `branding.powered_by_hidden`, store-scoped preference) so a downgrade to
  Free always reverts to showing the mark regardless of what the seller
  previously chose. Resolved server-side into `GET /storefront/store`'s
  `poweredByVisible` field - never left to the client to decide.
- `Theme.sortOrder` - deliberate, non-alphabetical default-assignment and
  picker-listing order (fixes a latent bug: with 3 free-tier theme rows
  now, alphabetical ordering would have silently made "Start from blank"
  the accidental default for every new store).
- **THE ISOLATION RULE**, enforced three ways: (1) structural - cart/
  checkout/order-status/wallet/verification components live entirely
  outside the templates directory, never imported by it; (2) static -
  `scripts/check-template-isolation.js`, wired into CI, fails the build if
  any template file imports that functional code (verified against a
  deliberately-introduced violation before being removed); (3) runtime - a
  template-invariance e2e suite running the full money path (mixed cart,
  discount, tax, mark-as-paid) once per template + blank, asserting order
  totals, ledger commission, wallet balance delta, P&L figures, and the
  confirmed outcome are byte-identical across all five runs.

### Fixed
- `themes.seed.ts`'s `create()`/`update()` upserts now actually rename/
  retier existing rows on rerun (previously `update: {}` was a no-op,
  which would have silently left stale names on an already-seeded dev
  database).

## Module 31 (Automated Profit & Loss Engine)

SRS §5.42, FR-42.1-42.7. Free v1.0 financial engine showing TRUE NET
PROFIT (not just revenue, unlike Shopify) - per order and per period,
computed from data the platform already holds (revenue, commission,
shipping, tax) minus seller-entered costs (product base cost, per-order
courier/handling, period ad spend). Financial Truth Invariant (§3.12)
applies unchanged: only `confirmed`+ orders ever count.

### Fixed
- **Build-time correction to FR-42.2's own formula.** The original spec
  text said to subtract `Order.discountAmount` from `totalAmount -
  taxAmount` when computing revenue. `computeOrderTotals()` already nets
  the discount out of `totalAmount` before shipping/tax are added
  (`taxableAmount = subtotal - discountAmount`), so subtracting it again
  would have silently understated every discounted order's revenue and
  profit by the discount amount a second time. Caught before ship,
  corrected in both the SRS text and the implementation, and locked in by
  an explicit regression test (`pnl.util.spec.ts`).

### Added
- Schema: `ProductVariant.baseCost` (optional COGS input - null, never 0,
  when unset, so an un-costed variant is always visibly flagged rather
  than silently treated as free), `Order.courierCost`/`handlingCost`
  (optional per-order costs), and a new tenant-isolated `AdSpendEntry`
  model (manual or CSV-imported, period-scoped).
- `PnLService`: `getOrderProfit()` (per-order true net profit, 400s for
  any order not yet `confirmed`+), `getPeriodProfit()` (sums confirmed+
  orders placed in a date range minus ad-spend entries whose period
  overlaps it - overlap, not containment, so a split-period entry counts
  in full rather than being pro-rated), and ad-spend CRUD.
- Ad-spend CSV import reuses Module 15/28's exact `ImportJob`/queue/
  error-report machinery via a third `ImportJobType` branch
  (`ad_spend_import`) - no new import engine.
- `AdSpendEntry.source` (`manual`/`csv_import`) is a documented extension
  point for a future Facebook/TikTok ad-spend API source value - that
  automated integration stays a roadmap note, not built now.
- New `/stores/[storeId]/pnl` dashboard screen: period selector, revenue
  vs. net profit shown side by side (the headline differentiator), full
  cost breakdown, an "incomplete" warning when any order in the period
  has an un-costed variant, and the ad-spend list/entry form/CSV upload.
  Order-detail page gained a "Costs & profit" section (courier/handling
  cost inputs plus that order's own profit breakdown, shown once
  confirmed+).

## Module 30 (WhatsApp Semi-Automation)

SRS §5.41, FR-41.1-41.4. Three seller-clicked WhatsApp deep-link generators
reusing existing machinery end-to-end - the `wa.me` construction from
Module 26's WhatsAppOtpAdapter, order/tracking state from Modules 9/27, and
abandoned-cart flagging from Module 9/15.2. v1.0 never sends anything
itself; every endpoint returns a link the seller taps to send from their
own connected WhatsApp app. Fully automated WhatsApp Business API sending
stays a documented roadmap note (FR-41.4), not built now.

### Fixed
- Closed a gap flagged when FR-41.2 was first written: `Cart.buyerWhatsapp`
  (the column has existed since Module 26) was never wired to capture -
  `POST /storefront/cart` now accepts it as an optional field alongside
  the required `buyerEmail`, at the same email-first step, matching FR-15.1's
  one-step design.

### Added
- `WhatsAppMessagingService` (new `whatsapp-messaging` module):
  `generateOrderConfirmationLink()` (available once an order is confirmed),
  `generateShippingUpdateLink()` (available once tracking is uploaded, using
  the same `TrackingUpdate` rows Module 27's timeline reads), and
  `generateCartRecoveryLink()` (available once a cart is flagged
  `abandoned`) - each requires a captured WhatsApp number and returns 400
  with a clear message otherwise, never inventing one.
- Three new Settings-Registry templates (`whatsapp.order_confirmation_template`,
  `whatsapp.shipping_update_template`, `whatsapp.cart_recovery_template`),
  seller-editable per store, with `{{order_number}}`/`{{store_name}}`/
  `{{total}}`/`{{tracking_id}}`/`{{item_summary}}`-style placeholders.
- `listAbandonedCarts()` backs a new `hasWhatsapp` flag so the seller-facing
  list can show which carts are actually actionable.
- Two new buttons on the order-detail page ("Send WhatsApp confirmation" /
  "Send shipping update", gated on order status + a captured number) and a
  new dedicated `/stores/[storeId]/whatsapp` abandoned-cart recovery screen.
- Storefront checkout's email-first step now has an optional WhatsApp
  number field, wired through to the new cart-capture path.

## Module 29 (Delivery-Time Badges)

SRS §5.40, FR-40.1-40.3. A buyer-trust storefront surface for supplier-
sourced items, reusing Module 8's existing per-request `supplierShipping`
transparency payload — no new data collected or computed.

### Fixed
- `StorefrontService.search()` and `.getCollection()` never populated
  `supplierShipping` (only `listProducts()`/`getProduct()` did) — a real
  pre-existing gap relative to FR-40.1's "search/collection/discovery
  grids" requirement, closed here rather than carried forward.

### Added
- `PublicProduct.supplierShipping` now typed on the web app (was silently
  untyped/unused before); `resolveDeliveryBadge()`/`<DeliveryBadge>`
  (`apps/web/app/storefront/delivery-badge.tsx`) render "Ships in X-Y
  days"/"Delivers to: …" — null for self-fulfilled products, and each line
  suppressed independently if its own data is incomplete, never the whole
  badge.
- Wired into the shared `FeaturedProductsSection` grid (home/search/
  collection pages all use it) and the product detail page.

## v0.31 — Built-in Email Verification, Shopify Migration, Cost-Savings Calculator, Public Store Badges, Emotional/Retention Layer, Community & Belonging (SRS amendment ahead of Modules 32-37)

Founder-requested: six new feature areas, slotted 32 → 33 → 34 → 35 → 36 →
37 after the already-approved Modules 29-31. See `docs/build-plan.md`'s "v0.31
slotting decision" for the full reasoning, including the deliberate deviation
of building a single shared `BadgeEvaluationService` (Module 35) consumed by
both the public storefront badges (§5.46) and the private dashboard
achievement badges (§5.47/Module 36).

### Added
- New §5.43 Built-in Email Verification Service (FR-43.1-43.6) — a 4th,
  platform-hosted verification channel option alongside the existing
  WhatsApp OTP/seller-SMTP Email OTP/Prepaid Confirmation, plan-quota-gated,
  designed with a documented extraction seam for a future standalone SaaS.
- New §5.44 One-Click Shopify Migration (FR-44.1-44.5), extending the
  existing CSV import engine into a guided multi-entity flow.
- New §5.45 Cost-Savings Calculator (FR-45.1-45.3), a Settings-Registry-
  driven marketing-site widget.
- New §5.46 Public Store Badges (FR-46.1-46.5) and §5.47 Emotional/
  Retention Layer (FR-47.1-47.6, dashboard achievement badges + milestone
  celebrations) sharing one Badge Evaluation Engine.
- New §5.48 Community & Belonging (FR-48.1-48.5) — success-story
  submissions, admin curation, opt-in Featured Sellers surface.
- Four new risk register rows (25-28).
- Platform stays English-only in v1.0 (no Urdu/Hinglish); i18n-readiness
  reaffirmed as intact for a future rebuild.

## Module 28 (Inventory Management)

SRS §5.39, FR-39.2-39.6. A dedicated stock-levels-and-adjustments surface,
distinct from the Products catalog screen, reusing the existing import-job
machinery for bulk CSV stock edits rather than a new import engine.

### Added
- `InventoryService.listInventory()` — per-variant stock quantity + a
  Settings-Registry-driven (`inventory.low_stock_threshold`, default 5)
  `isLowStock` flag, backing `GET /stores/:storeId/inventory`.
- `InventoryService.adjustStock()` — manual increment/decrement/set
  adjustment, writing an append-only `StockAdjustment` log row (user,
  timestamp, before/after quantity, reason); no endpoint edits or deletes
  a log row, and the table `REVOKE`s `UPDATE`/`DELETE` at the Postgres role
  level as a second, independent backstop.
- A new `stock_import` `ImportJobType`, reusing Module 15's
  `ProductImportService`/`ImportJobsService`/BullMQ worker machinery in a
  narrower mode (SKU + Quantity columns only — never price/title/etc.),
  via a new `POST /stores/:storeId/stock-import-jobs` endpoint.
- Module 24's Data Export bundle extended with a new `inventoryCsvKey`
  artifact, following the same private, ownership-checked download path as
  every other export file.
- New dashboard screen `/stores/[storeId]/inventory` (stock list, low-stock
  filter, expandable per-variant adjustment form + history) and a "Bulk
  update stock" upload card added to the existing Import & export page.

## v0.30 — Tracking Timeline, Delivery-Time Badges, WhatsApp Semi-Automation, Automated P&L Engine (SRS amendment ahead of Module 27)

Founder-requested: four features layered onto the already-planned Module 27
(Orders Command Center), slotted 27 → 28 (unchanged) → 29 → 30 → 31. See
`docs/build-plan.md`'s "v0.30 slotting decision" for the full reasoning.

### Added
- SRS §5.38 extended with FR-38.4 (role-based tracking upload, reaffirmed
  not rebuilt), FR-38.5 (public+seller computed status timeline), FR-38.6
  (Financial Truth Invariant reaffirmed for the Command Center).
- New §5.40 Delivery-Time Badges (FR-40.1-40.3).
- New §5.41 WhatsApp Semi-Automation (FR-41.1-41.4).
- New §5.42 Automated Profit & Loss Engine (FR-42.1-42.7).
- New risk register row 24: misleading profit figures from incomplete/
  dishonest seller-entered cost data — mitigation is to never silently
  treat a missing cost as zero and to visibly flag incomplete profit
  figures.

## Module 27 (Orders Command Center + Tracking Timeline)

SRS §5.38, FR-38.1-38.6. A single screen surfacing exactly what a seller
needs to act on next, plus a computed order-status timeline shared,
byte-for-byte, between the seller's own order-detail view and the buyer's
public order-status page.

### Added
- `OrdersOverviewService.getOverview()` — bucketed order counts (pending,
  awaiting verification, prepaid received, awaiting tracking, shipped,
  delivered, cancelled/returned) plus a supplier-items-awaiting-fulfillment
  count, backing a new `GET /stores/:storeId/orders/overview` endpoint.
- `orderBucketWhereClause(bucket)` — the single Prisma `where` clause each
  bucket's count AND its list-filter click-through both use, so "the count
  says 3" and "the filtered list has 3 rows" can never disagree (FR-38.2)
  by construction, not just by convention.
- `computeOrderTimeline()` — a pure function deriving a `placed → confirmed
  → shipped → delivered` (or `placed → cancelled`) timeline from existing
  `OrderTimelineEvent` rows, called identically by the public
  `OrderStatusLookupService` and the seller-facing `OrdersService.getOne()`
  — the same computation, never a second stored copy, so the two surfaces
  can never show different timelines for the same order (FR-38.5).
- Seller dashboard: bucket-count cards above the orders list (click to
  filter), an order-timeline card on the order-detail page, and a matching
  timeline stepper on the public buyer-facing order-status page.
- Role-based tracking upload (seller for self-fulfilled items, supplier for
  supplier-fulfilled items) reaffirmed via new e2e coverage — the
  underlying `OrdersService.uploadTracking()` / `SupplierOrdersService.
  uploadTracking()` methods already existed correctly since Modules 8/9 and
  were not modified.

### Verified
- Bucket-sum invariant: every bucket count sums to the store's total order
  count, with zero orders double-counted or dropped.
- Bucket click-through returns exactly the orders counted in that bucket.
- Timeline advances correctly across pay → track → deliver, and the public
  view's timeline exactly equals the seller view's timeline for the same
  order.
- A supplier cannot upload tracking for another supplier's order item
  (cross-supplier upload → 404; owning supplier's upload → 201).
- A pending/awaiting-verification order is visible on the Command Center
  but never counted as a confirmed sale (Financial Truth Invariant).

## Module 26 (Order Verification Channel Adapter)

SRS §5.37, FR-37.1-37.9. Founder-requested competitive gap: Shopify ships
no order-verification mechanism at all, and fake/return orders are
Pakistani sellers' #1 pain point. A seller can now require buyers to
confirm an order before it counts as a sale.

### Added
- New `VerificationChannelAdapter` interface (mirrors `TopUpAdapter`/
  `TitleVerificationAdapter`'s one-interface-per-integration-point shape)
  with three v1.0 implementations a seller picks between, per store:
  `WhatsAppOtpAdapter` (manual/link-assisted `wa.me` deep link — v1.0 never
  sends anything itself, interface leaves room for a future automated
  WhatsApp Business API adapter), `EmailOtpAdapter` (sent through the
  seller's own connected SMTP account via `nodemailer`, never the
  platform's `EmailService`), and `PrepaidConfirmationAdapter` (a manual
  "mark deposit received" action, the same human-in-the-loop shape as
  `OrdersService.markAsPaid()`).
- New Prisma models: `OrderVerification` (one row per order that needs
  verification — channel snapshot, hashed OTP, expiry, attempt count,
  status) and `SellerVerificationEmail` (a seller's 1-5 connected SMTP
  senders, credentials AES-256-GCM-encrypted under a new
  `SMTP_CREDENTIAL_ENCRYPTION_KEY`, with daily send-count tracking for
  rotation once one sender hits its cap).
- Extends (never duplicates) the Financial Truth Invariant (§3.12): a
  store with verification enabled gates its orders' `pending` →
  `confirmed` transition on verification success, exactly as it already
  gates on payment — `OrdersService.markAsPaid()` now checks
  `OrderVerificationService.isClearedForConfirmation()` first.
  `CheckoutService.placeOrder()` also gains a pre-checkout "store
  readiness" gate (same style as the existing payment-instructions/CNIC/
  publish checks): an Email OTP store with no connected sender can't
  accept a checkout it could never verify.
- OTP handling — 6-digit codes, SHA-256 hashed (never stored in plaintext),
  time-limited, retry-capped, single-use, with a rate-limited resend — is
  fully Settings-Registry-driven (`orders.verification_channel` at `store`
  scope, plus OTP TTL/cooldown/retry-cap/daily-send-cap), never
  hard-coded. The seller's own resend action deliberately bypasses the
  resend cooldown (that cooldown rate-limits buyer-triggered resends, not
  a seller fetching the wa.me link they need to send manually).
- Seller-facing bare-functional UI (`/stores/:id/order-verification`):
  channel selection, OTP message template editor, and connected-sender-
  email management (connect/revoke) — no design pass yet, per the
  founder's own instruction for this feature.
- Buyer-facing public endpoints (`/storefront/order-verification/:token/
  verify` and `/resend`), gated by the same unguessable
  `statusLookupToken` as the existing order-status lookup.

### Fixed
- `env.validation.spec.ts`'s base fixture was missing the new
  `SMTP_CREDENTIAL_ENCRYPTION_KEY` field, failing 7 unrelated tests.
- `billing.e2e-spec.ts` backdated ledger entries by a fixed "35 days ago"
  to land in "last calendar month" — silently wrong whenever today's
  day-of-month made 35 days undershoot past all of last month (e.g. early
  in a month following a 31-day one). Replaced with a date-safe
  `date_trunc('month', NOW() - INTERVAL '1 month') + INTERVAL '15 days'`.

## Module 19 (Product Design System) — Phase 1 of 8: foundation

Platform name is now official — **eyosto**. Founder-directed 8-phase
design pass across the whole product; this entry covers Phase 1 only.

### Added
- Real type scale (`text-display` through `text-eyebrow`), two marketing-
  rhythm spacing tokens, `shadow-xl`, `radius-full`, and two new easing
  curves (`ease-in`, `ease-emphasized`) plus `duration-slower` in
  `apps/web/app/globals.css`, mirrored as JS constants in the new
  `apps/web/lib/motion.ts` for GSAP.
- Plus Jakarta Sans added as the display typeface (headlines/hero/
  wordmark) alongside the existing Inter body face.
- "eyosto" typographic wordmark replacing the old "goto5x" glyph-mark +
  text lockup (`components/dashboard/Sidebar.tsx`).
- shadcn/ui-style component kit: existing `Button`/`Card`/`Badge`/`Alert`/
  `Field`/`EmptyState`/`PageHeader`/`Spinner`/`Disclosure` upgraded in
  place (same import paths/props, full 8-state coverage); twelve new
  Radix-based primitives (`Label`/`Checkbox`/`Switch`/`Tabs`/`Table`/
  `Dialog`/`DropdownMenu`/`Avatar`/`Progress`/`Skeleton`/`Tooltip`/
  `Separator`) plus a toast system.
- Two reusable GSAP motion primitives: `Reveal` (scroll-triggered fade/
  rise-in, reduced-motion aware) and `Magnetic` (cursor-follow hover for
  a page's single primary CTA).
- `/design-system` — the live token + component contract page every later
  phase is checked against.

### Not yet built (Phases 2-8, same module, next)
Marketing site, auth/onboarding, dashboard (core + remaining), buyer
storefronts, admin terminal — no page outside `/design-system` has been
visually restyled yet.

## Module 19 (Product Design System) — Phase 1 redo (v1.1)

Phase 1 above was **founder-rejected on visual direction** (Plus Jakarta
Sans read as "friendly startup," not "premium minimal"). This is the
corrected Phase 1, same checkpoint gate — not a new phase.

### Changed
- Display typeface: Plus Jakarta Sans → **Geist** (`geist` npm package,
  `next/font/local`), in `apps/web/app/layout.tsx`. Inter unchanged as the
  body/UI face.
- `apps/web/app/globals.css`: neutrals rewritten to an ink-on-paper palette
  (`--color-canvas: #faf9f6`, `--color-ink: #0a0a0a`); type scale rebuilt
  with bigger clamps, tighter large-size tracking (-0.02em to -0.04em),
  and one uniform heading weight (700, was a 600/700 mix);
  `--spacing-section`/`-lg` doubled; shadows softened.
- `/design-system` page rebuilt to the new tokens (swatches, labels,
  copy, and section spacing all corrected).

### Added
- `/design-system/type` — Geist vs. Instrument Sans (tightened) side-by-side
  comparison at matched scale/tracking/weight, with the decision reasoning
  written out on the page.
- Real hero section at `apps/web/app/page.tsx` (the platform's actual
  marketing homepage): wordmark nav, staggered GSAP headline entrance,
  magnetic primary CTA, subtle scroll cue.

### Fixed
- Scroll cue initially used `Reveal` (GSAP ScrollTrigger) on a
  `position: fixed` element; ScrollTrigger cannot resolve a valid trigger
  position for fixed elements on a non-scrolling page, so it stayed at
  `opacity: 0` permanently. Replaced with a plain CSS fade-in.

## Module 19 (Product Design System) — Phase 2: marketing site

Full marketing site built to the founder's scroll-driven-storytelling
spec, judged against dayos.com/tasteskill-class landing pages rather than
"clean minimal." Same checkpoint gate as Phase 1.

### Added
- Homepage (`apps/web/app/page.tsx`) rebuilt end to end: nav, hero (raw
  WebGL1 signature moment behind the headline, `Hero3D.tsx` - no Three.js,
  static SVG gradient fallback is the real LCP candidate), social proof,
  problem→solution narrative, a pinned horizontal-scroll feature-card rail
  (`HorizontalScrollCards.tsx`), a real-product-screenshot section (three
  `DeviceMockup` frames around actual screenshots of the seeded "Northline
  Goods" store, not stock photos), templates teaser, stat counters, live
  `/plans`-fed pricing, testimonials (explicitly labeled placeholder),
  FAQ, and a final CTA band.
- `/pricing` rebuilt the same way: live `/plans` fetch across
  Individual/Team/Supplier tiers, FAQ.
- New marketing primitive components (`apps/web/components/marketing/`):
  `MarketingNav`, `MarketingFooter`, `SectionTitle`, `FeatureCard`,
  `PricingCard`, `TestimonialCard`, `FAQAccordion`, `StatCounter`,
  `DeviceMockup`, `ImageStack`, `LogoStrip`, `HorizontalScrollCards`,
  `AbstractGraphic` (code-generated gradient mesh/dot grid, no stock
  assets), `Hero3D`.
- `/about` — mission/values/stats shell in the same design language.
- `/careers` — public listing wired to the real `GET /careers` API
  (Module 22 Phase B) with an apply-with-CV dialog against
  `POST /careers/:id/apply`, not placeholder copy.
- `/legal/[slug]` — renders the real drafts in `docs/legal/*.md` (terms,
  privacy, refund-policy, plus the two growth/verified-store terms docs)
  through a small purpose-built markdown renderer
  (`apps/web/lib/legal-markdown.tsx`); intentionally reads the on-disk
  drafts rather than the `ContentPage` API, since these are still
  unreviewed-by-counsel drafts, not admin-editable copy yet.
- `/design-system/color-ab` — founder-requested color A/B: the hero + one
  more section rendered twice, monochrome default vs. a warmer "energy"
  accent (`[data-marketing-theme="energy"]` in `globals.css`, same scoped-
  CSS-variable mechanism as the existing dashboard-theme presets). Not
  linked from nav/footer and not a shipped page - a screenshot-comparison
  surface only.

### Fixed
- `Reveal.tsx`: a target carrying `.transition-smooth(-fast)` for its own
  hover/press state (e.g. `PricingCard`'s CTA) has its CSS
  `transition-property` default to `all`, which includes `opacity`/
  `transform` - the same two properties GSAP's reveal tween drives. The
  CSS transition engine and the tween fought over ownership of those
  properties, and the reveal could get permanently stuck at its `opacity:
  0` "from" state (found on `/pricing`'s `PricingCard` grids). Fixed by
  suspending the CSS transition for exactly the reveal's own animation
  window (`gsap.set(targets, { transition: "none" })` before the tween,
  `clearProps: "transition"` in `onComplete`), scoped to `Reveal` itself
  rather than weakening the shared `.transition-smooth` utility (which
  would have silently undone transform-based hover/press feedback on
  seven-plus other components).
- `middleware.ts`: added `marketing` to the exclusion matcher - `next/
  image`'s optimizer makes an internal re-entrant request for local
  images that was getting caught by the multi-tenant storefront rewrite.

## Module 25 (P0) — Admin Terminal Completion

### Added
- Admin HOME page (`GET admin/overview`, `/admin`) — today's signups/
  orders/GMV alongside every pending-queue count (wallet top-ups,
  Verified Store applications/re-review, moderation, T&S payment-review +
  five monitor types, growth-program applications/content/withdrawals,
  career applicants), each jump-linking to its queue.
- Global search (`GET admin/search?q=`, `/admin/search`) — partial name/
  email/ID match across sellers, stores, orders, and suppliers via raw
  `$queryRaw` + `Prisma.sql` (a partial match against a `@db.Uuid` column
  needs an explicit `::text` cast Prisma's typed query API can't express).
- Seller-360 page (`GET admin/sellers/:id/overview`,
  `/admin/sellers/:sellerId`) — one aggregated read across profile,
  stores (with live health score + verified status), wallet + recent
  ledger, invoices, growth-program participation, T&S flags, devices/
  sessions, and a merged audit-log + platform-event timeline, with inline
  actions (approve activation, lifecycle change, impersonate, wallet
  adjust) reusing already-guarded endpoints.
- Settings Registry write UI (`/admin/settings`) — a new `GET
  admin/settings/resolve` endpoint exposes the full precedence chain
  (every allowed scope's own override or its absence, plus who last
  changed it and when); the write form is type-aware (boolean/number/
  string/json, client-side min/max validation mirroring the server's own
  rules) with a confirm-with-old-vs-new-value step for high-impact keys
  (`billing.*`, anything containing "commission", `platform.maintenance*`).
- Wallet manual-adjust action (`POST
  admin/wallet-topups/sellers/:sellerId/adjust`) — a reason-required
  admin credit/debit, audit-logged, via two new `LedgerEntryType` values
  (`admin_manual_credit`/`admin_manual_debit`, migration
  `20260726090000_module25_admin_completion`).
- Shared admin nav (`apps/web/app/(admin)/admin/layout.tsx`) and a shared
  `admin-api.ts` fetch wrapper (mirroring the seller dashboard's
  `dashboard-api.ts`) — this admin section had neither before.
- Closed a real gap the completeness audit found: four seller-facing
  money-write endpoints (`POST sellers/me/wallet/topup-requests`, `POST
  sellers/me/subscription/change`, `POST
  sellers/me/subscription/redeem-promo`, `POST
  sellers/me/growth-programs/withdrawals`) had never been wired to the
  existing `@BlockDuringImpersonation()` mechanism (built Module 17) —
  all four now reject with 403 under an impersonation token.

## Module 25 (P1/P2) — Admin Terminal Completion, continued

### Added
- Frontend pages for the eight previously API-only admin surfaces:
  growth-programs applications/content-submissions/withdrawals queues
  (`/admin/growth-programs/*`), careers (`/admin/careers` — postings +
  the full applicant pipeline), a real commission-invoices screen
  (`/admin/commission-invoices`, correctly split from `/admin/invoices`'s
  own wallet-top-ups screen), supplier adapters
  (`/admin/supplier-adapters` — register/enable/disable/reconfigure
  without a deploy), an audit-log viewer (`/admin/audit-log`, read-only),
  admin-granted-plan + platform promo codes (added to `/admin/plans`),
  category creation (`/admin/categories`), and the T&S self-referral
  monitor panel (added to `/admin/trust-safety`). Every one of these
  reuses an already-built backend endpoint; suspend/terminate on an
  approved growth-program participant and a fraud clawback are wired on
  the seller-360 page instead (the applications queue only ever lists
  `pending` rows).
- System status page (`GET admin/system-status`, `/admin/status`) —
  genuinely new instrumentation: database/Redis/object-storage
  reachability plus every one of the 12 BullMQ queues' job counts
  (waiting/active/delayed/failed). Email delivery failures and backups
  are disclosed stub lines (no real email provider or backup mechanism
  exists yet in this environment), not faked data.
- Admin notification center (`GET admin/notifications`, `POST
  admin/notifications/mark-seen`, new `AdminUser.lastSeenNotificationsAt`
  column, migration `20260726150000_module25_p1_notification_center`) —
  diffs new/changed rows across every row-based admin queue since the
  admin's last-seen timestamp, with a nav-bar badge + dropdown.
- Bulk actions: checkbox multi-select + "approve/reject selected" on the
  moderation queue, "verify/reject selected" on wallet top-ups — both
  reuse the existing per-item endpoint via `Promise.all`, no new bulk
  backend endpoint.
- New e2e coverage for two surfaces that had none anywhere before this
  phase: the Creator content-submission verify/reject queue, and category
  creation — plus new coverage for the supplier-adapter registry, the
  audit-log list endpoint, system status, and the notification center.

## Module 24 — Seller Data Export to Personal Cloud Storage

### Added
- `SellerDataExport` (FR-36.1-36.5) — a seller-scoped, cross-store data
  export job. Triggers: automatically on each successful subscription
  renewal (`PlanFeeDebitService.runMonthlyDebitSweep()` returns
  `renewedSellerIds`, consumed by the worker's orchestration layer, not a
  direct `BillingModule -> DataExportModule` import — that edge would
  create a real module cycle through `MediaModule -> AuthModule ->
  GrowthProgramsModule -> BillingModule`); or on-demand, rate-limited to
  once per `data_export.on_demand_min_interval_hours` (Settings Registry)
  via a rolling check against the export table's own timestamps.
- Bundle contents (FR-36.2): trailing-period products/orders/customers
  CSVs (reusing `toCsv`, FR-18.2's primitive, via fresh date-ranged
  queries — not a modification of the existing single-store
  `CsvExportService`) plus one summary PDF (reusing the Playwright
  renderer via a new `InvoicePdfService.renderToBuffer()` that returns a
  buffer without uploading, avoiding a redundant second render for the
  Drive-upload path).
- Delivery (FR-36.3): Google Drive when the seller has an active,
  upload-scoped connection (`IDriveClient.createFolder`/`uploadFile`,
  under a widened OAuth scope including `drive.file`), else an email
  fallback. Pre-existing connections made under the old `drive.readonly`-
  only scope correctly degrade to email rather than attempting an upload
  they cannot perform.
- Non-blocking guarantee (FR-36.4): `DataExportService.processExport()`
  never throws — a generation or delivery failure is caught, logged, and
  recorded on the row as `status: "failed"` with a `failureReason`,
  including the case where the export row itself can't be found; the
  subscription renewal that triggered it is provably unaffected.
- Seller-facing UI: a "Data export" card on the store Settings page
  (request-on-demand button + export history, with per-file download
  links per the security fix below).
- Migration `20260725090000_module24_seller_data_export`.

### Fixed (v0.28, security, same-day follow-up before this module's
checklist could be approved as final)
- Export bundles contain customer PII (buyer emails/names/order details)
  and had initially been stored as plain, permanent, unsigned public
  MinIO URLs — the pattern every other file link in this app uses, but
  wrong specifically here. Fixed: files now live under a `private-exports/`
  object-storage prefix, never returned as a public URL anywhere;
  `SellerDataExport`'s `*CsvUrl`/`summaryPdfUrl` columns renamed to
  `*CsvKey`/`summaryPdfKey` (migration
  `20260725100000_module24_security_private_exports`) to make "internal
  key, not a URL" visible in the schema; the sole read path is a new
  ownership-checked, authenticated endpoint,
  `GET sellers/me/data-export/:exportId/download/:file`, streaming bytes
  via a new `ObjectStorageService.getObject()`; the list/history endpoint
  now returns `hasProductsCsv`/`hasOrdersCsv`/`hasCustomersCsv`/
  `hasSummaryPdf` booleans instead of any key or URL; the email fallback
  links to the dashboard's Data export card (login required) instead of
  a raw file link. Google Drive delivery is unaffected (that's the
  seller's own Drive, not this platform's storage). **Flagged, not
  fixed:** `Order.invoicePdfUrl` shares the original plain-public-URL
  pattern — lower severity (one buyer's own order, not a seller's full
  customer/order list) and deliberately out of scope here; added to
  `docs/SRS.md` §14.19 as a known hardening item for a future pass.
  `docs/launch-runbook.md` gained a required deploy-time step: the MinIO
  bucket policy must not grant anonymous reads on `private-exports/`.

## Module 23 — Store Health Score + Verified Store Program

### Added
- `StoreHealthScoreService` (FR-34.1-34.3) — a 0-100 composite score per
  store from seven Settings-Registry-weighted inputs (on-time fulfillment,
  cancellation rate, pending-forever rate, dispute/refund signals, profile
  completeness, account age (capped), moderation/risk history via §5.30's
  existing Risk Score Engine). Normalizes by the actual sum of the
  (editable) weights rather than assuming they total 100 — robust to an
  admin tweaking one weight without rebalancing the rest.
- `Store.policyText` (new field, FR-34.1's disclosed schema gap) —
  freeform, seller-editable from the store Settings page, shown on the
  storefront and counted toward profile completeness.
- `StoreHealthScoreHistory` (FR-34.2) — one row per scheduled recompute
  run (`StoreHealthSweepScheduler`, `store-health-sweep` BullMQ queue);
  the seller dashboard (`/stores/:id/health`) renders a trend and a
  plain-language breakdown of what's lowering the score, never raw
  weighted-sum math (FR-34.3, Simplicity Invariant §3.13).
- `VerifiedStoreApplication` + `Store.verifiedStatus`/`verifiedSince`/
  `verifiedExpiresAt`/`reReviewFlaggedAt`/`reReviewReason` (FR-35.1-35.6)
  — the Verified Store Program. A live eligibility portal
  (`GET /stores/:id/verification/eligibility`) evaluates 6+ months on the
  same verified custom domain, Store Health Score ≥ 80, CNIC verified,
  zero unresolved T&S flags, and a minimum confirmed-sales volume — all
  Settings-Registry-driven. The SAME check function gates `apply()`
  server-side, so the portal can never drift from the real enforcement
  gate (proven by an e2e test posting a failing application directly).
- New `LedgerEntryType` values `verification_fee_debit`/
  `verification_fee_refund_credit` — the application fee debits at apply
  time (before any admin decision), and a Settings-controlled policy
  (default: full refund) reverses it on rejection. The fee is explicitly a
  processing fee, never a purchase of the badge — an eligible applicant
  can still be rejected by the mandatory admin audit queue.
- The badge (`Store.verifiedStatus === "verified"`) is surfaced as
  `verified` on `GET /storefront/store` (`cache: "no-store"`) and rendered
  once in the shared `SiteHeader` component, which the checkout page also
  reuses — one code change satisfies both required render points
  (storefront header + checkout), with no propagation delay.
- `VerificationReReviewService` (FR-35.5/35.6, scheduled sweep) —
  independently checks every verified store for a Store Health Score drop
  below threshold OR a T&S enforcement action (`lifecycleStatus != active`),
  auto-flagging either trigger for re-review (badge suspended, no
  auto-revoke); separately expires annual re-verification (Settings
  toggle, default on) after 12 months, requiring a full fresh application
  through the same live eligibility + mandatory-audit path — never a
  rubber-stamp renewal.
- Admin queue (`AdminVerificationController`, `AdminAuthGuard`-only —
  money-adjacent, same discipline as every other control-plane money
  action): approve/reject applications (reject refunds the fee), resolve
  a flagged re-review (clear or confirm-revoke), and a standing direct
  revoke at any time (requires a reason, audit-logged).
- Migration `20260724120000_module23_store_health_verified_store`.
- `docs/legal/verified-store-program-terms.md` (draft, flagged for legal
  review) — the fee-is-processing-not-purchase framing, eligibility/
  revocation/re-verification terms.

## Module 22 Phase B — Careers (Module 22 complete)

### Added
- `JobPosting`/`JobApplication` (FR-33.8) — a minimal admin-editable
  content type reusing FR-12.1's "admin-managed, data not a deploy"
  discipline, without overloading the shared `ContentPage` table (a job
  posting needs its own status/pipeline shape).
- Public careers listing shows only `open` postings; a candidate applies
  with a CV upload through a dedicated size/type limit (5MB, PDF/Word
  only — a document limit, distinct from the media pipeline's 25MB image/
  clip limit), reusing the existing object-storage substrate.
- Application-pipeline stage labels (`received`/`reviewing`/
  `interviewing`/`rejected`/`hired`) are Settings-Registry-editable
  display text — the internal state machine stays fixed, only the
  outward label is admin data, mirroring FR-33.5's certificate-tier
  naming discipline.
- Applicant data (contact details, CV) never appears on any public
  endpoint — enforced structurally: only the `AdminAuthGuard`-protected
  controller ever queries `JobApplication`.
- Migration `20260723180000_module22_growth_partner_programs_phase_b_careers`.
- No referral, commission, or wallet code — fully independent of Phase A,
  as scoped.

## Module 22 Phase A — Growth & Partner Programs: shared referral engine

### Added
- The shared application/eligibility/approval shape (FR-33.2) for all
  three referral programs — no self-serve join; an admin may suspend or
  terminate any approved participant at any time.
- `ReferralAttribution`, unique per referred seller at the database level
  (FR-33.3) — the first valid attribution across any program wins,
  permanently; enforced by a real unique constraint, not application logic.
- Commission restricted to a referred seller's own paid plan-subscription
  amount only (FR-33.4) — wired into exactly one call site
  (`PlanFeeDebitService.debitDuePlanFees()`'s successful-debit branch), so
  it structurally can never accrue from wallet top-ups or a seller's own
  storefront GMV.
- Ambassador (FR-33.5): plan-eligibility gate, 8% commission for 6 months
  (Settings Registry, locked in per-attribution), monthly performance
  reward sweep, live certificate-tier lookup against admin-editable
  thresholds.
- Student Referral (FR-33.6) and Creators (FR-33.7): shared 5%/3-month
  referral terms; Creators add a manual content-verification queue — a
  reported view count is never itself a payout trigger.
- `PayoutRequest` — the Payout Request & Disbursement Engine (SRS §5.6b,
  dormant since the schema was first drafted), reactivated: requesting/
  approving never touches the ledger, only a transition to `paid` creates
  the real debit, so a rejection needs no reversal.
- Clawback (FR-33.10) reuses the wallet's existing negative-balance
  mechanism verbatim — can take a participant's balance negative even
  against an already-paid withdrawal.
- Self-referral fraud signal added to the existing Trust & Safety admin
  risk view (`GET /admin/trust-safety/monitors/self-referral`) — CNIC,
  payment-instrument, and signup device/IP overlap between a referrer and
  their referred seller.
- Per-program admin report (referrals, conversions, payouts, rejection
  rate), application/withdrawal/content-verification admin queues.
- Migration `20260723172749_module22_growth_partner_programs_phase_a`.
- Careers (FR-33.8, Phase B) not yet built — no self-referral/commission
  machinery, next.

## v0.27 — Store Health Score, Verified Store Program, Seller Data Export (spec only, build TBD)

### Added (specification)
- §5.34/§14.34 Store Health Score: a 0-100 composite score from seven
  Settings-Registry-weighted inputs (fulfillment timing, cancellation
  rate, pending-forever rate, dispute/refund signals, profile
  completeness, account age, moderation/risk history), scheduled
  recompute + history for trending, plain-language seller-dashboard
  breakdown. Adds one small schema gap closer: `Store.policyText`.
- §5.35/§14.35 Verified Store Program: live self-serve eligibility portal,
  a paid application (processing fee, never a purchase) into a mandatory
  admin audit queue, a buyer-facing storefront/checkout badge, and a
  revocable status with both automatic re-review triggers (health drop,
  T&S action) and a standing admin override.
- §5.36/§14.36 Seller Data Export to Personal Cloud Storage: a non-blocking
  export (CSV + summary PDF) to a seller's connected Google Drive on
  subscription renewal or on demand, with an email-download-link fallback.
  Explicitly not a substitute for the platform's own backup NFR.
- FR-22.10 (roadmap note, no build): a future seller mobile app, using the
  existing SSO + API-first architecture.
- Slotting: Store Health Score + Verified Store Program become Module 23
  (tightly coupled to each other); Data Export becomes Module 24
  (independent). Module 22 (Growth & Partner Programs) is unchanged.

## Module 21 — Hardening & Launch Readiness

### Added
- CI required-checks (`.github/workflows/ci.yml`): typecheck, unit, e2e
  (real Postgres/Redis), dependency-audit, web-build.
- Rate-limit audit against §14.12's endpoint list; the one real gap found
  (login, seller + admin) closed with the existing dual-key
  `RateLimitService` pattern.
- PII-redaction test for the existing logging interceptor.
- Dependency-vulnerability CI gate (`pnpm audit --audit-level=critical`) +
  a fixture-proof script; a real `multer` DoS CVE fixed via
  `pnpm.overrides`.
- Load/soak simulation CLI (`apps/api/scripts/simulate/`) — seed/run/
  report/teardown, driven entirely through the real API. Found and fixed
  three real bugs while smoke-testing it: new sellers' products stuck in
  the moderation probation queue (100% of simulated orders failed at any
  N), a missing Postgres grant blocking teardown's trigger-bypass, and a
  teardown delete against a non-existent column.
- `docs/launch-runbook.md` — the ordered, checkbox launch-day sequence.

## v0.26 — Growth & Partner Programs (spec only, build TBD) + FR-33.1 standalone

### Added
- §5.33/§14.33 Growth & Partner Programs: four gated (never self-serve)
  acquisition channels — Certified Ambassador, Student Referral, Creators,
  Careers — crediting the existing wallet/ledger and reactivating the
  dormant Payout Request & Disbursement Engine (§5.6b) for withdrawal.
- FR-33.1 shipped standalone ahead of the rest: `Subscription.referralSource`
  captured (shape-validated only) at signup, for both seller and supplier
  signup paths — this data is unbackfillable, so it couldn't wait for the
  full module.

## v0.25 — Wallet negative-float floor enforcement fix (post-Module-20)

### Fixed
- FR-6.26's negative-float floor was seeded but never enforced — a store
  could take orders indefinitely while its balance ran arbitrarily
  negative during the grace period. Fixed as an immediate, grace-bypassing
  pause, checked right after a commission debit lands and on every
  low-balance sweep pass.

## v0.24 — Prepaid Credits Wallet (Module 20 build)

### Added
- Seller wallet: ledger-backed balance extending Module 11's `LedgerEntry`
  table with new entry types (`wallet_topup_credit`, `wallet_plan_fee_debit`,
  `wallet_team_seat_fee_debit`, `wallet_device_slot_fee_debit`); Balance box,
  top-up screen (presets + custom amount), and full transaction history on
  the seller dashboard.
- Publish gate (FR-6.21): an explicit "Publish store" seller action —
  requires a configured payment method, a verified CNIC, and a minimum
  wallet top-up (Settings Registry, default Rs. 500) before a store can
  accept a real order.
- `TopUpAdapter` interface + `ManualBankTransferTopUpAdapter` (v1.0's one
  implementation) — a future gateway-based auto-top-up plugs in as a second
  adapter without touching wallet/ledger logic.
- Low-balance grace ladder (FR-6.25): dashboard + email warning below a
  configurable threshold, a configurable grace period, then a new
  `orders_paused` store state (storefront stays browsable, checkout blocked
  with a respectful notice) — distinct from admin-issued `suspended`. A
  verified top-up restores instantly, no admin action needed.
- Negative-float floor (FR-6.26): the wallet may go negative down to a
  configurable floor so a confirmed sale's commission debit never fails or
  rolls back mid-transaction.
- Plan-fee collection finally built (FR-7.2, revised): a paid plan's fee,
  a Team leader's per-seat group total, and the FR-25.7 extra-device-slot
  add-on all debit the seller wallet monthly-in-advance; insufficient
  balance downgrades to Free (never `orders_paused`/suspension).
- Supplier Premium Plan's full stack (FR-7.10): `Subscription`/
  `SettingsContext` gain real supplier support (`supplierId`, a new
  `supplier` Settings Registry scope); a dedicated supplier-scoped wallet
  (`SupplierWalletEntry`) collects the Premium-tier fee; the supplier-facing
  aggregated multi-store dashboard (`apps/web/app/(supplier)`) — previously
  API-only since Module 9 — finally has a UI, gated on the Premium plan via
  `suppliers.aggregated_dashboard_enabled`.
- Signup form gained a Seller/Supplier role toggle — supplier signup was
  API-reachable since Module 8 but never exposed in `apps/web`.

### Changed
- The Module 17 admin commission-invoice verification screen is repurposed,
  not rebuilt: `/admin/invoices` now lists and verifies wallet top-up
  requests (seller and supplier) instead of invoices.
- `StorefrontService.loadActiveStoreOrThrow` treats `orders_paused` like
  `active` for browsing; only `CheckoutService` blocks it.
- Supplier order aggregation (`SupplierOrdersService.listOwnOrderItems`,
  built Module 9) is now gated: a free-tier supplier linked to more than one
  store must filter to a single store; Premium unlocks the unified view.

### Deprecated (dormant, not deleted)
- §5.6c's monthly commission-invoice mechanism (Module 11): the generation/
  overdue-sweep jobs are unscheduled — the code is untouched and callable,
  preserved for a possible future enterprise/post-paid reactivation, exactly
  like §5.6/§5.6a/§5.6b before it.

## v0.23 — Impersonation transparency amendment (ahead of Module 17)

### Added
- FR-8.4 impersonation transparency: a persistent "support mode" banner for
  the session's duration; a `platform_event` on session start; a seller-
  visible support-access history line (when/duration, never which admin);
  high-risk writes (mark-as-paid, payment-instruction changes, payout/
  invoice actions) blocked outright while impersonating.

## v0.22 / Module 15.5 — Storefront Buyer Purchase Flow & Store Branding

### Added
- New §5.32: storefront product-page add-to-cart, cart page, email-first
  checkout flow, order-confirmation page linking to the buyer order-status
  page, store logo upload (wired into storefront header, invoice template,
  and emails). Launch-blocking — closes the gap that Module 9's checkout
  APIs had no buyer-facing UI at all.

## v0.21 / Module 15 — Customers, Reviews & Data Portability

### Added
- Customers CRM (FR-13.1-13.3): auto-created/matched at order placement,
  spend/order-count updated only at payment confirmation.
- Product Reviews & Ratings (FR-14.1-14.4): public submission via the
  order-status token, seller moderation, verified-purchase flag tied to a
  confirmed order.
- Self-hosted PDF invoices (FR-19.1-19.3): one v1.0 template, generated
  once at order placement via headless Chromium, cached on the order.
- CSV import/export (FR-18.1-18.3): core-field mapping with unmapped
  fields listed explicitly per upload.
- The buyer order-status page (FR-5.4), previously never built despite
  being a Module 11 prerequisite, built here (status, items, totals,
  payment instructions, invoice download, review form).

## v0.20 — Plan-fee collection + Supplier Premium Plan pinned (ahead of Module 15)

### Changed
- FR-7.2 revised: pinned the (then-)v1.0 plan-fee mechanism as a monthly
  `plan_subscription` invoice on the same manual-verification engine as
  commission invoicing — schema-ready since Module 14, generation job
  deferred to a later module. (Superseded by v0.24's wallet mechanism.)
- FR-7.10 supplemented: confirmed the Supplier Premium Plan's three pieces
  (plan data, aggregation API, the gate connecting them) and slotted the
  gate + supplier-facing dashboard UI into a new Module 20.

## v0.19 — Plan Architecture: groups & tiers (ahead of Module 14)

### Added
- FR-7.17: plans organized into named groups (Individual, Team, Supplier),
  each an ordered list of tiers, addressed by `(group, tier)` everywhere a
  plan gate resolves — replacing a flat plan-id assumption.
- FR-7.18: Team plan per-seat pricing — a team tier's own seat price, not
  each sponsored member's individually-chosen plan.

## Module 18 — External-SaaS Integration Hooks

### Added
- Template Install/License API + entitlements (signed, import-only).
- Product Feed API + seller API tokens (rate-limited, revocable).
- Cross-SaaS eligibility + Marketing SSO handoff.
- External API client registry (FR-8.14) — enable/disable a SaaS
  integration without a deploy.
- Customizer showcase + lock state, Marketing page, admin registry page.

## Module 17 — Admin Control Plane completion

### Added
- Content pages + brand assets (FR-12.1/12.3): versioned, revision history,
  public reads need no auth.
- In-app messaging (FR-8.15) + maintenance-mode kill-switch (FR-8.7) with
  an IP allowlist.
- Real-time GMV/analytics dashboard (FR-8.10), Financial Truth Invariant
  respected (excludes `pending` orders).
- Commission-invoice verification screen; moderation-queue admin UI
  (closing Module 6's slotted gap).
- Seller impersonation + view-any-store with full audit trail (FR-8.4),
  including the v0.23 transparency amendment.

## Module 16 — Seller Onboarding Wizard

### Added
- Regional launch gating (FR-25.5): country allowlist + waitlist capture.
- Onboarding progress tracking (FR-20.1): a guided post-signup checklist
  (theme, logo, first product, domain), sticky completion.
- Signup gained a country field.

## v0.16 — Seller Identity & Commission-Fraud Defense (ahead of Module 12)

### Added
- New §5.30: CNIC capture at activation, name-consistency checks against
  payment instruments, a rule-based risk-score engine, a Trust & Safety
  enforcement ladder (warn/restrict/suspend/ban) built on FR-8.4's lifecycle
  control, anti-underreporting monitors (cancellation-rate,
  pending-forever-rate) feeding admin risk views.

## Module 14 — Plans, Pricing & Guard-Rails

### Added
- Plan groups/tiers schema + editor, per-seat Team pricing, inverse
  commission laddering, yearly billing, launch-campaign pricing,
  admin-granted plans, platform subscription promo codes.
- Business Guard-Rails (§5.23, FR-23.1-23.5): product/storage limits,
  dormant-store lifecycle, one-Free-store-per-identity default, velocity
  limits.

## Module 13 — Seller Account Security

### Added
- TOTP 2FA reusing Module 1's admin-MFA machinery; enforcement mode
  (optional/required-for-payout/required-always) as a Settings Registry key.
- Session/device management: list, revoke, concurrent-device limit
  (seller-scoped override = the paid extra-device-slot add-on's mechanism —
  monetized in Module 20/v0.24).

## Module 12 — Trust & Safety System

### Added
- Seller Agreement acceptance (FR-29.1/29.2), CNIC at activation (FR-30.1),
  TitleVerificationAdapter (FR-30.4), risk-score engine (FR-30.5/30.6),
  the Trust & Safety enforcement ladder + admin endpoints (FR-29.4).
- FR-27.8: Listing Moderation Engine extended to supplier-sourced listings,
  closing a gap found during Module 8's own review.

## v0.15 — Direct Seller Collection pivot (major business-model amendment, ahead of Module 10)

### Changed
- Platform-collected payments (Safepay-first gateway, hold/reserve/payout
  engine, §5.6/§5.6a/§5.6b) marked **dormant** for v1.0, preserved for a
  future international/regulatory reactivation.
- New §5.6c: buyers pay sellers directly (bank/JazzCash/Easypaisa/COD, COD
  unconditional since the platform never holds money); the platform's
  revenue becomes a commission invoice the seller owes after the fact —
  default 1%, monthly-generated, manually admin-verified, grace-period-
  then-automated-suspension on non-payment. Anti-underreporting monitors
  (cancellation-rate, pending-forever-rate) feed Trust & Safety.

## Module 11 — Commission & Invoicing Engine

### Added
- `LedgerEntry`/`SellerInvoice` built under the v0.15 Direct Seller
  Collection model: `commission_accrued` on confirmed sale only (Financial
  Truth Invariant), monthly invoice generation, manual mark-paid, grace-
  period-triggered suspension, commission waiver.

## Module 10 — Seller Dashboard UI

### Added
- New module (v0.12 amendment) closing the gap that Modules 2/7/9 shipped
  API-only with no dashboard screens: products/media, shipping/tax/
  discounts, orders, supplier links, collections/navigation/customizer/
  settings restyled, dashboard personalization.
- New binding SIMPLICITY INVARIANT NFR (§3.13).

## Module 9 — Orders, Cart & Checkout

### Added
- Cart, checkout, manual orders (FR-17.1), order notes/tags/timeline/
  editing, oversell protection, country-block, live price re-validation.
- FR-5.3: a `suspended` store now resolves to a distinct buyer-facing 403,
  not a generic 404.

## Module 8 — Suppliers & Printify Adapter

### Added
- Supplier registration/listing submission, generic supplier-adapter
  interface, Printify adapter, admin adapter registry, store-supplier
  linking, listing review queue.

## v0.12 / Module 7 — Shipping, Tax & Discounts

### Added
- Self-fulfilled shipping settings, tax settings (inclusive/exclusive),
  basic discount codes.

## Module 6 — Listing Moderation Engine

### Added
- New §5.27 (v0.10 amendment): banned/restricted keyword lists,
  restricted-category rules, new-seller probation, trusted-seller
  auto-approve, moderation queue, a REVIEWER admin sub-role.

## Module 5 — Discovery & Merchandising

### Added
- Storefront search/collections/merchandising, moderation-status filtering
  wired in.

## v0.10 — Account Security, Financial Truth Invariant, Moderation Engine (ahead of Module 5)

### Added
- §3.12 Financial Truth Invariant (binding NFR): no pending/unconfirmed
  order counts as a sale anywhere, pinned before Orders/Payments were
  designed.
- §5.25 Seller Account Security foundation; §5.27 Listing Moderation Engine
  (see Module 6).

## Module 4 — Theme Engine & Storefront Rendering

### Added
- Storefront rendering, theme settings, SEO fallback chain (FR-1.5,
  v0.9 amendment), dynamic sitemap/robots.txt, coming-soon/password gate.

## v0.8 — Platform Event Log

### Added
- §3.11: append-only `platform_events` table, non-blocking emission,
  backfilled into Modules 1-3.

## Module 3 — Custom Domain & TLS

### Added
- Domain attach/verify, TLS provisioning, Traefik dynamic config.

## Module 2 — Catalog & Media

### Added
- Products/variants/categories, Google Drive media import (encrypted
  refresh token, v0.7 amendment gap-closure), media asset pipeline.

## Module 1 — Foundation

### Added
- Auth (signup/login/email verification/password reset), multi-tenancy +
  RLS, the Settings Registry (config-as-data, precedence pinned v0.7),
  admin audit log (insert-only immutability), health checks.

## v0.1 – v0.7 — Pre-build specification phase

### Added
- Initial SRS, database schema, architecture, tech stack, and MVP cutlist
  drafts; the Settings Registry pattern and full Admin Control Plane
  section (v0.3); the self-host-first principle, Acceptance Checklists
  (§14), and Payout & Disbursement Engine design (v0.4); 16 new v1.0
  commerce features scoped (v0.5); documentation regressions fixed and two
  external-SaaS integration hooks specified (v0.6); the Settings Registry
  precedence pinned and seven further additions approved ahead of Module 2
  (v0.7).
