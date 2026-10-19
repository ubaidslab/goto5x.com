# MVP Scope

**Status:** adopted 2026-10-09 (founder's MVP Execution Prompt, D63–D81
in `docs/founder-decisions-log.md`), updated 2026-10-19 by the 2026-10-19
MVP offer review (D136-D151) and by `docs/prompts/2026-10-19-phases-1-5.md`
(D152-D157) — the latter is the active phase plan and supersedes the
original five-phase MVP Completion Program plan wherever the two
conflict; see `docs/README-for-new-developers.md`'s "Where the project
is right now" for the current phase. This file is the single place a
reader goes to answer "is X in the MVP?" — cross-references the fuller
specs rather than restating them. Milestones: `docs/build-plan.md`'s
2026-10-09 section. Per-gate detail: `docs/plan-matrix-mvp.md`. Full
Storefront Themes v2 + D-Studio v2 spec (launch-blocking, D152):
`docs/features/storefront-themes-v2.md`.

## Ships in the MVP

- **Plans:** Free, GO ($24), RUN ($49), RISE ($119) — USD, tax-
  exclusive, 4 billing cycles each (D10/D75d). FLY exists in the
  database but is dormant (not purchasable, not shown). Product caps
  revised 2026-10-19 (D142): Free 10, GO 30, RUN 100, RISE 500, FLY
  unlimited (dormant regardless) — see `docs/plan-matrix-mvp.md` for
  the as-built-vs-target gap. Storage now scales per tier (D142) instead
  of one flat value — proposed figures per the 2026-10-19 phases prompt
  (Phase 2A item 3): Free 500MB, GO 2GB, RUN 5GB, RISE 15GB, admin-
  editable in the Settings Registry; not yet built as of this doc.
- **One store per customer** (D74) — multi-store is archived, not
  deleted.
- **Seller payment gateways:** Simpaisa, Airwallex, Razorpay, and
  PayFast (D144 adds PayFast to and removes Stripe from the live MVP
  lineup — D73r's original Stripe-first build order is superseded, not
  the gateway code itself, which stays merged and dormant, see below),
  each gated by a registry `enabled` flag that only flips on after real
  sandbox-verification evidence exists
  (`docs/gateway-verification/<name>.md`). Plus the always-available
  COD / advance / manual-mark-as-paid payment *models* (not gateways),
  which is Pakistan's actual day-one payment path — "advance" now
  defaults to delivery-charge-only rather than a percentage of the
  order total (D136), with the percentage model staying available as a
  seller-chosen option.
- **UZEYN's own plan-fee billing (the platform's own revenue, not a
  seller's buyer-checkout gateway): PayFast is the live rail for the
  Pakistan phase (D150), not Paddle.** Paddle billing (B3) is built
  (its own PR, merging independently of this one) and, per Phase 1's
  2026-10-19 closure instruction, is being reduced to permanently
  dormant behind a `billing.paddle.enabled` flag (default `false`,
  admin-only) — no further Paddle build work planned; it's kept, not
  discarded, as the rail for "going global" later. PayFast-for-
  platform-billing is new, not-yet-started Phase 2B scope (phases
  prompt item 11) with real open questions (recurring/tokenization vs.
  a manual pay-link-plus-reminder flow, merchant onboarding, a PKR
  price table - placeholder only until the founder sets real figures -
  and the platform's own tax/invoicing liability since PayFast is not
  a merchant of record) — see D150 for the full list before building
  against an assumption. The platform also runs correctly with billing
  off entirely (Free-only private beta, D81).
- **Platform commission hard-locked at 0%** (D137) — not just defaulted
  to 0, the admin control that could raise it (up to 2%) is removed
  from the build entirely. Marketing copy states "0% platform fee"
  without qualification.
- **Data export available on every tier, including Free** (D139) —
  supersedes the FLY-only gate below; small exports are an instant CSV
  download, large exports run async and notify by email with a login-
  required, 24-hour-expiring link (never an attachment), gated behind
  re-authentication, rate-limited to 1/hour, every export audit-logged.
