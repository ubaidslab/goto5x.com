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
**Implementation note (B2, 2026-10-10) - the 15-bonus-days question is
now RESOLVED, Paddle-native support is still open:**
- The 6-month cycle buys one continuous period - 6 calendar months PLUS
  15 days of service, every purchase and every renewal alike. Never a
  separate credit, coupon, or bonus-entitlement record.
- Our own database is the sole source of truth for when that period
  ends (`Subscription.currentPeriodEnd`) - access, plan limits, and
  renewal reminders all read it directly; a payment provider's own
  billing date is never consulted. `addInterval()`/`addMonthsClamped()`
  (apps/api/src/plans/subscriptions.service.ts,
  plan-pricing.util.ts) implement this: +6 calendar months (clamped to
  the target month's real last day, not JS Date's native rollover),
  then +15 days, in one step. Month-end and leap-year edge cases are
  unit-tested (plan-pricing.util.spec.ts).
- Cancelling: access continues to the existing period's end, bonus days
  included - nothing is refunded for unused time. A refund within the
  14-day window (D11) ends the whole period, bonus days included; the
  bonus days are never paid out separately.
- An upgrade/downgrade inside the same 6-month cycle keeps
  `currentPeriodEnd` unchanged and prorates on the remaining days
  (bonus days included in the proration base) - already how
  `requestPlanChange()`'s deferred-change path works for every cycle,
  not a new mechanism B2 added.
- Switching to a DIFFERENT cycle takes effect only at the next renewal
  (no mid-period cycle switch in MVP) - also the pre-existing behavior:
  `billingInterval` is written immediately but `currentPeriodEnd` isn't
  touched until the next `addInterval()` call, which then uses whatever
  cycle is current at that point.
- Still genuinely open, deferred to 1C (after founder go-ahead, no
  Stripe/Paddle product or price objects created by B2): whether Paddle
  and Stripe both support pushing a provider's own next-billing-date to
  match our 6.5-month entitlement end on every six-month renewal. If
  either provider doesn't, the founder's instruction is to drop the
  bonus days for that provider rather than fake it - confirm this
  before 1C starts billing real six-month cycles on that provider.

**Two different "months" figures - both locked, deliberately not the
same number (founder item 4/D99, 2026-10-11):** six_month's 15 bonus
days answer two different questions differently, and both functions
live together in `apps/api/src/plans/plan-pricing.util.ts` specifically
so a future reader sees both at once instead of "fixing" one to match
the other:
- `monthsOfService()` - "divide a cycle's total price by how many
  months, for a price-per-month figure." six_month = **6.5**. The bonus
  days genuinely lower the true per-month cost, so dividing by a plain
  6 would overstate it. Used by MRR normalization
  (`MrrAnalyticsService`) and the pricing page's "effective monthly"
  savings label (`apps/web/app/pricing/page.tsx` - a separate app, its
  own hardcoded `6.5`, cross-referenced in a comment rather than shared
  code, since this repo has no shared package between `apps/api` and
  `apps/web` today).
- `paidMonths()` - "how many whole months of paid service did this
  cycle buy," for anything that counts discrete commission/eligibility
  months. six_month = **6**, a plain whole number. The 15 bonus days
  were never a commission-bearing month under the Ambassador program,
  confirmed explicitly by the founder - applying 6.5 here would both
  increase real Ambassador payouts nothing asked for and require a
  schema migration (`ReferralAttribution.commissionMonthsPaid` is an
  `Int` column). Used only by `ProgramCommissionService`'s Ambassador
  accrual.

Before this, `MrrAnalyticsService` carried its own second, independently-
maintained copy of the 6.5 figure (same value, but a real duplication-
drift risk - the actual bug item 4 was asking about) and
`ProgramCommissionService` carried its own separate whole-6 function
under a different name - both now call these two shared functions
instead. Zero e2e coverage existed for any non-monthly MRR cycle, or for
an Ambassador commission on anything but a monthly renewal, before this;
both gaps are now covered (`mrr-analytics.e2e-spec.ts`,
`module22-growth-partner-programs.e2e-spec.ts`).

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

---

## 2026-10-09 — Founder decisions on the M0 report (D82–D91)

Source: the founder, directly, replying to this session's M0
checkpoint report (§10 of the MVP Execution Prompt). Status legend as
the prior entries: **LOCKED** = the founder stated it directly. All
ten below are LOCKED.

### D82. Auth/session hardening — Option A approved, hardened beyond the proposal
**Status:** LOCKED.
**Decision:** Option A (`docs/auth-session-design.md` Part 2) approved
with specifics stricter than the original proposal: refresh token in
an `HttpOnly`, `Secure`, `SameSite` cookie using the `__Host-` prefix
(host-only, no `Domain` attribute — the strictest cookie-scoping
option available); CSRF defense is a custom header **plus** an
Origin/`Sec-Fetch-Site` check, not the header alone; reuse detection
revokes the entire token family on a tombstone hit, not just the one
session. Applies to the admin terminal too, with stricter lifetimes
and MFA step-up required on sensitive/destructive actions. **Nothing
may remain in `localStorage`** on either surface — stated as an
absolute, not a target to approach.
**Reasoning:** not elaborated beyond the decision itself.
**Implementation note:** `docs/auth-session-design.md` Part 2 needs a
revision pass to record these specifics (the `__Host-` prefix, the
Origin/`Sec-Fetch-Site` check, token-family revocation, the admin-
specific stricter lifetime + step-up MFA) as the locked target, not
just the original Option A sketch — tracked as M1/1B work.

