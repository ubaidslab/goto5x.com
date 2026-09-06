# Security Audit Report — Internal Hardening Pass

This is the authoritative, standalone record of the security-hardening pass
run against this codebase, per the founder's standing request for
advanced, "top-class-hacker-resistant" security. It replaces what had
previously existed only as scattered commit messages and an informal
verbal summary — this document is the actual pre-launch security record.

**Status as of this writing: incomplete.** Two of five phases never
executed at all, a third is roughly a third done, and two real
vulnerabilities were found and are **not yet fixed**. This report exists
specifically so that gap is visible and actionable rather than quietly
assumed away. Nothing in this document should be read as "the platform is
secure" — it is the honest state of an audit that stalled partway through.

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

### Phase 1 — Input validation sweep: **never executed**

Two dispatch attempts were made. The first was silently killed by a
sandbox container restart roughly an hour in, undiscovered until much
later. The second was interrupted before it could produce any findings.
**No endpoint was ever tested under this phase, and no findings — fixed or
otherwise — exist for it.**

The only two adjacent facts on record, found incidentally while
investigating other phases:

- The global `ValidationPipe` (`apps/api/src/main.ts:13`) is configured
  `{ whitelist: true, transform: true }` — unknown fields are stripped
  from incoming payloads. `forbidNonWhitelisted` is **not** set, so an
  unexpected field is silently dropped rather than rejected with a 400.
  This is a real gap in defense-in-depth (a client sending garbage fields
  gets no signal that anything was wrong), though not itself an exploit
  path given `whitelist: true` already strips them.
- `auth.controller.ts`'s `refresh`/`logout` endpoints and
  `admin-auth.controller.ts`'s `beginMfaEnrollment` take an untyped
  `@Body() body: {...}` object literal instead of a validated DTO class,
  bypassing the pipe entirely for those three routes. Each only reads a
  couple of named fields off the object, so no direct exploit was found —
  but they were never the subject of a deliberate check either.

**Open scope, entirely untested:** negative-number/range abuse, oversized
string/payload handling, null/undefined required fields, wrong types,
empty arrays, unicode/homoglyph identity-field tricks, SQLi-style payloads
against the ORM, script/HTML injection in every free-text field (product
descriptions, review bodies, D-Studio custom CSS/HTML, seller bios,
campaign email bodies, etc.), and ReDoS in this codebase's validation
regexes.

### Phase 2 — Business-logic abuse scenarios: **mostly done, one gap unfixed, one sub-area untested**

This phase has real, verified substance behind it — the most complete of
the five besides the secrets audit.

