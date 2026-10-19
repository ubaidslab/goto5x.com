# New developer orientation

Read this first. It doesn't duplicate the other docs — it tells you which
one to open for what, how changes land safely, how to run the thing
locally, and which product questions are still genuinely unanswered so you
don't accidentally build against a guess.

## Which docs are authoritative

**`docs/founder-decisions-log.md` is the single source of truth for *why*
a decision was made, and wins over every other doc on conflict.** It's a
dated, append-only log — entries are never rewritten to "clean up" earlier
reasoning. If a later decision reverses an earlier one, the later entry
says so explicitly and the earlier entry stays as historical record. If
you find a real contradiction between two docs (not just one being more
up to date), the decisions log wins; flag the stale doc for correction
rather than trusting it.

| Doc | What it's for |
|---|---|
| `docs/founder-decisions-log.md` | **Source of truth.** Decisions + reasoning, dated, supersession tracked explicitly. |
| `docs/advisor-log.md` | Historical context only — a founder/advisor conversation transcript. Explicitly **not** authoritative; says so in its own header. |
| `docs/prompts/2026-10-19-phases-1-5.md` | The founder's full phased build-out prompt (Phase 1 close-out through Phase 5 deploy-ready) — committed verbatim. **Supersedes any earlier phase plan where they conflict.** Its own §1.3 decisions are logged as D152-D157; the rest is task sequencing, tracked in this doc's "Where the project is right now" section below, not re-logged as separate D-numbers. |
| `docs/features/storefront-themes-v2.md` | The target spec for Storefront Themes v2 + D-Studio v2 (MVP scope, launch-blocking per D152) — a standalone copy of the prompt's §4. Not yet built; `docs/features/storefront-and-themes.md` describes what's actually live today. |
| `docs/SRS.md` | Technical spec: FR numbers, Risk Register, Open Questions, Acceptance Checklists (§14). The "what to build," not the "why." |
| `docs/pricing-and-programs.md` | Canonical numbers for pricing/billing/referral-program mechanics. |
| `docs/mvp-scope.md` | Current MVP ships/dormant/post-MVP summary — read this for "is X in scope." |
| `docs/plan-matrix-mvp.md` | Per-tier feature gate matrix: target vs. what's actually shipped vs. what marketing may claim. |
| `docs/build-plan.md` | Sequencing of implementation work — milestone order, not decisions. |
| `docs/security-audit-report.md` | Security source of truth — evidence-based findings, not a claims doc. |
| `docs/architecture.md`, `database-schema.md`, `tech-stack.md` | Technical reference. |
| `docs/founder-local-run.md` | Full non-engineer local setup walkthrough (this doc's "Local run" section below is the fast version). |
| `docs/launch-runbook.md` | Deployment/launch operational checklist. |
| `docs/mvp-v1-cutlist.md`, `page-inventory.md`, `ui-feature-inventory.md`, `auth-session-design.md`, `stripe-seller-setup.md`, `gateway-verification/`, `legal/`, `features/` | Narrower reference material — check each file's own header for exact scope before assuming it's current. |

## PR / CI rules

- **Every change goes through a branch and a PR — no direct pushes to
  `main`** (D92). One unit of work per PR.
- **CI must be green before merge, independently confirmed** — read the
  actual check-run/Actions result, never trust a summary (including this
  one) that claims "CI passed."
- `main`'s branch protection is a repo-admin setting (GitHub Settings →
  Branches), not something this codebase enforces in-repo. This session
  observed PR #16 report `mergeable_state: "blocked"`, which is consistent
  with required checks/reviews being enforced, but that's an inference
  from PR behavior, not a direct read of the protection rule — treat the
  actual configuration as the founder's own source of truth.
