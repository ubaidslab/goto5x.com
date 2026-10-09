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
thread.** (Update, 2026-09-16: two new critical CVEs against the pinned
`next@14.2.35` dependency surfaced after this pass closed and were
investigated the same day - both confirmed not exploitable in this
deployment's actual configuration/architecture; see §5. This is a
separate, later thread from the 5-phase pass below, tracked here rather
than in a new document.) This concludes the security-hardening thread
opened by the
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

## 5. Next.js dependency CVEs (2026-09-16) — investigated, not exploitable in this deployment

CI's `dependency-audit` job (`pnpm audit --audit-level=critical`) started
failing on every push once two new critical advisories were published
against `next@14.2.35` (the version this repo is pinned to) - not caused
by any code change in this repo, but a real gate failure that needed a
real answer rather than being waved off.

- **GHSA-p293-qw3h-jr36 - "Unauthenticated Remote Code Execution on
  windows-hosted servers."** Confirmed **not applicable** - this
  platform has no Windows deployment path anywhere. Both `apps/web/
  Dockerfile` and `apps/api/Dockerfile` build `FROM node:20-alpine`
  (Linux/musl), and the entire deployment story in `docs/launch-
  runbook.md` is a Linux VPS running `docker compose`. No fix needed;
  the vulnerable code path can never execute in this environment.