**Fixed and verified:**
- OTP verify/resend check-then-write race (see §3, #1)
- Promo-code redemption check-then-write race (see §3, #3)

**Found, confirmed real, NOT fixed:**
- Admin impersonation "End session" does not revoke the already-issued
  JWT (see §3, #4) — the single most important open item in this entire
  report.

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

**Never executed:** the IDOR full sweep across every resource type — the
single largest named sub-scope of this phase. Two dispatch attempts were
made and both were interrupted before producing a report, identically to
Phase 1's failure pattern.

### Phase 3 — File-upload security: **never executed; independently confirmed a real gap exists**

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

**Net effect (see §3, #14): a file whose actual bytes are anything can be
uploaded labeled `Content-Type: image/svg+xml` — it passes the
`startsWith("image/")` check — and the storage layer serves it back with
that same executable content type.** This is a plausible stored-XSS
vector via a mislabeled SVG upload (or similar), and it is currently
**unmitigated**. This is precisely the class of issue Phase 3 was scoped
to catch; the phase never ran, and the gap was found only by this
report's own follow-up check.

### Phase 4 — Rate-limit verification under real concurrency: **partially done — 2 of 6 named endpoints actually tested**

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

**Never burst-tested, despite being named explicitly in this phase's own
scope:** checkout, login/MFA (MFA specifically, distinct from the
password-login burst above), campaign send, and gift-card purchase. No
concurrent-traffic test of any kind exists for these four endpoints
anywhere in this session.

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
| 4 | Admin impersonation "End session" doesn't revoke the JWT | 2 | **Found, NOT fixed** | `apps/api/src/impersonation/impersonation.service.ts`'s `end()` only sets `endedAt` in the database. `apps/api/src/common/guards/impersonation-write.guard.ts` only checks whether the JWT's `impersonationSessionId` claim is *present* — it never re-checks that session's `endedAt` against the database. Both confirmed directly in current code. | An admin's already-issued impersonation token keeps working as that seller for the rest of its TTL (configurable 5–240 minutes) after "End impersonation session" is clicked. The safety control does not do what its name implies. **Recommended next step, not yet done.** |
| 5 | Discount-code redemption race | 2 | **Confirmed already safe** | Atomic `updateMany` guarded by `usageCount: { lt: usageLimit }`, confirmed at `apps/api/src/store-settings/discount-codes.service.ts:61`. | No fix needed. |
| 6 | Gift-card balance-draining race | 2 | **Confirmed already safe** | Atomic `updateMany` guarded by `remainingBalance: { gte: amount }`, confirmed at `apps/api/src/gift-cards/gift-cards.service.ts:184-186`. | No fix needed. |
| 7 | Mass-assignment via DTOs | 1 / 2 | **Confirmed mostly safe, one caveat** | Global `ValidationPipe({ whitelist: true })`; 10 sensitive DTOs spot-checked, none map a client field onto `role`/`isAdmin`/`balance`/etc. Caveat: `forbidNonWhitelisted` is unset (silently strips instead of loudly rejecting), and `auth.controller.ts`'s `refresh`/`logout` plus `admin-auth.controller.ts`'s `beginMfaEnrollment` use an untyped `@Body()` object literal that bypasses the pipe entirely. | Low — no direct exploit path found on the three untyped-body routes, but they sit outside the validation pipe's protection entirely and were never deliberately checked. |
| 8 | Money rounding/precision abuse | 2 | **Confirmed already safe** | 24 files route arithmetic through a shared `round2()` (`apps/api/src/orders/money.util.ts`); no unrounded float math found feeding a persisted/charged amount. | No fix needed (a theoretical IEEE-754 boundary case exists in principle but was not found to be exploitable in practice). |
| 9 | Supplier wallet debit — read-then-recompute, not atomic | 2 (incidental) | **Found, not fixed** | `apps/api/src/.../plan-fee-debit.service.ts` reads a JS-recomputed balance from `supplier-wallet.service.ts` rather than using a true atomic increment/decrement, unlike `WalletService`'s pattern elsewhere. | Exploitable only if the monthly debit-sweep cron can run concurrently for the same supplier — plausible under a scheduler misconfiguration or manual re-trigger, but not demonstrated live. Was surfaced as a side-observation, not itself investigated as a primary finding. |
| 10 | Password-reset / email-verification token reuse | 2 | **Confirmed already safe** | Token hash cleared atomically on first use in the same `update()` call, both flows, `apps/api/src/auth/auth.service.ts`. No clock-skew grace period on either expiry check. | No fix needed. |
| 11 | Access-token (JWT) has no live revocation check | 2 | **Confirmed as an accepted, deliberate tradeoff** | `apps/api/src/auth/jwt.strategy.ts` — stateless, 15-minute TTL, no per-request DB/Redis lookup. Refresh-token sessions are separately, genuinely revocable. | Low — standard short-TTL access-token design; not treated as a bug. |
| 12 | Input-validation sweep across all endpoints | 1 | **Never tested** | Both dispatch attempts failed or were interrupted before producing any findings. | Unknown severity. Negative-number/boundary handling, XSS sanitization of every free-text field, ReDoS in validation regexes, and any raw-SQL usage were never audited. |
| 13 | IDOR full sweep across every resource type | 2 | **Never tested** | Both dispatch attempts failed or were interrupted before producing any findings. | Unknown severity. This was explicitly framed as "a full fresh sweep across every resource type" and never ran once. |
| 14 | File-upload content-type spoofing (no magic-byte check) | 3 | **Never tested by this audit; independently confirmed to exist** | `apps/api/src/media/media.util.ts` trusts the client-supplied `mimetype` string only (`startsWith("image/")`/`"video/"`); `apps/api/src/media/object-storage.service.ts`'s `putObject()` echoes that same untrusted value as the stored object's served `Content-Type`, with no `Content-Disposition` set. No magic-byte-sniffing library exists anywhere in `apps/api`. | Plausible stored-XSS via a file whose real bytes are arbitrary but is labeled e.g. `image/svg+xml`, served back with that same executable content type. **Currently unmitigated.** |
| 15 | Checkout / MFA / campaign-send / gift-card-purchase burst-concurrency | 4 | **Never burst-tested** | Zero concurrent-traffic tests exist for these four endpoints anywhere in this session, despite each being named explicitly in the phase's own scope. Only signup and login actually received the "real concurrency" treatment the phase promised. | Unknown severity — these are exactly the endpoints a founder explicitly flagged as sensitive, and none of them were re-verified under real burst traffic. |
| 16 | Secrets committed to git history | 5 | **Confirmed already safe** | Full-history `gitleaks` scan, 9 hits, all individually triaged as non-issues (Settings Registry key names / disposable CI-only keys). Both `.env.example` files confirmed placeholder-only. | No fix needed. |

## 4. What this means for launch readiness

**Do not represent this platform as "secure" or "hardened" on the
strength of this pass alone.** Two of five phases (Input validation,
File-upload security) never actually ran — their task-tracker status of
"in progress" is misleading in the ordinary sense of the phrase; the
honest description is "not started." Phase 2's one large missing
sub-scope (the IDOR sweep) is the same story. Phase 4 tested 2 of the 6
endpoints it named.

Two concrete, currently-live gaps exist and should be prioritized before
any claim of launch-readiness:

- **#4 — impersonation "End session" doesn't revoke the token.** This is
  the more serious of the two: it defeats a control whose entire purpose
  is operator-facing trust and safety.
- **#14 — file-upload content-type spoofing.** A plausible stored-XSS
  vector via mislabeled upload content, with no magic-byte validation
  anywhere in the upload path.

Everything marked "confirmed already safe" in §3 was independently
checked against the live code for this report (not merely assumed), and
holds up: the discount/gift-card race guards, the money-rounding
discipline, the password-reset/email-verification token handling, and
the full-history secrets scan.

The recommended next step is to actually complete Phases 1 and 3 (which
never ran), finish the IDOR sweep from Phase 2, extend Phase 4's
concurrency testing to the four untested named endpoints, and fix
findings #4, #9, and #14 above — at which point this document should be
updated in place (not superseded) to reflect the completed state.

---

*This document was compiled from a full audit of the session transcript
covering the original 5-phase pass, cross-verified line-by-line against
the live codebase rather than taken on faith from commit messages alone.
Every "confirmed" claim in this document was independently re-checked
while writing it.*