- CI jobs today (`.github/workflows/ci.yml` on `main`): `changes` (a
  path-filter gate), `typecheck`, `lint`, `docker-build` (verifies
  non-root container users), `unit-tests`, `db-role-grants`,
  `backup-restore-drill`, `kms-localstack-test`, `stripe-mock-test`,
  `e2e-tests` (sharded) + `e2e-tests-summary`, `dependency-audit`,
  `web-build`. (A `paddle-sandbox-test` job exists on the Phase 1/Paddle
  branch and isn't on `main` as of this doc — see that PR.)
- **The docs-only skip only fires on a plain `push` to an already-existing
  branch** (confirmed by directly observing this PR's own two CI runs, not
  by reading the YAML alone): a `pull_request` event always runs
  everything (`code=true` unconditionally — see the `changes` job's own
  "Not a push event - running everything" branch), and so does a brand
  new branch's first push, or anything outside the checkout's fetch-depth
  (same unconditional fallback). In practice this means **a PR's own CI
  run is always the full suite, regardless of how small or docs-only the
  diff is** — the skip only saves minutes on a subsequent push of more
  commits onto a branch that already has an open PR... but even then,
  GitHub re-runs the workflow for both the `push` and the already-open
  `pull_request`, so the `pull_request`-triggered run still won't skip.
  Don't assume a docs change will produce a fast, mostly-skipped CI run on
  its PR — budget for the full run.
- Shell steps in CI use `set -o pipefail` (D130) — a piped command's exit
  code must reflect the real command's result, not just the last stage of
  the pipe.
- **Secrets:** sandbox/test credentials only, as GitHub Actions
  **environment** secrets (never repository-level, never reachable from a
  fork PR). Live keys never touch CI — no exception, for any gateway.
- A flaky test gets its real root cause fixed, not retried or skipped —
  see D133 (an otplib TOTP clock-skew default, not "test flakiness") as
  the model for how to treat one.

## Local run

Fast path for a developer (Node 20+, pnpm, and either Docker for
Postgres/Redis or your own local instances):

```sh
corepack enable
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev:api     # apps/api (NestJS) - localhost:<port per .env>
pnpm dev:web     # apps/web (Next.js) - separate terminal
```

Tests:

```sh
pnpm test:api         # unit suite, no external services
pnpm test:api:e2e     # e2e - needs a real Postgres + Redis, see apps/api/test/e2e/setup.ts
```

Copy `apps/api/.env.example` → `.env` and `apps/api/.env.test.example` →
`.env.test`, then fill in real values. Never commit a real `.env` — every
committed env file in this repo is an `.example`.

If anything above doesn't just work, switch to **`docs/founder-local-run.md`**
— it's a from-zero, no-coding-background walkthrough (Docker Path A vs.
no-Docker Path B) that was actually run end to end while this platform was
built, and covers everything this quick version skips.

## Where the project is right now

