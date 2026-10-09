# Pricing & Programs — Canonical Reference

**Status: amendment adopted 2026-10-08, DOCS ONLY — nothing in this
file is built yet** except where a section explicitly says otherwise
(§5.74 dual branding, §5.73 free tier, and the existing payment-gateway
*mechanism* generally are already shipped; their price points,
allowlist contents, and program designs below are not). This is the
single canonical source of truth for every number in this document —
`docs/SRS.md`'s §5.78-5.92 reference this file rather than restating
its numbers, specifically so the two can never drift. Where this file
and an older SRS section disagree, this file and the new §5.78-5.92
sections win; the older text stays in place, marked superseded, not
deleted.

Full decision provenance, status (LOCKED/LOCKED-DEFAULT/OPEN), and
reasoning for every number here: `docs/founder-decisions-log.md`'s
2026-10-08 entry (D1-D41). This file states the *what*; that log states
the *why* and *how settled*.

---

## 1. Plan ladder

Four individual paid tiers (GO/RUN/RISE/FLY), one free tier
(`starter_free`, §5.73, already shipped), plus the pre-existing Team and
Supplier plan groups (unaffected by this amendment except where noted).

| Plan | Monthly | Who it's for |
|---|---|---|
| Free (`starter_free`) | $0, forever | a seller testing the idea, no card required |
| GO | $24 | for new sellers |
| RUN | $49 | for growing stores |
| RISE | $119 | for established sellers |
| FLY | $249 | for high-volume operations |

Pricing is **USD-only, globally** — no PKR or other regional list
price (D6). A local PKR *payment route* for paying the USD price is a
separate, still-open question (D40.6).

## 2. Billing cycles

Every tier offers four cycles. Each cycle is a flat percentage off the
monthly list price; the 6-month cycle additionally includes **15 bonus
days of service** (a 6.5-month entitlement for a 6-month payment).

| Cycle | Discount | GO | RUN | RISE | FLY |
|---|---|---|---|---|---|
| Monthly | — | $24 | $49 | $119 | $249 |
| 3 months | −7% | $67 | $137 | $332 | $695 |
| 6 months | −12% (+15 days free) | $127 | $259 | $628 | $1,315 |
| 12 months | −25% | $216 | $441 | $1,071 | $2,241 |

Formulas: 3mo = 3 × monthly × 0.93; 6mo = 6 × monthly × 0.88; 12mo = 12
× monthly × 0.75 (equivalently 9 × monthly). Every figure rounded to
the nearest whole dollar.

Pricing-page toggle order: **Monthly · 3mo · 6mo ("Most popular",
default selected) · 12mo ("Best value")**.

Cycle mechanics: upgrade applies immediately with proration; downgrade
applies at period end; the cycle itself is switchable at renewal, not
mid-cycle; 14-day money-back on every cycle (no refund after, except
where law requires).

**Open implementation questions** (not founder-level, recorded for the
Phase B developer): does Paddle support custom 3/6-month billing
intervals natively, or does this need a custom cycle built on top of
Paddle's primitives? How are the 6-month cycle's 15 bonus days actually
delivered — shifting the next-billing-date forward, or a separate
entitlement-extension record independent of the billing date?

## 3. Discount floor

The effective price after a cycle discount plus at most one additional
promotion must never fall below **50% of list price** (LOCKED-DEFAULT,
reconfirm). Earn Your Plan credits (§6.3 below) are exempt — they're
earned, not discounted. Admin-editable Settings Registry value, not a
hardcoded constant.

## 4. Tax mode & merchant of record

**Tax-exclusive pricing**: the customer pays list price + applicable
tax, computed and shown at checkout ("$24 + tax"). This **supersedes**
the earlier tax-inclusive-flat-pricing decision (2026-10-03,
`founder-decisions-log.md` entry #6) — that entry stays as the
historical record, not deleted.

Paddle remains UZEYN's merchant of record for its own subscription
revenue only — never marketplace buyer-to-seller payments, which stay
on the regional seller-gateway adapters (§5 below). **Plan B: Polar**
if Paddle's account approval stalls (it lists Pakistan as a payout
country via Stripe Connect Express). No business verification is needed
for an individual Paddle account; payout is via wire/Payoneer monthly,
with an approximately $100 minimum (unconfirmed, third-party source).
The founder-owned Paddle approval critical path (domain → live
marketing site with ToS/Privacy/pricing/refund policy → Paddle domain
approval → ID verification → test mode) is tracked in
`docs/launch-runbook.md`.