- **Branding: RISE removes the loading mark and the checkout/invoice
  header branding** (a small "Powered by UZEYN" footer line stays even
  on RISE) (D138); GO/RUN keep full branding exactly as FR-74.4/74.5
  already specify.
- **Moderation: live-by-default, not hide-by-default** (D145) — a new
  product goes live immediately unless matched by a keyword/category
  flag, which routes it to review with a visible badge instead of
  hiding it. Adds a buyer-facing "Report this store" button.
- **Seller geography: Pakistan-only signup, but PK sellers can sell to
  buyers worldwide** (D141) — landing copy and the gateway-connect UI
  must say this precisely, including surfacing each gateway's own
  country/business eligibility so a seller can tell which one fits
  their storefront's target country.
- **Support infrastructure** (D146): a real `support@<domain>` address
  (not a personal inbox), an in-app Help form that auto-attaches the
  submitting seller's store ID, a 24-hour auto-reply, 15-20 help
  articles, and `security@<domain>` + `/.well-known/security.txt` built
  separately from general support.
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
- **Storefront Themes v2 + D-Studio v2** (D151's template redesign,
  substantially expanded and made launch-blocking by D152-D157) — four
  full-store premium themes (Fashion/Beauty/Tech/Home & General,
  working names) replacing the current four built-ins; a redesigned
  D-Studio editor with draft/publish and version history; a redesigned
  product page; a styled, trust-locked checkout (fulfills D149/D157).
  Full spec: `docs/features/storefront-themes-v2.md`. Phase 3 scope,
  not yet built; available on every plan including Free (D154), never
  plan-gated itself (only section count and Custom CSS stay gated, as
  today).

## Dormant (built, off by default, restorable — never deleted)

- **Stripe** (B2, merged) — sandbox-only, excluded from Stage 0 by its
  own original build decision; D144 (2026-10-19) confirms this stays
  the posture for the MVP's live gateway lineup, not a temporary gap.
  No contradiction between B2's decision record and D144 — both agree.
- **Paddle billing** (B3, built — its own PR, not yet merged as of this
  doc) — being closed to permanently dormant behind `billing.paddle.
  enabled` (default `false`, admin-only) per the 2026-10-19 phases
  prompt's Phase 1 instruction: "finish PR #16 with only what's already
  done and working... no further Paddle scope." D150 (2026-10-19)
  confirms PayFast, not Paddle, is the live rail for the Pakistan-phase
  MVP. Same "stays dormant, not discarded" posture as Stripe, for the
  same reason (built for a later phase - Paddle for "going global,"
  Stripe pending a future founder decision to re-activate it).
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

## What changed from the 2026-10-19 MVP offer review (D136-D151)

All LOCKED per the founder's explicit confirmation. Full text in
`docs/founder-decisions-log.md`; `docs/advisor-log.md` carries the
original, less formal source notes this review came from.

- **D142 supersedes this doc's and `docs/plan-matrix-mvp.md`'s own
  earlier product-cap figures** — Free 10/GO 100/RUN 100/RISE 100
  becomes Free 10/GO 30/RUN 100/RISE 500. GO's cap moves DOWN (100→30),
  not up — not yet built as of this doc.
- **D137 supersedes any assumption that 0% commission was already
  locked** — `billing.commission_rate_percent` could be raised by an
  admin up to 2% as of the 2026-10-19 gap finding; D137 removes that
  control entirely rather than just leaving it defaulted to 0.
- **D136 supersedes the advance-payment model's default** — "No
  Return" now defaults to buyer-pays-delivery-charge-only, not a
  percentage of the order total (the percentage model stays available
  as an option).
- **D143 corrects, rather than changes, the first-cycle-discount
  scope** — the shipped `billing.first_cycle_discount_percent` applies
  to every tier's first payment regardless of cycle; this was never
  the approved design, and D143 is the correction (GO/RUN monthly-only,
  new sellers only).
