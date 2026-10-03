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