Still open: whether Paddle needs to show tax-inclusive pricing to EU
consumers specifically (by location) despite this section's general
exclusive rule — a lawyer question, not yet resolved.

## 5. Seller payment gateways

Sellers may connect **only**: Stripe, Razorpay, Simpaisa, Airwallex,
Skypay Global, EBANX — each with the seller's own account. The
allowlist must become Settings-Registry-admin-editable; today it is
hardcoded in two places with no Settings Registry key governing it at
all (a confirmed gap, see `docs/SRS.md` §5.80's own gap report).

The existing four adapters (Raast, Easypaisa, JazzCash, bank transfer)
stay **dormant, not deleted** — not selectable at launch. COD, advance
payment, and manual-mark-as-paid remain payment *models*, a separate
concept from gateways, unaffected.

**Rollout order** (LOCKED-DEFAULT, reconfirm): launch with **Stripe,
Simpaisa, Razorpay**; Airwallex, Skypay Global, EBANX follow on demand.
The pricing page lists only live adapters as "supported."

## 6. Programs

### 6.1 Free tier (already shipped, §5.73)

Unchanged by this amendment beyond: a storage cap, a 1-store limit, and
no email-campaign sending (today the Free tier has no explicit cap,
resolving to the platform-wide 500/month default — a real gap to close
in Phase B, not yet closed).

### 6.2 Launch Assurance (GO only, one-time)

Public line: **"Slow first month? Your next month is half price."**
Applies to a customer's first-ever GO purchase only (matched on email +
Paddle customer ID), once, void if the plan changes before evaluation.

**Trigger**: confirmed non-refunded order value in days 1-30 below a
threshold — default **PKR 25,000 (≈$90)**, currency/amount not yet
finally confirmed (open), admin-editable per-currency table, no FX
engine. **Effort gate** (so the reward can't be earned by inactivity
alone): published, ≥5 products, ≥~50 visitors in the window, all
admin-editable.

**Relief**: a monthly customer's next invoice goes 50% off; a
3/6/12-month customer instead gets +15 days of service. Auto-evaluated
days 30-35; the seller gets a confirmation email, paired with a 3-4-step
"slow-start coach" email series. Cost-capped at roughly $12/GO customer,
once. Success metric: month-3 retention of relief recipients vs.
non-recipients, reviewed at that point.

### 6.3 Founding Members

