# Auth & Session Design

**Status:** Part 1 is a factual, cited inventory of what's live today
(2026-10-09). Part 2 is the target design for M1 (`docs/build-plan.md`
§3.2/S3). Part 3 lists gaps this investigation surfaced that are
adjacent to auth/session but outside its direct scope. Nothing in this
document is built yet beyond what Part 1 describes as already shipped.

---

## Part 1 — Current state (cited inventory)

Three auth paths exist: seller/supplier dashboard (`/auth/*`), admin
terminal (`/admin/auth/*`), buyer storefront (`/storefront/auth/*`).
A fourth, narrower path (seller Staff sub-accounts, `/staff/*`) is
noted where relevant.

### 1.1 Token storage

| Surface | Storage | Cited |
|---|---|---|
| Seller/supplier dashboard | `localStorage`: `accessToken`/`sessionId`/`refreshToken`, all plaintext — **including the refresh token itself**, not just the access token | `apps/web/lib/dashboard-api.ts`, `apps/web/app/(auth)/login/page.tsx:16-20` |
| Admin terminal | `localStorage`: `adminAccessToken`/`adminSessionId`/`adminRefreshToken` — same pattern, separate key namespace | `apps/web/lib/admin-api.ts`, `apps/web/app/(admin)/admin/login/page.tsx:76-78` |
| Buyer storefront | `httpOnly` cookie `buyer_session`, read only server-side inside Next.js Server Actions — never shipped to client JS | `apps/web/app/storefront/account/actions.ts:28-51` |

Any stored-XSS gap anywhere in the dashboard or admin terminal is a
full session-theft vector today — the refresh token, not just the
15-minute access token, is sitting in `localStorage`.

### 1.2 Token lifetimes

Access token: **15 minutes** (`JWT_ACCESS_TTL_MINUTES`, `.env.example:35`,
enforced `apps/api/src/auth/auth.service.ts:448-450`). Refresh/session:
**30 days, rolling** — every successful refresh destroys the old Redis
session and issues a brand-new one with a fresh 30-day TTL
(`apps/api/src/auth/session.service.ts:54-77`). A session used at least
once every 30 days persists indefinitely; it only hard-expires from 30
days of total inactivity. No absolute cap exists on top of the rolling
window.

### 1.3 Refresh rotation — yes; reuse detection — no

Rotation is real: `AuthService.refresh()` destroys the old session and
mints an entirely new `sessionId`/`refreshToken` pair on every refresh
(`apps/api/src/auth/auth.service.ts:333-356`, identical pattern in
`admin-auth.service.ts:160-190` and `buyer-auth.service.ts:78-89`).

**No reuse detection exists.** `SessionService.validateRefreshToken()`
(`apps/api/src/auth/session.service.ts:92-98`) looks up the Redis key;
`destroySession()` deletes it outright rather than marking it "used."
A replay of an already-rotated-out refresh token is therefore
byte-for-byte indistinguishable from a request carrying a fabricated
token — both hit the same `null` branch, both produce the same generic
401. Nothing calls the existing `destroyAllSessionsForUser()` primitive
in response to a failed refresh, and `SecurityEventService.record()` is
never invoked from any `refresh()` method. **A stolen refresh token,
replayed once by an attacker and once by the legitimate user, is not
detected as theft** — whichever side loses the race just sees an
"invalid or expired" error.

### 1.4 Session storage and revocation

No `Session`/`RefreshToken` database table exists — sessions live only
in Redis (`session.service.ts:15-38`). **Logout is real server-side
revocation**, not a client-side no-op: `AuthService.logout()` →
`SessionService.destroySession()` deletes the Redis record immediately
(`auth.service.ts:358-360`, `session.service.ts:139-146`) — a stolen
refresh token/session is dead the instant logout runs, for all three
auth surfaces.

One precise nuance: logout revokes the *refresh token/session*, not the
*access token* already in a client's possession — `JwtStrategy.validate()`
does pure JWT signature/expiry verification with no live lookup for an
ordinary token (`apps/api/src/auth/strategies/jwt.strategy.ts:22-43`;
the sole exception is an impersonation token, which does get a live
revocation check, lines 33-41). A stolen access token therefore
remains valid for up to its own 15-minute window even after logout —
bounded, not unbounded, but real.

Seller self-service session management exists: `GET /sellers/me/sessions`
/ `DELETE /sellers/me/sessions/:sessionId` (`apps/api/src/sellers/
sellers.controller.ts:82-97`), gated by `auth.max_concurrent_devices`
(default 3).

