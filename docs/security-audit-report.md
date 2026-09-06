# Security Audit Report — Internal Hardening Pass

This is the authoritative, standalone record of the security-hardening pass
run against this codebase, per the founder's standing request for
advanced, "top-class-hacker-resistant" security. It replaces what had
previously existed only as scattered commit messages and an informal
verbal summary — this document is the actual pre-launch security record.

**Status as of this writing (2026-09-06): all 5 phases of the original
pass have now run to completion, every real finding they surfaced is
fixed and verified, and both P2 consistency follow-ups they surfaced
have since been closed too — zero open items remain from this
thread.** This concludes the security-hardening thread opened by the
founder's standing request for advanced, "top-class-hacker-resistant"
security. Eight genuine vulnerabilities/races were found and fixed
across the full pass: the two P0 launch-blockers (impersonation-token
revocation, upload content-type spoofing - §3 #4/#14), the two Phase-2
races found before this final push (OTP verify/resend, promo-code
redemption - §3 #1/#3), a stored-XSS vector in the storefront product
page's JSON-LD block found by the input-validation sweep (§3 #12), a
monthly-quota check-then-act race in campaign creation found by the
concurrency-burst sweep (§3 #17), and the two related P2 races the
campaign-quota fix's own pattern surfaced and was then applied to: the
supplier wallet's non-atomic debit (§3 #9) and `ProductsService.
create()`'s product-limit gate (§3 #17's follow-up). The IDOR sweep (§3
#13) and input-validation sweep (§3 #12) each additionally closed one
lower-severity gap (a missing wallet cross-tenant test; four
robustness-class input bugs). This report exists specifically so this
record stays visible and actionable rather than quietly assumed away.
Nothing in this document should be read as "the platform is
comprehensively secure in every dimension forever" - it is the honest,
evidence-backed record of exactly this 5-phase pass plus its two P2
follow-ups, current as of the date above.

---

## 1. How this pass was structured

Five phases were opened as tracked tasks:

1. **Input validation sweep** (all endpoints) — malformed/boundary/oversized
   input, unicode/homoglyph tricks, SQLi-style payloads (defense in depth
   against the ORM), script/HTML injection in free-text fields.
2. **Business-logic abuse scenarios** — race conditions (coupon/discount
   redemption, gift-card draining, review-gaming), mass-assignment, a full
   IDOR sweep across every resource type, rounding/precision abuse in money
   calculations, token/session reuse, ReDoS in validation regexes.
3. **File-upload security** — confirm file-type validation checks actual
   content/magic bytes rather than trusting the client's declared type;
   size limits enforced server-side; uploaded files can't be executed or
   interpreted as code by the storage/serving layer.
4. **Rate-limit verification under real concurrency** — re-test existing
   rate limits with actual burst/concurrent traffic (not sequential) on
   checkout, OTP verify/resend, login/MFA, campaign send, gift-card
   purchase, and other previously-flagged sensitive endpoints.
5. **Secrets audit** — grep the full git history (not just current state)
   for committed credentials/API keys/connection strings.

## 2. What actually happened, phase by phase

### Phase 1 — Input validation sweep: **executed (2026-09-06), 3 real gaps found and fixed**

Two earlier dispatch attempts never produced findings (the first was
silently killed by a sandbox container restart roughly an hour in,
undiscovered until much later; the second was interrupted). The sweep
finally ran to completion as P1.4, using the same code-inspection +
live-request evidence standard as the P0/P1.3 fixes.

**Fixed and verified:**

1. **Untyped `@Body()` object literals bypassing the ValidationPipe
   entirely.** The two adjacent facts noted before this sweep ran
   understated the actual scope - it wasn't 3 routes, it was **7**:
   `auth.controller.ts`'s and `buyer-auth.controller.ts`'s `refresh`/
   `logout` (4 routes - the buyer-facing pair was newer than the
   original 2-route note and had never been caught), `admin-auth.
   controller.ts`'s `beginMfaEnrollment`, and `buyer-account.controller.
   ts`'s `updateProfile` (previously an unbounded `{ displayName?:
   string }` with no length cap at all). All 7 now go through real DTO
   classes (`RefreshTokenDto`, `LogoutDto`, `AdminMfaEnrollDto`,
   `UpdateProfileDto`), so malformed/wrong-typed input is rejected with a
   clean 400 instead of reaching a service method that assumed the shape
   was already correct. Live-verified: wrong-typed `sessionId`/
   `refreshToken`, a non-UUID `sessionId`, and an oversized `displayName`
   (>120 chars) are all now rejected with 400 (`input-validation-sweep.
   e2e-spec.ts`).
2. **Money-amount fields with no upper bound.** Every money column in
   this schema is `Decimal(12,2)`; a value beyond that range previously
   reached Postgres and failed as an unhandled 500 (numeric field
   overflow) instead of a clean 400. Found and fixed across 6 DTOs:
   `CreateVariantDto`/`UpdateVariantDto` (price/compareAtPrice/baseCost),
   `PurchaseGiftCardDto` (the highest-exposure of the six - public,
   unauthenticated, and previously had no upper bound at all, not even
   the `@IsPositive()`-only floor the others had), `IssueGiftCardDto`,
   `RequestTopUpDto` (wallet top-up), and `CreateDiscountCodeDto`. All
   now share one constant (`common/validation/money.constants.ts`).
   Live-verified: a variant price, gift-card purchase amount, wallet
   top-up amount, and discount-code value all beyond the range are
   rejected with 400, and a real in-range value still succeeds.
3. **Cart resource-amplification.** `CartItemDto`'s `quantity` had no
   upper bound and `CartItemsDto`/`CreateCartDto`/`UpdateCartDto`'s
   `items` array had no `@ArrayMaxSize` - a single request could submit
   an absurd quantity or, more materially, a large array of distinct
   items each triggering its own DB lookup, amplifying one request into
   many round-trips. Capped at 100,000/item and 100 items/request
   (generous for any real cart, tight enough to bound the amplification).
   Live-verified: both are rejected with 400.

**Also found and fixed, adjacent to but not itself a "boundary" bug:**

4. **`PayloadTooLargeError` surfaced as 500, not 413.** The global
   `HttpExceptionFilter` (`common/filters/http-exception.filter.ts`)
   already had a precedent for this exact class of problem - a
   non-`HttpException` error object carrying its own correct status that
   the filter's generic branch was discarding down to 500 (originally
   fixed for two Prisma error codes, per that file's own comment). The
   oversized-body protection itself was always working; only the status
   code was wrong. Added the same mapping for body-parser's own
   `PayloadTooLargeError` (duck-typed on `.type === "entity.too.large"`,
   the stable signal `raw-body` sets, rather than importing that
   package). Live-verified: a >100KB JSON body now gets a clean 413.
5. **A real stored-XSS vector, found while checking the "script/HTML
   injection in every free-text field" item this sweep was scoped to
   cover.** The storefront product-detail page
   (`apps/web/app/storefront/products/[productId]/page.tsx`) built its
   JSON-LD structured-data block via plain `JSON.stringify()` fed
   directly into `dangerouslySetInnerHTML` inside a `<script
   type="application/ld+json">` tag - and `JSON.stringify()` does not
   escape `<`. A seller-controlled product title of
   `</script><script>alert(document.cookie)</script>` would close the
   JSON-LD script tag early and inject a second, real, executable one -
   stored XSS against every buyer who views that product page. Fixed
   with a small shared helper (`apps/web/lib/safe-json-ld.ts`) that
   replaces every literal less-than character with its Unicode escape
   sequence before injection - semantically identical JSON (verified it
   round-trips through `JSON.parse()` back to the exact original string)
   with no HTML-sensitive sequence surviving.
   Checked every other `dangerouslySetInnerHTML` site in `apps/web` for
   the same pattern: the only other JSON-LD path
   (`storefront/layout.tsx`'s custom head tags) already goes through
   `sanitizeHeadTags()` server-side, which parses as real HTML via the
   `sanitize-html` library rather than naive string interpolation, so it
   was never vulnerable to this; the two `bodyHtml`/design-token sites
   are admin-only input by design (documented as such in their own
   comments), a different and already-accepted trust boundary.
   `apps/web` has no unit/e2e test framework wired up (CI's `web-build`
   job is a build/typecheck check only) - verified via a direct proof
   that the escaped output contains no raw `</script>` and round-trips
   correctly, plus a clean `pnpm --filter @uzeyn/web build`.

**Confirmed already safe, not a finding:**
- `forbidNonWhitelisted` is still unset on the global `ValidationPipe`
  (`whitelist: true` strips unknown fields silently rather than
  rejecting them with 400) - unchanged, low-severity defense-in-depth
  gap, not itself an exploit path.
- Every `@Matches()` regex in the codebase (slug/code fields) uses a
  simple bounded character class (`[a-z0-9-]{1,63}` and similar) - no
  nested quantifiers or ambiguous alternation, so none are vulnerable to
  ReDoS.
- Every raw-SQL call site (`$executeRawUnsafe`/`$queryRaw`) was checked:
  `TenantPrismaService`'s UUID-validated seller-id interpolation (already
  documented), `retention.service.ts`'s hardcoded parameterized
  statements with no user-facing input path, and `admin-search.service.
  ts`'s `Prisma.sql` tagged-template search (properly parameterized, not
  string concatenation) are all safe.
- Pagination/list-query DTOs already had sane bounds where checked
  (`ProductListQueryDto`'s `limit` is already `@Max(100)`), confirming
  the gaps found above were genuine oversights on specific newer/money
  DTOs, not a systemic absence of boundary discipline.

**Not exhaustively covered:** this was a deep, representative sweep
across the endpoint categories most exposed to attacker-controlled input
(auth, money amounts, cart, the free-text-to-HTML rendering path) rather
than a literal field-by-field audit of every one of this codebase's ~150
DTOs. Lower-exposure fields (most `@MaxLength`-less optional strings on
admin-only or already-authenticated seller-dashboard-only endpoints)
were not individually hunted down.

### Phase 2 — Business-logic abuse scenarios: **mostly done, one gap unfixed, one sub-area untested**

This phase has real, verified substance behind it — the most complete of
the five besides the secrets audit.

**Fixed and verified:**
- OTP verify/resend check-then-write race (see §3, #1)
- Promo-code redemption check-then-write race (see §3, #3)

**Found, confirmed real, fixed (2026-09-06):**
- Admin impersonation "End session" did not revoke the already-issued
  JWT (see §3, #4) — the single most important open item in this
  report, now closed via commit `e4b1118`.

**Investigated and confirmed already safe** (a real check was performed,
not just assumed):
- Discount-code redemption race — atomic `updateMany` guard, confirmed
  at `apps/api/src/store-settings/discount-codes.service.ts:61`.
- Gift-card balance-draining race — atomic `updateMany` guard, confirmed
  at `apps/api/src/gift-cards/gift-cards.service.ts:184-186`.
- Mass-assignment via DTOs — global whitelist plus a spot-check of ten
  sensitive DTOs, none of which map a client-supplied field onto
  `role`/`isAdmin`/`balance`/similar. (Caveat: the three untyped-body
  endpoints noted under Phase 1 above sit outside this check entirely.)
- Money rounding/precision — 24 files consistently route arithmetic
  through a shared `round2()` helper (`apps/api/src/orders/money.util.ts`);
  no unrounded float math was found feeding a persisted or charged amount.
- Password-reset / email-verification token reuse — the token hash is
  cleared atomically on first use in the same `update()` call in both
  flows (`apps/api/src/auth/auth.service.ts`); no clock-skew grace period
  exists on either expiry check.
- Short-lived access-token (JWT) revocation model — stateless, 15-minute
  TTL, no per-request DB/Redis check; refresh-token sessions **are**
  live-revocable. This is a deliberate, standard tradeoff for a
  short-TTL access token, not a bug.

**Found, not fixed, not previously tracked as its own item (surfaced
incidentally while checking the gift-card/discount races):**
- Supplier wallet debit — a read-then-recompute pattern, unlike the true
  atomic increment used elsewhere in `WalletService` (see §3, #9).

**Executed and closed (2026-09-06):** the IDOR full sweep across every
resource type — the single largest named sub-scope of this phase, and
the previous two dispatch attempts were interrupted before producing a
report, identically to Phase 1's failure pattern. See §3, #13 for the
full writeup; short version: every resource type the founder explicitly
named (orders, products, reviews, staff, wallet, D-Studio assets/theme
settings, template purchases, buyer accounts/wishlist/chat) was checked
against direct cross-tenant/cross-buyer object-ID access, with particular
scrutiny on wishlist/chat/D-Studio as newer surface area that couldn't be
assumed to have inherited the same guarantees automatically. One test
coverage gap was found and closed (wallet endpoints had no explicit
cross-tenant e2e test, though the code was already safe); no exploitable
IDOR was found anywhere.

### Phase 3 — File-upload security: **never executed by the audit; the gap it was scoped to find is now fixed (2026-09-06, commit `8319fe9`)**

Two dispatch attempts were made for this phase. The first was killed by
the same container restart that hit Phase 1. The second hit an
account-wide API rate limit mid-investigation and was never resumed —
there is no further mention of file-upload security anywhere in the rest
of the session.

Because the phase produced nothing, this report's author independently
checked the current code directly rather than leave the question open:

- **Size limit: real.** `apps/api/src/media/media-upload.controller.ts`
  enforces a 25MB `fileSize` limit server-side via multer — this part of
  the phase's scope is genuinely fine.
- **Content-type validation: not content-based.**
  `apps/api/src/media/media.util.ts`'s `mediaTypeFromMimetype()` only
  checks whether the client-supplied `mimetype` string starts with
  `"image/"` or `"video/"` — there is no inspection of the file's actual
  bytes anywhere in the codebase (confirmed: no `file-type` package or
  any magic-byte-sniffing logic exists in `apps/api`).
- **Serving safety: the same untrusted value is echoed back.**
  `apps/api/src/media/object-storage.service.ts`'s `putObject()` sets the
  stored object's `ContentType` directly from that same client-supplied,
  unverified mimetype, with no `Content-Disposition` header set on
  upload.

**Net effect (see §3, #14): a file whose actual bytes were anything could be
uploaded labeled `Content-Type: image/svg+xml` — it passed the
`startsWith("image/")` check — and the storage layer served it back with
that same executable content type.** This was a plausible stored-XSS
vector via a mislabeled SVG upload (or similar). This is precisely the
class of issue Phase 3 was scoped to catch; the phase never ran, and the
gap was found only by this report's own follow-up check — **now fixed**
via `apps/api/src/media/file-signature.util.ts` (magic-byte sniffing
against a fixed image/video/document allow-list), wired into every
upload path that shares this object-storage pipeline (direct media
upload, store logo, review media, Careers CVs, Google Drive import).
Commit `8319fe9`; 15 existing test fixtures updated to real
signature-prefixed bytes, plus one new dedicated test proving the exact
spoofing vector above is now rejected. Full 100-file e2e regression:
100/100 passed.

### Phase 4 — Rate-limit verification under real concurrency: **done (2026-09-06) — 6 of 6 named endpoints tested, 1 real race found and fixed**

Real, live-proven work exists here:

- All 33 `enforcePerHour` rate-limit call sites across the app were
  mapped.
- **Signup**: a 25-concurrent-request burst was fired at the real dev
  server; the 10/hour cap held exactly.
- **Login**: a 40-concurrent-request burst was fired at the real dev
  server; the 20/hour cap held exactly.
- **OTP verify/resend**: this is where the Phase-2 OTP race (§3, #1) was
  actually discovered — a live 20-concurrent-guess proof against a
  5-attempt lockout showed the lockout being defeated pre-fix, and
  holding correctly post-fix.
- **Trust-proxy / X-Forwarded-For bypass** (§3, #2): discovered and fixed
  under this phase, live-proven via curl against the real dev server
  both before and after the fix. A more realistic proof through an actual
  Traefik hop was attempted but blocked by this sandbox's network policy
  (Docker Hub returns 403 here); the fix was instead verified directly
  against this repo's pinned `proxy-addr` dependency's own hop-counting
  semantics.

**Closed (2026-09-06, P1.5):** the four endpoints above - checkout, admin
MFA verify, campaign creation, and gift-card purchase - each got a real
`Promise.all` burst of genuinely simultaneous HTTP requests (not the
sequential-loop pattern `phaseb-item1-rate-limits.e2e-spec.ts` already
used to prove each limit eventually fires), in a new
`p15-concurrency-burst.e2e-spec.ts`.

- **Checkout, admin MFA verify, gift-card purchase**: the rate limiter
  itself (`RateLimitService.enforcePerHour()`) is backed by a single
  atomic Redis `INCR` per call, not a check-then-set pair - structurally
  race-free by construction, and now empirically proven so: a genuine
  3-way simultaneous burst against a limit of 2 still produces at least
  one 429 on each of these three endpoints.
- **Gift-card purchase, P1.4 interaction check**: per the founder's own
  follow-up request, concurrent purchases fired at exactly the new
  `Decimal(12,2)` ceiling, one cent past it, and orders of magnitude past
  it were fired together in one burst - each was independently accepted
  or rejected correctly with no cross-request interference, proving the
  P1.4 boundary fix and P1.5's concurrency-safety hold together, not just
  individually.
- **Campaign creation - a genuine, previously-undiscovered race, found
  and fixed**: `EmailCampaignsService.create()`'s monthly-quota check
  read a `remaining` value (a SUM aggregate over already-*sent*
  campaigns) in one transaction, then inserted the new campaign in a
  *separate* one. Two genuinely concurrent create() calls for the same
  seller each read the same `remaining` before either committed, so a
  burst of creates each individually within quota could together exceed
  it - and even without true concurrency, a burst issued faster than the
  async send queue drains had the same effect, since a just-created
  "queued" campaign was never counted as reserved. Live-proven: with a
  quota of 3 and two concurrent creates of 2 recipients each (4 total,
  over quota, but 2 individually within it), the pre-fix code would have
  let both succeed. Fixed in `email-campaigns.service.ts` by taking a
  `SELECT ... FOR UPDATE` row lock on the seller's own Subscription row
  (one per seller, always exists) to serialize concurrent create() calls
  for that seller, and by reserving against every campaign *created* this
  month rather than only ones that finished sending, so a serialized-in
  second call sees the first's reservation immediately. Live-verified
  post-fix: the same burst now produces exactly one 201 and one 400,
  and the total reserved recipient count across both requests never
  exceeds the quota. The doc comment on `create()` had already flagged
  this as "the same check-then-act shape as `ProductsService.create()`'s
  `catalog.product_limit` gate" - that second gate has a narrower window
  (its count-then-insert happens inside one transaction, not two) but is
  built on the same non-atomic-aggregate foundation and was not itself
  re-verified or fixed in this pass; noted below as a follow-up.

**Not part of this audit, despite surfacing in an adjacent commit
search:** `Fix retry-storm cooldown ordering race in 3 payment-request
paths` (commit `58568e6`) is a real, separately-verified fix, but it
belongs to the earlier Platform Merchant Connection financial-safety
initiative (commit `852dd69`, the day before this 5-phase pass was even
opened) — it is not a Phase 4 output and is listed here only to avoid
double-counting it as evidence of Phase 4 progress.

### Phase 5 — Secrets audit (full git history): **done, and genuinely clean**

The only phase that ran to completion. `gitleaks` was run across the
full commit history. 9 raw pattern hits were produced and individually
triaged: 6 were Settings Registry key names (e.g.
`marketing.pricing_benefit_1`) that only pattern-match a generic
high-entropy-string rule, and 3 were intentional, disposable
CI-only encryption keys used exclusively by the ephemeral CI Postgres
instance. No `.env`/`.env.local`/`.env.production` file was ever
committed at any point in history, and both `.env.example` files (repo
root and `apps/web/`) contain only placeholder text
(`change-me-local-only` and similar) — independently re-checked while
writing this report.

---

## 3. Complete finding list

Every distinct vulnerability, race condition, or gap discussed across
the entire pass, regardless of phase or whether it was fixed.

| # | Finding | Phase | Status | Evidence | Impact |
|---|---|---|---|---|---|
| 1 | OTP verify/resend check-then-write race | 4 (found) / 2 | **Fixed & verified** | Commit `2dd4e408d4f80f354e189cceaf1aeaf06c068c71`. Atomic `updateMany({ where: { status: "pending", attemptCount: { lt: maxAttempts } } })` confirmed at `apps/api/src/order-verification/order-verification.service.ts:260`. Live race-proof before/after; 2 new tests in `module26-order-verification.e2e-spec.ts`, run 5x stable; full regression green; CI-confirmed. | A concurrent burst of guesses could defeat the 5-attempt brute-force lockout, letting an attacker brute-force the buyer order-verification OTP. |
| 2 | `trust proxy: true` / X-Forwarded-For rate-limit bypass | 4 | **Fixed & verified** | Commit `98c45a3481c42bdaa33a377291840e19b9f14892`. Confirmed at `apps/api/src/main.ts:36`: `trust proxy` set to `1` in production, `true` otherwise. Live curl proof before/after; 43 tests green. | Rotating the `X-Forwarded-For` header on every request bypassed *every* per-IP rate limit in the app (signup, login, OTP, checkout, etc.) with no botnet required. |
| 3 | Promo-code redemption check-then-write race | 2 | **Fixed & verified** | Commit `6ae1dd73eecfdf40b2be96dd89477f0fee65bd64`. Atomic `updateMany({ where: { redeemedCount: { lt: maxRedemptions } } })` confirmed at `apps/api/src/plans/promo-codes.service.ts:81-82`. 27 tests green, CI-confirmed. | Concurrent redemptions from different sellers could exceed a promo code's global `maxRedemptions` cap. |
| 4 | Admin impersonation "End session" doesn't revoke the JWT | 2 | **Fixed & verified** | Commit `e4b1118`. `apps/api/src/auth/strategies/jwt.strategy.ts`'s `validate()` now performs a live lookup against `ImpersonationSession` (`endedAt IS NULL AND expiresAt > now`) on every request carrying an `impersonationSessionId` claim, rejecting with 401 if the session has been ended or expired. 2 new e2e tests in `module17-admin-control-plane.e2e-spec.ts`: one proves the token is rejected immediately after `POST /admin/impersonation/:id/end`; one forces `expiresAt` into the past directly and proves the same rejection independent of an explicit "end." Full 100-file e2e regression: 100/100 passed. | Previously: an admin's already-issued impersonation token kept working as that seller for the rest of its TTL (5–240 configurable minutes) after "End impersonation session" was clicked. Now: the token stops working the instant the session ends or expires. |
| 5 | Discount-code redemption race | 2 | **Confirmed already safe** | Atomic `updateMany` guarded by `usageCount: { lt: usageLimit }`, confirmed at `apps/api/src/store-settings/discount-codes.service.ts:61`. | No fix needed. |
| 6 | Gift-card balance-draining race | 2 | **Confirmed already safe** | Atomic `updateMany` guarded by `remainingBalance: { gte: amount }`, confirmed at `apps/api/src/gift-cards/gift-cards.service.ts:184-186`. | No fix needed. |
| 7 | Mass-assignment via DTOs | 1 / 2 | **Confirmed mostly safe; the one caveat is now closed by #12** | Global `ValidationPipe({ whitelist: true })`; 10 sensitive DTOs spot-checked, none map a client field onto `role`/`isAdmin`/`balance`/etc. The caveat noted here originally - `auth.controller.ts`'s `refresh`/`logout` and `admin-auth.controller.ts`'s `beginMfaEnrollment` bypassing the pipe via an untyped `@Body()` object literal - turned out to be 7 routes, not 3 (the buyer-facing pair and a buyer-profile update were missed), and all 7 are now behind real DTOs per #12's fix. `forbidNonWhitelisted` remains unset (silently strips unknown fields instead of loudly rejecting) - a real but low-severity defense-in-depth gap, not itself an exploit path. | Low - no direct exploit path was ever found on the untyped-body routes, but they sat outside the validation pipe's protection entirely; now closed. |
| 8 | Money rounding/precision abuse | 2 | **Confirmed already safe** | 24 files route arithmetic through a shared `round2()` (`apps/api/src/orders/money.util.ts`); no unrounded float math found feeding a persisted/charged amount. | No fix needed (a theoretical IEEE-754 boundary case exists in principle but was not found to be exploitable in practice). |
| 9 | Supplier wallet debit — read-then-recompute, not atomic | 2 (incidental) | **Fixed & verified (2026-09-06)** | `PlanFeeDebitService.debitDueSupplierPlanFees()` used to read `SupplierWalletService.getBalance()` (a ledger SUM) in one step, then separately create the debit entry - a check-then-write race. There's no cached balance column here to `updateMany` against (unlike `WalletService`'s real `WalletBalance.balance` column), so the fix instead adds `SupplierWalletService.debitIfSufficientBalance(tx, ...)`, which takes a `SELECT ... FOR UPDATE` lock on the supplier's own Subscription row (one per supplier, `@unique`, always exists) for the duration of the caller's transaction - the same technique proven on the campaign-quota race (#17) - before re-checking the balance and creating the debit entry, all inside one transaction with the subscription-period advance. Live-proven: topped up a supplier's wallet to exactly one fee's worth, then fired two genuinely concurrent `runMonthlyDebitSweep()` calls via `Promise.all` - pre-fix reasoning would have both succeed (driving the balance to `-fee`); post-fix, exactly one `plan_fee_debit` entry is created and the balance lands at exactly 0, never negative. Verified by 1 new e2e test plus the full existing `module20-wallet-supplier-portal.e2e-spec.ts` suite (14/14, unaffected). | Exploitable only under genuine concurrent/re-triggered sweep execution - now closed rather than merely disclosed, at the founder's explicit request not to let a "found, not urgent" item go stale. |
| 10 | Password-reset / email-verification token reuse | 2 | **Confirmed already safe** | Token hash cleared atomically on first use in the same `update()` call, both flows, `apps/api/src/auth/auth.service.ts`. No clock-skew grace period on either expiry check. | No fix needed. |
| 11 | Access-token (JWT) has no live revocation check | 2 | **Confirmed as an accepted, deliberate tradeoff** | `apps/api/src/auth/jwt.strategy.ts` — stateless, 15-minute TTL, no per-request DB/Redis lookup. Refresh-token sessions are separately, genuinely revocable. | Low — standard short-TTL access-token design; not treated as a bug. |
| 12 | Input-validation sweep across all endpoints | 1 | **Swept (2026-09-06), 5 real gaps found and fixed** | See §2 Phase 1 for the full writeup. Summary: 7 untyped `@Body()` routes now behind real DTOs (`RefreshTokenDto`/`LogoutDto`/`AdminMfaEnrollDto`/`UpdateProfileDto`); 6 money-amount DTOs given an upper bound matching `Decimal(12,2)` (`PurchaseGiftCardDto` was the highest-exposure - public, unauthenticated, previously unbounded); cart quantity/array-size capped against resource amplification; `PayloadTooLargeError` now correctly surfaces as 413 not 500 (`HttpExceptionFilter`); a real stored-XSS vector in the storefront product page's JSON-LD block fixed (`apps/web/lib/safe-json-ld.ts`). Verified via 9 new live e2e tests (`input-validation-sweep.e2e-spec.ts`) plus a clean web build for the frontend fix. ReDoS and raw-SQL usage were also checked and confirmed already safe. | The stored-XSS finding was the most serious - any seller could have targeted every buyer viewing their product page. Now closed; everything else was a 500-instead-of-400/413 robustness gap or a DoS-adjacent amplification bound, not a data-exposure or auth-bypass path. |
| 13 | IDOR full sweep across every resource type | 2 | **Swept, no exploitable IDOR found; one test-coverage gap closed** | Direct cross-tenant/cross-buyer object-ID access attempted (code-level verification plus live e2e test execution) across every named resource type: **orders** — dual-layer app+RLS cross-tenant tests already existed (`orders.e2e-spec.ts:691,716`), confirmed current. **products** — same, plus the sharper same-seller/cross-store boundary case (`catalog.e2e-spec.ts:114,147,169`). **reviews** — buyer-side media attach checked against `review.orderId !== order.id` (not just "any review at this store"); seller moderation RLS + explicit `review.storeId !== storeId` check, both confirmed in `reviews.service.ts`. **staff** — `module101-staff-lifecycle.e2e-spec.ts:233` already proves an admin action against a staff-account id belonging to a different seller is rejected as not found. **wallet** — `SellerWalletController`/`SupplierWalletController` derive `sellerId`/`supplierId` only from `@CurrentSellerId()`/`@CurrentSupplierId()` (JWT-only, never a route/body param) confirmed in `current-seller.decorator.ts`, but no e2e test exercised this cross-tenant — **2 new tests added** to `module20-wallet-supplier-portal.e2e-spec.ts` (both seller and supplier sides), passing. **D-Studio assets/theme settings** — `store-theme-settings.service.ts` explicitly documents and implements the RLS-isn't-enough case ("RLS proves 'not another seller's row,' not 'not my OWN other store's row'"), re-verifying `storeId` belongs to the calling seller on every read/write. **D-Studio Pack / template purchases** — seller-facing `requestPurchase`/`listOwn` are sellerId-JWT-scoped; the `verify`/`reject` admin actions that grant entitlements are correctly gated behind `AdminAuthGuard` (structurally rejects any token without an `adminUserId` claim — a seller token can never reach them), confirmed in both `dstudio-pack.service.ts` and `template-purchase.service.ts`. **buyer accounts / wishlist / chat (the newer, buyer-account-linked surfaces flagged for extra scrutiny)** — wishlist and saved addresses are keyed by composite `(buyerId, productId)`/explicit `assertOwnsAddress()` ownership checks, buyerId always from `@CurrentBuyer()` (JWT), never a client param; existing e2e tests already attempt direct cross-buyer ID guesses (not just "list doesn't leak"), e.g. `module81-buyer-accounts.e2e-spec.ts:153-161` PATCHes/DELETEs buyer A's address with buyer B's token and asserts 403/404. Buyer chat is a capability-token model (192-bit `randomBytes(24)`, not brute-forceable) for the buyer side, and RLS + explicit `storeId` filter for the seller side, both already tested in `module83-buyer-chat.e2e-spec.ts`. | None found exploitable. The one real gap (wallet's missing explicit test) was a coverage gap, not a code gap — closed same-day. |
| 14 | File-upload content-type spoofing (no magic-byte check) | 3 | **Fixed & verified** | Commit `8319fe9`. New `apps/api/src/media/file-signature.util.ts` sniffs real magic bytes (JPEG/PNG/GIF/WEBP images; MP4/MOV/WEBM video; PDF/DOC/DOCX documents) and returns a server-chosen, canonical Content-Type; `media.util.ts`'s `mediaTypeFromMimetype(mimetype)` replaced with `detectMediaTypeOrThrow(buffer)`, wired into direct media upload, store logo, review media, Google Drive import, and (via a parallel document check) Careers CVs — the client's declared mimetype is no longer read for classification or the stored `Content-Type` anywhere in this pipeline. 15 test fixtures updated across 8 e2e files; 1 new dedicated test proves the exact spoofing vector (declared `image/png`, real bytes `<script>...`) is rejected, and that a real file declared with a generic/wrong mimetype is still correctly classified. Full 100-file e2e regression: 100/100 passed. | Previously: a file whose real bytes were arbitrary but labeled e.g. `image/svg+xml` passed validation and was served back with that same executable content type — a plausible stored-XSS vector. Now: only recognized real image/video/document content is accepted, and the served Content-Type is always server-chosen. |
| 15 | Checkout / MFA / campaign-send / gift-card-purchase burst-concurrency | 4 | **Burst-tested (2026-09-06), all four confirmed safe under genuine concurrency** | `p15-concurrency-burst.e2e-spec.ts` fires real `Promise.all` bursts (not sequential loops) at all four. Checkout/MFA-verify/gift-card-purchase: the rate limiter's atomic Redis `INCR` holds under a genuine 3-way simultaneous burst against a limit of 2 (at least one 429 each time). Gift-card purchase additionally burst-tested at/past the new P1.4 `Decimal(12,2)` bound concurrently - each request independently correct, no cross-request interference. Campaign creation initially failed this burst test for a different reason - see #17. | None of the four rate limiters themselves were racy - `RateLimitService.enforcePerHour()`'s single atomic `INCR` was already structurally safe, now empirically proven so under real concurrency, not just sequential requests. |
| 16 | Secrets committed to git history | 5 | **Confirmed already safe** | Full-history `gitleaks` scan, 9 hits, all individually triaged as non-issues (Settings Registry key names / disposable CI-only keys). Both `.env.example` files confirmed placeholder-only. | No fix needed. |
| 17 | Campaign-creation monthly-quota check-then-act race | 4 (found via burst-test) | **Fixed & verified** | `EmailCampaignsService.create()`'s quota check read a SUM aggregate over already-*sent* campaigns in one transaction, then inserted the new campaign in a separate one - two concurrent create() calls for the same seller (or even a fast sequential burst, since a "queued" campaign was never counted as reserved before the async worker marked it sent) could each pass a quota check that only one should have. Live-proven with a quota of 3 and two concurrent 2-recipient creates (4 total, over quota): pre-fix both would have succeeded. Fixed by a `SELECT ... FOR UPDATE` lock on the seller's Subscription row (serializes concurrent create() calls per seller) plus reserving against every campaign *created* this month, not just ones already sent. Post-fix: the same burst produces exactly one 201 and one 400. Verified by the new burst test plus the full existing `module34-email-campaigns.e2e-spec.ts` suite (unaffected, still 5/5). | Business-logic/revenue-integrity, not a data-exposure or auth-bypass path - a seller could have sent more marketing email in a month than their plan entitles them to. **Follow-up, also fixed (2026-09-06):** `ProductsService.create()`'s `catalog.product_limit` gate was built on the same non-atomic-aggregate foundation (count-then-insert, no lock) - narrower window (one transaction, not two) so harder to hit, but the same class of gap. Closed with the identical technique: a `SELECT ... FOR UPDATE` lock on the store's own row (already being fetched at that point in `create()` anyway) for the duration of the transaction, serializing concurrent create() calls per store. Live-proven: with a plan-scoped limit of 3 and 2 pre-existing products, two genuinely concurrent creates (each individually within the limit) now produce exactly one 201 and one 400, and the store never exceeds 3 products. Verified by 1 new e2e test plus the full existing `catalog.e2e-spec.ts` suite (16/16, unaffected). |

## 4. What this means for launch readiness

**Do not represent this platform as comprehensively "secure" or
"hardened" forever on the strength of this pass alone — but every phase
of it has now run to completion, and every real finding across all five
has been fixed and verified.** The two launch-blocking (P0) gaps are
closed; the IDOR sweep (P1) found nothing exploitable; the input-
validation sweep (P1) found and fixed a real stored-XSS vector plus four
lower-severity robustness gaps; the concurrency-burst sweep (P1, the
last item outstanding) found and fixed a real monthly-quota race in
campaign creation, and confirmed all three other named endpoints
(checkout, admin MFA verify, gift-card purchase) hold correctly under
genuine simultaneous-request bursts, not just sequential ones.

**Fixed (2026-09-06):**

- **#4 — impersonation "End session" doesn't revoke the token.** Fixed
  in commit `e4b1118`. This was the more serious of the two: it defeated
  a control whose entire purpose is operator-facing trust and safety.
  `JwtStrategy` now performs a live revocation-state lookup; verified by
  2 new e2e tests and the full 100-file regression suite.
- **#14 — file-upload content-type spoofing.** Fixed in commit
  `8319fe9`. A plausible stored-XSS vector via mislabeled upload
  content is now closed by real magic-byte validation across every
  upload path, with a server-chosen Content-Type never taken from the
  client. Verified by 15 updated test fixtures, 1 new dedicated test,
  and the full 100-file regression suite.
- **#13 — IDOR full sweep.** Run to completion (2026-09-06). Every
  named resource type (orders, products, reviews, staff, wallet,
  D-Studio assets/theme settings, template purchases, buyer accounts/
  wishlist/chat) was checked against direct cross-tenant/cross-buyer
  object-ID access, with the newer buyer-account-linked surfaces
  (wishlist, chat) given specific extra scrutiny rather than assumed
  safe by pattern resemblance to older tables. No exploitable IDOR was
  found; one test-coverage gap (wallet had no explicit cross-tenant e2e
  test, though the underlying code was already safe) was closed with 2
  new tests in `module20-wallet-supplier-portal.e2e-spec.ts`.
- **#12 — input-validation sweep.** Run to completion (2026-09-06). 7
  untyped-body routes, 6 unbounded money-amount DTOs, unbounded cart
  quantity/array size, a `PayloadTooLargeError` surfacing as 500 instead
  of 413, and a real stored-XSS vector in the storefront product page's
  JSON-LD block were all found and fixed. Verified by 9 new e2e tests
  (`input-validation-sweep.e2e-spec.ts`) plus a clean web build.
- **#15/#17 — concurrency/rate-limit burst-testing.** Run to completion
  (2026-09-06), the last item from the original 5-phase pass. Genuine
  `Promise.all` simultaneous-request bursts (not sequential loops) fired
  at all four named endpoints. Checkout, admin MFA verify, and gift-card
  purchase all held correctly - their shared `RateLimitService.
  enforcePerHour()` is backed by a single atomic Redis `INCR`, race-free
  by construction and now empirically proven so; gift-card purchase was
  additionally burst-tested at/past the new P1.4 `Decimal(12,2)` bound
  concurrently, confirming the two fixes interact correctly. Campaign
  creation surfaced a real, previously-undiscovered race (#17): its
  monthly-quota check read an aggregate in one transaction and inserted
  the new campaign in a separate one, so concurrent (or merely fast-
  sequential) creates could together exceed the quota even though each
  individually passed. Fixed with a `SELECT ... FOR UPDATE` lock on the
  seller's Subscription row plus reserving against every campaign
  created this month, not just ones already sent. Verified by 5 new e2e
  tests (`p15-concurrency-burst.e2e-spec.ts`) plus the full existing
  `module34-email-campaigns.e2e-spec.ts` suite (unaffected).
- **#9 — supplier wallet debit's read-then-recompute race.** Fixed
  (2026-09-06), the same day the campaign-quota fix established the
  pattern. `SupplierWalletService.debitIfSufficientBalance()` now locks
  the supplier's Subscription row (`SELECT ... FOR UPDATE`) inside one
  Prisma transaction shared with the balance re-check and the debit-
  entry insert and the subscription-period advance, closing the
  previous separate-`getBalance()`-then-separate-`create()` gap. Verified
  by a new `Promise.all` dual-sweep e2e test in
  `module20-wallet-supplier-portal.e2e-spec.ts` (tops a supplier's
  balance up to exactly the plan fee, fires two genuinely concurrent
  `runMonthlyDebitSweep()` calls, and asserts exactly one debit entry
  and a final balance of zero) plus the full 14-test file passing.
- **#17's follow-up — `ProductsService.create()`'s product-limit gate.**
  Fixed (2026-09-06), same pass as #9. The existing `store.findUnique()`
  read inside `create()`'s transaction is now preceded by a `SELECT ...
  FOR UPDATE` lock on that same Store row, serializing concurrent
  creates against the same store so two individually-within-limit
  concurrent requests can no longer both pass the count check. Verified
  by a new `Promise.all` two-concurrent-create e2e test in
  `guardrails.e2e-spec.ts` (limit set to 3, 2 products seeded
  sequentially, then 2 concurrent creates asserted to resolve as exactly
  one `201` and one `400`, with the store's final product count staying
  at 3, never 4) plus the full 6-test file passing.

**Still open: none.** Both P2 consistency follow-ups above were closed
the same day they were raised, per the founder's explicit instruction not
to let them become deferred/forgotten items. This concludes the entire
security-hardening thread — all 5 original phases plus both P2
follow-ups are fixed and verified with real evidence and CI green.

Everything marked "confirmed already safe" in §3 was independently
checked against the live code for this report (not merely assumed), and
holds up: the discount/gift-card race guards, the money-rounding
discipline, the password-reset/email-verification token handling, and
the full-history secrets scan.

---

*This document was compiled from a full audit of the session transcript
covering the original 5-phase pass, cross-verified line-by-line against
the live codebase rather than taken on faith from commit messages alone.
Every "confirmed" claim in this document was independently re-checked
while writing it.*