The **first 100 paying sellers**, globally, across every plan: a price
lock for as long as their subscription stays continuously active; a
Founding badge on profile and store; direct support via a dedicated
priority channel (not the founder's personal WhatsApp). Stacks with
billing-cycle discounts. No extra percentage discount, no lifetime
deal.

### 6.4 Earn Your Plan (post-launch; renames "Growth Challenge")

Not a launch blocker — starts once roughly 50 paying sellers exist,
time-boxed 60-90 days, tracked against one success metric. The internal
program key stays stable in code across the rename.

A referral counts only when: the account is new, buys a paid
subscription, has used and paid for one complete month, the 14-day
refund window has passed with no refund, and there is no open
chargeback/dispute. **A free signup never counts — no exception.**

**Rungs** (LOCKED-DEFAULT, numbers to reconfirm): 5 verified referrals
→ proposed 1 free GO month; 20 → proposed 3 free GO months; 35 →
proposed 6 free GO months. Default windows: 5-and-20 within 30 days of
enrollment, 35 within 60 days — all measured in parallel from one
shared enrollment date. Each rung is independent; claiming is optional;
enrollment is admin-approved.

Reward form: account credit/entitlement only, never cash,
non-transferable, clawed back on a chargeback. A Free-tier member's
reward is a time-limited GO entitlement via the existing `expiresAt`
grant mechanism; the delivery mechanism for an already-paying member is
still an open implementation question. Economics: self-referral is
unprofitable (5 referrals cost ≈$120 against a $24 reward).

### 6.5 UZEYN Partners

Invite-only, local-first, **not** a fixed-cash program.

**Benefits**: (1) a certificate with a verification code/QR; (2) a
"UZEYN Partner" store badge; (3) an opt-in public profile in a partner
directory, no private data; (4) free plan access — default (open): a
Verified Partner gets GO free while active (≥1 paying referral/rolling
90 days); a Verified Teacher/Community Partner with ≥3 paying
referrals/rolling 90 days gets RUN free; (5) free meetup access
(operational only, no v1 software); (6) a community-admin designation
(manually verified); (7) a future education portal — **roadmap only,
not scheduled**, it implies its own checkout/tax/marketplace
obligations; (8) a referral bonus (below); (9) explicitly **not
offered**: special payment gateways.

**Referral bonus**: **8.88% of cleared net revenue** (after tax and
Paddle fees) from the referred customer's payments, for the first 12
months (open: recurring-forever vs. capped-at-12-months not yet
confirmed). Rate and duration are Settings Registry keys
(`partner.commission_rate_percent` = 8.88,
`partner.commission_duration_months` = 12). Released only after
identity verification and an onboarding call. A payment counts only
under the same verified-referral rules as Earn Your Plan (§6.4).

Honest expectation: 8.88% of a GO subscription is roughly $1.91/month
per referred customer (≈$22.90 over 12 months); 10 active GO referrals
is roughly $19/month — the non-cash benefits above carry most of this
program's real value. Review the rate after 90 days live.

**SECP-safe design**: single-level only (no reward for recruiting other
partners); rewards only on genuine paid subscriptions; written terms
with a 14-day refund right; no purchase required to participate; no
income guarantees or earnings claims; an affiliate-disclosure
requirement in partner content; both this program and Earn Your Plan
need lawyer review before launch; a CA question is open on withholding
tax/record-keeping for bonus payments. Re-check against Pakistan's
draft S.R.O. 2440(I)/2025 before launch.

**Accounting** (no code yet): accrue via the existing
`WalletService.postLedgerEntry` ledger path, evaluating reuse of the
dormant commission engine already present in the codebase. States:
`pending_verification` → `releasable` → `paid`. Clawback on
refund/chargeback. Payout release is an admin money-moving action
(step-up MFA, typed confirmation, audit log) — manual, PKR via
bank/Easypaisa/JazzCash for Pakistani partners at launch, other methods
later. Minimum payout: open, default ≈Rs 5,000-equivalent.

**Verification**: application → admin review → identity + payout-
account check → onboarding call → activation. No CNIC system revival.
Identity documents, if unavoidable, are stored encrypted (AES-256-GCM),
access-logged, deleted after verification (keep only result/reviewer/
date).

Build v1 manually: the existing attribution engine plus an admin
ledger report. No external affiliate tool until past roughly 20 active
partners (candidates: FirstPromoter/Rewardful, both Paddle-compatible —
verify PKR payouts would still need to stay manual either way).

### 6.6 Students (dormant, redesign TBD)

The old PKR "Commerce Students" plan is **not** offered at global
launch — stays dormant, not deleted. (Note: "Commerce Students Support"
is today's live *referral program* name, Rs 345/renewal — not a pricing
plan; no Students pricing `Plan` row has ever existed in code. Flagged
here to avoid confusing the two.) Guardrails on file for the eventual
redesign: no separate SKU (a verified Paddle discount code on GO
instead); verification by .edu/university email or ID with manual
review and yearly re-verification; same feature set as GO; a 12-month
term, renewable once.

### 6.7 Removed programs

The general flat-referral program and the Ambassador commission program
are both removed outright. **Not** simply repriced to $1/$499 as an
earlier proposal had it — that proposal is itself superseded here. The
actual *live* figures being retired are Rs 345/renewal (Student
Referral, max 2 renewals) and Rs 499/renewed month (Ambassador, max 3
months) — the $1/$499 figures an earlier log entry referenced were
never what shipped. First-month-free stays removed (unaffected,
decided earlier).

### 6.8 Program hygiene (applies to every program above)

One owner, one success metric, one sunset date per program. One
customer belongs to one program at a time (enforced by the shared
referral attribution engine, `docs/SRS.md` §5.85). Account credit is
preferred over cash everywhere except the Partner bonus (§6.5), which
is explicitly cash-equivalent by design.

## 7. Feature distribution per tier

Target state (advisor's proposal, delegated by the founder) — see
`docs/SRS.md` §5.78 FR-78.4 for the pointer to the full gap report
against today's actual `plans.seed.ts` gates. Summary:

- **Free**: as already shipped (10 products, UZEYN subdomain, 4-section
  no-animation allow-list, email verification before publish, mandatory
  branding) + a storage cap, 1 store, no email campaigns.
- **GO**: custom domain, 500-product cap (today: 100), all static
  D-Studio sections (today: 8 of 22), discount codes, basic analytics,
  1 store, 0 staff.
- **RUN**: 3 stores, 2 staff, prepaid payment model, abandoned-cart
  emails, campaigns (monthly quota), gift cards, funnel analytics, data
  export.
- **RISE**: 5 stores, 3 staff, Custom CSS, advanced SEO, device-approval
  restriction, API/webhooks, priority support; Vellum when ready
  (roadmap, not scheduled).
- **FLY**: 10 stores, 5 staff, the removable loading-screen mark
  (already shipped, §5.74) — invoice and order-review branding stay
  permanent on every tier, including FLY.
- **Fair use**: no order-volume caps at launch; a ToS fair-use clause
  plus internal usage alerts (orders/month, storage, emails/store) for
  60 days, then a founder decision on volume bands.

## 8. Pricing page & Shopify savings calculator

The pricing page references Shopify through an **interactive
calculator** (seller enters monthly sales + gateway type), never a
static comparison claim. Guardrails: every competitor number carries an
"as of <date>" tag and a source link; a footnote discloses tax/
card-fee exclusions; the third-party-gateway surcharge shows only in the
"other gateway" scenario; "Shopify" is used by name only (no logo);
reviewed quarterly.

Reference figures, captured 2026-10-08 — **re-verify before
publishing**: Shopify Starter $5; Basic $39 ($29 billed annually); Grow
$105 ($79 annually); Advanced $399 ($299 annually); third-party-gateway
surcharge 2% (Basic) / 1% (Grow) / 0.6% (Advanced); all figures exclude
VAT.

## 9. Economics (record only)

Net to UZEYN per subscriber/month (tax-exclusive, 20% VAT assumption,
monthly cycle, after Paddle's 5% + 50¢ and an unconfirmed ~2.5%
payout-conversion cost): **GO ≈$21.5 · RUN ≈$44.4 · RISE ≈$108.6 · FLY
≈$227.7** (GO on the 12-month cycle ≈$16.5/mo equivalent).

Illustrative break-even, monthly cycle, mix 65% GO / 20% RUN / 10% RISE
/ 5% FLY, ~10% average tax (an assumption, not measured data): roughly
**$45 net/subscriber/month** blended — about 12 sellers to reach
$500/mo, 23 for $1,000/mo, 67 for $3,000/mo. Roughly $37 blended if
every seller were on the 6-month cycle instead (≈14/27/81 sellers for
the same milestones). Free-to-paid conversion of 2-5% is used as a
rule-of-thumb planning assumption, not a measured figure yet.

Prepaid cycles are deferred revenue, recognized monthly as service is
delivered. Paddle never returns its own fee on a refund.

At $10,000/month in sales, a seller on Shopify Basic paying the 2%
third-party-gateway surcharge pays roughly $239/month (plan + fee)
versus UZEYN RUN's flat $49 — the saving applies specifically to a
seller not already using Shopify Payments.

---

*Every number in this file traces to a specific decision (D1-D41) in
`docs/founder-decisions-log.md`'s 2026-10-08 entry. An item marked
"open" above is tracked there and in `docs/SRS.md` §13's open-questions
list — do not implement an open item on the strength of its stated
default alone.*