### 1.5 Login security

Password hashing: bcrypt, **12 rounds**, consistent across seller/
supplier/buyer/staff signup and reset (`auth.service.ts:33,110,404`,
mirrored in `buyer-auth.service.ts`, `staff-auth.service.ts`). One
exception: the **dev-only** admin-bootstrap script hashes at 10 rounds
(`apps/api/scripts/create-local-admin.ts:31`) — confined to local
tooling, never used by running application code for a real admin
account.

Login rate limiting: dual-keyed (per-account + per-IP), default
20/hour, **flat fixed-window, no exponential backoff** — a hard 429
cutoff at the threshold, reset at the top of each clock hour
(`auth.service.ts:223-225`, `common/rate-limit/rate-limit.service.ts:16-25`).
Identical shape for MFA-code verification (default 10/hour).

One configuration nuance worth carrying into the hardening pass:
`apps/api/src/main.ts:46-68` trusts the *entire* client-supplied
`X-Forwarded-For` chain outside of `NODE_ENV === "production"` — the
code's own comment documents this as a previously-exploited,
since-fixed-for-prod per-IP-rate-limit bypass; confirm the production
deployment target always sets `NODE_ENV=production` correctly.

### 1.6 Password reset

Single-use (token hash cleared on completion, confirmed by the code's
own comment), hashed at rest (SHA-256 of a 32-byte random token, only
the hash persisted — `apps/api/src/auth/token.util.ts:9-13`,
`auth.service.ts:378-384`), 45-minute TTL, rate-limited on both request
and complete. **All other sessions are destroyed on a successful
reset** (`auth.service.ts:417`).

**Reset-link base URL is `APP_BASE_URL` (a required, boot-validated
config value), never the request's `Host` header** —
`auth.service.ts:385`. A full-codebase search for `Host`-header-style
URL construction across `apps/api/src` returned zero matches; every one
of the 14 URL-building call sites in the API uses the same configured
base URL. **Password-reset-poisoning via a forged Host header is not
reachable in this codebase today** — there is no code path that would
honor one.

### 1.7 Account enumeration

Login and password-reset-request responses are content-identical
regardless of whether the account exists, **but both have a bcrypt-
timing side channel** (the slow hash comparison only runs when a
matching user row is found, via short-circuit evaluation) — content
doesn't leak existence, wall-clock timing plausibly does. Signup is
explicit-by-design (`"An account with this email already exists"`) —
a standard, generally-accepted tradeoff for signup specifically.

### 1.8 CSRF

The API has **zero cookie-based authentication** anywhere — every
surface uses bearer tokens exclusively (`ExtractJwt.fromAuthHeaderAsBearerToken()`,
`jwt.strategy.ts:15`). Because a browser never auto-attaches an
`Authorization` header the way it does a cookie, CSRF structurally
doesn't apply to any API route regardless of role.

The one real cookie (`buyer_session`) is `httpOnly`, `sameSite: "lax"`,
read only inside Next.js Server Actions (never reaches client JS, never
sent to the API directly — the Next.js server extracts it and issues
its own server-to-server Bearer-authenticated call). `SameSite=Lax`
alone blocks it from being sent on cross-site state-changing requests;
Next.js 14's Server Actions additionally carry a default same-origin
`Origin`-header check with no `allowedOrigins` override configured in
this repo. One precise gap: neither `buyer_session` nor the sibling
`storefront_unlock_<storeId>` cookie sets `secure: true` explicitly in
its `cookies().set()` call.

### 1.9 Session revocation on password change

**No in-session "change my password while logged in" endpoint exists
anywhere** — the only password-change path for any role is the
forgot-password reset flow (§1.6), which does revoke every other
session. Buyers have no password-change path because they have no
password-reset path at all (§3.1). Staff sub-accounts get a password
reset that updates `passwordHash` but has nothing to revoke — a staff
login never receives a `sessionId`/`refreshToken` in the first place,
only a bare access token, which is **therefore not revocable at all**
by any mechanism short of its own 15-minute expiry.

### 1.10 MFA

Seller MFA: settings-driven (`auth.seller_mfa_enforcement`, default
`"optional"`), voluntary self-enrollment available. An already-enrolled
seller is always stepped through MFA at login regardless of the current
setting. **One seeded enum value, `"required_for_payout_actions"`, is
dead code** — documented in its own seed description but never checked
anywhere in the codebase; selecting it today behaves identically to
`"optional"`.