The founder's active plan is **`docs/prompts/2026-10-19-phases-1-5.md`**
— a detailed, five-phase build-out prompt that supersedes the original
MVP Completion Program's phase plan wherever the two conflict. Same
discipline as before: each phase ends in a written report (what shipped
/ what didn't / deviations / test evidence / open questions) and a pause
for founder review before the next phase starts — except Phase 3 design
work, which may run in parallel with Phase 2B on its own branches.

1. **Phase 1 (Paddle billing, B3)** — being closed to a reduced,
   permanently-dormant scope: everything gated behind
   `billing.paddle.enabled` (default `false`, admin-only), no further
   Paddle build work. PayFast (not Paddle) is now the live rail for the
   Pakistan-phase MVP (D150). Its own PR, reported separately from this
   doc.
2. **Phase 2A (money/promises)** and **2B (PayFast)** — ten+two
   decision-implementation items, one PR each; not started.
3. **Phase 3 (Storefront Themes v2 + D-Studio v2)** — launch-blocking,
   full spec in `docs/features/storefront-themes-v2.md` (D152); not
   started. May start in parallel with 2B once that phase begins.
4. **Phase 4 (AI persona testing + attacker-mindset security pass)** —
   not started.
5. **Phase 5 (deploy-ready)** — not started.

This PR ("Step 0 for the phases-1-5 prompt") is docs-only groundwork,
committing that prompt verbatim, its new decisions (D152-D157), the
theme spec, and these links — run independently of Phase 1's own PR.

**The repo's GitHub visibility was independently re-checked while writing
this doc (unauthenticated API read, not the dashboard) and is still
`public`.** The founder said he was making it private; that hasn't taken
effect yet as of this doc. Until it does, treat "nothing may depend on
obscurity" as live operating guidance, not a one-time reminder.

## Open founder decisions

These are real, currently-unanswered questions — don't build against an
assumed answer. Full text is in `docs/founder-decisions-log.md`; this is
just the index.

| # | Question | Default if any | Notes |
|---|---|---|---|
| D41 | Lapsed-paid-seller retention: keep hard-delete, or downgrade-to-free instead? | Advisor's "Option B" (downgrade, archive don't delete) recorded as the likely pick | **Not implemented** — today's actual behavior (pause → 3 warnings over 14 days → hard-delete) is unchanged until the founder explicitly approves a replacement |
| D40.1 | Launch Assurance trigger threshold — currency/amount | PKR 25,000 ≈ $90, per-currency table | |
| D40.2 | UZEYN Partners referral bonus — 12-month cap or recurring forever? | 12-month cap | |
| D40.3 | UZEYN Partners minimum payout amount | ≈Rs 5,000-equivalent | |
| D20 (new, D141) | Gateway-connect UI should show each gateway's own country/business eligibility before a seller tries to connect it | Not built yet | Surfaced by D141 (2026-10-19), not a pre-existing item |
| — (plan-matrix-mvp.md) | Exact per-tier storage caps | **Now has figures:** Free 500MB / GO 2GB / RUN 5GB / RISE 15GB, per the 2026-10-19 phases prompt (Phase 2A item 3) | Explicitly "proposed defaults in the Settings Registry, editable by admin" — not yet built, but no longer an open number to invent |
| D147 | Does PayFast actually accept international cards? | Unverified | Phase 2B item 11's own required verification step before building against the assumption |
| — (new) | Does PayFast support real recurring billing/tokenization, or is renewal a manual pay-link flow? | Verify first; if unsupported, the phases prompt's own fallback is a manual pay-link emailed/shown 7/3/1 days before due, 7-day grace, then downgrade to Free (D66) | Phase 2B item 11 — don't build automatic recurring billing against an unconfirmed assumption |
| — (new) | UZEYN's own plan PKR price table | "TBD by founder" placeholder only — never shown publicly until set | Phase 2B item 11; needs the founder's actual numbers (see §7 of the phases prompt) |
| D23 | Discount floor (50% of list price after cycle discount + 1 promo) | Current default stands | Flagged for reconfirmation, not reopened |
| D5 / D73r | Gateway rollout order | Stripe/Simpaisa/Razorpay first, others on demand | Flagged for reconfirmation in D40.8; largely overtaken by D144 (PayFast added, Stripe dormant) without an explicit "D40.8 resolved" note — see this PR's report for the cross-reference gap |
| D7 / D40.10 | Paddle tax display by buyer location vs. always tax-exclusive | Always tax-exclusive | Paddle itself is now deferred (D150), so this is lower-priority than when written |

**Two items that look open but are likely answered** — flagged here
because the log never says so explicitly (see this PR's own report for
detail): **D3**'s "go-to-market geography" question and **D40.9**/**D40.6**
(local PKR payment route for UZEYN's own billing) both appear to be
settled by **D141** (Pakistan-only seller signup) and **D150** (PayFast as
the Pakistan-phase billing rail) respectively — but neither later entry
says in so many words "this resolves D3/D40.6/D40.9." Don't delete the
older entries (this file's own rule); if you confirm with the founder that
they're really closed, add a one-line forward-reference rather than
editing the old entry's substance.

CA questions (D38) and lawyer questions (D39) are founder-owned follow-ups
with outside professionals, not engineering-blocking decisions — listed in
full in the decisions log, not repeated here.

**D149 (buyer-trust checkout design) is no longer open** — it was listed
here before the founder's 2026-10-19 phases prompt arrived with a
concrete, binding spec (§4.6 there; `docs/features/storefront-themes-v2.md`
§6; decision-log entry D157). Mentioned here only so this table doesn't
look inconsistent with an earlier read of it.

**Founder-owed inputs, not decisions** — small, explicitly non-blocking
per the phases prompt's own §7 ("ask once, don't block on it"): the
fashion-theme reference image and `img/mark.svg`; the final display
names for the 4 new premium themes (working names — Fashion/Beauty/
Tech/Home & General — stand in until then); the support/security email
domain (use a placeholder config until set); the PKR price table for
UZEYN's own plans (placeholder, never shown publicly until real).
