# Founder Decisions Log

A running, dated log of major strategic decisions made in founder
discussions — not what got built (that's `docs/build-plan.md`'s job,
and `docs/SRS.md`'s §14 Acceptance Checklists), but *why* a decision
was made, so the reasoning survives independently of the spec it later
produced. A decision lands here as soon as it's made, even before the
corresponding SRS amendment or build work exists. Entries are never
edited after the fact to "clean up" earlier reasoning — if a later
decision reverses an earlier one, the later entry says so explicitly
and the earlier entry stays as the historical record, same discipline
`docs/SRS.md` already uses for a retired FR.

---

## 2026-10-03 — Global Launch Mandate

The largest single strategic batch in this project's history to date,
consolidating an extended founder discussion into one pivot. Full
technical specification lives in `docs/SRS.md`'s §5.70-5.77 (new,
v0.62) and the corresponding Risk Register (#30-33), Open Questions
(#9-15), Payment Gateway Research (§11.1), and Acceptance Checklist
(§14.74) entries — this log entry is the decisions and reasoning behind
that spec, not a duplicate of it.

### 1. Global launch, not Pakistan-only
**Decision:** UZEYN launches globally. Every Pakistan-specific
assumption gets audited systematically (not guessed at) and addressed.
**Reasoning:** not recorded beyond the decision itself — this is the
umbrella decision the other items below implement pieces of.

### 2. CNIC verification removed entirely, no replacement
**Decision:** Remove CNIC collection/encryption/uniqueness-checking from
signup, publish-gate, and Trust & Safety. Device/IP fingerprinting is
explicitly **not** being built as a replacement.
**Reasoning:** CNIC cannot generalize to a global seller base — it's a
Pakistan-specific identity document. Device/IP fingerprinting was
considered and explicitly rejected as a replacement: not worth the
added complexity.
**Accepted tradeoff:** the fraud-prevention gap this leaves is real and
deliberate, not an oversight — mitigated by (a) the free tier carrying
no paid-tier abuse surface, (b) every referral/challenge reward
triggering only off a real verified Paddle transaction, never signup
alone, and (c) Paddle's own built-in fraud detection. Logged as Risk
Register #30, not buried in the spec.

### 3. Multi-currency display, not a conversion engine
**Decision:** Each store displays in one seller-chosen currency. No FX
conversion logic anywhere.
**Reasoning:** a full conversion engine is real scope this platform
doesn't need to take on — a seller picking their own display currency
solves the actual problem (a global seller base needs to show prices in
their own currency) without the exchange-rate-feed/rounding/reporting
complexity a true multi-currency ledger would add.

### 4. Security checklist audit, founder-provided
**Decision:** Audit the full founder-provided 18-item checklist against
the actual codebase — don't assume anything is covered, verify each
item, close genuine gaps found. Read replicas explicitly out of scope
for current scale.
**Reasoning:** the checklist itself needed no separate reasoning
beyond "verify, don't assume" — the one explicit scope decision was
excluding read replicas, since they solve a scaling problem this
platform doesn't have yet.
**Outcome:** full findings in `docs/security-audit-report.md`'s new
Phase 6 — 7 of 18 items are real, pre-existing gaps (none introduced by
this pivot, none blocking it); one (checkout idempotency) is flagged
as worth closing before Paddle's webhook handler ships, since that's
new surface area that shouldn't repeat an existing gap.

### 5. Paddle replaces Platform Merchant Connection for UZEYN's own billing only
**Decision:** Paddle becomes UZEYN's merchant of record for collecting
its own subscription revenue from sellers, globally. Paddle never
touches marketplace buyer-to-seller payments — that stays regional
(Pakistani sellers keep Easypaisa/JazzCash/Raast via the existing
adapter architecture; sellers elsewhere need their own regional
gateway, explicitly still unsolved).
**Reasoning:** collecting UZEYN's own subscription fee from a global
seller base through a Pakistan-specific bank relationship doesn't
generalize, same root reason as the CNIC decision. Paddle solves this
specific problem (global merchant-of-record subscription billing)
without UZEYN needing its own tax/VAT registration in every country a
seller signs up from.
**Boundary explicitly re-stated because it's the easiest thing to
blur:** this is about how UZEYN gets paid by sellers for their
subscription — nothing about how a seller gets paid by their own
buyers changes.

### 6. Tax-inclusive, flat total pricing
**Decision:** A plan's listed price is exactly what the seller pays.
Paddle's fees and any tax/VAT/GST remittance come out of UZEYN's own
revenue, never added on top.
**Reasoning:** a surprise line item at checkout (tax added on top of
the advertised price) is a trust/conversion problem for a subscription
product — the price shown should be the price charged, full stop.
**Confirmed feasible before committing**, not assumed: Paddle's
account-level tax-inclusive setting does exactly this; see `docs/
SRS.md` §11.1 for the sourced research.

### 7. New GO/RUN/RISE/FLY dollar pricing
**Decision:** GO ≈ $20-25/mo, RUN ≈ $45/mo, founder-anchored; RISE and
FLY proposed by this amendment ($99/$199) to keep a comparable step
progression, pending the founder's final sign-off.
**Reasoning:** redenominating the existing PKR ladder 1:1 at a fixed
exchange rate would produce ugly, non-standard price points; the
proposal instead matches the *existing ladder's relative step size*
while landing on prices a buyer actually expects to see. Not yet
authorized — logged as Open Question #9 in `docs/SRS.md`.

### 8. First-month-free removed entirely
**Decision:** No discounted or free first subscription cycle, on any
tier, ever again. Every subscription starts at full price from cycle
one. The abuse-prevention machinery built specifically to guard the
free-first-cycle is removed along with it (nothing left to protect).
FR-6.50's referral non-refund rule is explicitly **not** touched — it
stays, since paid renewals can still be refunded and the referred-seller
carve-out remains relevant regardless of what the first cycle costs.
**Reasoning:** not recorded beyond the decision itself.

### 9. Free, permanent, editable-template + subdomain tier
**Decision:** A genuinely free, permanent (not time-limited) tier:
simple editable templates, UZEYN subdomain only, replacing
first-month-free as the platform's entry offer.
**Reasoning:** the founder's own stated logic — a *time-pressured* free
tier (a trial with a countdown) is exactly what creates an abuse
incentive ("use it fully before it's gone"). Removing the time pressure
removes that incentive. Explicitly modeled as its own plan group rather
than a renumbered GO tier, to avoid touching the existing GO/RUN/RISE/
FLY tier-order semantics anywhere else in the codebase.

### 10. Dual branding — seller's logo + UZEYN's, tier-differentiated removability
**Decision:** every page gets an animated loading state showing both
the seller's own logo and UZEYN's mark. UZEYN branding is
loading-screen-removable on FLY only (narrower than today's broader
removability grant); invoices and the buyer-facing cart/checkout pages
carry UZEYN branding on every tier, including FLY, permanently
non-removable.
**Reasoning:** not recorded beyond the decision itself — the explicit
ask was to confirm the existing any-placement-removable mark system is
being correctly *narrowed* to this new, more surface-specific rule
rather than assumed to still apply uniformly, which this amendment's
research confirmed it currently does (a real behavior change needed on
cart/checkout specifically, not just a new loading screen to add).

### 11. Flat $1 referral commission
**Decision:** $1 per successful referral (a referred seller's verified
paid Paddle subscription), replacing the prior PKR-denominated amounts.
**Reasoning:** not recorded beyond the decision itself. Applied to both
existing flat-commission programs (Student Referral, Ambassador) by
this amendment's own reading, since neither was named specifically —
flagged as Open Question #12 for explicit confirmation, not assumed
settled.

### 12. New "Growth Challenge" program
**Decision:** a new, standalone referral-incentive program (name open
to change) — 20 qualifying referrals in 30 days unlocks a free GO
month; 35 in 60 days (parallel window from the same start date, not
sequential) unlocks a free RUN month. Both independently claimable.
Non-stacking with the existing per-referral commission (separate
attribution channel, no double-counting).
**Reasoning:** not recorded beyond the mechanics themselves, which are
specified in full (including a real schema conflict this amendment
surfaced — re-enrollment after an expired cycle needs new
infrastructure the existing per-program enrollment-uniqueness
constraint doesn't allow for as originally assumed) in `docs/SRS.md`
§5.75.

### 13. Order verification redesign — post-payment acknowledgment, email-first
**Decision:** shift the default/primary verification model to a
post-payment buyer acknowledgment (buyer confirms "I placed this order
and will receive it" after payment, with admin-editable terms text),
defaulting to email OTP globally. WhatsApp becomes an optional regional
channel, no longer the default.
**Reasoning:** the acknowledgment creates a timestamped, auditable
record of buyer intent — useful as chargeback/dispute evidence, not
just an anti-fraud gate, which is a different and arguably more durable
value than the old pre-payment gate alone provided. Email over WhatsApp
specifically for global applicability (WhatsApp OTP has no equivalent
global reach assumption; email does).

### 14. D-Studio Pack retired
**Decision:** remove the Rs 1,499/3-month full-catalog-unlock purchase
mechanism, its admin UI, and its expiry machinery, entirely. The
GO/RUN/RISE/FLY tier-based D-Studio access is unaffected. The Template
Marketplace (individually-purchasable premium themes) is confirmed
unaffected and remains the sole paid-design-content path.
**Reasoning:** not recorded beyond the decision itself.

### 15. This log itself
**Decision:** maintain this file going forward — any future
founder-direction discussion that results in a real decision gets
logged here, even before (or entirely separately from) the
corresponding SRS/build work.
**Reasoning:** decisions and their reasoning were previously only
findable by reading build-plan/SRS amendment prose written well after
the fact, which conflates "what was decided" with "what was built" and
loses the former once the latter is done. This file separates them.

### Same-day resolutions — the 7 open questions from the SRS draft

Resolved immediately after reviewing the draft SRS amendment above,
before any implementation started. Each is also recorded inline at its
own FR in `docs/SRS.md` (search "2026-10-03" for every resolution) —
logged here too since this file's whole purpose is keeping the decision
itself visible independent of the spec.

1. **Currency rollup (§5.70/FR-70.5):** admin GMV/MRR shows a
   per-currency breakdown, never a blended/fake-converted total. No FX
   engine, consistent with the original currency-display decision.
2. **Free-tier ceiling (§5.73/FR-73.3):** approved exactly as proposed
   (10 products, subdomain-only).
3. **Growth Challenge re-enrollment (§5.75/FR-75.6):** approved exactly
   as proposed — new `GrowthChallengeCycle` table, including the
   corrected (non-reuse) D-Studio Pack billing-wiring finding.
4. **$1 referral commission scope (§5.75/FR-75.1):** applies only to
   the general referral program (Student Referral / "Commerce Students
   Support"). The Ambassador Program's existing $499/cycle
   performance-based model is structurally separate and untouched.
5. **Post-payment acknowledgment email delivery (§5.76/FR-76.3):**
   goes through UZEYN's own platform-wide email service as the
   reliable primary path — built out now, not deferred behind §5.43 —
   never dependent on a seller's own SMTP connection, since this record
   is forming dispute evidence and reliability outranks a
   seller-branded sending address. A connected seller SMTP sender may
   still be used cosmetically (From-header display name only).
6. **Paddle pricing ladder (§5.72/FR-72.5):** approved as proposed — GO
   $24 / RUN $45 / RISE $99 / FLY $199.
7. **Team-tier branding (§5.74/FR-74.3):** Team Growth/Scale's existing
   branding-removal behavior stays completely unchanged. The new
   FLY-tier-specific loading-screen rule applies only to the individual
   GO/RUN/RISE/FLY ladder — this section does not touch Team-plan
   branding logic at all.

**Still open, not part of this round:** whether an advance-model/
partial-advance order counts as "prepaid" for FR-76.1's gating
condition (SRS §13 item #14) — confirm before that one specific piece
of §5.76 ships.

**Instruction accompanying these resolutions:** start Phase A now on
everything unblocked by them (security fixes, currency display,
free-tier work, dual branding, post-payment acknowledgment) — same
incremental commit / live-verify / independently-CI-confirm discipline
as every prior item in this project, reported the same way throughout.

---

## 2026-10-08 — Pricing, Billing, Programs, Partners, Gateways

Source: a founder/advisor pricing-and-programs discussion, turned into
decisions D1-D41 below. Full technical specification lives in
`docs/pricing-and-programs.md` (new canonical source of truth for every
number here) and `docs/SRS.md`'s §5.78-5.92 (new, this amendment) plus
the corresponding Risk Register and Open Questions additions — this log
entry is the decisions and reasoning, not a duplicate of either. Status
legend: **LOCKED** = explicitly approved. **LOCKED-DEFAULT** = approved
in principle, the specific number/mechanic is the advisor's proposal,
not yet separately reconfirmed. **OPEN** = not decided; recorded with
its stated default, not implemented. This round is **docs-only** — see
`docs/build-plan.md` for the sequencing of the actual implementation
work these decisions unlock.

### A. Positioning

### D1. Global launch, all countries
**Status:** LOCKED.
**Decision:** UZEYN launches globally, every country, no change from
the 2026-10-03 Global Launch Mandate.
**Reasoning:** not recorded beyond the decision itself — re-confirmed
here as the umbrella the rest of this batch sits under.

### D2. Subscription-only, no commission
**Status:** LOCKED.
**Decision:** UZEYN's own revenue is subscription fees only — no
commission, no per-transaction fee, no hidden charges. Public line:
"0% platform cut, no gateway surcharge." Comparative claims about
competitors stay strictly factual — never "hidden paisa/fees" framing.
**Reasoning:** not recorded beyond the decision itself.

### D3. Go-to-market geography
**Status:** OPEN.
**Decision:** not decided. The advisor recommends a Pakistan/South-Asia-
first rollout until the Stripe/Simpaisa adapters are live; the founder
has not approved a sequencing. Default: treat D1's "global, all
countries" as still governing until this is resolved.
**Reasoning:** n/a — recorded as open, not implemented.

### B. Seller payment gateways

### D4. Seller gateway allowlist: Stripe, Razorpay, Simpaisa, Airwallex, Skypay Global, EBANX
**Status:** LOCKED.
**Decision:** sellers may connect only these six gateways (each with
their own account). The allowlist is Settings-Registry-admin-editable,
not hardcoded. Raast/Easypaisa/JazzCash/bank stay dormant (not
deleted, not selectable at launch). COD/advance/manual-mark-as-paid
remain payment *models*, a separate axis from gateways — unchanged.
Each new adapter follows the existing Payment Gateway Connect pattern
(AES-256-GCM, health monitoring, manual fallback).
**Reasoning:** the existing four adapters are Pakistan-specific; a
global launch needs gateways with real reach in the countries sellers
will actually be in.
**Gap flagged by this amendment's own research** (see
`docs/pricing-and-programs.md`): today's allowlist is two hardcoded
locations (`PaymentGatewayProvider` enum + a DTO's `@IsEnum([...])`
array) backed by zero Settings Registry key — "admin-editable, no
hardcoding" is new scope this decision requires, not a reframing of
something already built that way.

### D5. Gateway rollout order
**Status:** LOCKED-DEFAULT.
**Decision:** launch with Stripe, Simpaisa, Razorpay; Airwallex, Skypay
Global, EBANX follow on demand. The pricing page lists only live
adapters as "supported."
**Reasoning:** narrows D4's six-gateway surface to a buildable first
slice without blocking launch on all six at once.

### C. UZEYN's own pricing and billing

### D6. USD-only pricing
**Status:** LOCKED.
**Decision:** every seller sees one USD price list, globally. No PKR/
regional price list (a *local PKR payment route* for paying that USD
price is a separate, still-open question — D40.6).
**Reasoning:** not recorded beyond the decision itself.

### D7. Tax-exclusive pricing — supersedes the 2026-10-03 "tax-inclusive, flat total" decision
**Status:** LOCKED.
**Decision:** the customer pays list price + applicable tax, shown as
"$24 + tax," calculated at checkout. **This reverses entry #6 above**
("Tax-inclusive, flat total pricing," 2026-10-03) — that entry stays in
this log as the historical record, not deleted, per this file's own
discipline.
**Reasoning:** not recorded beyond the decision itself.
**Implementation note (no code yet):** Paddle's `tax_mode` must be set
to the exclusive equivalent when billing is actually built (§5.72/5.79
superseded accordingly) — confirmed not yet built in code (zero Paddle
SDK/client/webhook code exists anywhere in `apps/api` today), so there
is no tax-inclusive implementation to unwind, only spec text to
supersede.

### D8. Paddle stays merchant of record; Plan B = Polar
**Status:** LOCKED-DEFAULT.
**Decision:** Paddle remains the merchant of record for UZEYN's own
subscriptions (checked against Polar and Dodo — neither cheaper). If
Paddle's account approval stalls, Plan B is Polar (lists Pakistan as a
payout country via Stripe Connect Express).
**Reasoning:** re-confirms the 2026-10-03 decision (#5 above) rather
than reopening it; adds the fallback since Paddle approval is this
launch's single biggest critical-path risk (Risk Register #1 below).
**Accepted tradeoff:** the Paddle approval path has real founder-owned
prerequisites (domain, live marketing site, ID verification) tracked in
`docs/launch-runbook.md`, not something this docs pass can shortcut.

### D9. New monthly list prices — supersedes the 2026-10-03 ladder
**Status:** LOCKED-DEFAULT.
**Decision:** GO $24 · RUN $49 · RISE $119 · FLY $249/month. **This
replaces** the 2026-10-03 same-day resolution #6 ($24/$45/$99/$199) —
that resolution stays in this log as the historical record.
**Reasoning:** launch high, sell through discounts (D10) rather than a
low list price with no room to run promotions.

### D10. Billing cycles — exact discount table
**Status:** LOCKED.
**Decision:** four cycles, each a flat discount off the monthly list
price, 6-month additionally including 15 bonus days of service:

| Cycle | Discount | GO | RUN | RISE | FLY |
|---|---|---|---|---|---|
| Monthly | — | $24 | $49 | $119 | $249 |
| 3 months | −7% | $67 | $137 | $332 | $695 |
| 6 months | −12% + 15 free days | $127 | $259 | $628 | $1,315 |
| 12 months | −25% | $216 | $441 | $1,071 | $2,241 |

Formulas: 3mo = 3×list×0.93; 6mo = 6×list×0.88; 12mo = 12×list×0.75 (=
9×list); every figure rounded to the nearest whole dollar. Pricing-page
toggle order: Monthly · 3mo · 6mo ("Most popular", default selected) ·
12mo ("Best value").
**Reasoning:** not recorded beyond the mechanics themselves.
**Implementation questions, not yet answered (no code yet):** whether
Paddle supports custom 3/6-month billing intervals natively, and how
the 6-month cycle's 15 bonus days get delivered (shifting the next
billing date vs. a separate entitlement-extension record).

### D11. Retention rules
**Status:** LOCKED.
**Decision:** 14-day money-back on every cycle (no refunds after,
except where law requires); a renewal reminder 7-14 days before
renewal; the cancel flow offers "keep my store on Free" plus a pause
option plus a one-question exit survey (reuses the existing
starter_free downgrade path — distinct from D41's separate, still-open
lapsed-seller question); an upgrade applies immediately with proration,
a downgrade applies at period end; the billing cycle is switchable at
renewal; Founding Members keep their price lock (D17) through all of
this.
**Reasoning:** not recorded beyond the mechanics themselves.

### D12. Cumulative plan ladder
**Status:** LOCKED.
**Decision:** every plan is a strict superset — "everything in GO, plus
…" — all the way up. Capacity, capability, and brand control all rise
with tier; trust/safety basics are free on every plan. The comparison
table stays to roughly 12 rows.
**Reasoning:** not recorded beyond the decision itself.

### D13. Feature distribution per tier
**Status:** LOCKED-DEFAULT.
**Decision:** the advisor's proposed distribution (full table in
`docs/pricing-and-programs.md`) — notably: Free gains a storage cap, a
1-store limit, and no email campaigns on top of what's already built;
GO's product cap rises to 500 and gains all static D-Studio sections,
discount codes, and basic analytics; RUN adds 3 stores/2 staff/prepaid/
abandoned-cart emails/campaign quotas/gift cards/funnel analytics/data
export; RISE adds 5 stores/3 staff/Custom CSS/advanced SEO/device-
approval/API+webhooks/priority support; FLY adds 10 stores/5 staff and
the removable loading-screen mark (§5.74, already shipped) with
invoice/order-review branding staying permanent on every tier. No
order-volume caps at launch — a fair-use ToS clause plus internal usage
alerts for 60 days, then a founder decision on volume bands.
**Reasoning:** delegated to the advisor's proposal; the founder's own
instruction was to gap-report it against the actual current gates
before changing anything, not to implement it in this pass.
**Gap report (this amendment's own research, summarized — full detail
in `docs/pricing-and-programs.md`):** roughly half of D13 already
matches shipped `plans.seed.ts` gates (Free's 10-product/subdomain-only/
4-section/email-verification rules; GO's domain+1-store+0-staff; RUN's
3-store/2-staff/prepaid; RISE's 5-store/3-staff/Custom-CSS/advanced-SEO;
FLY's 10-store/5-staff). Real gaps found: Free's campaign-sending is
not yet capped at zero (resolves to the global 500/mo default); GO's
product cap is 100, not 500; GO's D-Studio access is 8 of 22 sections,
not "all static sections"; "basic analytics" vs. a fuller funnel-
analytics tier doesn't exist as a distinction yet (every tier gets the
same full analytics set today); abandoned-cart emails are ungated
(available to every tier, not RUN-exclusive); campaign quotas already
differ by tier but GO already has a nonzero quota (799/mo), so
campaigns aren't RUN-exclusive today; gift cards/data export are
RISE+/FLY-only today, not RUN; device-approval restriction and generic
seller-facing API/webhooks don't exist as features at all yet; priority
support has no SLA differentiation by tier today (one flat SLA for
everyone).

### D14. Pricing page: Shopify savings calculator
**Status:** LOCKED.
**Decision:** the pricing page references Shopify via an interactive
calculator (seller enters monthly sales + gateway type), never a static
comparison claim. Every competitor number carries an "as of <date>" tag
and a source link; a footnote discloses tax/card-fee exclusions; the
third-party-gateway surcharge only shows in the "other gateway"
scenario; "Shopify" is used by name only (nominative use, no logo);
reviewed quarterly. Reference figures captured 2026-10-08 (re-verify
before publishing): Shopify Starter $5, Basic $39 ($29 annual), Grow
$105 ($79), Advanced $399 ($299); third-party surcharge 2%/1%/0.6% by
tier; all figures exclude VAT.
**Reasoning:** a calculator keeps the comparison honest and current in
a way a static claim can't, and avoids the comparative-advertising
accuracy risk a stale static number would carry (Risk Register #8).

### D. Programs

### D15. Remove the $1 referral and the $499/cycle Ambassador program
**Status:** LOCKED.
**Decision:** both programs are removed outright — the general flat-$1
referral (2026-10-03 decision #11 above) and the Ambassador $499/cycle
model. First-month-free stays removed (2026-10-03 decision #8,
unaffected). Device/IP fingerprinting is not being built.
**Reasoning:** not recorded beyond the decision itself.
**Gap flagged by this amendment's own research:** the $1/$499 figures
being removed here were never actually the *live* numbers in code or in
this log's own prior entry — the shipped `growth-programs.seed.ts`
values are Rs 345/renewal (Student Referral, max 2 renewals) and Rs
499/renewed month (Ambassador, max 3 months; the 8%-of-revenue key for
Ambassador has been dormant since Module 79). Decision #11's "$1 flat"
and decision #4 above ("Growth Challenge") were themselves SRS-only
proposals (§5.75, explicitly marked "PROPOSED, not yet built") that
never shipped — so this decision removes a proposal, not a live feature,
and the actually-live Rs 345/Rs 499 mechanisms are what the removal
needs to act on once Phase B implementation starts. Recorded as a gap,
not resolved here (docs-only pass).

### D16. Free tier unchanged
**Status:** LOCKED.
**Decision:** the existing permanent free tier (§5.73) is unchanged by
this batch beyond D13's additions (storage cap, 1-store, no campaigns).
**Reasoning:** not recorded beyond the decision itself.

### D17. Founding Members
**Status:** LOCKED.
**Decision:** the first 100 paying sellers get a price lock for as long
as their subscription stays active, a founding badge, and direct
support via a dedicated priority channel (not the founder's personal
WhatsApp). Stacks with billing-cycle discounts. No extra percentage
discount, no lifetime deal.
**Reasoning:** not recorded beyond the decision itself.

### D18. Launch Assurance (GO only, one-time)
**Status:** LOCKED.
**Decision:** public line — "slow first month? Your next month is half
price." Applies only to a customer's first-ever GO purchase, once
(matched on email + Paddle customer ID), and expires if the plan
changes. Trigger: confirmed non-refunded order value in days 1-30 below
a threshold (**default PKR 25,000 ≈ $90, currency not yet confirmed —
OPEN, D40.1**; admin-editable per-currency table, no FX engine), plus an
effort gate (published, ≥5 products, ≥~50 visitors in the window, all
admin-editable) so the reward can't be earned by inactivity alone.
Monthly customers get their next invoice at 50% off; 3/6/12-month
customers get +15 days of service instead. Auto-evaluated days 30-35,
confirmed by email, paired with a 3-4-step "slow-start coach" email
series. Cost-capped at roughly $12 per GO customer, once.
**Reasoning:** softens the real risk a slow first month poses to
early retention, with an effort gate specifically so it rewards a
seller who tried and struggled, not one who never launched.

### D19. Earn Your Plan — renames "Growth Challenge," post-launch
**Status:** LOCKED (program); LOCKED-DEFAULT (the specific rungs/
windows/rewards below).
**Decision:** post-launch only, once roughly 50 paying sellers exist,
time-boxed 60-90 days, one success metric — explicitly not a launch
blocker. A referral counts only once the referred seller has a paid
subscription, has used and paid for a complete month, the 14-day refund
window has passed with no refund, and there is no chargeback/dispute —
a free signup never counts, no exception. Proposed rungs: 5 verified
referrals unlocks 1 free GO month, 20 unlocks 3 free GO months, 35
unlocks 6 free GO months; default windows are 5-and-20 within 30 days
and 35 within 60 days, all measured in parallel from one shared
enrollment date; rungs are independent thresholds and claiming is
optional. Rewards are account credit/entitlement only, never cash,
non-transferable, clawed back on a chargeback. A Free-tier member's
reward is a time-limited GO entitlement (the existing `expiresAt` grant
mechanism, reverting to starter_free at expiry); the equivalent
mechanism for an already-paying member is still a developer-level open
question, not founder-level.
**Reasoning:** keeps the 2026-10-03 "Growth Challenge" concept (decision
#12 above) but renames it and redesigns the rungs/economics; self-
referral is unprofitable by construction (5 referrals cost roughly $120
against a $24 reward).
**Supersedes, not deletes:** the 2026-10-03 §5.75 Growth Challenge spec
(20-referrals/30-days → free GO month, 35/60-days → free RUN month) —
that spec was itself never built (confirmed: no `growth_challenge`/
`GrowthChallengeCycle` code exists anywhere), so this is a specification
change, not an in-flight feature being redirected.

### D20. UZEYN Partners
**Status:** LOCKED (program, benefits 1-3/5-6/9); LOCKED-DEFAULT (free-
plan-access mechanics, benefit 4); roadmap-only, not scheduled (benefit
7).
**Decision:** invite-only, local-first, explicitly not a fixed-cash
program. Benefits: (1) a certificate with a verification code/QR; (2) a
"UZEYN Partner" store badge; (3) an opt-in public profile in a partner
directory, no private data shown; (4) free access to special plans —
**default (OPEN, D40.4):** a Verified Partner gets GO free while active
(≥1 paying referral per rolling 90 days); a Verified Teacher/Community
Partner with ≥3 paying referrals per rolling 90 days gets RUN free; (5)
free meetup access (an operational benefit, no software in v1); (6) a
community-admin designation (manually verified by URL/member count);
(7) a future education portal — **roadmap only, not scheduled**, since
it implies its own checkout/tax/marketplace obligations that need
separate analysis; (8) a referral bonus of **8.88% of cleared net
revenue** (after tax and Paddle fees) from the referred customer's
payments, for the first 12 months — **the 12-month duration vs.
recurring-forever is OPEN, D40.2**; released only after identity
verification and an onboarding call; (9) explicitly **not** offered:
special payment gateways.
**Reasoning:** not recorded beyond the mechanics themselves.
**Accepted tradeoff — honest expectation-setting:** 8.88% of a GO
subscription is roughly $1.91/month per referred customer (about $22.90
over 12 months); 10 active GO referrals is roughly $19/month — the
non-cash benefits (badge, certificate, directory listing) carry most of
this program's real value, not the bonus. Rate is scheduled for review
after 90 days live.
**Accounting approach (no code yet):** accrue via the existing
`WalletService.postLedgerEntry` ledger path, evaluating reuse of the
dormant commission engine already in `program-reward.service.ts`/
`growth-programs.seed.ts`; states `pending_verification` →
`releasable` → `paid`; clawback on refund/chargeback; payout release is
an admin money-moving action (step-up MFA, typed confirmation, audit
log), manual, PKR via bank/Easypaisa/JazzCash for Pakistani partners at
launch, others later; minimum payout **default ≈Rs 5,000-equivalent,
OPEN, D40.3**.
**Identity verification:** application → admin review → identity +
payout-account check → onboarding call → activation. No CNIC system
revival. Identity documents, if unavoidable, are stored encrypted
(AES-256-GCM), access-logged, and deleted after verification, keeping
only the result/reviewer/date.

### D21. SECP-safe program design for D19/D20
**Status:** LOCKED.
**Decision:** single-level only — no reward for recruiting other
partners; rewards trigger only on genuine paid subscriptions; written
terms with a 14-day refund right; no purchase required to participate;
no income guarantees or earnings claims; an affiliate-disclosure
requirement in partner content; SECP registration applies these
regulations directly once UZEYN incorporates; both programs' terms need
lawyer review before launch; a CA question is logged on withholding tax
and record-keeping for partner bonus payments.
**Reasoning:** Pakistan's draft S.R.O. 2440(I)/2025 on referral/MLM-
adjacent marketing is the regulatory backdrop — this design keeps both
programs on the safe side of it by construction (single-level, no
recruitment reward, genuine-transaction-gated), re-check against the
final regulation text before launch.

### D22. Students plan — dormant, redesigned later
**Status:** LOCKED (defer); founder TBD (the eventual redesign).
**Decision:** the old PKR "Commerce Students" plan is not offered at
global launch — stays dormant, not deleted. A new version will be
designed later, on file guardrails for that redesign: no separate SKU
(a verified Paddle discount code on GO instead), verification by .edu/
university email or ID with manual review and yearly re-verification,
same feature set as GO, a 12-month term renewable once.
**Reasoning:** "Commerce Students Support" is today's live *referral
program* name (Rs 345/renewal, see D15's gap note), not a pricing plan
— there has never been a Students pricing Plan row in `plans.seed.ts`.
This decision is about a genuinely new, not-yet-built Students pricing
plan, kept clearly distinct from the referral program sharing a similar
name.

### D23. Discount floor
**Status:** LOCKED-DEFAULT, reconfirm (D40.7).
**Decision:** the effective price after a billing-cycle discount plus at
most one promotion must never fall below 50% of list price.
Earn-Your-Plan credits are exempt (they're earned, not discounted).
Admin-editable setting.
**Reasoning:** guards against stacked discounts eroding margin (Risk
Register #7) without hand-auditing every combination.

### D24. Program hygiene
**Status:** LOCKED.
**Decision:** one owner, one success metric, and one sunset date per
program; one customer belongs to one program at a time; account credit
is preferred over cash everywhere except the Partner bonus (D20, which
is explicitly cash-equivalent by design).
**Reasoning:** directly addresses founder-bandwidth risk (Risk Register
#11) — too many programs for one person to run well is a real failure
mode this hygiene rule exists to prevent.

### E. Security and trust

### D25. Seller store domain separation
**Status:** LOCKED.
**Decision:** storefronts must not share a registrable domain or cookie
scope with the dashboard/admin — a separate apex for stores, added to
the Public Suffix List, host-only cookies throughout.
**Reasoning:** limits the blast radius of a compromised storefront
(XSS, a malicious custom domain) from ever reaching dashboard/admin
session state.
**Gap report (this amendment's own research):** today's actual state
already matches the *outcome* this decision wants, though not by an
explicit domain-separation architecture — it's an emergent property of
how auth is currently built. The dashboard uses `localStorage` (no
cookie at all); the one buyer-facing cookie (`buyer_session`) is
already host-only (no `domain:` attribute set); the admin gate cookie is
likewise host-only. All three — dashboard, storefronts, and the Support
Center — already sit on different origins with no shared cookie scope
between them, even though all of them share one apex (`uzeyn.com`)
today. Flagged so future auth work (e.g. migrating the dashboard to
cookie-based sessions) doesn't accidentally introduce a shared
`domain: ".uzeyn.com"` attribute and break this.

### D26. Free-tier abuse controls
**Status:** LOCKED.
**Decision:** a report-abuse link, a takedown process with an SLA, a
brand-impersonation blocklist, signup rate limits, AUP/ToS liability
limits, and phishing/spam monitoring.
**Reasoning:** addresses Risk Register #4 — a free subdomain store is a
plausible phishing/spam magnet without these controls.

### D27. "Verified store" badge replaces CNIC-based trust
**Status:** LOCKED.
**Decision:** a store is "Verified" once its domain is verified, its
email is verified, a payment gateway is connected, and it has real
orders.
**Reasoning:** CNIC verification was removed globally on 2026-10-03
(decision #2 above) with no replacement specified at the time; this is
that replacement, built from signals that generalize globally instead
of a Pakistan-specific document.

### F. UX and growth

### D28. Leverage existing assets
**Status:** LOCKED.
**Decision:** D-Studio animations double as demo content; template demo
pages stay public and indexable for SEO; free-tier branding becomes a
deliberate viral loop (a clickable, referral/UTM-attributed "managed by
UZEYN" mark plus an opt-in showcase gallery); the existing delivery-
tracking and post-payment-OTP mechanisms become a published trust story
(real before/after data only).
**Reasoning:** not recorded beyond the decision itself.

### D29. Region-gated features
**Status:** LOCKED-DEFAULT.
**Decision:** Pakistan-specific features (the supplier network, local
gateways) show only to relevant regions — extends the existing
"hide features not in your plan" pattern to "hide features not in your
region" too.
**Reasoning:** not recorded beyond the decision itself.

### D30. UX backlog (global-launch-adapted)
**Status:** LOCKED.
**Decision:** a first-10-minutes flow (signup → subdomain → niche
template → first product → publish, target under 15 minutes); a
dashboard launch checklist with progress and sample products;
contextual upgrade prompts at real limit moments (the 11th product, a
custom-domain attempt, the animation toggle); the pricing-page cycle
toggle (D10); a share set (copy link/QR/WhatsApp/Instagram/Facebook/X);
a weekly digest email; an RTL/Urdu/Arabic storefront check (report
whether RTL support exists at all); a performance budget (dashboard p95
under 1.5s, skeleton loaders) as a launch gate.
**Reasoning:** not recorded beyond the items themselves.

### D31. Pricing page spec
**Status:** LOCKED.
**Decision:** the billing-cycle toggle (D10), a tax note, "Free
forever" as the primary CTA, a local-currency *estimate* display only
(never a real PKR price, per D6), the Shopify savings calculator (D14),
and the Launch Assurance + Founding Member badges.
**Reasoning:** not recorded beyond the decision itself — consolidates
D10/D6/D14/D17/D18 into one page spec.

### D32. Cancel flow + Launch Assurance UI
**Status:** LOCKED.
**Decision:** the cancel flow (D11) and a Launch Assurance banner/state
(D18) both need real UI, not just backend mechanics.
**Reasoning:** not recorded beyond the decision itself.

### D33. Partner portal pages
**Status:** LOCKED.
**Decision:** an application page, a partner dashboard, a public
directory profile, certificates, and an Earn Your Plan progress page.
**Reasoning:** not recorded beyond the decision itself — the UI surface
D20/D19 need to actually be usable.

### D34. Founding + Partner badges
**Status:** LOCKED.
**Decision:** a Founding badge on a seller's profile/store; a Partner
badge on a store.
**Reasoning:** not recorded beyond the decision itself.

### G. Metrics

### D35. Internal funnel analytics, pre-launch
**Status:** LOCKED.
**Decision:** instrument the funnel `signup → email_verified →
store_created → product_added → published → first_order →
upgrade_viewed → upgrade_clicked → paid`. Weekly KPIs: activation (%
publishing within 24h), time-to-first-order, free-to-paid conversion at
30/90 days, 30-day paid retention, Paddle payment-failure rate by
country, and support tickets per 100 sellers.
**Reasoning:** not recorded beyond the decision itself. Seller-facing
funnel analytics and Vellum stay post-launch, unaffected.

### H. Economics (figures recorded in `docs/pricing-and-programs.md`)

### D36. Net revenue estimate
**Status:** record only, not a decision requiring status.
**Figures:** tax-exclusive, 20% VAT, monthly cycle, after Paddle's 5% +
50¢ and an unconfirmed ~2.5% payout-conversion cost: GO ≈$21.5, RUN
≈$44.4, RISE ≈$108.6, FLY ≈$227.7 net/month (GO on the 12-month cycle ≈
$16.5/mo equivalent). Illustrative break-even mix (65% GO/20% RUN/10%
RISE/5% FLY, ~10% average tax — an assumption, not measured data):
roughly $45 net/subscriber/month blended on the monthly cycle (~12
sellers ≈ $500/mo, ~23 ≈ $1,000/mo, ~67 ≈ $3,000/mo); roughly $37 if
every seller were on the 6-month cycle instead.
**Reasoning:** n/a — recorded for planning reference.

### D37. Shopify comparison reference point
**Status:** record only.
**Figures:** at $10,000/month in sales, a Shopify Basic seller paying
2% third-party-gateway surcharge pays roughly $239/month (plan + fee)
versus UZEYN RUN's flat $49 — the saving applies specifically to a
seller not already on Shopify Payments.
**Reasoning:** n/a — feeds D14's calculator.

### I. Founder-owned / professional follow-ups

### D38. CA questions
**Status:** record only, founder-owned.
**Questions:** company-registration timing relative to the Paddle
account (and whether an entity change forces Paddle re-verification);
the applicable Pakistani tax regime for software/IT export income;
withholding tax and record-keeping obligations on Partner bonus
payments (D20); deferred-revenue treatment of prepaid billing cycles.
**Reasoning:** n/a — these need a CA, not a docs amendment.

### D39. Lawyer questions
**Status:** record only, founder-owned.
**Questions:** EU consumer tax-display rules versus this platform's
"for business use" positioning; auto-renewal/click-to-cancel
requirements by jurisdiction; refund-term wording; Earn Your Plan and
UZEYN Partners terms (D21); AUP/takedown process language; DPA/
controller-processor roles for seller storefront data.
**Reasoning:** n/a — these need a lawyer, not a docs amendment.

### J. Open items — recorded, not implemented

### D40. Ten open sub-questions
**Status:** OPEN (all ten).
**Items, each with its stated default:** (1) Launch Assurance threshold
currency/amount — default PKR 25,000 ≈ $90, per-currency table, D18;
(2) Partner bonus basis/duration — default 8.88% of cleared net revenue,
recurring vs. 12-month capped, D20; (3) Partner payout method/currency/
minimum — default manual, PKR, ≈Rs 5,000-equivalent minimum, D20; (4)
Partner free-plan-access mechanics — default per D20's benefit 4
description; (5) Earn Your Plan windows/rewards — default per D19's
proposed rungs; (6) a local PKR payment route for UZEYN's own plans
(bank/Easypaisa/Raast, admin-verified) — the advisor recommends yes
since Pakistani cards often fail recurring USD charges, founder
undecided, Paddle-only until resolved; (7) the discount floor (D23)
needs a separate reconfirmation; (8) the gateway rollout order (D5)
needs a separate reconfirmation; (9) go-to-market geography (D3); (10)
Paddle tax display by buyer location versus always-exclusive (D7, a
lawyer question).
**Reasoning:** n/a — every item here is recorded with its default and
left unimplemented, per this round's own instruction not to act on an
OPEN item.

### D41. Lapsed-paid-seller retention policy — reverses the current hard-delete policy, NOT approved
**Status:** OPEN. **Not implemented. Current hard-delete behavior is
unchanged until the founder explicitly approves a replacement.**
**Decision:** none yet. The advisor's recommended "Option B" —
downgrade to starter_free, archive (never delete) products beyond the
10-product cap, suspend (never delete) staff, keep the full D-Studio
layout but render only the 4 Free-tier-allowed sections, 301-redirect
any custom domain to the subdomain before release, honor in-flight
orders/buyer pages, restore idempotently on payment, allow data export
during the lapse, trigger from the Paddle subscription status
transitioning `past_due` → `canceled`, and auto-delete only a signup
that was never verified/never published after roughly 90 days — is
recorded here as the stated default a future decision would most likely
pick, not as something decided.
**Reasoning:** this directly corresponds to the retention-policy
proposal already delivered earlier in this engagement, comparing "keep
today's hard-delete" against "downgrade to free instead" — the
advisor's document independently converges on the same "downgrade"
option as the recommended default. It remains the founder's call.
**Today's actual behavior, unchanged by this entry:** pause → three
warnings over 14 days → permanent hard-delete.

**Instruction accompanying these resolutions:** this round is docs-only
— no application code, schema, seed, or config changes. Once this
entry's own commit is CI-confirmed green, resume the Phase A/B backlog
using the re-sequenced order in `docs/build-plan.md`, same incremental
commit / live-verify / independently-CI-confirm discipline as every
prior item in this project. No OPEN item above (D3, D23 reconfirmation,
every D40 sub-item, D41) gets implemented until it is explicitly
resolved.

---

## 2026-10-09 — MVP Execution Prompt (D63–D81)

Source: the founder, via his co-founder/advisor — the **build** prompt,
superseding the MVP-relevant parts of the 2026-10-08 entry (D1–D41)
wherever they conflict; everything else in that entry stays. Full
spec: `docs/mvp-scope.md` (what ships/is dormant/is out) and
`docs/plan-matrix-mvp.md` (D78's per-gate matrix). Status legend as
the prior entry: **LOCKED** = the founder stated it directly.
**LOCKED-DEFAULT** = the founder delegated the call to his co-founder
("jesa behtar lagy wesa karo" — "however you think is better, do it").

### D55. Scope freeze
**Status:** LOCKED-DEFAULT.
**Decision:** a new request must pass: "does it move activation or
revenue in the first 90 days, or does it protect money and data?" —
otherwise it doesn't ship in the MVP window.
**Reasoning:** not recorded beyond the test itself.

### D57/D58. Gateway-secret custody and an independent security review
**Status:** LOCKED-DEFAULT.
**Decision:** envelope encryption with the master key held outside the
app host/image (S4 below), and a paid independent security review
focused on tenant isolation/payments/webhooks/domain-separation/key
custody **before real seller gateway keys are ever accepted** (S14).
**Reasoning:** real seller payment credentials are the single highest-
value target on the platform; a founder-run review alone isn't
sufficient assurance for that specific risk.

### D59. CI speed for docs-only commits
**Status:** LOCKED-DEFAULT.
**Decision:** shard e2e tests across parallel runners (target ≤15 min)
and path-filter docs-only commits so they skip the full suite. This
**amends** the standing "all 5 jobs on every push, no exceptions" rule
that has governed every commit in this project to date — but **only
for commits that touch nothing outside `docs/`/`CHANGELOG.md`**; a
code commit still needs all 5 jobs green, unchanged. Time-boxed to one
working day; revert and report if it destabilizes CI.
**Reasoning:** the standing full-suite-every-push discipline was
calibrated for a solo-founder pace where CI turnaround wasn't the
bottleneck; at MVP-build pace (frequent small pushes) a 45-60 minute
e2e wait on a PURE docs change is pure latency with no corresponding
safety benefit, since a docs-only diff cannot break a test.
**Sequencing note (my own call, not yet executed):** this is
infrastructure (`.github/workflows/ci.yml`), not a doc — it will ship
as its own small, CODE-touching push, sequenced after this M0 docs
push's own CI confirms green (not bundled into this commit, and not
run concurrently with it, per the standing "one CI-triggering push at
a time" rule, which D59 does not relax).

### D63. Programs are post-MVP, documented only
**Status:** LOCKED.
**Decision:** Earn Your Plan, UZEYN Partners (including the 8.88% bonus
and payout controls — recorded as design records, not built), Students,
the referral/attribution engine, the education portal, Vellum, seller-
facing funnel analytics, paid templates (Template Marketplace), and the
D-Studio Pack (already retired 2026-10-03) are all out of the MVP build.
Specs for all of these stay exactly as written in the 2026-10-08 entry
and `docs/SRS.md` §5.83–5.85/§5.91 — nothing there is deleted or
un-specified, it simply doesn't get built in this window.
**Reasoning:** scope freeze (D55) — none of these move activation or
revenue in the first 90 days, and several (Partners, Earn Your Plan)
were already explicitly post-launch in the prior entry.

### D66. Minimal billing; lapse never auto-deletes — partially resolves D41
**Status:** LOCKED-DEFAULT.
**Decision:** a lapsed paying seller downgrades to Free; a store is
**never** auto-deleted for non-payment. This is the **minimum** version
of D41's still-open retention question — it locks in the single most
important piece (no hard-delete of a lapsed paying seller) without
settling the rest of D41's fuller mechanics (archiving product rows
beyond the Free cap, 301-redirecting a custom domain, the exact
warning-email ladder, the 90-day never-verified-signup auto-delete
rule). **D41 stays OPEN for everything beyond this minimum** — record
it as "partially resolved" in the open-questions list, not closed.
**Reasoning:** "never destroy a paying customer's data for a billing
lapse" is the one piece of D41 not actually in dispute — the founder
delegated the rest of the mechanics rather than blocking the MVP on
settling every detail now.

### D69. Next.js 14→15 timeline
**Status:** LOCKED-DEFAULT.
**Decision:** upgrade within ~30 days after launch; stay on the latest
14.x patch until then; keep the scoped `pnpm audit` exception (Risk
Register #29, `docs/SRS.md`) documented and intact until the upgrade
lands.
**Reasoning:** not recorded beyond the timeline itself — confirms Risk
Register #29's existing "not rushed into the middle of an urgent pass"
reasoning still applies, now with a concrete deadline.

### D70. Milestone estimates owed to the founder
**Status:** LOCKED (process requirement, not a product decision).
**Decision:** every milestone checkpoint report includes a done/
remaining/risk estimate per item, plus what depends on the founder
(credentials, Simpaisa contact, hosting choice, etc.).
**Reasoning:** the founder is funding and time-boxing this build and
needs visibility to plan around it, not just a final "it's done."

### D71. Founder-facing guides ship in the repo
**Status:** LOCKED.
**Decision:** `docs/founder-local-run.md` (exists, needs Windows-
specific verification), `docs/founder-test-guide.md`,
`docs/founder-security-test-guide.md`, `docs/launch-readiness-
checklist.md`, and `docs/security/` runbooks (key rotation, gateway
kill switch, session revocation, restore) all ship as real, verified
documents — not aspirational placeholders. The founder approves launch
readiness by following these himself, without reading code.
**Reasoning:** the founder is non-technical enough to need this
(Windows PC, i5 6th-gen, 16GB RAM, limited disk — explicitly not a
developer's own dev-box profile) and the whole MVP's acceptance
criterion is that he can test and approve it unassisted.

### D73r. Seller gateways at launch — reordered, two demoted to Phase 2
**Status:** LOCKED (founder, 2026-10-09 13:43) — **supersedes D5's
rollout order**.
**Decision:** build order is Stripe → Simpaisa → Airwallex → Razorpay
(Airwallex now ahead of Razorpay, reflecting real sandbox availability
— Airwallex and Razorpay both offer self-serve test credentials with
no KYC, Simpaisa has no public self-serve sandbox found as of this
writing). EBANX and Skypay Global move to **Phase 2** — kept in the
docs and the allowlist's `planned` state, not selectable, not built in
this window.
**Reasoning:** sandbox availability, not a market-priority change —
D4's full six-gateway allowlist (Stripe, Razorpay, Simpaisa, Airwallex,
Skypay Global, EBANX) is unchanged; this only reorders the BUILD
sequence and demotes two from "follow on demand" to an explicit
Phase 2 label.
**Additional rule (new, not in D4/D5):** a gateway is built ≠ live — it
only enters the registry's `enabled` state once its own
`docs/gateway-verification/<name>.md` evidence file exists, confirmed
by the founder's own decision, never assumed from "the code compiles."

### D74. One customer = one store; multi-store archived
**Status:** LOCKED — **supersedes the "3/5/10 stores by tier" piece of
D12's cumulative ladder and D13's feature distribution**, for the MVP
window only.
**Decision:** every plan (including the eventually-reactivated FLY) gets
`stores = 1` at launch. Existing multi-store code — the UI store
switcher, every multi-store screen, the tiered `stores.max_per_seller`
values — is archived (git tag `archive/multi-store-2026-10-09` plus a
branch), not deleted, and the **1-store limit is enforced server-side**
(the API refuses to create a second store), not just hidden in the UI.
**Reasoning:** scope freeze (D55) — multi-store management is real
complexity (switcher UI, per-store billing/staff/analytics surfaces)
that doesn't move activation or revenue for a brand-new seller's first
90 days, who by definition starts with exactly one store regardless of
what their plan would eventually allow.
**Accepted tradeoff:** D12's "every tier is a strict superset" framing
technically no longer holds on the stores dimension alone during the
MVP window (every tier is capped at 1, not tiered 1/3/5/10) — this is
a deliberate, temporary, documented exception, not a quiet contradiction
of D12. Multi-store returns once FLY (or a growth-stage upgrade path)
is reactivated post-MVP.

### D75d. MVP plan ladder — Free + GO/RUN/RISE live, FLY dormant
**Status:** LOCKED-DEFAULT.
**Decision:** at launch, sellers can be on Free or pay for GO
($24) / RUN ($49) / RISE ($119) — USD, tax-exclusive, cycles exactly
per D10's table (3mo −7%, 6mo −12%+15 days, 12mo −25%). **FLY's plan row
is kept in the database, `isActive = false`: inactive, not purchasable,
not shown anywhere** — a true "dormant," not a deletion. D9's full
GO/RUN/RISE/FLY price list stays the canonical reference for when FLY
reactivates; nothing about FLY's eventual $249 price point changes.
**Reasoning:** scope freeze again — FLY's distinguishing features (10
stores, 5 staff, the removable loading-mark) are either archived for
MVP (D74's single-store rule) or reassigned to RISE (D76d), so a
FLY tier with nothing distinctively FLY about it yet isn't worth
exposing to a first customer.

### D76d. Loader-mark removability moves from FLY to RISE
**Status:** LOCKED-DEFAULT — **supersedes §5.74 FR-74.3's `planGroup
=== "individual" && tierOrder === 3` (FLY) gate for the MVP window.**
**Decision:** RISE becomes the top *active* brand-control tier at
launch, so the loading-screen "Managed by UZEYN" mark becomes removable
on RISE instead of FLY. Invoice branding and buyer-facing cart/checkout
branding (FR-74.4/FR-74.5) stay permanently non-removable on every
tier, unchanged. Already-shipped Team Growth/Scale behavior (§5.74
FR-74.3's own "never touches Team-tier branding" guarantee) is also
unchanged.
**Reasoning:** since FLY is dormant (D75d) with no seller actually on
it, a removability grant that only FLY sellers could use would be
dead code in practice for the entire MVP window.
**Implementation note (M1 work, not yet done as of this entry):**
`BrandingService.getLoadingScreenBrandingVisible()`'s current check
(`planGroup === "individual" && tierOrder === 3`) needs to become
`tierOrder === 2` (RISE) — a real, small code change, sequenced into
M1 alongside the plan reseed (3.1), not part of this docs-only M0
push. The existing e2e coverage (`branding.e2e-spec.ts`'s Team Growth/
Scale divergence test added 2026-10-08) will need its individual-tier
assertions updated to match.

### D77. M0–M4 milestones with founder checkpoints
**Status:** LOCKED-DEFAULT.
**Decision:** work proceeds in order through M0 (docs) → M1 (core +
security P0) → M2 (trust + security gate) → M3 (gateway wave) → M4
(acceptance package), each ending in a founder checkpoint report. Don't
wait for a reply between milestones unless a stop condition (D6 above)
applies. Launch rule: launch once M1, M2, and the P0 security items
are done and at least the sandbox-verified gateways are live; remaining
gateways follow as config/registry changes, not a re-launch.
**Reasoning:** lets the founder test and give feedback early (M1)
rather than waiting for the full six-gateway build before seeing
anything real.

### D78. Marketing copy follows shipped code, not the advisor's proposal
**Status:** LOCKED-DEFAULT — **narrows D13's feature-distribution
table for MVP marketing purposes specifically** (D13's table stays the
long-term target spec in `docs/pricing-and-programs.md`/SRS §5.78
FR-78.4; it is not deleted or itself superseded).
**Decision:** the MVP's plan-comparison marketing copy describes only
gates that exist in the codebase TODAY, confirmed by the 2026-10-08
amendment's own gap report — not D13's advisor-proposed target state.
Concretely dropped from marketing (not built, not promised): the
500-product cap on GO (ships copy for the real 100-product cap unless
raising the number is trivial and gets pulled into an MVP milestone),
"all D-Studio sections" on GO (ships copy for the real 8-of-22 access),
a basic-vs-funnel analytics split (doesn't exist — one analytics set
for everyone, described as such), device-approval restriction, generic
seller-facing API/webhooks, and tiered support SLAs (none of these
exist in code). `docs/plan-matrix-mvp.md` is the authoritative per-gate
record — one row per gate, Free/GO/RUN/RISE columns, "exists in code"
and "shown on marketing" each Y/N, so a gap between promise and product
can never recur silently.
**Reasoning:** a marketing claim for a feature that doesn't exist is
both a trust risk and a support-ticket generator on day one — "build
what we describe" is cheaper to maintain than "describe what we'll
eventually build."

### D79. Security is a first-class workstream, evidence-based
**Status:** LOCKED.
**Decision:** handle every part of security to the deepest practical
level for an MVP and defend against a highly skilled attacker, not
just casual abuse. The full P0/P1 control list (S1–S15,
`docs/SRS.md` §12 risk items to follow and `docs/security/abuse-
cases.md`) is binding. A disagreement with a listed control must come
with evidence (a cited reason it doesn't apply, or a cheaper control
that covers the same risk) — silently dropping a control is not
permitted.
**Reasoning:** this platform will hold real seller payment credentials
and real buyer PII from day one; "MVP" describes feature scope, not an
excuse to ship with a lighter security bar than a mature product would
carry.

### D80. Founding Members and Launch Assurance run manually at launch
**Status:** LOCKED — **removes both from Phase B's pre-launch code
queue** (§5.81/§5.82 in `docs/SRS.md` stay the full future-automation
spec, now explicitly re-tagged post-MVP in `docs/build-plan.md`).
**Decision:** at launch, both run as manual admin actions — a flag set
by hand, a Paddle discount code created by hand — not the automated
eligibility-detection/relief-application mechanisms §5.81/§5.82
originally specified.
**Reasoning:** scope freeze — the automation is real engineering work
(an effort-gate evaluator, an auto-applied relief mechanism, a
dedicated UI) that a human can substitute for cheaply at launch's
likely small initial seller count.

### D81. Billing behind a feature flag; Free-only mode is the fallback
**Status:** LOCKED-DEFAULT.
**Decision:** all Paddle billing code ships behind `billing.enabled`
(a Settings Registry boolean, default state TBD at each environment's
setup). The platform must run correctly with billing OFF (every seller
effectively on Free, a private-beta-style mode) and separately with
Paddle sandbox ON. If Paddle's account approval (`docs/launch-
runbook.md` §11) is slow, launch can proceed Free-only and flip billing
on later without a second deploy.
**Reasoning:** decouples "the founder's Paddle account is approved" —
a founder-owned, external, unpredictable-timeline dependency — from
"the MVP is otherwise ready to launch."

**Instruction accompanying these resolutions:** M0 (this docs push) is
the only work item before the first investigation reply (see the
2026-10-09 checkpoint report in this session's own record). M1 starts
immediately after M0's CI is independently confirmed green, same
incremental-commit/live-verify/independently-CI-confirmed discipline as
every prior item in this project — amended per D59 for docs-only
commits once that work lands, unchanged for every code commit before
and after.