- **GHSA-2xp9-vwfh-vxw4 - "Unauthenticated Remote Code Execution in
  Image Optimization API when AVIF files are used."** Investigated and
  confirmed **not reachable**, for two independent reasons - either one
  alone would already close this, and both hold simultaneously:
  1. **AVIF is never enabled.** `apps/web/next.config.js` has no
     `images.formats` override at all, so Next's own default applies -
     confirmed directly from the installed package's source
     (`node_modules/next@14.2.35/.../shared/lib/image-config.js`,
     `formats: ["image/webp"]`). AVIF encoding/decoding is opt-in only;
     this deployment never opts in, so the vulnerable code path is
     never invoked regardless of what's requested.
  2. **The Image Optimization API is never fed attacker-controllable
     input either way.** `next/image` is used in exactly two files in
     this entire codebase - `components/marketing/ImageStack.tsx` and
     `components/marketing/DeviceMockup.tsx` - both marketing-page
     components whose only real-world call sites (`app/page.tsx`) pass
     hardcoded, build-time-static local paths (`/marketing/dashboard-
     products.png` etc. - developer-supplied product screenshots, never
     a remote or user-suppliable URL). Every path that actually serves
     externally-sourced imagery - product photos, store logos, deal
     thumbnails, wishlist images, D-Studio previews - deliberately uses
     a plain `<img>` tag instead, each already carrying its own
     `eslint-disable @next/next/no-img-element` comment explaining why
     (e.g. "seller-uploaded external MinIO URL, not a static/local
     asset" - `components/dashboard/ImagesSection.tsx`, `app/storefront/
     products/[productId]/product-gallery.tsx`, every storefront
     template, `app/storefront/templates/dstudio-sections/index.tsx`).
     This was a deliberate architectural choice made before this CVE
     existed (keeping untrusted image bytes out of Next's built-in
     optimizer), not a fix applied in response to it - it just happens
     to also close this exposure completely.

**Update (2026-09-16) - explicit mitigation applied, and the CI gate
closed with a documented, scoped exception.** The investigation above
was correct but initially left two loose ends: (1) AVIF being disabled
was only Next's *implicit default* - true today, but silently reversible
by a future `next.config.js` edit or a Next version that changes that
default; (2) `pnpm audit --audit-level=critical` in CI kept failing on
every push with no resolution, which is not sustainable - a red required
check that's expected to stay red indefinitely trains everyone to ignore
it, which is worse than not having the check. Both are now closed:

1. **`apps/web/next.config.js` now explicitly sets
   `images: { formats: ["image/webp"] }`** - the exact interim mitigation
   the official patched Next.js releases apply, made structural instead
   of implicit. AVIF being unreachable is now true by explicit
   configuration, not by relying on a default that could silently change.
2. **`scripts/dependency-audit.sh`** (wired in as the `audit` root
   package.json script, unchanged in CI's `dependency-audit` job) applies
   a narrowly-scoped, fully-commented exception for exactly these two
   GHSA IDs via `pnpm audit --ignore <id>` - the actual mechanism this
   pnpm version (10.33.0) implements (confirmed via `pnpm audit --help`;
   the `pnpm.auditConfig.ignoreCves` package.json field some pnpm docs
   reference was tried first and confirmed **not** respected by this
   version - `pnpm audit` still failed with it set). The script's own
   comments carry the full justification (which CVE, why it's not
   exploitable in this deployment, a `TODO(next-15-upgrade)` marker to
   revisit when the tracked major-version upgrade lands) so the exception
   is legible from the script itself, not just this document.

**What remains genuinely open:** `next@14.2.35` itself is still an
outdated major version with unpatched code for both advisories - this
exception is "not currently exploitable given how this app uses
Next.js, confirmed and now also structurally enforced," not "the
dependency is fine to leave forever." The full Next.js 14→15 upgrade
(required for the real fix, and requiring React 19 plus a full
regression pass across every page) is tracked as its own dedicated
future task rather than rushed into the middle of this pass - see
`docs/SRS.md`'s Risk Register #29 for the entry and reasoning. Both
`scripts/dependency-audit.sh`'s `TODO(next-15-upgrade)` comment and Risk
Register #29 itself must be revisited (the exception almost certainly
deleted outright) the moment that upgrade lands - this is not a
permanent suppression.

---

## 6. Global-Launch Pre-Launch Security Checklist Audit (2026-10-03)

A founder-provided 18-item checklist, audited item-by-item against the
live codebase ahead of the Global Launch Mandate (`docs/SRS.md`'s
§5.70-5.77 amendment) — each verdict below is COVERED (real, cited
evidence), GAP (confirmed missing, cited), or PARTIAL (real but
incomplete coverage, cited). Read replicas were explicitly excluded
from this pass per the founder's own instruction — out of scope for
current scale, not audited, not a gap.

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Soft-delete discipline | **PARTIAL** | Store/Seller/Order all use status-enum transitions (never a hard `.delete()`), confirmed by codebase-wide grep — `Seller` is explicitly documented "never hard-deleted" (`schema.prisma:370-371`). `ProductReview` has real `deletedAt`/`deletedReason` columns. **Confirmed gap:** `ProductsService.remove()` (`products.service.ts:327-338`) performs a literal `tx.product.delete()`, reachable via a live `DELETE /stores/:storeId/products/:productId` route, despite `Product` having its own `archived` status suggesting the same soft convention was intended. `User` has no delete path at all — not a misuse case, a completeness gap (no account-deletion/erasure mechanism exists, soft or hard). |
| 2 | Webhook/UI idempotency | **PARTIAL** | No inbound payment webhooks exist in this codebase by design (`platform-gateway.service.ts:60-62`'s own comment confirms this) — moot for the regional gateways. The three seller-initiated payment-reference submission flows (wallet top-up, template purchase, D-Studio Pack) are correctly idempotent via `PlatformGatewayService.claimSubmissionCooldown()` (atomic Redis `SET NX EX`) plus a DB-unique constraint on consumed references. **Confirmed gap:** buyer checkout's "Place order" has no server-side idempotency guard — `CheckoutService.checkout()` (`checkout.service.ts:90-121`) reads the cart, creates the order, then marks the cart converted, a check-then-act window two concurrent requests on the same `sessionToken` can both pass before either commits, producing two orders from one cart. No `Idempotency-Key` header exists anywhere in `apps/web`. **Relevant to Paddle (§5.72):** Paddle's own webhook delivery is HMAC-signed and retried — verify the new webhook *handler* this integration adds is itself idempotent (checks a Paddle event/transaction ID before acting) before this ships, since this is new surface area, not existing code. |
| 3 | DB migration zero-downtime + FK indexing | **PARTIAL** | 97 of 99 migrations are purely additive; 2 confirmed non-additive (`module97_staff_overhaul`'s `DROP COLUMN "scopes"`, `module24_security_private_exports`'s column renames) — real, but isolated, exceptions, not a systemic practice. FK indexing is inconsistent: 42 of 134 `FOREIGN KEY` constraints across all migrations have no co-located index (`Domain.storeId`, `LedgerEntry.orderId`/`invoiceId`, `dstudio_pack_purchases.verified_by`, `media_assets.thumbnail_media_id` confirmed still unindexed in current `schema.prisma`), while other migration batches (buyer accounts/chat) pair every FK with one correctly — a real, recurring gap, not universal. |
| 4 | Background queues | **PARTIAL** | BullMQ confirmed in use across 27 queues, each scheduled/consumed correctly. **Confirmed gap:** zero retry/backoff configuration found anywhere (`attempts:`/`backoff:` grep returns one hit, and it's a comment stating the opposite) — every queue defaults to BullMQ's `attempts: 1`, so a job that throws once simply fails until its next scheduled tick, with failure handling limited to `console.error`. Failed-job visibility (`AdminSystemStatusService`) covers only 14 of 27 queue constants — 13 queues (including `EMAIL_CAMPAIGNS`, `RENEWAL_REMINDERS`, `SUPPORT_TICKET_SLA`) have no admin-visible failure count at all. |
| 5 | Documentation/ADRs | **GAP**, substitute mechanisms exist | No `docs/adr/` directory or ADR-numbered-file convention exists anywhere in the repo. Substitutes are real and substantive but not a lightweight per-decision format: `docs/build-plan.md` (dated amendment sections), `docs/SRS.md` (§12 Risk Register/§13 Open Questions/§14 Acceptance Checklists), `CHANGELOG.md`, and this document itself — the closest existing model for how a decision/finding record should look, just never generalized into a per-decision ADR. `docs/founder-decisions-log.md` (new, created alongside this audit) is the first step toward closing this specific gap going forward. |
| 6 | SAST/OWASP Top 10 + IDOR | **PARTIAL** | IDOR: **COVERED**, independently re-verified (not re-trusted from §3's prior pass) at two further endpoints (`GET /stores/:storeId/orders/:orderId`, `GET /stores/:storeId/shipping-settings`) — both dual-layer, JWT-derived id + explicit `storeId` re-check inside RLS-scoped queries, never a client-suppliable id alone. SAST: **confirmed gap** — the 5-job CI pipeline runs no Semgrep/CodeQL/Snyk-Code/eslint-security pass, and no `.eslintrc*`/lint script exists in this repo at all, so not even plain ESLint runs in CI today. No `.github/dependabot.yml` either. |
| 7 | RLS (Postgres Row-Level Security) | **COVERED** | Real, DB-level enforcement, not app-level filtering alone — `TenantPrismaService.run()` sets `SET LOCAL app.current_seller_id` (UUID-regex-validated against the one deliberate string-concatenation site in the codebase) inside a transaction; real `CREATE POLICY` SQL across 28 migration files, `ENABLE`/`FORCE ROW LEVEL SECURITY` on 50+ tables. Role separation (`app_runtime`, no `BYPASSRLS`; `app_admin`, `BYPASSRLS`, gated behind `AdminAuthGuard`-only paths) closes the "app bug bypasses it" risk. `admin_audit_logs`/`user_security_events` additionally have `UPDATE`/`DELETE` revoked from both roles at the grant level. |
| 8 | Dependency audit | **COVERED**, with a documented exception (see Risk Register #29 above) | CI's `dependency-audit` job blocks on `pnpm audit --audit-level=critical` (two narrowly-scoped, commented, time-boxed exceptions for the pinned-`next@14.2.35` CVEs); high-severity is reported, non-blocking; a dedicated self-test proves the audit mechanism itself still catches a known-vulnerable package. **One stale, misleading config confirmed:** root `package.json`'s `pnpm.auditConfig.ignoreCves` field is not actually respected by this repo's pinned pnpm version (10.33.0) — the real enforcement is `dependency-audit.sh`'s `--ignore` CLI flags. Remove the dead config so a future reader doesn't mistake it for the live mechanism. |
| 9 | Encryption/hashing | **COVERED** | bcrypt, 12 rounds (`auth.service.ts:11`). One canonical AES-256-GCM implementation (`drive-token-crypto.util.ts`) reused, not duplicated, across 5 independently-keyed domains (CNIC — retired by §5.71, payment-gateway credentials, seller/admin SMTP credentials, external-API signing secrets). Real, runnable, tested key-rotation tooling (`scripts/rotate-encryption-key.ts`, `--dry-run` supported, all-or-nothing per row) plus a documented runbook (`docs/launch-runbook.md:84-109`). |
| 10 | Env/secrets hygiene | **PARTIAL** | Committed-secrets check is genuinely clean — `git log --all --diff-filter=A` for every `.env*` pattern across full history returns only 3 placeholder `.example` files, ever; `.gitignore` confirmed actually working via `git status --ignored`. **Confirmed gap:** no secrets-scanning step exists in CI (no gitleaks/truffleHog step, no pre-commit hook) — the clean `gitleaks` result on record (§3 #16) was a one-time manual pass, not a recurring automated gate. Nothing today stops a future secret from being committed and sitting undetected until someone manually re-runs a scan. |
| 11 | Log sanitization / PII compliance | **PARTIAL** | HTTP access logging is correctly minimal by design (`PiiRedactionInterceptor` logs only `method path +Nms`, never body/query/headers) and the global exception filter never leaks a stack trace to a 5xx response body. **Confirmed gap:** `EmailService`'s only currently-working code path (`EMAIL_PROVIDER=console`) logs the full email body via the standard `Logger` — and `auth.service.ts` builds email-verification/password-reset URLs containing the raw secret token before passing them to this path, meaning those tokens are logged in plaintext today, in any environment, until a real email provider is wired in (every non-console provider currently throws `"not yet implemented"`). |
| 12 | Connection pooling | **GAP** | `docs/tech-stack.md`/`docs/architecture.md`/`docs/SRS.md` all document PgBouncer as **"Required from Phase 1"** — `docker-compose.yml` defines no such service, and neither local-run doc mentions it. Prisma clients are constructed with no `connection_limit`/pool params anywhere, left on Prisma's undocumented-in-repo default. The documented requirement was never actually implemented. |
| 13 | Rate limiting | **COVERED**, including buyer-facing | Global `ThrottlerModule` baseline (100/min default) on every route, plus `RateLimitService.enforcePerHour()` (Redis-backed, atomic `INCR`, already burst-tested under genuine concurrency per §3 #15) applied at 30+ specific sites — confirmed present on every endpoint named in the checklist (signup, login, password reset, admin login) **and** on the storefront/buyer-facing side specifically (checkout, cart creation, gift-card purchase, deal buy-now, reviews, returns, buyer chat, password-protected-storefront unlock) — not a gap some might assume exists. |
| 14 | CORS | **COVERED** | Explicit allowlist only (`CORS_ALLOWED_ORIGINS` env var, `main.ts:64-70`), `enableCors()` called only when that list is non-empty. Zero wildcard (`origin: "*"` or equivalent) found anywhere in either app. Production is same-origin behind Traefik by design — CORS exists only for dev/mobile, never a blanket allow-all. |
| 15 | Custom error pages (no raw stack traces) | **PARTIAL** | API side fully covered — the global exception filter hardcodes `"Internal server error"` for any unhandled 500, with `exception.stack` going only to the server-side `Logger`, never the response body, regardless of `NODE_ENV`. **Confirmed gap on the web side:** zero `error.tsx`/`not-found.tsx`/`global-error.tsx` exist anywhere in `apps/web` — every error/404 renders Next.js's own generic, unbranded default page today. |
| 16 | Graceful shutdown / circuit breakers | **PARTIAL** | The background worker process (`worker.main.ts`) has a real `SIGTERM`/`SIGINT` handler that closes all ~23 BullMQ workers cleanly. **Confirmed gap:** the request-serving API process (`main.ts`) has no `enableShutdownHooks()` call and no signal handler at all — a `docker stop`/orchestrator SIGTERM hard-kills it without draining in-flight requests. No circuit-breaker pattern exists anywhere (all 4 payment adapters and the Printify client use a bare `AbortSignal.timeout()`, a timeout, not a breaker) — `PaymentGatewayService.chargeViaGateway()` calls an adapter unconditionally even when `GatewayHealthService` already knows that provider is degraded. |
| 17 | Health checks | **COVERED** | `GET /health` (`health.controller.ts`) checks Postgres + Redis in parallel, returns 503 via `ServiceUnavailableException` on either failure, 200 otherwise — genuinely public (no auth guard beyond the generic throttler), distinct from the admin-gated System Status page, suitable for a load-balancer/orchestrator healthcheck as-is. |
| 18 | 3-2-1 backups | **GAP**, not true 3-2-1 | `DatabaseBackupService` does produce one real off-box copy (a separate S3-compatible bucket from the primary MinIO, confirmed deliberately distinct) on a daily schedule — but that's 2 copies total (live DB + one dump), one storage medium pair, not 3 copies / 2 media / 1 offsite. The service's own docstring already discloses this explicitly ("off-box copy of the MinIO data directory... needs a real second storage account" — not yet built). If `BACKUP_S3_*` is unset, backups silently record `skipped_not_configured` rather than failing loud — only visible by checking the admin status page. |
| — | Audit logging (checklist item, listed last on the founder's list, audited here out of order for grouping with #7/#10) | **COVERED** | `AuditLogService` has no update/delete method in the class, and both DB roles have `UPDATE`/`DELETE` revoked on `admin_audit_logs` at the Postgres grant level — genuinely append-only, not just by convention. 62 `.record()` call sites across 31 files — broad coverage of admin-mutation surfaces (auth, trust & safety, theme-engine purchases, support tickets, growth programs, billing), not sparse. |
| — | Read replicas | **Explicitly deferred, not audited** | Out of scope for current scale per the founder's own instruction. Not a gap — a deliberate non-decision, recorded here so a future reader doesn't mistake its absence from this table for an oversight. |

**What this means for the Global Launch Mandate specifically:** none of
the 7 confirmed gaps/partials above (items 1 Product hard-delete, 2
checkout idempotency, 3 FK indexing, 4 queue retry/visibility, 10
secret-scanning, 12 connection pooling, 15 web error pages, 16 API
graceful shutdown, 18 true 3-2-1) block any of §5.70-5.77's work, and
none were introduced by this amendment — they are pre-existing,
general-hardening items this audit surfaced while looking, same as
every prior phase of this report. The one genuinely launch-adjacent
finding is **item 2's checkout idempotency gap**, worth closing before
or alongside Paddle's own webhook handler ships (§5.72), since that
handler is new surface area that should not repeat the same
check-then-act shape checkout already has. Everything else is tracked
here as backlog, not a blocker, consistent with this document's
standing "disclosed, not silently absorbed" discipline.

---

## 7. Pricing/Programs/Partners Amendment — New Risk Items (2026-10-08)

Four new risk items surfaced by the 2026-10-08 pricing/programs
amendment (`docs/founder-decisions-log.md`, `docs/SRS.md` §5.78-5.92).
**Every item below is a planned control for not-yet-built work — none
of this is fixed, none of it is built, and nothing here should be read
as "closed."** Full decisions: D4, D20, D25-D27.

| # | Item | Status | Planned control |
|---|---|---|---|
| 1 | Store-domain/cookie-scope separation (D25) | **Planned control; partially already true by accident, not by design** | §5.89 FR-89.1 — confirmed the *outcome* already holds today (dashboard uses `localStorage`, the one buyer cookie is already host-only), but this is an emergent property of unrelated implementation choices, not an explicit architecture. The real control going forward is a review-checklist item: never introduce a shared `domain: ".uzeyn.com"` cookie attribute in future auth work. |
| 2 | Free-tier abuse surface (D26) | **Planned control, not built** | A report-abuse link, a takedown process with an SLA, a brand-impersonation blocklist, signup rate limits (extends the existing `RateLimitService`), AUP/ToS liability-limit language, and phishing/spam monitoring — none of these exist specifically for free-tier storefronts today. §5.89 FR-89.2. |
| 3 | UZEYN Partners identity/KYC data (D20 FR-84.6) | **Planned control, not built** | Partner identity documents, if unavoidable, must be stored encrypted (AES-256-GCM, reusing the existing canonical encryption utility rather than a new implementation), access-logged, and deleted after verification — keeping only the result, reviewer, and date. No CNIC-style long-term document retention. This is a design requirement for not-yet-built Phase-B/post-launch work, not a statement about any data currently held (no Partner program exists in code yet). |
| 4 | UZEYN Partners payout release (D20 FR-84.5) | **Planned control, not built** | Payout release must be an admin money-moving action gated by step-up MFA, a typed confirmation, and a full audit-log entry — the same discipline already proven out elsewhere in the admin terminal (e.g. the Newsletters "Send" typed-confirmation gate, §5 Part 5 of this document's own UI inventory cross-reference). Not built because the Partner ledger itself is not built. |

**Relationship to the existing Risk Register:** items 1-2 above (domain
separation, free-tier abuse) both fold into `docs/SRS.md` §12 Risk
Register item #37; items 3-4 (Partner KYC data, payout release) both
fold into item #38 (the Partner bonus money-moving risk, which already
names fraud/clawback/KYC/payout controls together) — this table is the
security-specific elaboration of those two risk-register rows, not a
parallel list. See §12 for the full #34-44 set.

---

## 8. MVP Execution Prompt — Security Workstream (2026-10-09, D79)

The founder's MVP Execution Prompt makes security a first-class,
evidence-based workstream for the MVP itself (not deferred hardening)
— defend against a skilled, motivated attacker, not just casual abuse.
Full control list (S1–S15) and the abuse-case catalog live in the
prompt itself and will be transcribed into `docs/security/abuse-
cases.md` as M1/M2 land the corresponding tests (not yet created —
tracked here so its absence isn't mistaken for a decision not to build
it). **Every item below is a planned control, tagged to the milestone
that builds it — none of this is fixed yet.**

| Control | Tier | Milestone | What it covers |
|---|---|---|---|
| Tenant isolation (RLS forced, no bypass from a seller-facing route) | P0 | M1 | See `docs/auth-session-design.md`'s sibling RLS investigation for the current-state baseline this builds on |
| Object-level authorization (IDOR/BOLA) on every route | P0 | M1 | Generated allow/deny test per route |
| Auth and sessions | P0 | M1 | See `docs/auth-session-design.md` for the full current-state investigation and target design |
| Gateway-secret custody (envelope encryption, master key outside the app host/image) | P0 | M1 | D57 |
| Payment integrity (server-computed amounts, idempotency keys, atomic state transitions, webhook verification) | P0 | M1–M3 | The abuse-case catalog's payment-tampering cases |
| Input/output safety (sanitization, SSRF guard, upload validation, CSV-injection neutralization) | P0 | M2 | The abuse-case catalog's injection cases |
| Store-domain separation (real build, not the "already true by accident" state this report's §7 previously recorded) | P0 | M2 | Supersedes this report's own 2026-10-08 §7 item 1 framing — see `docs/SRS.md` §5.93 FR-93's cross-reference |
| Custom CSS cannot exfiltrate or script (RISE's Custom CSS feature) | P0 | M2 | Genuinely new risk this prompt surfaces — no prior audit pass covered seller-authored CSS as an attack surface |
| Security headers and transport (CSP without unsafe-inline, HSTS, no secrets in client bundles) | P0 | M2 | |
| Abuse limits (rate limits, Turnstile, disposable-email blocklist) | P0 | M2 | Builds on this report's existing §6 item 13 (rate limiting, already COVERED broadly) |
| Admin plane (step-up MFA on destructive/money actions, typed confirmation) | P0 | M2 | Builds on existing admin-terminal `useConfirm()` gating already shipped |
| Supply chain and CI (pinned Actions by SHA, secret scanning, non-root images) | P0 | M1 | Builds on this report's existing §6 item 10 (env/secrets hygiene — no CI secret-scanning step today, confirmed gap) |
| Observability and incident response (redacted structured logs, per-gateway kill switch, runbooks) | P0 | M2 | |
| **Independent paid security review** — tenant isolation, payments, webhooks, domain separation, key custody | P0, before launch | M4 | D58; gated explicitly before any real seller gateway key is accepted, not before |
| Privacy basics (PII export/delete runbook) | P1 | by launch +30 days | |

**Relationship to the existing Risk Register:** see `docs/SRS.md` §12
items #45+ (added alongside this section) for the specific new risks
this workstream responds to, distinct from #34–44's pricing/programs-
era risks.

### Tenant isolation (RLS) — independently re-verified, 2026-10-09

Re-checked from scratch against the live codebase (not re-stated from
this report's own §6 item 7) ahead of the MVP build, since real seller
payment credentials are about to flow through this platform for the
first time. **No confirmed cross-tenant data leak found**, after a
full-file read of 30+ of the highest-risk services (wallet/billing,
staff accounts, buyer accounts, checkout, every IDOR-shaped method
taking a client-suppliable resource id, and every file that imports
both `PrismaAdminService` and `TenantPrismaService`).

- All 53 RLS-protected tables have `FORCE ROW LEVEL SECURITY` paired
  with `ENABLE`, zero exceptions, each using an identical,
  independently-parsed fail-closed policy guard. One precision over
  this report's earlier §6 item 7 framing: `app_runtime` is not the
  table *owner* (the migration superuser is), so under Postgres's own
  semantics `FORCE` isn't actually the control protecting
  `app_runtime`'s isolation — plain `ENABLE` plus `app_runtime` being a
  non-superuser, non-`BYPASSRLS` role already does that job. `FORCE` is
  present everywhere regardless (good hygiene), just not the
  operative mechanism under this ownership model.
- `app_runtime` has no `BYPASSRLS`/`SUPERUSER`/`CREATEDB`/`CREATEROLE`
  and owns no tables; `UPDATE`/`DELETE` are revoked at the grant level
  on **5** append-only tables (`admin_audit_logs`, `user_security_events`,
  `platform_events`, `stock_adjustments`, `milestone_events`) — 3 more
  than this report's §6 item 7 originally cited.
- `TenantPrismaService.run()`'s one deliberate string-concatenation
  site is UUID-regex-gated and unit-tested against 13 adversarial
  inputs (SQL injection, homoglyphs, embedded quotes); confirmed the
  *only* such site in the codebase — all 15 other raw-SQL call sites
  use real bind parameters.
- **New finding, not previously documented:** ~20 of the 27 background-
  job queues (every named scheduler checked: cart abandonment,
  missing-tracking alerts, dormant-store sweep, renewal reminders,
  daily sales summary, and more) operate via the `app_admin` bypass
  client across *all* tenants in one pass, never per-seller through
  `TenantPrismaService`. Every one re-scopes correctly by each row's
  own `storeId`/`sellerId` inside its loop — no leak found — but this
  means **RLS provides zero protection for the background-job surface
  by construction; correctness there is entirely app-level, not
  DB-level**, a materially different trust model from the request-
  serving path. Worth the founder knowing explicitly rather than
  assuming RLS "also" covers it.
- **Two concrete hardening refinements identified for M1** (neither is
  a confirmed vulnerability today): (1) `WalletService` and
  `SubscriptionInvoiceService` use `PrismaAdminService` for 100% of
  their seller-facing queries, including on two tables that *are*
  RLS-protected (`wallet_balances`, `ledger_entries`) — safe today
  because neither ever takes a second client-suppliable id, but it
  means a future code change that weakens a `where: { sellerId }`
  filter would not be caught by RLS the way almost everywhere else in
  the codebase would catch it. Routing these through `TenantPrismaService`
  would restore that defense-in-depth. (2) `PrismaAdminService`'s own
  doc comment states "three legitimate uses, and no others" but the
  background-sweep pattern above is a de facto fourth, undocumented
  legitimate use — worth updating the comment to match actual,
  verified-safe usage rather than leaving a stale threat model.

---

*This document was compiled from a full audit of the session transcript
covering the original 5-phase pass, cross-verified line-by-line against
the live codebase rather than taken on faith from commit messages alone.
Every "confirmed" claim in this document was independently re-checked
while writing it.*