Admin MFA: unconditionally mandatory, no settings toggle, re-verified
on every admin-guarded request (`admin-auth.guard.ts:36-38`), not just
at login.

Buyer MFA: does not exist.

---

## Part 2 — Target design for M1

Two real options exist, both legitimate; the choice is an engineering-
timeline call, recorded here rather than left implicit.

**Option A — minimal, M1-sized (recommended for M1):**
- Access token: kept in memory only (React state/context), never
  written to `localStorage`. Still sent as `Authorization: Bearer`,
  unchanged transport. Still 15 minutes (already correct).
- Refresh token: moved to an `HttpOnly; Secure; SameSite=None` cookie
  set directly by the API on its own origin, sent back via
  `credentials: "include"` on the one refresh call. `SameSite=None`
  is required here since the cookie crosses from the dashboard's
  origin to the API's origin — this means `SameSite` alone provides
  **no** CSRF protection for the refresh endpoint specifically, so a
  second defense is required: a custom header (e.g.
  `X-Requested-With: XMLHttpRequest`) the API rejects the refresh
  request without, which a cross-site form/script cannot set.
- **Reuse detection, added regardless of which option ships**: on a
  `validateRefreshToken()` miss, distinguish "never existed" from
  "existed, already rotated out" (e.g. keep a short-TTL tombstone of
  recently-destroyed session IDs); on a tombstone hit, call
  `destroyAllSessionsForUser()` for that user and log a
  `SecurityEventService` entry.
- Strict CSP (no `unsafe-inline` script, nonce-based for Next) on the
  dashboard origin.
- CORS: explicit credentialed allowlist for the dashboard's exact
  origin, `Access-Control-Allow-Credentials: true`.
- Net code-touch: the auth/token-handling layer only (`dashboard-api.ts`,
  `admin-api.ts`, `session.service.ts`, the login/refresh/logout
  controllers) — does **not** require restructuring every dashboard
  page's data-fetching.

**Option B — proven-pattern extension (architecturally cleaner, larger
refactor, propose for a later milestone rather than M1):**
Extend the *already-shipped and working* `buyer_session` pattern to the
dashboard and admin terminal: every dashboard/admin API call is proxied
through a Next.js Server Action/Route Handler, so the browser only ever
talks to `app.uzeyn.com` (same-origin, `SameSite=Lax` is sufficient, no
separate CSRF defense needed beyond what already protects
`buyer_session`), and the Next.js server attaches the Bearer token
server-side. This is the stronger design and reuses a pattern this
exact codebase already trusts — but it touches every direct-fetch call
site across the dashboard's ~100 pages, which is a large refactor to
fit alongside M1's other scope (single-store enforcement, plan reseed,
gateway registry, Stripe adapter, Paddle sandbox billing).

**Recommendation:** ship Option A in M1 (closes the highest-severity
gap — the refresh token's plaintext `localStorage` exposure — with a
bounded, auditable change), record Option B here as the target to
revisit once there's room for the larger refactor, most plausibly
alongside the Next.js 14→15 upgrade (D69) since both touch the same
broad surface area.

Also in scope for M1 regardless of option:
- Session-revocation-on-password-change stays correct (already true
  via the reset flow) — no regression risk, just confirm it after the
  token-layer change.
- Staff sub-account tokens: give staff logins a real `sessionId` too,
  so they become revocable (currently a bare, non-revocable access
  token) — small, contained fix.
- `secure: true` explicitly on `buyer_session` and the unlock cookie.

---

## Part 3 — Adjacent gaps found during this investigation (not auth/
session design per se, flagged here so they aren't lost)

- **Buyers have no password-reset flow at all** — no endpoint, no
  page. A buyer who forgets their password has no self-service
  recovery today. Not in the MVP prompt's explicit scope; flagged for
  a founder decision on whether it belongs in M1/M2 or stays a known
  gap for launch.
- **Non-`console` email providers are unimplemented** —
  `EmailService.send()` throws `"Email provider \"X\" is not yet
  implemented"` for anything other than the dev-default console logger
  (`apps/api/src/notifications/email.service.ts:20-34`). In a real
  deployment with a real `EMAIL_PROVIDER` configured, **every email
  send — including password reset and email verification — fails**.
  This is launch-blocking on its own terms regardless of the auth/
  session hardening above: a real email provider needs to be wired in
  before M1 closes, or password reset is non-functional in production.
