# MVP Scope

**Status:** adopted 2026-10-09 (founder's MVP Execution Prompt, D63–D81
in `docs/founder-decisions-log.md`). This file is the single place a
reader goes to answer "is X in the MVP?" — cross-references the fuller
specs rather than restating them. Milestones: `docs/build-plan.md`'s
2026-10-09 section. Per-gate detail: `docs/plan-matrix-mvp.md`.

## Ships in the MVP

- **Plans:** Free, GO ($24), RUN ($49), RISE ($119) — USD, tax-
  exclusive, 4 billing cycles each (D10/D75d). FLY exists in the
  database but is dormant (not purchasable, not shown).
- **One store per customer** (D74) — multi-store is archived, not
  deleted.
- **Seller payment gateways, built in this order:** Stripe → Simpaisa →
  Airwallex → Razorpay (D73r), each gated by a registry `enabled` flag
  that only flips on after real sandbox-verification evidence exists
  (`docs/gateway-verification/<name>.md`). Plus the always-available
  COD / advance / manual-mark-as-paid payment *models* (not gateways),
  which is Pakistan's actual day-one payment path.
- **Paddle billing**, sandboxed, behind a `billing.enabled` flag; the
  platform also runs correctly with billing off (Free-only private
  beta, D81).
- **Post-payment buyer acknowledgment** (§5.76) — next item in the
  existing Phase A backlog, folded into M2.
- **Store-domain separation** (D25) and the free-tier abuse controls
  (D26) — promoted from "regression-test item" to an actual M2 build
  task per the 2026-10-09 gap report.
- **Security P0 list** (S1–S15 in the 2026-10-09 prompt; tracked
  against `docs/SRS.md`'s Risk Register and a new `docs/security/`
  runbook set) — required before launch, not optional hardening.
- **Founder-facing guides**: local-run, test guide, security test
  guide, launch-readiness checklist (D71).
- **Founding Members and Launch Assurance**, run manually by an admin
  (D80) — the public-facing offers exist, the automation doesn't yet.

## Dormant (built, off by default, restorable — never deleted)

- **Multi-store** (D74) — git-tagged `archive/multi-store-2026-10-09`,
  server-side 1-store limit enforced regardless of what a plan would
  otherwise allow.
- **FLY plan** (D75d) — `isActive = false`, kept for reactivation once
  multi-store (or another FLY-distinguishing feature set) returns.
- **Live referral/reward code** (Student Referral Rs 345/renewal,
  Ambassador Rs 499/renewed-month — see the 2026-10-08 entry's D15 gap
  note) — put behind `programs.enabled = false`, enforced in the
  service layer so no endpoint can award, accrue, or pay while off
  (M1, 3.3). The dormant commission engine and the ledger write path
  stay intact for the eventual Earn Your Plan/Partners build.
- **Raast / Easypaisa / JazzCash / bank-transfer adapters** — **gap
  found, corrects D4's assumption**: these are NOT currently dormant.
  The seller-facing "Connect a payment gateway" UI is live and
  completely ungated on every plan today (`docs/ui-feature-inventory.md`
  confirms this independently) — a real seller can connect and
  activate any of the four right now, with zero credential
  pre-validation. Each adapter implements only a single
  `verifyPayment()` poll method (no charge/initiate, no refund, no
  webhook — none of the four gateways has ever had a webhook, by
  design); every one carries its own explicit "unverified against a
  live sandbox" comment; and every e2e test replaces the adapter class
  entirely with a mock, so zero real HTTP call has ever been made by
  any of the four against a real provider endpoint. Making them
  genuinely dormant (not just "never verified") is real M1 work — part
  of the registry-driven allowlist/kill-switch build (D4), not a
  pre-existing state to preserve. No reactivation toward real use
  without a separate founder decision; see the 2026-10-09 checkpoint
  report for the full per-adapter findings.
- **EBANX / Skypay Global** — demoted to "Phase 2," kept as `planned`
  allowlist entries, not built in the MVP window (D73r).

## Explicitly out of scope for the MVP (specified, not built)

Earn Your Plan, UZEYN Partners (including the 8.88% referral bonus and
its payout controls), the shared referral/attribution engine, the
Students plan redesign, the UZEYN Partners education portal, Vellum,
seller-facing funnel analytics, the paid Template Marketplace, the
D-Studio Pack (already retired 2026-10-03), dark/light theme toggle,
the Shopify savings calculator (a static comparison table on the
marketing page instead — no interactive calculator), device/IP
fingerprinting (standing founder rule: never built) (D63).

## What changed from the 2026-10-08 pricing/programs amendment

The MVP prompt (D63–D81) supersedes, for the MVP build window only:

- **D12's cumulative store count** (1/3/5/10 by tier) — MVP is 1 store
  on every tier (D74). The rest of D12's "strict superset" framing is
  unaffected (every other dimension still only adds, never trades off,
  moving up the ladder).
- **§5.74 FR-74.3's FLY-only loading-mark removability** — moves to
  RISE for the MVP window (D76d); a real, small code change, not yet
  made as of this doc (sequenced into M1).
- **D13's feature-distribution table** — stays the long-term target in
  `docs/pricing-and-programs.md`; MVP marketing copy follows what's
  actually built instead (D78, see `docs/plan-matrix-mvp.md`).
- **D5's gateway rollout order** — Airwallex now builds ahead of
  Razorpay; EBANX/Skypay Global explicitly demoted to Phase 2 (D73r).
- **D41's lapsed-seller retention question** — partially resolved: a
  lapsed paying seller's store is never auto-deleted, downgrades to
  Free instead (D66). Everything beyond that minimum (archiving
  excess products, 301-redirecting a custom domain, the exact warning
  cadence) stays OPEN.
- **§5.81/§5.82's automated Launch Assurance/Founding Members** — run
  manually at launch instead (D80); the automated version is re-tagged
  post-MVP in `docs/build-plan.md`.

Everything else in the 2026-10-08 entry (D1–D41) — the plan ladder's
prices and cycles, tax-exclusive pricing, the SECP-safe program design,
store-domain separation's requirements, the removed $1/$499 proposals,
the Students-plan guardrails, the open questions not listed above — is
unchanged and still governs.