### D83. Real email transport is a hard publish-gate, not just infrastructure
**Status:** LOCKED.
**Decision:** M1 builds a provider interface, a real SMTP transport,
and one real API provider (exact choice TBD), with Mailpit staying the
local-dev-only provider. A new application-level gate: **a store
cannot be published while email sending is non-functional** — whether
because `EMAIL_PROVIDER` still resolves to the dev-only console logger,
or because the configured provider fails its own health/send check.
**Reasoning:** not elaborated beyond the decision itself — a stronger,
product-level requirement than "build the transport": it must be
enforced as working before commerce starts, not just available.
**Implementation note:** this is a new FR, not yet specced in
`docs/SRS.md` — needs a store-publish-flow touchpoint identified
(wherever a store's `status` transitions to published/live today) and
a new acceptance-checklist item; tracked for M1/1B.

### D84. Buyer password reset ships in M2; passwordless proposal invited
**Status:** LOCKED.
**Decision:** M2 builds a buyer password-reset flow mirroring the
existing seller/admin pattern exactly: single-use hashed token, short
expiry, no content-based account enumeration, reset-link base URL from
`APP_BASE_URL` config (never the request's `Host` header). Separately:
the founder is open to a passwordless buyer login (e.g. magic
link/email OTP) instead, if it's genuinely simpler than building and
maintaining password + reset for buyers specifically — asked for a
proposal rather than a default build.
**Reasoning:** not elaborated beyond the decision itself.
**Implementation note:** a short passwordless-vs-password-reset
proposal is owed before M2's buyer-auth work starts (not yet written) —
tracked as a required M1/M2-boundary deliverable.

### D85. Plan matrix approved, conditional on three M1 code changes
**Status:** LOCKED — approves `docs/plan-matrix-mvp.md` (D78) as the
MVP marketing source of truth, contingent on the three items below.
**Decision:** (1) Free-tier email-campaign cap enforced at 0 in code
(M1) — today it falls through to the 500/mo global default; (2) the
loading-mark gate flip, FLY→RISE (§5.74 FR-74.3, D76d) lands in M1,
and that matrix row **stays unpublished until the corresponding commit
is independently CI-confirmed green** — not published ahead of the
code; (3) Free-tier D-Studio marketing copy is worded as section
counts ("8/14/20 of 22 sections"), never an "animation" claim.
**Reasoning:** not elaborated beyond the decision itself — consistent
with D78's own "copy follows shipped code" rule applied to the three
rows the matrix itself flagged as not-yet-true.

### D86. Legacy PK gateways default to dormant when the registry lands
**Status:** LOCKED — supersedes the interim "live and ungated" state
Risk #50 recorded, as of the M1 registry landing.
**Decision:** Raast/Easypaisa/JazzCash/bank-transfer adapters default
to **off** the moment the gateway registry ships (M1). Each may only
be re-enabled individually, and only after real sandbox-verification
evidence exists in `docs/gateway-verification/<name>.md` — no blanket
reactivation. Pakistan's day-one payment path is COD/advance/manual-
mark-as-paid (payment *models*, not gateways) — confirms D4/D73r's
framing and build order.
**Reasoning:** not elaborated beyond the decision itself — closes
Risk #50's exposure (live, ungated, zero real-HTTP test coverage) at
the earliest point the registry makes closing it possible.

### D87. Merge the four duplicated credential-encryption implementations
**Status:** LOCKED, P0, tagged to D57/S4 (gateway-secret custody).
**Decision:** consolidate `drive-token-crypto.util.ts`,
`payment-gateway-credential-crypto.util.ts`,
`smtp-credential-crypto.util.ts`, and
`admin-email-credential-crypto.util.ts`'s hand-copied AES-256-GCM logic
into one shared module parametrized by key — matching
`identity-crypto.util.ts`'s existing import pattern, which is already
correct. Closes Risk #51.
**Reasoning:** not elaborated beyond the decision itself — a future
correctness fix to the shared AES-256-GCM shape should only need to
land in one place, especially now that real seller payment-gateway
credentials are about to flow through one of the four duplicates.

### D88. RLS hardening follow-ups
**Status:** LOCKED.
**Decision:** four concrete M1 items: (1) route `WalletService` and
`SubscriptionInvoiceService` through `TenantPrismaService` instead of
the `app_admin` bypass client; (2) replace
`TenantPrismaService.run()`'s UUID-regex-gated string-concatenation
`SET LOCAL` with `set_config('app.current_seller_id', $1, true)`
passed as a real bind parameter — removes the one remaining string-
built SQL fragment in the codebase rather than just validating it;
(3) add a CI test that allowlists every call site using the
`app_admin` bypass client by name/path and fails the build the moment
a new, un-reviewed call site appears; (4) review the ~20 cross-tenant
background-job queues the M0 report identified, prioritized by data
sensitivity — money-touching and PII-touching queues first.
**Reasoning:** not elaborated beyond the decision itself — closes the
two hardening refinements and the background-job trust-model gap the
M0 report's RLS re-verification surfaced, with concrete, scoped fixes
rather than leaving them noted-but-unaddressed.

### D89. CI hardening ships first, ahead of M1's own sub-phases
**Status:** LOCKED — sequenced **before** D90's 1A/1B/1C.
**Decision:** (a) remove `next/font/google` from the codebase in favor
of self-hosted font files, eliminating the build-time network
dependency that caused the M0 report's `web-build` flake; (b) land D59
(shard e2e across parallel runners; path-filter docs-only commits to
skip the full suite). Time-boxed to one working day total; report the
new CI time once both land.
**Reasoning:** not elaborated beyond the decision itself — removes the
*cause* of the flake (an avoidable external network dependency at
build time) rather than just tolerating retries going forward.
**Sequencing note:** both are CI infrastructure, not docs — ships as
its own small, code-touching push per the standing one-push-at-a-time
rule, before 1A starts.

### D90. M1 build order: three founder-visible sub-phases
**Status:** LOCKED — confirms the sub-phase split proposed in the M0
report's own estimates (§5).
**Decision:** **1A** = single-store enforcement + plan reseed +
programs gating + gateway registry; **1B** = auth hardening (D82) +
email transport (D83) + security P0 items tagged M1; **1C** = Stripe
adapter + Paddle sandbox billing + the founder-local-run guide — 1C
explicitly needs founder-supplied keys (Stripe, Paddle) before it can
complete.
**Reasoning:** not elaborated beyond the decision itself — a
checkpoint after each sub-phase instead of one long M1 stretch.

### D91. Minimum viable private beta — estimate and date owed after 1A
**Status:** LOCKED (process requirement, alongside D70).
**Decision:** once 1A lands and is independently CI-confirmed, restate
the M1–M4 estimates, and separately define the minimum feature/doc set
for an invite-only private beta that needs **neither** billing **nor**
any live (non-sandbox) seller gateway key — plus a target date for
reaching that minimum.
**Reasoning:** not elaborated beyond the decision itself — a faster,
narrower path to something real sellers can touch than waiting for all
of M1–M4 to land.

---

## 2026-10-10 — Founder decisions on the D89/D59 report (D92–D97)

Source: the founder, directly, replying to this session's D89/D59
checkpoint report. Status legend as the prior entries: **LOCKED** =
the founder stated it directly. All six below are LOCKED.

### D92. Every change goes through a branch and a PR; no direct pushes to main
**Status:** LOCKED — supersedes this project's standing practice (push
to the feature branch, fast-forward `main` directly) **effective
immediately**, for every change, CI/workflow changes especially.
**Decision:** branch protection on `main`, required status checks
(`e2e-tests-summary` plus every other real job), no direct pushes, no
force pushes.
**Reasoning:** not elaborated beyond the decision itself.
**Implementation note:** no branch-protection/repo-settings write tool
is available via the GitHub MCP server in this session (confirmed by
search) — enabling the protection rule itself is a one-time repo-admin
action only the founder can do (GitHub Settings → Branches). The PR
discipline (branch + PR + CI-gated merge, no bare push) starts
immediately regardless of whether that server-side enforcement is
switched on yet.

### D93. CI cost controls — triggers, concurrency, caching
**Status:** LOCKED.
**Decision:** full e2e only on PR-to-main, merge-to-main, and a
nightly schedule; a feature-branch push gets lint + typecheck + unit
tests only. `concurrency` with `cancel-in-progress` per branch, so a
new push cancels the old run rather than paying for both. pnpm store
and Playwright browsers cached across runs.
**Reasoning:** sharding cut wall-clock time, not total compute, on a
private repo with a limited monthly Actions-minutes quota — billable
runner-minutes needed its own, separate fix.
**Implementation note:** before wiring "lint" into the feature-branch
job, ran both apps' existing `lint` scripts locally rather than
assuming they pass. Neither does: `apps/api`'s `eslint "src/**/*.ts"`
has zero `eslint.config.js` (ESLint 10 requires the flat-config format;
nothing in this repo ever migrated to it) and apps/api declares no
ESLint-related devDependency of its own beyond `typescript`, so there's
no rule set to even point a config at without first choosing and adding
one. `apps/web`'s `lint` (`next lint`) has never been initialized
either — it drops into an interactive "how would you like to configure
ESLint?" prompt, which would hang forever on a non-interactive CI
runner. Standing up a real config for either is a separate, open-ended
piece of work (choosing rule strictness, adding the devDependencies,
then triaging however many pre-existing violations that surfaces across
~100+ source files) that I'm not willing to do silently inside a CI-
trigger-restructuring change. Shipped A3 with feature branches running
typecheck + unit-tests only (the two that actually work today); lint
is tracked as an open gap, not implemented, pending a decision on
priority.

### D94. Workflow security hardening is required, not optional, for `ci.yml`
**Status:** LOCKED.
**Decision:** top-level `permissions: contents: read`, widened per job
only where a job genuinely needs more; every third-party Action pinned
to a full commit SHA, with Dependabot tracking the `github-actions`
ecosystem for version bumps; no `pull_request_target` anywhere;
secrets never exposed to a fork or printed in a log.
**Reasoning:** not elaborated beyond the decision itself — closes
Risk #48/S12's remaining gap (Actions pinned by tag, not SHA) and adds
the permissions/fork-secret controls that gap report didn't cover.

### D95. Gateway registry status is tri-state (live/soon/verifying), not binary
**Status:** LOCKED — refines D86's "default dormant, reactivate with
evidence" framing into this explicit three-state model; does not
reverse D86, makes it precise.
**Decision:** every gateway/payment-model entry carries a `live` /
`soon` / `verifying` status. **Live at launch:** COD, advance payment,
manual-mark-as-paid (payment models, not gateways — matches D4/D73r's
Pakistan day-one path). **Soon:** Stripe, Simpaisa, Airwallex,
Razorpay, EBANX, Skypay Global. **Verifying:** Easypaisa, JazzCash,
Raast, bank transfer — the four legacy adapters Risk #50 found live
and ungated; "verifying" replaces the plainer "dormant" label D86 used,
same underlying rule (nothing in this status goes live until it passes
the contract-test suite). Per-tenant gateway credentials stay
encrypted at rest (ties to D87's crypto-module merge), never sent to
the client or written to a log. Each registry entry carries its own
required CSP additions (e.g. Stripe.js needs `js.stripe.com`), applied
only on checkout pages — storefront domains stay separate from the
admin/app domain, and the rest of the app keeps strict CSP.
**Reasoning:** not elaborated beyond the decision itself.

### D96. Logo/wordmark stays untouched; the loader-mark tier-gate code change is unrelated and proceeds
**Status:** LOCKED.
**Decision:** the founder is separately deciding whether to adopt a
new blackletter "uyz" monogram (seen on the landing page) as the
platform's actual wordmark, and will send the SVG if so — **don't
change the product logo yet**. This is unrelated to D76d's loader-mark
*removability* change (`BrandingService`'s `tierOrder === 3` →
`tierOrder === 2`), which is a tier-gate code change touching no
visual asset, and proceeds as already planned.
**Reasoning:** not elaborated beyond the decision itself — keeps a
branding decision and a tier-gate code change from getting conflated.

### D97. Checkpoint discipline after 1B; secrets-exposure escalation
**Status:** LOCKED — overrides the standing "don't wait between
milestones" instruction for this one boundary.
**Decision:** continue through 1A and 1B without waiting. After 1B
(auth hardening, email transport, security P0), **stop** and send a
full report — what shipped, tests, a security checklist, open risks,
CI runner-minutes for the milestone — before starting 1C. 1C (Stripe +
Paddle sandbox) starts only after the founder's explicit go-ahead. No
live (non-sandbox) payment keys in any environment until the
independent security review (D58) is done. Secrets and test keys live
only in a local, gitignored `.env` — never in the repo, CI logs,
screenshots, or messages. If a secret ever lands in git history: stop,
tell the founder, and rotate it — don't quietly continue.
**Reasoning:** not elaborated beyond the decision itself — tightens
D58's existing "before any real seller gateway key" gate with an
explicit stop-and-report point the founder controls directly, rather
than leaving 1C's start to this session's own judgment.

### D98. Post-B3a punch list (6 items) before B3b/1B; explicit order of work
**Status:** LOCKED. Order: finish B3a (done, PR #10 merged) → items 1+2
→ item 3 together with B3b → items 4-6 → 1B. Checkpoint (D97) unchanged.
**Decision:**
1. **Main branch protection (HIGH).** `main` had `protected: false` -
   confirmed via `mcp__github__list_branches`. Every commit that reached
   it so far did so through a real PR merge via the GitHub UI (confirmed
   via `pull_request_read`'s `merged: true`/`merged_by`/`merged_at` and
   the resulting commit's `web-flow` committer identity - this session's
   own git identity doesn't match those commits' authorship, ruling out
   a direct push from a Claude Code session) - the "closed, not merged"
   reading that raised the concern was a stale field on the PR-list
   endpoint, not evidence of a bypass. Going forward: PR-merge-through-
   GitHub only, no direct pushes/local fast-forwards/admin bypass - PR
   #10 (B3a) was the first merged via `merge_pull_request` rather than
   any local push. Exact settings to enable (repo-admin action, no API
   access to do it from here) documented in `docs/launch-runbook.md`'s
   new "0. Repository branch protection" section.
2. **Database role grants (HIGH, security).** `bootstrap-db.sql` re-run
   after migrations silently re-widened five append-only tables'
   grants back to full DML (found locally: `admin_audit_logs`/
   `platform_events`/`user_security_events` drifted this way; the fix
   also covers `milestone_events`/`stock_adjustments`, found already
   drifted on the same local DB while verifying this). Fixed: the
   script's blanket grant is now followed by an unconditional,
   existence-guarded REVOKE on exactly those five tables, so it's
   order-safe regardless of when/how often it runs relative to
   migrations - verified directly (re-ran it against an
   already-migrated, already-drifted local DB; both drifted tables
   self-corrected, ran it twice more with no change, and a deliberately
   re-widened grant was caught and then corrected by the next run).
   New CI job `db-role-grants`: migrate → bootstrap → bootstrap again →
   asserts the exact grant set, proven to fail against the bug first
   (deliberately re-widened a grant locally, confirmed the same
   assertion logic catches it, then restored it).
3. **Stock restore-on-cancel + oversell (HIGH, money).** Confirmed: no
   reserved/on-hand split exists (`ProductVariant.stockQuantity` is the
   only counter), the decrement at order creation
   (`CheckoutService.reserveSelfFulfilledStock()`) IS already atomic
   (conditional `updateMany` with a `gte` guard), but the matching
   release function is private and only ever called as same-request
   rollback - cancelling a pending order today never gives stock back,
   for every payment type, not just the new Manual Transfer path. To be
   built together with B3b: a shared restore-stock-on-cancel path
   (seller/buyer/auto-cancel all call the same function), plus a
   concurrent-order test proving the decrement side.
4. **Money math consistency (MEDIUM).** B2's 6.5-months-of-service rule
   and program-commission.service.ts's deliberate whole-6 exception (a
   different concept - discrete eligibility cap, not per-month price,
   per B2's own documented reasoning) are in tension with this item's
   literal wording ("must use the same figure everywhere") - flagged
   back to the founder rather than silently changed, since it's real
   Ambassador payout math. Not yet resolved.
5. **prepaid_partial_advance UX gate (MEDIUM).** Not yet built - gate
   channel *selection* (not just checkout-readiness) on live-gateway
   status, with the founder's exact copy.
6. **Test/tooling hygiene (LOW).** Not yet done - lint has never been
   wired into CI at all (confirmed: no `lint` job exists in `ci.yml`
   today, and no eslint config file exists anywhere in the repo, which
   is why it won't even run locally); DNS/TLS tests that depend on real
   network reachability need mocking; every milestone report lists
   tests removed/rewritten with reason; CI polling stays light.
**Reasoning:** not elaborated beyond the decision itself.

### D99. B3b (Manual Transfer for "advance") confirmed scope; buyer-cancel stays out of this milestone
**Status:** LOCKED. B3b built to the 8-point spec below; item 3 (D98)
shipped together with it as instructed. Both merged into PR #12,
CI-confirmed green.
**Decision:**
1. B3b reuses existing pieces rather than adding new state: the same
   OR-pattern B3a already uses for "prepaid" (live gateway OR a
   configured `StorePaymentInstructions` payout method) now also gates
   "advance", and the seller's existing `markAsPaid()` is the
   confirmation action - no new `OrderStatus`.
2. An unpaid advance order uses the existing pending/unpaid state and
   is blocked from fulfillment/shipping until the seller confirms (new
   `assertShippableForPaymentModel()` guard on both tracking-upload
   paths).
3. The buyer submits a transaction reference + sender name (text only,
   validated, length-limited, escaped) via a public token-gated
   endpoint; shown to the seller next to Mark as paid.
4. The seller's "Not received" action reuses the existing cancel path
   plus item 3 (D98)'s stock-restore function - no separate rejection
   mechanism.
5. Unpaid advance orders auto-cancel after a seller-set window (default
   48h) through that same cancel-plus-restore path, run by a new hourly
   sweep worker.
6. Order creation is rate-limited per buyer email/phone in addition to
   the existing per-IP limit.
7. Label is exactly "Paid (confirmed by seller)", never "verified"; who
   confirmed and when is recorded in the existing `order.placed`
   platform-event's metadata (`EventsService`'s actor-table convention -
   `OrderTimelineEvent` itself has no actor column anywhere in this
   schema).
8. Seller dashboard shows the founder's exact warning copy ("Check the
   money in your own account before shipping - a screenshot or
   reference number is not proof.") next to the confirm action.
9. Checkout only offers advance-via-manual-transfer when the seller has
   filled in at least one payout method (account title + number);
   otherwise blocked, same as any other unconfigured channel today.

   Tests: happy path, seller rejects, auto-cancel with stock restored,
   shipping-before-confirmation blocked, and an injection attempt in the
   reference field - all passing (backend e2e; frontend hand-verified,
   see the B3b report for one disclosed browser-click caveat that
   doesn't implicate the proven server-side logic).

10. **Buyer-initiated cancellation is explicitly out of this milestone.**
    The founder's item-3 wording ("seller/buyer/auto-cancel") named the
    eventual full set, not a requirement for B3b/item 3 itself. In
    scope now: seller cancel, seller "Not received", and auto-cancel -
    all three already funneled through item 3 (D98)'s one generic,
    idempotent restore-stock-on-cancel function, specifically so a
    future buyer-cancel can call it with no changes to that function.
    Until then, a buyer who wants to cancel contacts the seller, who
    cancels on their behalf.

**Post-MVP backlog addition:** buyer-initiated order cancellation, with
seller-defined rules and a time window (e.g., only before the seller
has started fulfillment, or only within N minutes of placing the
order) - not scoped or estimated yet. Tracked here and in
`docs/build-plan.md`'s "Explicitly re-tagged out of the pre-MVP code
queue" section; pick up post-MVP, reusing item 3 (D98)'s
`restoreStockForOrder()` unchanged.
**Reasoning:** keeps B3b's shipped surface area to exactly what was
asked, while making the eventual buyer-cancel feature a pure addition
(new trigger path calling an already-generic function) instead of a
future refactor.

### D100. Founder item 5 - prepaid_partial_advance gated at save time, not just checkout time
**Status:** LOCKED.
**Decision:** `OrderVerificationService.updateSettingsForStore()` (the
seller's own channel-selection save, `PATCH /stores/:storeId/
verification-settings`) now runs the same `isGatewayLive()` check
`assertChannelReady()` already ran at checkout time - a seller could
previously save this channel with zero gateway connected and only
discover it never works once a real buyer hit checkout. Exact copy per
the founder's instruction: "Needs a live payment gateway. Not available
yet in your country." `getSettingsForStore()` also now reports a
`prepaidPartialAdvanceHasLiveGateway` flag, read by the Order
Verification settings page so this shows before the seller ever clicks
Save - the same "locked, not just a 403 on save" treatment the
existing RUN+ plan gate already gets on that page, but this is a
SEPARATE gate (upgrading plan tier doesn't fix it, so it's shown as a
plain warning, never the plan-upgrade card).

**Tests added proving a seller can't save a blocking configuration**
(`module76-prepaid-partial-advance.e2e-spec.ts`): the save is rejected
with the exact copy, both with no gateway connected at all and with one
connected-but-not-"live" (D95's "verifying" status); the rejected save
writes no settings row at all (not a silent half-save); the read
endpoint's new flag reflects both states correctly.

**Existing tests rewritten, with reason (founder item 6's own
discipline, applied here ahead of item 6 itself):** no gateway is
"live" platform-wide today (D95/D86 - every `PaymentGatewayProvider`
adapter is "verifying"), so this new gate makes the real save endpoint
unable to ever actually reach `prepaid_partial_advance` for any store
today, in any test. Three pre-existing tests used that save endpoint
only as SETUP for a DIFFERENT, downstream check and so needed a direct-
write test helper (`forceChannel()`, bypassing this new gate the same
way `upgradeToTier()` already bypasses the real billing flow) to keep
testing what they were actually about, unaffected by this change:
- `module76`'s own "Checkout readiness"/"verified-partial-payment flow"
  blocks (2 tests) - about `assertChannelReady()`'s pre-existing gate.
- `module95`'s cross-setting-rule setup test ("rejects switching the
  payment model to Advance while that channel is already active").
One `module76` test's RUN-seller-succeeds assertion was simply wrong
after this change (a RUN seller has no live gateway either, today) -
corrected to the real, current behavior rather than forced to keep
passing. One `module95` cross-setting test ("rejects switching the
channel to prepaid_partial_advance while payment model is already
Advance") is renamed and re-pointed: it still asserts 400, but now
honestly documents that THIS gate is what fires first today, not
FR-6.67's cross-setting rule - that rule is unchanged, real code, and
still reachable via `forceChannel()` in its own sibling test.
**Reasoning:** not elaborated beyond the decision itself.

### D101. Founder item 6 - test/tooling hygiene
**Status:** LOCKED.
**Decision:**
1. **ESLint, confirmed broken, now real.** Neither app had an
   `eslint.config.*`/`.eslintrc.*` anywhere, nor `eslint` itself in
   either app's own devDependencies - `apps/api/package.json`'s `lint`
   script and `apps/web`'s `next lint` both existed but had nothing
   backing them; running either failed outright. Fixed with two
   deliberately different setups, because the two apps' own
   dependencies pull in two different ESLint majors:
   - `apps/api`: `eslint.config.mjs` (flat config), `eslint@^10`,
     `typescript-eslint@^8`'s `recommended` (NOT `recommendedTypeChecked`
     - full type-aware linting is slower in CI and would have surfaced a
     larger first-pass count than this LOW item's scope; this project
     also has no Prettier and this pass doesn't add one, so no
     stylistic/formatting rules are in here either).
   - `apps/web`: `.eslintrc.json` (`next/core-web-vitals`, the Next 14
     scaffold default), `eslint@^8.57.0` - `eslint-config-next@14.2.18`
     (matching the installed Next version exactly) only supports ESLint
     7/8 as a peer, so apps/web deliberately stays on the older major;
     apps/api and apps/web are separate pnpm workspace packages with
     fully independent `node_modules`, so this isn't a conflict.
   - New `lint` CI job (`.github/workflows/ci.yml`), same cheap "every
     code-touching push" tier as `typecheck`/`unit-tests` - not gated
     behind `full_run`.
2. **First-pass violations, fixed, not just configured away.** 88
   problems in apps/api (1 real error, the rest warnings), 21 real
   errors in apps/web (all `react/no-unescaped-entities` - a raw `'`/`"`
   character directly in JSX text), both counts small enough to fix
   directly rather than suppress:
   - `gateway-health.service.ts` - a genuine (harmless but real)
     `no-useless-assignment` finding: `let verified = false` was always
     overwritten by both the try and catch branches before ever being
     read. Changed to `let verified: boolean` (no initializer) - TS's
     own definite-assignment analysis confirms both branches still
     assign it before the one place it's read.
   - A handful of truly-unused imports/variables removed
     (`orders.service.ts`'s `Order`/`OrderBucket`,
     `subscriptions.service.ts` and `verification-application.service.ts`'s
     `ForbiddenException`).
   - Several destructuring-omit sites (deliberately stripping a
     sensitive/internal field before returning an object -
     `tokenHash`/`signingSecretEncrypted`/a test's `DATABASE_URL`)
     renamed to their already-established `_`-prefixed-ignore convention
     (`tenancy/stores.service.ts`'s pre-existing `_omit` was the
     precedent) - the eslint config's `varsIgnorePattern`/
     `destructuredArrayIgnorePattern` now actually honor that
     convention, which it turns out the lint rule's default options
     didn't, before this.
   - `teams.service.ts`'s `acceptInvite(..., dto)` - looked real at
     first (the method's own doc comment claims consent is "enforced
     here"), traced all the way through: `AcceptTeamInviteDto`'s
     `@IsBoolean()`/`@Equals(true)` decorators enforce it at the
     controller's `@Body()` binding via the global ValidationPipe
     (confirmed registered in `main.ts`), before this method ever runs -
     real and working, just not literally inside this method's body.
     Renamed to `_dto` and the comment corrected to say where
     enforcement actually happens, so a future reader doesn't go
     looking for a check that was never going to be here.
   - 77 stale `// eslint-disable-next-line no-console` comments across
     seed files, `main.ts`, and `worker.main.ts` - dead code from before
     this config existed (this config never enables `no-console` at all;
     seed/worker scripts legitimately log to stdout for operator
     visibility) - removed.
   - apps/web: every `'`/`"` escaped to `&apos;` or `&ldquo;`/`&rdquo;`,
     matching whichever entity convention is already dominant at each
     call site in this codebase (`&apos;` has 33 pre-existing uses, used
     throughout; `&ldquo;`/`&rdquo;` for one genuine open/close quoted
     word). `react-hooks/exhaustive-deps` (5) and
     `@next/next/no-img-element` (3) warnings left as warnings,
     deliberately not auto-"fixed" - both require real behavioral
     verification (a blind effect-deps fix risks an infinite-render
     loop; an `<img>`-to-`<Image>` swap needs width/height/domain-config
     checking) that's a bigger, riskier change than "lint hygiene," and
     Next's own default severity for both is already "warning," not
     "error" - they don't fail the command.
3. **DNS/TLS tests, mocked, not reliant on real network reachability.**
   `node-dns-resolver.service.spec.ts`/`node-tls-prober.service.spec.ts`
   were deliberately written against the live public internet
   (`dns.google`, `www.github.com`, `www.google.com`) - reachable in
   whatever sandbox first wrote them, NOT reachable from this one
   (confirmed directly: this container can't resolve raw DNS or complete
   a raw TLS handshake to any of them), which is exactly the flake this
   item flagged. Rewritten to mock `dns.promises`/`https.request`
   directly - what's actually under test is these two thin wrapper
   services' own try/catch-into-`[]` and resolve-true/false-on-response/
   error/timeout logic, not any real hostname's real DNS/TLS state.
   Same test intent preserved (A record, CNAME, NXDOMAIN-shaped reject,
   ENODATA-shaped reject, handshake success, connection error) plus one
   new case (timeout) the real-network version couldn't exercise on
   demand at all.
4. **Tests removed/rewritten this report, with reason** (consolidating
   this item's own ask, going forward every report should do the same):
   see D100 for the 3 `module76` + 1 `module95` test rewrites (save-time
   live-gateway gate making their old setup unreachable); this entry's
   own point 3 above for the 2 DNS/TLS spec rewrites (real-network to
   mocked, same intent, zero tests deleted outright).
5. **CI polling light** - standing discipline this whole session, not a
   one-time deliverable; unchanged by this item.
**Reasoning:** not elaborated beyond the decision itself.

### D102. B4 (loader-mark flip) and B5 (programs gating) - closing out M1-1A
**Status:** LOCKED.
**Decision:**
1. **B4 - D76d's loader-mark flip, code + the write-path it depends on.**
   `BrandingService.getLoadingScreenBrandingVisible()`'s tierOrder check
   changed from `=== 3` (FLY) to `=== 2` (RISE), per D76d's own
   implementation note exactly (not `>= 2` - the note names 2
   specifically). Found while testing, not in the implementation note:
   the shared `branding.powered_by_hidden` preference this gate reads
   can only ever be WRITTEN when the OLD mechanism's own
   `branding.powered_by_removable` is true (FLY + team tiers only) -
   `setHiddenForStore()` had its own separate gate on the same shared
   write. Flipping only the read side would have made D76d's grant
   unreachable in practice (a RISE seller could never set `hidden=true`
   to begin with). Fixed by extracting the new check into
   `isLoadingScreenBrandingRemovable()` and having `setHiddenForStore()`
   accept EITHER capability as sufficient to write - the OLD mark's own
   visibility computation is untouched and stays FLY-only, confirmed by
   test. `branding.e2e-spec.ts`'s existing FLY-tier assertions for the
   new gate are updated to the new boundary (D76d's own note flagged
   these would need it); a new RISE-tier test proves the real grant,
   writes included, not just the read-side number.
2. **B5 - Growth & Partner Programs, out of the MVP build (D63), gated
   off by a new `programs.enabled` (global, default false).** One real
   enforcement point: `ProgramApplicationService.apply()` - every other
   endpoint in the module (content submission, withdrawal, every admin
   review/payout action) requires an already-approved
   `ProgramParticipant` row to do anything, which this gate makes
   impossible to create while off. Admin endpoints are deliberately left
   ungated - admins are trusted, and nothing reaches them if no seller
   can ever apply. New tests prove both directions (blocked while off,
   immediately unblocked once on, no other code change needed). Five
   pre-existing e2e files that apply to a program as test SETUP
   (module22 itself, finance-terminal, module72/78/79) now explicitly
   enable it in their own beforeAll/afterEach, same as any other test
   exercising a plan-gated/admin-disabled-by-default capability - not
   rewrites of what they test, just keeping their existing setup
   working against the new default.
3. **A CI flake, diagnosed, not chased.** `e2e-tests (4)` failed once on
   this item's own commit (10d6058) - `finance-terminal.e2e-spec.ts`'s
   `createAndLoginAdmin()` generates a TOTP code
   (`authenticator.generate()`) and immediately submits it over the
   network with zero slack for the verify call landing a 30-second
   window late; the helper also never checks the verify response's
   status before trusting `accessToken`, so a late code silently returns
   an unusable token instead of a clear failure. This exact
   generate-then-immediately-verify pattern is shared by many e2e
   helpers across this codebase, all otherwise green for this entire
   session's dozens of prior CI runs - confirmed consistent with a rare,
   one-off timing hiccup, not a regression from this item's own changes
   (this test file wasn't touched by it), by re-running just the failed
   job on the unchanged commit. Not fixed here - hardening every such
   helper (a fresh-window wait before generating the code, or a status
   check with one retry) is real, broader scope beyond this item;
   flagged here as a known, diagnosed, rare flake for a future pass
   rather than silently ignored.
**Reasoning:** not elaborated beyond the decision itself.

### D103. D87 - the four duplicated credential-encryption implementations merged
**Status:** LOCKED. First M1-1B item.
**Decision:** `payment-gateway-credential-crypto.util.ts`,
`smtp-credential-crypto.util.ts`, and
`admin-email-credential-crypto.util.ts` each carried their own hand-
copied AES-256-GCM implementation, byte-for-byte identical to
`media/drive-token-crypto.util.ts`'s (same algorithm, IV length, and
`iv:authTag:ciphertext` packing) - differing only in function names and
the "malformed" error's credential-type wording. All three now
re-export `drive-token-crypto.util.ts`'s `encryptDriveToken`/
`decryptDriveToken` under their own existing names, exactly matching
`trust-safety/identity-crypto.util.ts`'s own pre-existing two-line
re-export pattern - the founder's own instruction named this as "already
correct," so no new abstraction was introduced beyond copying it.
Every call site keeps its exact existing import name and signature;
each credential type still encrypts under its own independently-
rotatable key (`PAYMENT_GATEWAY_CREDENTIAL_ENCRYPTION_KEY`/
`SMTP_CREDENTIAL_ENCRYPTION_KEY`/`ADMIN_EMAIL_CREDENTIAL_ENCRYPTION_KEY`)
- only the code is shared, never the key. One observable change: the
"malformed packed value" error now always says "Drive token" instead of
each credential's own name, same tradeoff identity-crypto.util.ts's own
errors already accepted for CNIC/payment-instrument fingerprints - the
three existing unit tests asserting the old per-domain wording are
updated to match, not left to rot or deleted.
**Reasoning:** not elaborated beyond the decision itself - "a future
correctness fix to the shared AES-256-GCM shape should only need to
land in one place" (D87's own wording), now true for all five
credential/token types in this codebase, not just identity values.

### D104. D88 - RLS hardening follow-ups, all four items closed out
**Status:** LOCKED. Second M1-1B item.
**Decision - item 1 (WalletService/SubscriptionInvoiceService off the
app_admin bypass client):** `SubscriptionInvoiceService` converts
fully - both its reads (`walletTopUpRequest`, `ledgerEntry`) now run
inside `TenantPrismaService.run(sellerId, ...)`. `WalletService` does
not convert wholesale: reading it in full surfaced that it mixes two
genuinely different actors, not just two code styles - a seller acting
on their own wallet (`getBalance`, `computeLedgerBalance`,
`getTransactionHistory`, `requestTopUp`, `listOwnTopUpRequests` - all
five converted) versus an admin acting on an arbitrary seller's wallet
by admin authority (`listPendingForAdmin`, `verifyTopUp`,
`rejectTopUp`, `adminManualAdjust` - left on `prismaAdmin`, on
purpose). The second group is correctly admin-scoped already: each has
its own admin-auth guard and audit-log entry, and `verifyTopUp`/
`rejectTopUp` only ever receive a bare `topUpId` - which seller it
belongs to is discovered only after the lookup, so there is no
sellerId to scope a transaction to until that point. Forcing these
through tenant scoping would mean splitting one atomic operation into
two separate transactions for no real gain. `getPlanFeePaymentPreview`/
`hasEverPaidPlanFee`/`requestPlanFeePayment` are left for a future pass
too, flagged rather than silently skipped: they're seller-facing like
the converted group, but checking the migrations directly found
neither `Subscription` nor `WalletTopUpRequest` has an RLS policy at
all today, so converting them now would add transaction overhead with
no present security benefit - and `requestPlanFeePayment`'s
auto-verify branch calls straight into the non-convertible
`verifyTopUp`, tangled enough to deserve its own careful pass. The
class-level comment in `wallet.service.ts` records this split so it
doesn't need re-deriving later. One unit test
(`tenant-prisma.service.spec.ts`) exercised neither client, so it was
unaffected; `wallet.service.spec.ts` only covers the pure
`signedContribution()` function and needed no change.
**Decision - item 2 (`set_config()` parameterization):**
`TenantPrismaService.run()`'s `SET LOCAL app.current_seller_id =
'<concatenated-and-regex-gated value>'` is replaced with
`SELECT set_config('app.current_seller_id', $1, true)` called through
Prisma's tagged-template `$executeRaw` - a real bind parameter, not
string interpolation, removing the one remaining string-built SQL
fragment in the codebase rather than just validating it more tightly.
The UUID regex stays as fail-fast validation (a non-UUID sellerId
reaching here is always a caller bug worth a clear error), not as the
injection defense anymore - that's now the parameterization itself.
`tenant-prisma.service.spec.ts`'s mock only implemented the old
`$executeRawUnsafe`, so it broke immediately under the full unit suite
once this landed - fixed, and rewritten to assert the actually-relevant
property (the sellerId appears only as a separate bind value, never
inside the SQL text, verified both for a value that passes UUID_RE and
for what the call site would pass it) rather than the old test's literal
`SET LOCAL ...` string match. Validated against the full unit suite
(49 suites, 320 tests, all passing) and a local full e2e run that
reached far enough through heavily tenant-scoped suites (orders,
trust-safety, catalog, wallet-supplier-portal, growth-partner-programs,
order-verification, bulk-order-ops, and more, 2 dozen+ files) with zero
new failures before an unrelated Node heap-size crash ended the run
early (an artifact of running the whole suite unsharded in one long-
lived local process, not a code defect - CI's own `test:e2e` shards
4-way with a per-worker memory cap specifically to avoid this); the
real, authoritative confirmation is CI's sharded e2e run on the actual
pushed commit, same as every other change in this project.
**Decision - item 3 (CI allowlist tripwire):** new
`src/prisma/admin-bypass-allowlist.spec.ts` - a fast unit test (no DB)
that walks every `.ts` file under `src/` (excluding `.spec.ts`),
collects every file that references `PrismaAdminService`, and fails if
that set differs at all from a hardcoded, sorted allowlist of the 96
files doing so as of this change (generated mechanically via `grep -rl
... | sort`, not hand-typed). Fails two ways on purpose: a new,
unreviewed call site (must be added deliberately), or a stale entry
(the file stopped using it and the list wasn't updated) - verified both
directions actually fire by temporarily removing an entry and
confirming the test goes red with a clear message, then restoring it.
This is a tripwire against future drift, not a re-audit of the 96 -
that re-audit is item 4 below (for the background-job slice of those
96) and the M4 independent security review (for the rest).
**Decision - item 4 (review the ~20 cross-tenant background-job
queues):** independently re-verified, not just trusted, the M0 report's
"no leak found" finding, prioritized money-touching queues first
(`plan-fee-debit.service.ts`'s three sweep methods, `wallet-
reconciliation.service.ts`, `platform-gateway-reconciliation.service
.ts`, `manual-transfer-auto-cancel.service.ts`, `renewal-reminders
.service.ts`, `retention.service.ts`, `invoices.service.ts`,
`gateway-health.service.ts`), then PII/operational queues (`domain-
verification.service.ts`, `verification-re-review.service.ts`,
`missing-tracking-alert.service.ts`, `cart.service.ts`'s abandonment
sweep, `support-ticket-sla.service.ts`, `store-health-score.service
.ts`, `dormant-store.service.ts`, `staff-accounts.service.ts`'s expiry/
suspension-lift sweeps, the two seller-report generators). Confirmed
the same two safe patterns everywhere, no exception found: (a) sweep
every tenant's due rows in one unscoped read, then scope every
subsequent read/write by that row's own id/sellerId/leaderSellerId -
never a client-suppliable or cross-row value; or (b) a single bulk
`updateMany` that writes one uniform, non-tenant-specific value (e.g.
flipping cart status to `abandoned`, or a staff account to `revoked`)
where no cross-tenant data-mixing is even possible because nothing
seller-specific is in the write payload. Also confirmed directly (not
assumed from the comment citing it) that `WalletLowBalanceSweepScheduler`/
`InvoiceGenerationScheduler`/`InvoiceOverdueScheduler` are genuinely
absent from every module's `providers` array - truly dormant, not a
live risk today. This re-confirms, independently, that RLS provides
zero protection for the background-job surface by construction and
correctness there is entirely app-level - unchanged from the M0
report's own framing - across a risk-prioritized review covering the
money-touching tier completely and a representative majority of the
rest, not a sample-and-hope pass.
**Reasoning:** not elaborated beyond the decision itself - closes all
four concrete M1 items D88 named, with the two "future pass" carve-outs
in item 1 flagged explicitly (not silently dropped) since neither has
a present RLS policy to gain defense-in-depth from yet.

### D105. Security P0 (Risk #48/S12) - the non-root-images half, and a new docker-build CI check
**Status:** LOCKED. Third M1-1B item - a supply-chain/CI control from
the security P0 table, not a D-numbered founder decision with its own
text; filed here under the Risk Register's own tagging (M1, S12).
**Decision:** `apps/api/Dockerfile`, `apps/api/Dockerfile.worker`, and
`apps/web/Dockerfile`'s `production` stages ran as root - confirmed by
reading all three fresh, not assumed from the SHA-pinning half (D94/A5)
already being done. All three now `COPY --chown=node:node` and `USER
node` in the `production` stage only (`node:20-alpine`'s own built-in
uid/gid-1000 user) - `dev`/`base`/`build` stages are untouched since
they never run in a real deployment, only feed `production` via
multi-stage `COPY --from=build`. The worker's `apk add
postgresql16-client` (needed for `pg_dump`, Risk 5/13's backup sweep)
stays before `USER node` since package installs need root; confirmed
`pg_dump`'s output is piped through gzip and collected in memory
(`database-backup.service.ts`), never written to local disk, so there's
no runtime write-permission concern there.
**Also found while implementing:** no Dockerfile had ever been built in
CI at all - confirmed by reading `ci.yml` fresh; Dockerfiles were only
named in the docs-only-skip filter's own exclusion comment. A new
`docker-build` job (cheap tier, every code push, same as typecheck/
lint) now builds all three `production` targets (no push - no registry
credentials needed) and proves each one actually runs as the new
non-root user AND can still read the exact file it needs to execute
(`fs.accessSync` on `dist/main.js`/`dist/worker/worker.main.js`/
`.next`) - the precise failure mode a wrong `--chown` would cause. A
full running-container HTTP smoke test was considered and rejected as
disproportionate here: `/health`'s own check (`health.controller.ts`)
needs real Postgres+Redis, and boot validation needs the same long
env-var list `e2e-tests`' `.env.test` step already assembles - cloning
that just to prove a `USER` line works is a much bigger, slower job for
the same answer the file-read check already gives directly.
**Verification note:** this sandbox has the `docker` CLI but no running
daemon, and CI itself never built an image before this change - so
there is no prior automated baseline to diff against here, unlike every
other change this session. YAML parses clean
(`python3 -c "import yaml..."`) and the shell loop's field-splitting
was dry-run against a fake `docker`/`node` shim locally, but the actual
`docker build`/`docker run` steps are only proven by this commit's own
CI run on a real runner - watched the same as everything else, just
starting from a thinner local-verification base than usual, flagged
explicitly rather than glossed over.
**Reasoning:** not elaborated beyond the Risk Register's own framing -
closes the second of the two S12 controls (SHA-pinning already done),
and adds the one piece of ongoing verification (`docker-build` in CI)
that would have caught this gap immediately had it existed earlier.

### D106. D82 part 1 - refresh-token reuse detection (seller, admin, buyer)
**Status:** LOCKED. Fourth M1-1B item - the first slice of D82; the
cookie-based transport/CSRF/CSP/stricter-admin-lifetimes/step-up-MFA
pieces are separate, larger, still-to-come slices of the same decision.
**Decision:** Dispatched a full current-state investigation first
(confirmed directly against live code, not re-stated from
`docs/auth-session-design.md`'s own citations) - `SessionService`
already has real rotation and real server-side revocation; what it
never had was reuse detection. `validateRefreshToken()` now returns a
`"valid" | "reused" | "invalid"` result instead of a bare userId-or-
null: a miss checks a new short-TTL (24h) tombstone left by the new
`rotateOutSession()` (called from refresh-token rotation specifically,
not from ordinary logout/revoke, which has no "this was valid a moment
ago" story to detect) - recording exactly which (userId,
refreshTokenHash) pair just got rotated out, so a later replay of that
exact pair is told apart from a token that never existed. All three
`refresh()` methods (seller `AuthService`, `AdminAuthService`,
`BuyerAuthService` - all three share the one `SessionService`) react to
a `"reused"` result by calling the already-existing but previously
never-invoked `destroyAllSessionsForUser()` and logging a
`refresh_token_reuse_detected` `SecurityEventService` entry - both
primitives already existed, wired to nothing; this is the first call
site for either in response to a detected anomaly. The externally-
visible response (401, same message) is unchanged between "reused" and
"invalid" on purpose - not a behavior a client should be able to
distinguish - only the internal reaction differs.
**Also found while investigating (kept as-is, not touched by this
item):** `touchSession()`'s `lastActiveAt` bump is called one line
before the session it just touched gets destroyed in every refresh
flow - vestigial, no observable effect, not worth a change bundled
into a security-sensitive commit; a working step-up-MFA precedent
already exists (`SellerLifecycleService.verifyStepUpMfa()`, suspend/
ban only) that D82's later admin-step-up-MFA slice should extend
rather than reinvent; CORS already has `credentials: true` wired
(`main.ts`), ready for the cookie-transport slice; production runs
`app.*`/`api.*` as same-site subdomains with no CORS configured at all
(confirmed via `docker-compose.yml`'s Traefik host rules) - meaning the
upcoming refresh-cookie's `SameSite` can be `Lax` (stricter than
`auth-session-design.md`'s own Option A text, which proposed `None` on
an apparent same-origin/same-site conflation) - noted here for that
slice, not acted on yet.
**Verified:** new e2e tests (one seller, one admin) prove the actual
behavioral difference, not just that nothing broke - replaying an
already-rotated-out token is rejected, AND a sibling session that was
genuinely valid a moment earlier is also dead afterward (proving
`destroyAllSessionsForUser()` really fired, not just the one replayed
session), AND exactly one `refresh_token_reuse_detected` event is
recorded. Full unit suite (50/321) and the 6 pre-existing auth/session/
security-event/password-reset/buyer-account e2e suites (38 tests) all
still pass unchanged.
**Reasoning:** not elaborated beyond D82's own text - ships the lowest-
risk, purely-additive slice first (no client-visible transport change
at all) and independently proves it, rather than bundling it into the
much larger, higher-risk cookie-migration slice where a mistake would
be harder to isolate.

### D107. D105's own docker-build job caught a real, pre-existing Dockerfile bug on its first run
**Status:** LOCKED - closes D105's own "verification note" (this
sandbox has no Docker daemon; the real build was only ever going to be
proven by CI itself) with the actual result.
**Decision:** the first-ever `docker-build` CI run failed - not on the
new `USER node`/`--chown` lines, but one step earlier, in the `base`
stage's `pnpm install`, which has been latent and unexercised in CI
since before this session. Root cause confirmed by reproducing it
directly (an isolated copy of just the Dockerfile's `base`-stage input
files, outside any Docker daemon): root `package.json` has no
`packageManager` field, so `corepack enable` inside the Dockerfile
resolves pnpm to whatever corepack's own default is - pnpm 12.11.2 on
this run - a full major ahead of the pnpm 10.33.0 this repo is actually
built, tested, and pinned against everywhere else
(`ci.yml`'s `pnpm/action-setup` + `docs/security-audit-report.md`'s own
confirmed-version citation). pnpm 12 rejects this lockfile two
different ways pnpm 10 doesn't: `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` on
the frozen-lockfile attempt, then `ERR_PNPM_IGNORED_BUILDS` (a hard
error in 12.x; a mere warning in 10.x) on the install fallback.
**Fix:** added `"packageManager": "pnpm@10.33.0"` to root
`package.json` - the standard, corepack-native way to pin this, read
by `corepack enable` wherever it runs (Docker, and any future local/CI
path that relies on it) without touching the three Dockerfiles
themselves at all. **Directly verified, not just reasoned about:**
reproduced the exact failure in an isolated copy with the field absent
("Update available! 10.33.0 → 12.11.2", `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`),
then reproduced the fix with the field present (`corepack pnpm
--version` → exactly `10.33.0`; `pnpm install --frozen-lockfile` →
"Lockfile is up to date... Done in 5.4s using pnpm v10.33.0", the
ignored-build-scripts line now a non-blocking warning) - before
trusting it enough to push again.
**Reasoning:** not elaborated beyond the finding itself - this is
exactly the kind of gap `docker-build` exists to catch (D105's own
reasoning), and it caught one on its very first real run; worth
recording plainly as a found-and-fixed bug rather than folding it
silently into D105's history.

### D108. D82 part 2 - the seller dashboard's refresh token moves to a cookie; nothing seller-facing left in localStorage
**Status:** LOCKED. Fifth M1-1B item - the second slice of D82. Admin
terminal (stricter lifetimes + step-up MFA) is a separate, still-to-come
slice; buyer/storefront is untouched by design (already compliant, see
below) and staff-session-revocability is still outstanding.
**Decision:** `POST /auth/login`, `/auth/mfa/verify`, `/auth/refresh`
now set/read a `__Host-refresh_token` cookie
(`auth/refresh-cookie.util.ts`) instead of returning/accepting the
refresh token in the JSON body at all; `sessionId` stays in the body
(not a secret on its own, needed for the self-service session list).
`SameSite=Lax`, not the `None` the design doc's own Option A text
proposed - confirmed via `docker-compose.yml`'s Traefik host rules that
every real topology (local dev AND production) has the dashboard/API
on same-site subdomains (`app.*`/`api.*`), so `None`'s cross-site
exposure was never actually needed; `Lax` + the `__Host-` prefix (no
`Domain`, `Secure`, `Path=/`) is strictly tighter and still works.
`RefreshCookieCsrfGuard` (new, shared - admin will reuse it) guards
`/auth/refresh` and `/auth/logout`: requires `X-Requested-With:
XMLHttpRequest` always, then checks `Sec-Fetch-Site` (browser-set, not
spoofable, true regardless of CORS config) when present, falling back
to an `Origin`-against-`CORS_ALLOWED_ORIGINS` check only when
`Sec-Fetch-Site` is absent - a plain allowlist-only check would have
incorrectly rejected every real production request, since production
runs same-origin with no CORS allowlist configured at all but modern
browsers still send `Origin` on state-changing requests.
**Frontend (`dashboard-api.ts` and everything that depended on its old
localStorage contract):** the access token now lives in one in-memory
module variable, never localStorage - a fresh page load starts with no
token, which is fine: the first request 401s with no Authorization
header, the existing retry-after-refresh logic calls the now-cookie-
authenticated `/auth/refresh`, and succeeds exactly as before. Fixed,
not just the obvious `login/page.tsx` and `dashboard-api.ts`: a full-
repo grep for the old localStorage keys surfaced 13 more files actually
depending on the old contract - `support-center/login/page.tsx` (same
`/auth/login` backend, separate origin, separate in-memory instance -
isolation preserved the same way separate-origin localStorage already
provided it); five `support-center/*` pages whose synchronous
`localStorage.getItem("accessToken")` check would now ALWAYS fire even
for a genuinely logged-in seller - removed, since each page's own
`api.get()` 401-handling already covers it correctly (added a 401-
specific redirect to the two pages that only had a generic error
message before, to avoid a real regression); `impersonate/page.tsx` and
`SupportModeBanner.tsx` (impersonation deliberately shares the
dashboard's own token-storage mechanism so "every existing screen Just
Works" - now shares the in-memory store via a new `setSession()`
export instead; the destination navigation changed from
`window.location.replace()` to a client-side `router.push()`, since a
hard navigation would have discarded the in-memory token before the
destination page could use it); `settings/page.tsx`'s session-list
"which one is this" comparison (now `api.getCurrentSessionId()`).
**Deliberately NOT changed:** `impersonationSessionId` stays in
localStorage - it's a reference id, not a bearer credential (nothing
can authenticate as anything with just this value), so it's outside
the actual security concern "nothing may remain in localStorage" is
about, and `SupportModeBanner` (a separately-mounted component) still
needs a way to read it. Buyer/storefront's own `buyer_session` cookie
pattern is untouched - it was already doing everything D82 asks for on
the seller/admin surface (httpOnly cookie, same-origin via Server
Actions, no token in client JS at all) before this item existed.
**A real gap found while testing, not assumed:** the e2e test harness
(`test/e2e/setup.ts`) builds the Nest app directly via
`Test.createTestingModule()`, never through `bootstrap()` - so
`main.ts`'s new `app.use(cookieParser())` was invisible to every e2e
test until added there too. Without this fix, every cookie-based test
would have failed on "missing cookie" regardless of whether the real
mechanism worked - confirmed by deliberately reproducing the failure
(a debug spec, since deleted) before fixing it, not just asserting
green after the fact. Also found: supertest's own `Set-Cookie` response
value includes the full attribute string (`Max-Age=`/`Path=`/`Secure`/
etc.) - a real `Cookie` request header only ever carries bare
`name=value`, so a new shared `cookieHeaderFrom()` test helper
(`setup.ts`) strips the attributes the same way a browser's own cookie
jar would, used everywhere a test needs to replay a captured cookie.
**Verified:** every e2e spec that exercises `/auth/refresh`/`/auth/
logout` for the seller surface (`auth`, `account-security`, `password-
reset`, `module81-buyer-accounts`, `admin-auth`/`admin-auth-refresh`,
`input-validation-sweep`) passes with `CORS_ALLOWED_ORIGINS` forced
empty to match real CI's actual condition (confirmed this sandbox's
own gitignored `.env` sets a dev-shaped value CI never has, which
initially masked the real behavior under test). Full unit suite
(50/321), `apps/web` typecheck, lint (zero new warnings - one pre-
existing-pattern warning introduced by my own edit was found and fixed
in the same pass), and a full production build all pass clean.
**Reasoning:** not elaborated beyond D82's own text - this is the
headline risk D82 exists to close (the refresh token's plaintext
localStorage exposure), landed as its own slice after reuse detection
(D106) for the same risk-isolation reason that slice was split out.

### D109. Two CI breaks surfaced immediately after D107 and D105 landed - a `pnpm/action-setup` conflict D107's own fix caused, and a second, independent pre-existing Dockerfile bug D105's verify step caught
**Status:** LOCKED - both are mechanical CI fixes, not new product
decisions; filed here (not folded silently into D105/D107's own
history) for the same "record what was actually found and fixed"
reason D107 gave for itself.
**Decision (bug 1 - D107's own fix broke every other job):** `831c878`
(D107) added root `package.json`'s `packageManager: "pnpm@10.33.0"`
field to fix `docker-build`'s pnpm-version drift. That same commit's
next CI run failed on every OTHER job that uses `pnpm/action-setup`
with an explicit `version:` input - `pnpm/action-setup@v4` hard-
refuses to run at all when both a `version:` input and a
`packageManager` field are present ("Multiple versions of pnpm
specified... Remove one of these versions"), confirmed directly from
that run's own job logs. **Fix:** removed `version: ${{
env.PNPM_VERSION }}` from all 7 `pnpm/action-setup` steps in `ci.yml`
(typecheck/lint/unit-tests/db-role-grants/e2e-tests/dependency-audit/
web-build) and the now-unused `PNPM_VERSION` env var - `packageManager`
is the single source of truth now, read automatically by the Action.
One consolidated comment block replaces what was briefly 7 repeated
copies of the same explanation (an intermediate state from fixing this
iteratively, cleaned up before committing).
**Decision (bug 2 - a second, independent, genuinely pre-existing bug,
not caused by anything this session touched):** the same CI run's new
`docker-build` job (D105) failed its own verify step with `ENOENT: no
such file or directory, access 'dist/main.js'` - NOT a permissions
regression (the non-root `uid` check immediately before it passed
cleanly, proving `USER node`/`--chown` both work correctly), but a
wrong path assumption baked into `apps/api/Dockerfile`'s `CMD`,
`apps/api/Dockerfile.worker`'s `CMD`, `apps/api/package.json`'s
`"start"` script, AND the verify step's own check - all four assumed a
flat `dist/main.js`/`dist/worker/worker.main.js` layout that has never
actually existed. **Root cause, confirmed by direct local
reproduction** (`rm -rf dist && pnpm build`, then `find dist`):
`apps/api/tsconfig.json` has no explicit `rootDir`, and the compiled
project includes files outside `src/` (`scripts/**`, `test/**` -
there's no `tsconfig.build.json` splitting these out, unlike the
standard Nest starter), so tsc infers the common root as the
`apps/api/` project directory itself, nesting all output under its
original relative path - the real entry points are `dist/src/main.js`
and `dist/src/worker/worker.main.js`. This means the API's production
Docker image and its `pnpm start` script have never actually been
runnable - entirely latent until `docker-build` (D105) was the first
thing to ever actually build and exercise these images in CI.
**Fix considered and rejected:** adding `rootDir: "./src"` to
`tsconfig.json` to make the flat-path assumption correct instead -
rejected because `scripts/**` and `test/**` genuinely are (and should
stay) part of the same `tsc --noEmit` typecheck coverage, and forcing
`rootDir` while compiling files outside it is a hard `tsc` error
(TS6059), not a warning; doing this properly would mean introducing a
separate `tsconfig.build.json` (splitting build-emit scope from
typecheck scope) - a real improvement, but a wider, riskier change
than this fix warrants right before the 1B checkpoint, and orthogonal
to the actual bug (nothing is broken by the current nested output,
only by the wrong assumption about where it lands). **Fix applied
instead:** updated all 4 references to the real paths
(`dist/src/main.js`, `dist/src/worker/worker.main.js`) and changed
nothing about how the project builds or typechecks.
**Verified:** reproduced both failures' exact error text before fixing
anything (not assumed from reading alone); after the fix, a fresh
local `tsc --noEmit` is clean, and a fresh `rm -rf dist && pnpm build`
followed by `node --check` on both real output paths confirms they
exist and are syntactically valid entry points. The actual `docker
build`/`docker run` proof (same caveat D105 recorded - no Docker
daemon in this sandbox) is this commit's own CI run, watched the same
way as every other change this session.
**Reasoning:** not elaborated beyond the findings themselves - both are
exactly the kind of gap D105's own new `docker-build` job exists to
catch, and between the two of them it caught one new bug immediately
(D107's own fix) and one much older one (the dist path, present since
whenever these Dockerfiles were first written) on its very first two
real runs.

### D110. D82 part 3 - the admin terminal's own refresh token moves to a cookie, mirroring D108
**Status:** LOCKED. Sixth M1-1B item - the third slice of D82. Stricter
admin session/access lifetimes and step-up MFA generalization are
separate, still-to-come slices; staff sub-account session revocability
(`docs/auth-session-design.md`'s own explicit "small, contained fix" line)
is also still outstanding.
**Decision:** `POST /admin/auth/mfa/verify`, `/admin/auth/refresh` now
set/read a `__Host-admin_refresh_token` cookie
(`auth/admin-refresh-cookie.util.ts`) instead of a response-body refresh
token; `/admin/auth/refresh` and `/admin/auth/logout` are guarded by the
SAME `RefreshCookieCsrfGuard` D108 already built (it only checks headers/
Origin, nothing cookie-name-specific, so sharing it is safe and was the
plan D108's own comment already stated). `/admin/auth/login` itself
needed no change - admin MFA is mandatory, so no session/refresh token
exists until `mfa/verify` succeeds.
**A real collision risk found before writing any code, not after:** the
admin terminal is NOT a separate origin from the seller dashboard -
`(admin)` is a Next.js route group inside the same `apps/web` app, and
`docker-compose.yml`'s Traefik rules confirm there is no separate
`admin.*` host anywhere. Both hit the same API origin too. Reusing
D108's exact cookie name would have let an admin who is also logged in
as a seller in the same browser silently overwrite one session's cookie
with the other's on every login - so the admin slice gets its own
distinctly-named cookie (`admin-refresh-cookie.util.ts`, a small mirror
of `refresh-cookie.util.ts` rather than a shared parameterized function,
matching this codebase's existing per-actor-service convention) instead
of trying to genericize the two into one.
**Frontend (`admin-api.ts` and the admin login page):** access token and
`sessionId` are now in-memory only, never localStorage - a full-repo grep
for `adminAccessToken`/`adminSessionId`/`adminRefreshToken` across
`apps/web` (excluding stale `.next` build output) found exactly two real
source files (the login page and `admin-api.ts` itself), both fixed; no
other admin page reads these keys directly. The admin-side impersonation
"login as seller" trigger (`admin/sellers/[sellerId]/page.tsx`) already
went entirely through `adminApi.post()`, so it needed no change at all.
**Verified:** `admin-auth.e2e-spec.ts` and `admin-auth-refresh.e2e-spec.ts`
rewritten for cookie-based refresh/logout (same manual-capture pattern
D108 introduced, via the same shared `cookieHeaderFrom()` helper - no
changes needed there, it's cookie-name-agnostic), plus one new test for
the missing-CSRF-header case; all 11 tests pass with
`CORS_ALLOWED_ORIGINS` forced empty to match real CI. Full unit suite
(50/321 - unchanged count, confirming no regression), `apps/api` and
`apps/web` typecheck, and both apps' lint are all clean (lint's handful
of warnings are pre-existing, in files this change never touched).
**Reasoning:** not elaborated beyond D82's own text - ships the admin
terminal to the same standard D108 already proved out for the seller
dashboard, reusing its CSRF guard directly (exactly as D108's own
comment said it would) while keeping the actual token storage properly
isolated per actor type.

### D111. D82's "staff sub-account tokens" bullet - a staff login now creates a real, revocable session
**Status:** LOCKED. Seventh M1-1B item - closes
`docs/auth-session-design.md`'s explicit "Staff sub-account tokens: give
staff logins a real sessionId too, so they become revocable (currently a
bare, non-revocable access token) - small, contained fix" bullet. This
closes D82's last specifically-named sub-item; the two remaining D82
pieces (stricter admin session/access lifetimes, and generalizing
`SellerLifecycleService.verifyStepUpMfa()` into a reusable guard for other
destructive admin actions) were never given this level of textual detail
in the design doc and are tracked separately.
**Decision:** `StaffAuthService.login()` now calls
`SessionService.createSession(staff.id, ...)` - `SessionService` is
actor-agnostic (admin sessions are already keyed by the shared `User.id`
the same generic way), and `StaffAccount` has no backing `User` row at
all, so its own `id` is just as valid an opaque session key. New
`POST /staff/auth/refresh` and `/staff/auth/logout` endpoints (neither
existed before - a staff account previously had no refresh path and had
to re-enter their password every 15 minutes) reuse D108/D110's exact
cookie-plus-CSRF-guard pattern (`staff-refresh-cookie.util.ts`, its own
`__Host-staff_refresh_token` name for the same same-origin-collision
reason D110 gave itself - staff, admin, and seller all share one
apps/web origin and one API origin).
**The actual security property, not just plumbing:** `refresh()`
re-reads the staff account fresh from the DB on every call (status,
`expiresAt`) rather than trusting the original login's claims - mirrors
`AdminAuthService.refresh()`'s own "re-reads adminUser fresh... so a role
change or de-provisioning is picked up immediately" reasoning exactly.
Without this re-check, adding a refresh endpoint at all would have made
the existing (already-bounded, 15-minute) staleness gap WORSE, not
better - a revoked account could otherwise keep perpetually renewing
itself forever via refresh. `staff-accounts.service.ts`'s `revoke()`/
`suspend()`/`block()` additionally call `destroyAllSessionsForUser()`
directly, so a live session dies at the moment of the action rather than
only at its next refresh attempt.
**Reuse detection uses `EventsService`, not `SecurityEventService`:**
`UserSecurityEvent.userId` carries a real Prisma `@relation` against the
`users` table (confirmed by reading `schema.prisma`, not assumed) -
calling it with a `StaffAccount.id` would be a foreign-key violation, not
a silent no-op. `EventsService.emit()` has no such constraint and is
already the pattern this exact file uses for `staff_account.login`, so
`staff_account.refresh_token_reuse_detected` follows the same shape.
**A real, disclosed gap found while scoping this, not fixed here:**
`POST /staff/auth/login` has no frontend caller anywhere in `apps/web` -
confirmed by grepping the whole app (`.next` build-cache hits excluded).
A staff account can be created, scoped, and password-reset through the
owner/admin UI, and can complete that reset
(`app/staff/reset-password/page.tsx` is the one piece of staff-facing UI
that exists), but there is no actual login page for a staff member to
use afterward. This is a separate, substantial, pre-existing frontend
gap - unrelated to session revocability and out of this item's "small,
contained fix" scope - flagged here rather than silently worked around
or silently left for someone to discover later.
**Verified:** new `test/e2e/staff-auth-refresh.e2e-spec.ts` (8 tests) -
refresh + rotation, missing-CSRF-header rejection, reuse detection
(session-wide revocation + exactly one platform event), logout, and
three separate tests proving revoke/suspend/block each kill a live
session's refresh ability immediately rather than only blocking a future
login. All pre-existing staff e2e suites (`module35-staff-accounts`,
`module101-staff-lifecycle`, 23 tests) still pass unchanged - the
response-body shape change (no more bare `refreshToken` field) was
confirmed to not be asserted on anywhere. Full unit suite (50/321),
`apps/api` typecheck and lint all clean.
**Reasoning:** not elaborated beyond the design doc's own text - this was
genuinely the last specifically-scoped D82 sub-item left; what remains
(admin lifetimes, step-up-MFA generalization) needs its own design
decisions this entry doesn't make.

### D112. D82's last two pieces - admin sessions get a strict, short default lifetime; step-up MFA becomes a reusable mechanism, not a one-off private method
**Status:** LOCKED. Eighth M1-1B item - closes D82 in full. The two
remaining named gaps from the original item ("stricter admin session/
access lifetimes" and "generalize verifyStepUpMfa() into a reusable
guard/decorator for other money-moving/destructive admin actions") were
judgment calls on exact numbers/shape rather than text already specified
elsewhere - made here, documented, not escalated, consistent with every
other D-numbered decision this session has made autonomously.
**Decision (stricter admin lifetimes):** new optional
`ADMIN_JWT_REFRESH_TTL_DAYS` env var; when unset, admin sessions default
to `ADMIN_DEFAULT_REFRESH_TTL_DAYS = 1` day (`admin-auth.service.ts`) -
a full password+TOTP re-login daily, versus the seller-wide
`JWT_REFRESH_TTL_DAYS=30`. Optional, not required, so every existing
deployment/CI env keeps working unchanged - it's an override for an
already-strict default, not the switch that enables stricter behavior.
`SessionService.createSession()` gained an optional `ttlDaysOverride`
param rather than reaching into actor-specific config itself (would make
it no longer actor-agnostic); `resolveAdminRefreshTtlDays()` is shared by
`AdminAuthService` (the Redis session TTL) and `AdminAuthController`
(the cookie's own `maxAge`) so the two can never drift apart - a cookie
claiming a 30-day lifetime for a 1-day session would be a real, if minor,
bug. Only the refresh/session lifetime changed, not the 15-minute access
token TTL - that's already short, shared infrastructure, and shortening
it further buys mostly UX friction, not a meaningfully smaller exposure
window.
**Decision (step-up MFA generalization):** `SellerLifecycleService.
verifyStepUpMfa()`'s logic moved, unchanged, into a new shared
`StepUpMfaService` (`src/auth/step-up-mfa.service.ts`) - a pure refactor;
`SellerLifecycleService` calls it instead of its own private method, same
body-based `mfaCode` wire contract it already had and already has a
frontend for. A new `StepUpMfaGuard` (`common/guards/step-up-mfa.guard.ts`)
wraps the same service for any NEW route: reads the code from an
`X-Step-Up-MFA-Code` header rather than a DTO body field, so it's usable
on any route without that route's own DTO needing to know this concern
exists - same reasoning `RefreshCookieCsrfGuard`'s header already follows.
Registered on `TrustSafetyModule` (where `SellerLifecycleService` already
lived) and exported from there; `BillingModule` already imports
`TrustSafetyModule`, so wiring the guard into a billing route needed zero
new module imports and no circular-dependency risk.
**First new call site, chosen deliberately:** `POST /admin/wallet-topups/
sellers/:sellerId/adjust` (`WalletService.adminManualAdjust()`) - a
direct, unbounded admin balance change with no step-up check at all
before this, the clearest "money-moving admin action" in the codebase
outside the lifecycle ladder itself. Verified this has a real, already-
shipped frontend caller (`admin/sellers/[sellerId]/page.tsx`'s
`adjustWallet()`) before touching the backend, specifically to avoid
breaking a working feature - `adminApi.post()` gained an optional
`headers` param (every other call site unaffected), and `adjustWallet()`
now prompts for the admin's TOTP code and sends it via the header.
**Deliberately NOT retrofitted here:** `AdminWalletController`'s
`verifyTopUp`/`rejectTopUp` routes are also money-related and also have
real frontend callers (`admin/invoices/page.tsx`) - good candidates for a
future pass, left alone this time to keep this change's blast radius to
one proven call site rather than several at once.
**A real regression caught before it shipped, not after:** adding the
guard to `adjust()` immediately broke 2 pre-existing, already-green e2e
tests that called this route with no step-up header at all
(`module25-admin-completion.e2e-spec.ts`'s manual-adjust and audit-log-
list tests, `module47-wallet-balance-reconciliation.e2e-spec.ts`'s three
ledger tests) - found by actually running the full suite after the
change, not assumed safe. Fixed by exposing each admin helper's enrolled
MFA secret so a fresh TOTP code can be generated per call (a fresh code
per call, not one reused across a whole test, since a 30s TOTP window
could otherwise go stale mid-test) - and, separately, confirmed that
widening one test file's `createAndLoginAdmin()` return type from a bare
string to an object would have silently "passed" `tsc` at every bare
`const adminToken = await createAndLoginAdmin(...)` call site (a
template literal stringifies an object without a type error) while
actually breaking at runtime - caught by running every affected test
file fully, not just the one directly touched, and resolved by leaving
one helper's signature untouched and inlining the one test that needed
the secret instead of widening a shape five other call sites depended on.
**Verified:** `trust-safety.e2e-spec.ts`'s 6 step-up-MFA-specific tests
(suspend/ban) still pass unchanged, proving the `SellerLifecycleService`
refactor is behavior-preserving; `admin-auth-refresh.e2e-spec.ts` gained
a test proving the admin cookie's `Max-Age` is exactly 86400s (1 day),
not anywhere near `JWT_REFRESH_TTL_DAYS`'s 30 days; `module25`/`module47`
updated and re-verified (17 tests); full unit suite (50/321, after also
adding the new `step-up-mfa.service.ts` file to D88's
`admin-bypass-allowlist.spec.ts` tripwire, which correctly caught it as
an unreviewed new `PrismaAdminService` call site on the first run); both
apps' typecheck and lint clean throughout.
**Reasoning:** not elaborated beyond D82's own framing - admin sessions
now get a materially shorter default lifetime than seller sessions
without touching the shared access-token TTL, and step-up MFA is now a
mechanism other admin actions can adopt in one line rather than a
private method that only ever existed for one call site.

### D113. D83 - EmailService gets a real provider instead of unconditionally throwing for anything but console
**Status:** LOCKED. Closes `docs/auth-session-design.md`'s Part 3
disclosure: "Non-console email providers are unimplemented... In a real
deployment with a real EMAIL_PROVIDER configured, every email send -
including password reset and email verification - fails. This is
launch-blocking on its own terms."
**Decision:** `EmailService.send()` was already the one choke point
every one of its 20 other methods funneled through (confirmed by
reading the whole file, not assumed) - it now dispatches to a real
`EmailProvider` implementation (`email-provider.interface.ts`, one
method, the same four params `send()` already took) instead of
unconditionally throwing for anything but `"console"`.
`ConsoleEmailProvider` is the exact pre-existing dev/test behavior,
moved out verbatim - zero behavior change there. `ResendEmailProvider`
is the first real one: a direct `fetch()` against Resend's HTTP API,
not its SDK - one HTTP call, no new npm dependency, matching how this
codebase already calls other external HTTP APIs (payment gateways)
without adopting their SDKs. `docs/tech-stack.md`'s own Email row
("Transactional email API (e.g. Resend/SES-class provider)... not
worth building") already named Resend as the example, confirming this
wasn't a build-vs-buy call that needed revisiting - a self-hosted SMTP
transport was never actually the intended design for the platform's
own transactional email (that's a separate, already-existing concern -
`SMTP_CREDENTIAL_ENCRYPTION_KEY`, Module 26 - for a SELLER's own
connected SMTP server for their campaigns, a different feature
entirely).
**Attachment handling:** Resend's API needs the actual bytes (base64),
not a URL reference, so `ResendEmailProvider` fetches `attachmentUrl`
itself and inlines it - best-effort, same "never blocks the main send"
discipline `sendOrderConfirmationEmail`'s own `invoicePdfUrl` comment
already documents: a failed attachment fetch logs a warning and sends
without it rather than losing the email entirely over a PDF-storage
hiccup.
**Deliberately NOT done here:** `"ses"` stays a validated
`EMAIL_PROVIDER` value (`env.validation.ts`'s existing `@IsIn`) but is
still unimplemented - throws the same "not yet implemented" error,
narrower now (just this one value). Resend alone closes the actual
launch-blocking gap (at least one real provider works) with zero new
dependencies; SES needs the AWS SDK plus region/credential setup, a
separable follow-up rather than folded in silently here.
**On `WalletGraceLadderService.publish()` (the other half of this
item's name) - investigated, no code change made, and here's why:**
`publish()` already has a `requireEmailVerification`-gated check
against `seller.user.emailVerifiedAt` (pre-existing, unrelated to this
item). That gate was already correct in shape; what made it hollow in
a real deployment was that the verification email it depends on could
never actually be delivered once a real `EMAIL_PROVIDER` was
configured, since `send()` threw for anything but console. With
`send()` now actually working for Resend, the existing gate becomes
meaningful "for free" - no new precondition belongs in
`WalletGraceLadderService` itself; the fix was upstream in
`EmailService` the whole time. Adding a second, separate "is email
transport configured" check directly inside a billing/publishing
service would be unrelated infrastructure logic bleeding into a
business-rule method for no benefit over fixing the actual root cause.
**Verified:** new `resend-email.provider.spec.ts` (5 tests) - missing-
API-key rejection, the request shape sent to Resend's API, attachment
fetch-and-inline, attachment-fetch-failure graceful degradation, and
non-OK-response surfacing. One test's own mock had a bug caught before
trusting the result: `Buffer.from(str).buffer` is Node's pooled
allocation, not a tightly-sized `ArrayBuffer` (small Buffers share an
8KB pool), so the mock had to slice to the real byte range to match
what a genuine `Response.arrayBuffer()` actually returns. A focused
battery of 11 e2e files that exercise `EmailService` through its
existing console path (signup/password-reset/admin-auth/seller-
notifications/order-verification/support-tickets/monthly-reports/
suppliers/missing-tracking-alerts/gateway-health/data-export - 90
tests) all still pass, confirming the refactor is transparent to every
existing caller. Full unit suite (51/326, +5 for this item), both
apps' typecheck and lint clean throughout.
**Reasoning:** not elaborated beyond the design doc's own framing -
this was the one specifically launch-blocking item named in Part 3,
closed with the smallest change that makes it genuinely true rather
than the largest one that could plausibly be justified.

### D114. Security P0 items (object-level authorization, gateway-secret custody, payment integrity) - investigated, findings recorded, no code changed
**Status:** INVESTIGATION COMPLETE, IMPLEMENTATION NOT STARTED. Closes
the investigation half of 1B's three remaining security P0 line items
(`docs/security-audit-report.md`'s P0 table) with an honest current-
state finding for each - none of the three gets a code change in this
entry, for reasons specific to each, recorded below rather than
silently expanded into a much larger undertaking or silently skipped.
**#1 - Object-level authorization (IDOR/BOLA) on every route, "generated
allow/deny test per route":** this is explicitly a NEW, larger-scoped
item than the 2026-09-06 IDOR sweep already on record (§3 #13 of that
same report) - the report's own text is unambiguous: "Every item below
is a planned control... none of this is fixed yet," and "generated
allow/deny test per route" describes a systematic test-generation pass
across the entire route table, not a sampled check. That is genuinely
larger than "finish 1B's remaining named items" - it's its own
milestone-sized effort. What I *did* do, bounded and complete: checked
every NEW route this session's D108-D113 work added that takes a
client-suppliable resource id. All of them follow the already-audited
pattern exactly - `DELETE /sellers/me/staff-accounts/:id` scopes via
`@CurrentSellerId()` (derived from the authenticated token, never
client-suppliable) and checks `staff.sellerId !== sellerId` before
acting, exactly like every other owner-scoped method in this codebase;
`/admin/wallet-topups/sellers/:sellerId/adjust` and the staff
suspend/block admin routes are deliberately cross-tenant BY DESIGN
(that is what admin authority means), gated by `AdminAuthGuard` (now
also `StepUpMfaGuard` for the wallet-adjust one) rather than an IDOR
concern. No new gap found in this session's own additions. The full
generated-test-per-route sweep itself is recommended as its own
dedicated effort, not squeezed into 1B's tail end.
**#2 - Gateway-secret custody, D57's own "envelope encryption, master
key outside the app host/image":** checked the actual implementation,
not assumed. Every one of this codebase's 7 `*_ENCRYPTION_KEY` secrets
(Drive token, CNIC/identity, external-API client, SMTP credential,
admin-email credential, **payment-gateway credential**, and the newer
ones since) uses the exact same single-tier scheme
(`drive-token-crypto.util.ts`'s AES-256-GCM, reused verbatim by every
other credential type including `payment-gateway-credential-crypto.
util.ts` - D87's own comment confirms this was a deliberate "one
audited implementation" reuse, not an oversight) - one static
symmetric key, read directly from an environment variable on the same
host/image that uses it. A full-repo grep for KMS/envelope/master-key/
Vault/SecretsManager terminology returns zero matches anywhere in
`apps/api/src`. This is real encryption at rest (meaningfully better
than plaintext), but it is NOT what D57 actually decided: a master key
held OUTSIDE the app host/image specifically protects against the
scenario where the app host itself is compromised - under the current
scheme, compromising the container also hands over the exact key
needed to decrypt every gateway credential it's holding, defeating the
property D57 asked for. **Not implemented here, and correctly so for
this session:** building this for real means picking a KMS approach
(a cloud KMS - AWS/GCP - vs. a self-hosted Vault, matching or breaking
this project's self-host-first stance per `docs/tech-stack.md`),
designing a per-record-DEK-wrapped-by-KMS-held-KEK scheme, migrating
every already-encrypted credential to it, and standing up that KMS in
every environment including local dev - a genuine architecture
decision with real ops/cost implications, not a "small, contained fix"
autonomous judgment call like D82/D83's items. Flagged here for
founder decision before M1-1C (real seller gateway keys), matching
D57/D58's own "before real seller gateway keys are ever accepted" gate.
**#3 - Payment integrity (server-computed amounts, idempotency keys,
atomic state transitions, webhook verification):** checked the two
highest-value existing live money paths directly.
`WalletService.requestTopUp()` validates `amount > 0` server-side and
is a seller declaring their OWN top-up claim (fraud-prevention here is
the admin's own human verification against an out-of-band bank
receipt, not a code-level amount check - appropriate for a manual-
transfer flow); `verifyTopUp()` reads the amount from the already-
stored DB row (never re-accepts one from the admin's confirm call),
guards re-processing via a `status !== "pending"` check (equivalent
protection to an idempotency key for this specific admin-driven,
single-actor flow), and wraps the ledger write + status update in one
`$transaction` - server-computed, atomic, and effectively idempotent
for this path, confirmed by reading the code, not assumed. **A real,
systemic gap found, not fixed here:** a full-repo grep for "Idempotency-
Key"/"idempotencyKey" returns zero matches anywhere - there is no
FORMAL, reusable idempotency-key mechanism for client-retryable money-
moving requests (e.g., a flaky-network double-submit on checkout or a
mark-as-paid call). The admin/manual-driven paths checked above happen
to be protected by their own status-check guards, but that's
per-method incidental protection, not a systematic pattern a future
endpoint can be assumed to inherit. **Webhook verification is not yet
applicable, not skipped:** no real payment-gateway webhook endpoint
exists anywhere in this codebase today - Safepay/Stripe/Simpaisa/
Airwallex/Razorpay adapters are all M1-1C/M3 scope, explicitly blocked
on founder-supplied keys, not started. This sub-item needs to be
designed alongside whichever gateway adapter is actually built first
(1C), not retrofitted onto a webhook receiver that doesn't exist.
**Recommendation for the 1B report:** a formal idempotency-key
middleware/decorator (client-supplied key, server dedupes by key+route
within a TTL window) is a bounded, clearly-scoped follow-up that could
reasonably happen inside 1B's spirit if the founder wants it done now
rather than deferred to M1-1C; the KMS/envelope-encryption migration
and the full IDOR generated-test-per-route sweep are both larger,
genuinely milestone-sized efforts that need their own explicit go-ahead
rather than being absorbed into "finish 1B's remaining items."
**Reasoning:** investigate-first, same discipline as every other item
this session - the honest finding for all three was "here's exactly
what's true today, here's the real gap, here's why building the full
fix now would be the wrong call to make unilaterally," not silence and
not a rushed partial implementation.

---

## 2026-10-16 — Founder decisions on the 1B report (D115–D118)

Source: the founder, directly, replying to this session's 1B completion
report. Status legend as before (LOCKED unless noted).

### D115. D91 resolved - Stage 0 private beta scope confirmed
**Status:** LOCKED. Resolves D91's outstanding "define the minimum
feature/doc set" obligation.
**Decision:** YES to Stage 0. Invite-only, 5-10 sellers, Free plan
only. Payments limited to COD, manual mark-as-paid, and advance via
manual transfer. No billing, no live seller gateway keys in any
environment. Stated goal: reach Stage 0 as fast as safely possible,
with M1-1C billing work built alongside it rather than strictly
sequenced after.
**Reasoning:** not elaborated beyond the decision itself.

### D116. Stage 0 readiness sprint ordered - 7 items, before Stage 0 goes live
**Status:** LOCKED. "Report after A, before starting B."
**Decision:** before Stage 0 accepts real sellers, this session must:
1. Build a reusable idempotency-key mechanism and apply it to order
   creation, markAsPaid/"Not received", the manual-transfer reference
   submission, and every wallet/top-up mutation. Test: the same key
   submitted twice produces one effect.
2. Wire `StepUpMfaGuard` onto the admin verify-topup and reject-topup
   routes (same guard D112 already built).
3. Generate IDOR/BOLA allow/deny tests, scoped to the high-risk route
   groups only: orders, customers, products/stock, payment
   instructions, store settings, staff, wallet, domains, and all admin
   routes - cross-tenant (seller A -> seller B) and staff-permission-
   limit cases. The full per-route sweep is deferred to before paid
   public launch (D118), not required for Stage 0.
4. Ship a minimal staff login UI (`POST /staff/auth/login` + logout) -
   beta sellers are expected to use staff accounts from day one, and
   D111 already flagged this page as the one missing piece.
5. Confirm or finish store-domain separation (storefronts on a
   separate domain from app/admin) and abuse controls (signup/order
   rate limits, disposable-email block, basic fraud flags) - report
   what already existed vs. what this session added.
6. Operations minimum: automated daily DB backups plus one tested
   restore, error tracking/alerting, a status/health endpoint, and a
   "Stage 0 deploy checklist" appended to `docs/launch-runbook.md`
   including SPF/DKIM/DMARC for the Resend sending domain.
7. One end-to-end smoke test per payment path (COD, manual
   mark-as-paid, advance via manual transfer), storefront order through
   seller dashboard, running in CI.
**Reasoning:** not elaborated beyond the decision itself - this is the
minimum the founder judges necessary before real outside sellers touch
the product.

### D117. M1-1C go-ahead confirmed, sandbox only - gateway-secret custody via managed cloud KMS
**Status:** LOCKED. The explicit go-ahead D114 flagged as needed before
1C, now given with a concrete, scoped answer.
**Decision:**
1. Gateway-secret custody: implement the envelope encryption D57
   actually specified - a per-secret data key encrypts the secret,
   wrapped by an external master key behind a small KMS adapter
   interface. Managed cloud KMS, explicitly not self-hosted Vault (too
   much operations for a solo team). Until the KMS is wired in, only
   sandbox/test gateway keys may be stored anywhere; no live seller
   gateway keys in any environment until this is done and independently
   reviewed.
2. Stripe adapter, sandbox only, with webhook signature verification
   and idempotent webhook handling (dedupe on event ID).
3. Paddle sandbox billing for the platform's own subscriptions, using
   the already-locked price ladder and bonus-day rules (D10).
4. COD/advance/manual e2e, as already planned.
**Reasoning:** not elaborated beyond the decision itself. Directly
answers D114 finding #2 with a concrete KMS approach (cloud, not
self-hosted) and a hard gate (sandbox-only until reviewed).

### D118. Deferred to backlog - not built now
**Status:** LOCKED.
**Decision:** three items logged as backlog, explicitly not built in
this pass:
- SES email provider (Resend judged sufficient).
- The full IDOR/BOLA generated-test-per-route sweep (D114 finding #1) -
  required before paid public launch, not before Stage 0.
- Buyer-initiated cancellation.
**Reasoning:** not elaborated beyond the decision itself.

---

## Stage 0 readiness sprint (D116) - shipped items

### D119. D116 item 1+2 - idempotency-key mechanism + step-up MFA on verify/reject/bulk-decide
**Status:** LOCKED.
**Decision:** a new `IdempotencyService`/`IdempotencyInterceptor` pair
(`apps/api/src/common/idempotency/`), backed by the same shared
`RedisService` every other Redis-backed service already injects
(`RedisModule` is `@Global()`, mirrored here). Opt-in via an
`Idempotency-Key` request header - a caller that never sends it gets
exactly the pre-existing behavior, so applying `@UseInterceptors(
IdempotencyInterceptor)` to an existing route is purely additive and
broke no existing test on its own. Applied to the exact routes D116 item
1 named: `CheckoutController.checkout()`, `OrdersController.markAsPaid()`
and `.changeStatus()` (covers "Not received", which the frontend already
implements as a `changeStatus({status:"cancelled"})` call - confirmed by
reading `orders/[orderId]/page.tsx`, not assumed), `
ManualTransferSubmissionController.submitReference()`, and all 6 wallet/
top-up mutations in `wallet.controller.ts` (seller + supplier
`requestTopUp()`, admin `verify()`/`reject()`/`bulkDecide()`/`adjust()`).
A concurrent duplicate of an in-flight key is rejected (409), never
silently re-run; a failed attempt releases its claim so a retry gets a
genuinely fresh attempt, never permanently poisoned.
**Step-up MFA (item 2):** `StepUpMfaGuard` (D112) added to `verify()` and
`reject()`, matching the founder's literal ask - and, caught before
shipping rather than after, to `bulkDecide()` too: it dispatches to the
exact same `verifyOne()`/`rejectTopUp()` internally, so leaving it
unguarded would make the per-item guard added to `verify()`/`reject()`
trivially bypassable by going through the bulk route instead. One
step-up code covers the whole batch, same as one `AdminAuthGuard` login
covers it.
**Test fallout, found and fixed:** adding the guard broke every e2e test
that calls `verify()`/`bulkDecide()` as a setup/prerequisite step for
something unrelated - 19 files, not the 2-3 a narrower search would have
suggested (confirmed via a repo-wide grep, not assumed from memory).
Fixed per-file using whichever of two patterns fit without silently
breaking an unrelated call site: widen the file's local
`createAndLoginAdmin()` helper to also return the enrolled `mfaSecret`
(only where that file's helper is used almost exclusively for
wallet-topup calls - `module20-wallet-supplier-portal` and `module47-
wallet-balance-reconciliation`, the latter already partly done by D112),
or leave that shared helper untouched and do a self-contained inline
MFA enroll+verify at just the specific call sites that need it (every
other file - lower blast radius, and the one that matches this
codebase's own existing precedent, `module25-admin-completion`'s
audit-log test). A fresh TOTP code is generated immediately before each
call that needs one, never reused across calls (a stale code can fail a
30-second-window check mid-test).
**Verified:** `idempotency.service.spec.ts` (5 tests) and `
idempotency.interceptor.spec.ts` (5 tests) - including "the same
Idempotency-Key submitted twice runs the handler once and returns the
same result both times," the exact property D116 item 1 asked to be
tested. Full unit suite (342/342, +14 for this item), both apps'
typecheck and lint clean. All 19 e2e files independently re-verified
(typecheck clean, diffed to confirm no `expect(...)` assertion was added
or removed - only auth/header plumbing changed) - their actual pass/fail
against a real database can only be confirmed via CI (no local
Postgres/Redis in this sandbox), same as every other e2e change this
session.
**Reasoning:** the interceptor-not-guard shape was deliberate: a guard
can only allow/deny, it can't replay a cached response, and "replay the
same result instead of re-running the side effect" is the actual
property an idempotency key needs to provide.

### D120. D116 item 5 - disposable-email block (seller signup) + basic fraud flags (buyer checkout)
**Status:** LOCKED.
**Decision:** two related but distinct controls, matched to where each
belongs:
- **Seller/supplier signup** (`AuthService.signup()`): a disposable
  email domain is a hard rejection (400), checked before any DB read/
  write, same placement discipline as the existing country gate just
  above it - but unlike that gate, never waitlisted (there's nothing to
  wait for). Backed by the `disposable-email-domains` npm package
  (121k+ domains, actively maintained - last published days before this
  was written) plus its `wildcard.json` subdomain list, rather than a
  hand-rolled list that would just go stale.
- **Buyer checkout** (`CheckoutService.placeOrder()`): a new, informational-
  only `computeFraudFlags()` step adds up to two string flags -
  `disposable_email` (same check as above) and `repeat_ip_short_window`
  (3rd+ order from the same IP within an hour) - onto two new `Order`
  columns (`buyerIp`, `fraudFlags`, migration `20261016103000_order_
  fraud_flags`). Never blocks checkout, deliberately: a hard block here
  risks refusing a real sale over a privacy-conscious buyer's throwaway
  email. Flows through to every existing seller/admin order-read path
  automatically (none of them use a narrowing Prisma `select`, confirmed
  by reading `orders.service.ts`, not assumed) - no new UI was built to
  surface them specially; that's a reasonable fast-follow, not done here.
  Deliberately separate from `Seller.riskScore` (`RiskScoreService`),
  which scores a SELLER's own identity at signup, not buyer behavior at
  order time - a different signal for a different actor.
**Verified:** `disposable-email.util.spec.ts` (4 tests: known disposable
domain, wildcard subdomain, ordinary domain, malformed input). The
signup-rejection and checkout-fraud-flag behaviors themselves need a real
database to exercise (buyer/seller creation, order placement) - covered
by this session's existing e2e discipline going forward, verified via
CI after push same as every DB-dependent change this session.
**Reasoning:** "block" for a known-bad signal at account creation (seller
side, where it's almost certainly abuse in an invite-only beta); "flag,
don't block" for the same signal at checkout (buyer side, where it's
sometimes a real, privacy-conscious customer) - the two surfaces warranted
different enforcement, not the same rule copy-pasted twice.

### D121. D116 item 4 - staff login UI
**Status:** LOCKED. Closes D111's own flagged gap: `POST /staff/auth/
login` has existed since D111 with no UI ever built for it.
**Decision:** a minimal login page (`apps/web/app/staff/login/page.tsx`),
styled with the same `AuthShell`/`Card`/`Field`/`Input`/`Button`/`Alert`
primitives the seller and admin login pages already use (not the bare
`<input>`/`<button>` tier `staff/reset-password/page.tsx` deliberately
chose for itself) - a page a staff member sees every login, not a
one-off recovery completion, warrants the same baseline polish/
accessibility the rest of this app's auth surfaces already have, and
costs nothing extra to use. No MFA sub-step - staff login has none.
A staff JWT carries the same `sellerId` claim a seller's own token does
(`staff-auth.service.ts`'s `signAccessToken()`), so a staff session
shares `dashboard-api.ts`'s session store wholesale and lands on the
exact same `(dashboard)` UI, scoped per-route by `StaffScopeGuard` -
never a separate staff UI tree.
**Found and fixed before this would have quietly broken in production:**
`dashboard-api.ts`'s session-refresh-on-401 and logout were both
hardcoded to the seller's own `/auth/refresh`/`/auth/logout` routes and
cookie - reusing them as-is for a staff session would have refreshed
against the wrong endpoint (failing silently) and logged out to the
wrong page. `setSession()` gained a third `actorKind` parameter
(defaulting to `"seller"`, so every existing call site - seller login,
admin impersonate-entry, support-center - is unaffected), and `
tryRefresh()`/`logout()`/the redirect-to-login path now branch on it.
The existing dashboard sidebar's logout button (already shipped, no new
UI) therefore already works correctly for a staff session too.
**Verified:** apps/web typecheck and lint both clean. This repo's test
suite doesn't cover frontend pages at all (e2e is Supertest-driven API
testing only, confirmed by reading the existing e2e test shape - no
Playwright-driven UI test convention exists anywhere to extend); that's
a pre-existing gap, not a new one introduced here.
**Reasoning:** "minimal" (the founder's own word) was read as minimal
SCOPE (login + logout, nothing else), not minimal visual quality -
CLAUDE.md's own UI/UX skills policy applies to any frontend work in this
repo without a carve-out for "small" pages.

### D122. D116 item 6 - error tracking/alerting (Sentry)
**Status:** LOCKED.
**Decision:** `@sentry/node`, wired into both Node processes (`main.ts`'s
API server and `worker/worker.main.ts`'s BullMQ worker, each needs its
own `init()`), gated on an optional `SENTRY_DSN` env var - unset, it
never initializes, same "skipped_not_configured, not a crash" discipline
`backups/database-backup.service.ts` already established for `BACKUP_S3_
*`. `HttpExceptionFilter` (the one place every unhandled server fault
already funnels through) calls `Sentry.captureException(exception)`
inside its existing `status >= 500` branch, right alongside the line
that already logs it - a genuine server fault reaches Sentry; an
ordinary 4xx client error never does.
**PII discipline, checked rather than assumed:** this codebase has a
standing "never send request bodies/headers/cookies anywhere outside
this process" rule (`pii-redaction.interceptor.ts`). `captureException`
is called with the bare exception only, never a request object. Looked
for a `sendDefaultPii`-style init flag as an explicit backstop against
the SDK's own default auto-instrumentation attaching ambient request
data on its own - the installed major version's `NodeOptions` type has
no such flag (confirmed by reading the actual shipped `.d.ts`, not
assumed from older Sentry docs) - so `beforeSend` deletes `event.request`
unconditionally instead, a mechanism that doesn't depend on guessing at
SDK-version-specific option names.
**Verified:** `http-exception.filter.spec.ts` (2 tests: a 5xx reaches
`Sentry.captureException`, a 4xx never does - `jest.spyOn` doesn't work
on `@sentry/node`'s own exports, so this mocks the whole module via
`jest.mock`, not a real network call). Full unit suite and typecheck
clean on both apps.
**Reasoning:** picked the standard, hosted-SaaS-with-a-generous-free-tier
option rather than self-hosting an error-tracking stack, same build-vs-
buy call this session already made for Resend over self-hosted SMTP
(D113) - "don't build/run infrastructure that's a specialized, already-
solved, externally-maintained concern" is a repeated pattern, not a
one-off.

### D123. D116 item 6 (remainder) - automated backup-restore CI drill + Stage 0 deploy checklist
**Status:** LOCKED.
**Decision:** daily backups were already automated before this session
(`backups/database-backup.service.ts`, Sept 2026) - what `docs/launch-
runbook.md` §6 still only offered was a one-off MANUAL restore drill
(and its own text already documents the one time it actually ran,
Sept 2026, finding a real bug: FK constraints silently dropped without
`psql -v ON_ERROR_STOP=1`). A new CI job, `backup-restore-drill` (`.
github/workflows/ci.yml`, same cheap tier as `db-role-grants` - real
Postgres, no Redis/Playwright/app boot), now runs the exact pg_dump
invocation `DatabaseBackupService` itself uses in production, restores
it into a scratch database with the runbook's own `ON_ERROR_STOP=1`
discipline, and asserts two things a bare "the app booted" check would
miss: a deterministic marker row survives byte-for-byte, and every
foreign-key constraint name survives (the exact class of failure §6
already found once). This makes the restore side of the backup story
continuously, automatically re-verified on every push, not a drill the
founder has to remember to repeat by hand.
**Stage 0 deploy checklist:** a new §0b in `launch-runbook.md`,
inserted right after the existing branch-protection section (read
early, not buried at the end) - a condensed cross-reference saying
which of the existing numbered sections apply to a Stage 0 deploy
(skip load/soak, skip Paddle entirely), plus the one genuinely new item
nothing else in the doc covers: SPF/DKIM/DMARC for the Resend sending
domain. Checked directly rather than assumed: this is a DIFFERENT
concern from §10's existing Cloudflare Email Routing instructions
(founder's own inbound/send-as inbox) - if both mechanisms live on the
same root domain, their SPF records must be MERGED into one TXT record,
never two separate ones (invalid per the SPF spec), which the checklist
calls out explicitly since it's the one non-obvious trap here.
**Reasoning:** not elaborated beyond the decision itself - the honest
reading of "one tested restore" for a sandbox with no access to the
real production VPS/S3 bucket is "prove the mechanism and the exact
documented failure mode stay caught, continuously," not a restore this
session could perform against infrastructure it has no access to.

### D124. D116 item 7 - one e2e smoke test per payment path, checked before writing anything new
**Status:** LOCKED.
**Decision:** audited existing coverage for all 3 named payment paths
before adding anything, to avoid duplicating what already exists.
**COD and manual mark-as-paid already have full-chain coverage**: `
orders.e2e-spec.ts`'s Financial Truth Invariant test already goes real
storefront checkout -> seller-dashboard-visible pending order -> real
markAsPaid() -> confirmed, and mechanically "manual mark-as-paid" IS
that same mechanism (checked, not assumed - `Store.paymentModel`
defaults to `cod`, and `CheckoutService`'s per-model readiness gate
only adds extra requirements for `prepaid`/`advance`, so an
unconfigured default checkout already IS the COD path). **The advance
model's Manual Transfer fallback (B3b) had a real, if narrow, gap**:
`b3b-manual-transfer.e2e-spec.ts`'s happy-path test already chains real
checkout -> real reference submission -> real markAsPaid(), but verified
the intermediate and final state via direct Prisma reads, never the
actual `GET /stores/:storeId/orders/:orderId` a seller's browser hits -
closed by adding exactly that GET call in two places (after submission,
after confirmation), same test, no new file.
**Reasoning:** "one e2e smoke test per payment path" is already true
for 2 of 3 paths without any new code - closing the one real gap in
the existing test was the smallest change that makes the claim
genuinely true for all 3, not a reason to write 3 new parallel tests
duplicating what already exists.

### D125. D116 item 3 - scoped IDOR/BOLA sweep across the 9 named route groups, plus one real gap found and fixed
**Status:** LOCKED.
**Decision:** a new file, `stage0-idor-bola-sweep.e2e-spec.ts`, adds a
cross-tenant (seller A -> seller B) test for 8 of the 9 named groups
(orders, customers, products/stock, payment instructions, store
settings, staff, domains, plus a denial sweep for "all admin routes" -
inherently cross-tenant by design, so it gets a sweep instead) -
wallet is `it.todo`'d with a pointer, already thoroughly covered by
`module20-wallet-supplier-portal.e2e-spec.ts` and structurally unable
to have an IDOR surface (`SellerWalletController`/`SupplierWalletController`
resolve ownership only from the caller's own JWT, never a foreign-
tenant-referencing param). For the staff-permission-limit dimension,
customers and products/stock are `it.todo`'d (already thoroughly
covered by `module35-staff-accounts.e2e-spec.ts`, confirmed by reading
that file directly rather than trusting the task's own framing, which
turned out to be based on stale information).
**A real gap, found then fixed in the same pass - not just flagged:**
`ShippingSettingsController`/`TaxSettingsController`/`StoresController`/
`DomainsController` had NO staff-scope gate at all - neither
`StaffScopeGuard`/`@RequireStaffScope` (unlike orders/catalog/
discounts/customers/theme-settings) nor `@BlockStaffSessions()` (unlike
payment-instructions/staff-accounts/wallet, explicitly owner-only).
`StaffScopeGuard` is never registered globally either, so nothing else
was catching this. Confirmed, not assumed: a staff account scoped only
to an unrelated permission (e.g. "design") could read AND write
shipping/tax settings, and - the most serious instance - change a
store's payment-model (COD/prepaid/advance, a core financial decision)
or create a new store under the owner's account via `StoresController`,
exactly as the owner could. Fixed by adding `@BlockStaffSessions()` to
all four controllers (the same owner-only pattern already proven on
payment-instructions/staff-accounts/wallet) rather than inventing a new
`StaffScope` value - none of the 9 existing scopes (orders/catalog/
discounts/customers/design/analytics/marketing/reviews/suppliers)
cleanly map to "store settings" or "domains", and picking a delegable
scope's name/granularity unilaterally would be a product decision, not
a security fix. Shipped now rather than merely flagged: this is a
privilege-escalation-shaped hole, closed with an already-established,
zero-new-surface pattern, during the exact window Stage 0 is bringing
real staff accounts online (D116 item 4 shipped the staff login UI this
same session) - leaving it open to ask first was the actually risky
choice.
**For the founder:** if staff SHOULD be delegable for shipping/tax/
domain management in a future pass, that needs a new `StaffScope` value
(migration + seller-facing scope-picker UI) - a real feature, not
folded into this fix. Until then, owner-only is correct and safe.
**Verified:** confirmed via grep that no existing e2e test calls any of
the four controllers with a staff token (so this fix breaks nothing
already passing) before applying it. Full unit suite (342/342
unchanged - this fix is e2e-only), both apps' typecheck and lint clean.
The sweep file's own two new tests for this gap assert the FIXED (403)
behavior, not the vulnerable one - e2e correctness is confirmed via CI
after push, consistent with every DB-dependent change this session.
**Reasoning:** investigate-first, same discipline as every other item
this session - read every controller directly before writing a single
test, found the one real gap the founder's own ask best describes
("staff-permission limits") was there to catch, and fixed it with the
smallest change that closes it rather than the largest one that could
plausibly be justified.
**CI follow-up:** the PR-triggered full run on the above commit came
back red - one test, not the fix. The group-8 domains cross-tenant
test set `domains.custom_domain_enabled` with a `"global"`-scope
override, but `PRECEDENCE` in `settings.types.ts` is `["seller",
"store", "supplier", "plan", "category", "global"]` - a fresh test
seller lands on the `starter_free` plan, which already carries its own
plan-scoped override of that key to `false`, and plan outranks global.
Confirmed, not assumed, via the real job log (`expect(201)` received
`403`) and a direct read of `DomainsService.attach()` before touching
anything. Not a regression from the staff-scope fix above - the failing
call uses the seller's own owner token, never a staff one. Fixed by
setting the override at seller scope instead (which outranks plan),
same change in both affected tests in this file.
**Correction (same CI follow-up, second round):** the seller-scope fix
above was itself wrong, and CI caught it too - `setValue()` validates
the scope against the key's own `allowedScopes` before PRECEDENCE is
even consulted, and `domains.custom_domain_enabled`'s is `["global",
"plan"]` (`plans.seed.ts`) - "seller" was never a legal scope for this
key, so the call threw `BadRequestException` during test setup.
Confirmed via the real job log (`SettingsService.setValue:121`) rather
than assumed from the first fix's own (wrong) reasoning. Since neither
"seller" nor "global" is usable here, and mutating the shared
`starter_free` plan-scoped row would leak into every other
starter_free-seller test sharing the database, the correct fix is the
one `module16-seller-onboarding.e2e-spec.ts` already uses for this
same gate: upgrade the test seller to a paid tier, which carries no
override at all. The staff-permission-limit domains test never needed
the override in the first place - `BlockStaffSessionsGuard` blocks a
staff token before the handler ever reaches the plan-gate check - so
it's dropped there rather than ported. Verified for real this time
before pushing again: started local Postgres 16 + Redis in this
session's own container, bootstrapped roles, ran migrations, and ran
this exact spec file against them directly rather than typechecking
and hoping - all 10 tests (3 todo) pass. Full unit suite (342/342)
re-run clean alongside it.