- **D139 supersedes the FLY-only data-export gate** stated below under
  "Dormant"-adjacent context in the 2026-10-09 gap report — export
  moves to every tier, with the security controls listed above.
- **D138 narrows FR-74.4/74.5's "permanent on every tier" branding
  rule** for RISE specifically (loading mark + checkout/invoice header
  branding become removable there; GO/RUN unaffected).
- **D140 reverses CLAUDE.md's v1.3 monochrome/dummy-branding rule
  entirely** — see `CLAUDE.md`'s own v1.4 entry; not yet built as a
  repo-wide re-skin (Phase 3 scope).
- **D141 adds an explicit seller-geography scope statement** this doc
  never previously stated outright (Pakistan-only signup, worldwide
  buyers).
- **D144 changes the live MVP gateway lineup** — Stripe moves from
  "building toward live" (D73r) to confirmed-dormant; PayFast is added.
- **D145 changes the moderation default** from hide-new-products-under-
  review to live-by-default-with-flagged-exceptions.
- **D146 adds support infrastructure** to MVP scope that this doc
  never previously specified.
- **D150 changes which rail carries the platform's own plan-fee
  revenue** for the Pakistan-phase MVP — PayFast, not Paddle (B3 stays
  built and will stay dormant once merged, not discarded).
- **D151 adds a storefront-template redesign** to Phase 3 scope that
  this doc never previously specified.
- **D147/D149 are process decisions** (persona-based pre-launch testing;
  delegating the buyer-trust checkout design to the advisor/developer)
  rather than product-scope changes — noted here for completeness, not
  because they alter what ships.

## What changed from `docs/prompts/2026-10-19-phases-1-5.md` (D152-D157)

This is the founder's detailed "decisions a-o" prompt, received after
the above 2026-10-19 review and superseding the original five-phase MVP
Completion Program plan wherever the two conflict. Full text committed
verbatim at that path; decisions recorded as D152-D157.

- **Phase 1 (Paddle, B3) is being closed to a reduced scope** — "only
  what's already done and working, dormant behind
  `billing.paddle.enabled=false`... no further Paddle scope." This
  doesn't change anything already stated above (Paddle was always
  going to stay dormant per D150) — it makes the *mechanism* concrete
  (a specific flag, three specific required tests) and explicitly
  closes off any further Paddle build work, which the earlier 2026-10-19
  entries hadn't explicitly ruled out.
- **D152 makes Storefront Themes v2 + D-Studio v2 launch-blocking MVP
  scope** — previously D151 described a narrower "redesign the
  templates" item; D152-D157 expand this into a full theme system (new
  D-Studio editor with draft/publish/versions, a redesigned product
  page, a styled and trust-locked checkout) and make it a launch
  blocker, not an enhancement. Full spec:
  `docs/features/storefront-themes-v2.md`.
- **D153 replaces the 4 built-in themes**, not just restyles them —
  Editorial/Studio/Market/Atelier are retired in favor of 4 new
  category themes (Fashion/Beauty/Tech/Home & General, working names),
  with a required content-preserving migration.
- **D154 confirms theme choice is never plan-gated** — a question this
  doc hadn't previously addressed explicitly; only section count and
  Custom CSS stay gated, exactly as today.
- **D155 keeps the paid "Premium Motion" template entitlement dormant**
  — unaffected by D152's build, explicitly post-launch, hide its
  buyer-facing entry point.
- **D156 retires `/customizer` outright** — a real cutover (data
  migrated into D-Studio, then the route redirects), not a parallel
  system kept running alongside D-Studio.
- **D157 makes D149's delegated buyer-trust design concrete** — D149
  (above) left the actual design open; D157 is that design, binding,
  in `docs/features/storefront-themes-v2.md` §6.
- **The 2A/2B item numbering in the new prompt cites several existing
  decisions by their *external* advisor-log number, not this file's
  own** — see `docs/founder-decisions-log.md`'s own mapping table at the
  top of its 2026-10-19 phases-prompt section before trusting a D-number
  written directly in the prompt text.
