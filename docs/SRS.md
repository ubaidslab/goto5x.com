# uzeyn.com — Software Requirements Specification (SRS)

**Version:** 0.44 (Build-phase amendment — review detail view and reason-
audited soft-delete, §5.14/FR-14.5-14.6, Module 93; founder batch item A9,
extending the existing Product Reviews & Ratings feature rather than a new
top-level module, same "extend the existing FR block" precedent as FR-7.19-
7.21)
**Date:** 2026-08-30
**Status:** v0.6 formally approved; documentation phase closed, build phase
underway. Modules 1–9 (Foundation; Catalog & Media; Custom Domain & TLS;
Theme Engine & Storefront Rendering; Discovery & Merchandising; Listing
Moderation Engine; Shipping, Tax & Discounts; Suppliers & Printify Adapter;
Orders, Cart & Checkout) built, tested, and approved. v0.7 pinned the Settings Registry precedence,
added password reset, regional launch gating, admin plan grants/platform
subscription promo codes, in-app messaging, platform brand-asset
management, a mobile-app-readiness NFR, a region-sharded-deployment Phase
4+ note, and referral attribution/cross-SaaS discount eligibility for the
two external-SaaS hooks. v0.8 added the Platform Event Log (§3.11,
FR-26.x). v0.9 closed a schema gap found while planning Module 4 (SEO
field placement, sitemap/robots pulled forward). v0.10 (approved before
Module 5) added seller account security (§5.25), the Financial Truth
Invariant (§3.12), the zero-cost rule-based Listing Moderation Engine
(§5.27), and one reaffirming line on the premium-UI-bar dependency. v0.11
(approved after Module 6) slotted the moderation queue's bare functional
admin page into Module 16. v0.12 (approved after Module 7) inserted a new
**Seller Dashboard UI** module (§5.28, Module 10) and a binding SIMPLICITY
INVARIANT NFR (§3.13). v0.13 (approved after Module 8) closed a gap
identified during Module 8's review — supplier-sourced listings were
bypassing the Listing Moderation Engine entirely (a seller's
fulfillment-quality approval is not a substitute for the platform's own
legal-safety check). New FR-27.8 (§5.27) runs the same banned/restricted-
keyword and restricted-category checks, and the same trusted-seller
bypass, on a supplier listing at the moment of seller approval; new-seller
probation stays scoped to self-fulfilled listings only. §14.25 gained two
lines. v0.14 (approved after Module 9): Module 9 (Orders, Cart & Checkout)
built; completed Module 8's deferred FR-3.3/3.4/4.5/4.7/4.8 wiring; fixed a
found-during-build completeness gap in FR-2.7/3.2 (a supplier listing's
approval now also creates its `product_variants` row); clarified FR-5.3's
suspended-store behavior. **This revision (v0.15), approved before Module
10 — a major business-model pivot, good timing since Payments (Module
10/11) had not yet been built:** v1.0 replaces platform-collected payments
with **Direct Seller Collection** (§5.6c) — buyers pay sellers directly
(bank/JazzCash/Easypaisa/COD, all unconditionally permitted since the
platform never touches the money); the existing Module 9 mark-as-paid path
is unchanged and is now the universal payment-confirmation mechanism;
commission becomes **invoice-based** (default 1%, down from 3%), accrued
per confirmed sale and billed monthly, with manual admin payment
verification and automated grace-period store suspension for non-payment.
The dormant Platform-Collected mode (Safepay, hold, reserve, payout/
disbursement — §5.6/§5.6a/§5.6b, retitled but **not one word of their
content changed**) is retained verbatim for a future reactivation. A new
**Trust & Safety System** (§5.29) — a versioned Seller Agreement
(timestamp+IP acceptance, re-acceptance on version change), a zero-cost
rule-based T&S engine extending existing mechanisms (Module 6 moderation,
FR-23.5 signup-velocity limits, new anti-underreporting monitors), and an
enforcement ladder built on the existing seller-lifecycle admin controls
(FR-8.4) — compensates for the accountability a payment gateway used to
provide for free. Also new: a Supplier Premium Plan (FR-7.10, the
multi-store aggregated dashboard as its flagship, paid-tier feature) and
seller dashboard personalization (FR-28.4, plan-gated). No FR from any
prior version was deleted; every dormant-mode FR keeps its exact meaning
for its own eventual reactivation — every change below is additive or
explicitly superseding, never a silent rewrite. **v0.16 (approved during
Module 10's rollout)** adds **Seller Identity & Commission-Fraud Defense**
(§5.30, slotted into Module 12 alongside the Trust & Safety System it
extends): mandatory, unique, encrypted-at-rest CNIC at seller activation
(FR-30.1); a name-consistency rule flagging (never hard-blocking, except
for exact account-number reuse) a mismatch between a seller's declared
legal name and the account title on any payment instrument they add
(FR-30.2); payment-account-number uniqueness across sellers (FR-30.3, hard
block); an adapter-seamed path to automated Raast/1Link title verification
as the documented first paid T&S upgrade (FR-30.4); a rule-based,
Settings-Registry-weighted risk score with exactly three outcomes —
auto-approve / manual review / block — computed from identity, payment,
and device/IP signals (FR-30.5); and a check tying re-registration attempts
by a commission-suspended seller's identity cluster back into the
enforcement ladder (FR-30.6). §14.30 added. No code was written for this
amendment — Module 12 has not started; Module 10's UI rollout continues
using the design system approved at its checkpoint. **v0.17 (approved
alongside Module 10's completion, ahead of Module 11)** adds **Teams &
Community Sponsorship** (§5.31/FR-7.11–7.16, slotted into Module 14): a
seller on a qualifying plan tier ("leader") can invite other sellers and
sponsor their subscriptions; a binding pre-acceptance consent screen
(FR-7.12) discloses the leader's access is read-only analytics only — no
store access, no editing, no customer PII; a member can leave at any time
(FR-7.13, graceful next-cycle downgrade to Free, never account deletion or
suspension); the leader's own commission invoice and the group sponsorship
invoice are two separate documents (FR-7.15) using Module 11's invoicing
mechanism verbatim, with suspension never crossing the team boundary.
§14.31 added. This same revision also confirmed the `store_payment_instructions`
gap flagged in v0.16's build-plan note is being fixed now, at the start of
Module 11, per the founder's direction — see `docs/build-plan.md`. No code
was written for the Teams amendment itself. **v0.18 (approved after Module
11, ahead of Module 12)** adds two items: **Domain Upsell Referral**
(§5.11 FR-11.3) — a "get a domain" affiliate link block on the custom-domain
dashboard screen, with the partner URL/name and an enabled flag all as
Settings Registry entries so the founder can swap or disable the affiliate
partner without a deploy; §14.11 gained one checklist line. Built now,
alongside a pre-existing gap this surfaced: Module 3 (Custom Domain & TLS)
had only ever shipped its backend (`DomainsController`/`DomainsService`) —
no seller-facing dashboard screen existed to host the new referral block, so
one was built to the exact, already-approved shape of FR-11.2 (attach/list/
verify/remove), not a scope expansion. Also: the **Template Package Spec**
(architecture decision, `docs/architecture.md`) — every storefront template
is pinned as a self-contained frontend package (markup/styles/scripts,
preview assets, a manifest declaring name/version/settings-schema) consuming
the same storefront data API and theme-settings backend as every other
template, with a hard isolation rule (one template's code can never affect
another template or the dashboard). This governs the Template Store hook
(§5.24a) and every future template from Module 15 onward; the three
built-in v1.0 themes are unaffected and not rebuilt. No code changes from
the spec itself. Then proceeds to **Module 12 (Trust & Safety System)**,
which now also owns FR-6.19 (anti-underreporting monitors) and §5.30's
FR-30.x (CNIC/name-consistency/risk score) per their existing deferrals.
**v0.19 (approved after Module 12, ahead of Module 14)** adds the **Plan
Architecture** amendment (§5.7 FR-7.17/7.18) — plans are organized into
named **plan groups** (Individual, Team, Supplier), each with an ordered
list of founder-editable **tiers** (a Cursor-style structure: mechanism
only, every price/name/limit stays founder-set plan-editor data). FR-7.18
revises FR-7.15's Team-plan group-invoice math: a sponsored member's seat
is billed at the **leader's team tier's seat price**, uniform across every
seat on that team, not "that member's own individually-chosen plan price"
as v0.17 originally specified — while sponsored, a member's individual plan
becomes whatever their team tier grants (reverting to Free on leave,
FR-7.13 unchanged). §14.7 gained plan-groups/tiers-as-data checklist items;
§14.31's group-invoice-math line updated to the seat-price formula. No code
was written — Module 14 has not started; this stages the architecture for
that module's own build, per the founder's explicit request to confirm/
amend the mechanism before Module 14 begins.

**v0.20 (approved after Module 14, ahead of Module 15)** closes two gaps
the founder flagged on Module 14's own approval — both slotted into
homes, not built now. **FR-7.2 is revised** to pin the v1.0 plan-fee
collection mechanism explicitly: a seller on a paid plan is billed via a
`plan_subscription`-typed `seller_invoices` row, the identical manual-
verification/grace-period mechanism as commission invoicing (FR-6.16–18)
— the schema (`invoice_type`) was already built ready for this in Module
14, but the invoice-generation job itself was not. Non-payment past grace
downgrades the seller to Free (graceful, the same mechanism FR-7.13
already uses), **never store suspension** — a plan fee going unpaid is
the seller choosing not to afford the tier, not a debt tied to store
operations the way commission is. **A new Module 20 (Supplier Portal
Completion & Plan-Fee Collection)** is inserted to build this alongside
FR-3.3's supplier-facing dashboard UI (the aggregation API/data already
exists, built in Module 9 — no UI was ever built, and no supplier login/
dashboard surface exists in `apps/web` at all) and the Supplier Premium
Plan's actual gate (Subscription/SettingsContext supplier support, absent
since Module 14 scoped `Subscription` to sellers only). The former Module
20 (Hardening & Launch Readiness) is renumbered to **Module 21** — the
only renumbering this causes; every other module keeps its number. No
code written for either gap — see `docs/build-plan.md`'s own amendment
note for the full module-sequence table change.

**v0.21 (Module 15 built)** — Customers, Reviews & Data Portability
shipped (§5.13/§5.14/§5.18/§5.19). One flagged decision and one flagged
gap-fill, both disclosed rather than silently absorbed: **FR-19.1's
"seller logo"** — no store-logo-upload capability exists anywhere in the
platform (no prior module ever built one), so the one v1.0 invoice
template's "branded" header is the store name in a designed typographic
mark, not an uploaded image; a literal logo is a small, separable
follow-up if the founder wants one once §14.19's founder sign-off happens.
**The buyer order-status page (FR-5.4) never actually existed in
`apps/web`** despite being scoped into Module 11's own prerequisite fix
(`docs/build-plan.md`) — discovered only because FR-19.1 hard-depends on
it (the invoice link and the review-submission form both have to live
somewhere). Built the minimal page now (status, items, totals, payment
instructions, invoice download link, review form) since Module 15 cannot
honestly claim FR-19.1/FR-14.1 without it; the platform's storefront
**cart and checkout pages are a separate, larger, still-open gap** —
Module 9's checkout/cart APIs are fully built and tested, but no
`apps/web` buyer-facing cart/checkout UI was ever built either. That gap
is *not* fixed here (out of Module 15's scope) and needs its own founder
decision on which module absorbs it.

**v0.22 (approved after Module 15, new Module 15.5)** — the founder's
answer to that flagged gap: a new **§5.32 (Storefront Buyer Purchase Flow
& Store Branding)**, checklist §14.32, slotted as **Module 15.5**, built
immediately (before the SaaS-bridges module), launch-blocking since
nothing sells without it. Bundles in store logo upload (FR-32.5), the
other small-but-real gap Module 15's invoice template surfaced. FR-19.2's
founder sign-off on the one invoice template stays a separate, explicit
line item — added to `README.md`'s founder pre-launch verification list
so it isn't lost.

**v0.23 (approved before Module 17)** — impersonation transparency,
added to FR-8.4 (§5.8) as a founder-required condition on the
impersonation mode Module 17 is about to build, not a new mechanism:
(a) a persistent, unmissable "support mode" banner is shown for the
entire duration of an impersonation session; (b) starting a session emits
a `platform_event` (§3.11); (c) the impersonated seller's own Security
card (Module 13's screen) shows a plain support-access history line —
when it happened and for how long, **never which admin** did it, since
that's an internal control-plane detail, not something the seller needs
or should see; (d) impersonation is read-write for ordinary settings/
support work, but a specific list of **high-risk write actions —
mark-as-paid, payment-instruction changes, payout/invoice actions** — is
blocked outright while impersonating, so support can fix a seller's
configuration but can never move money or money-adjacent state on their
behalf. §14.8 gains four checklist lines for this (banner presence, event
emission, seller-visible history, blocked-write negative test).

**v0.24 (approved before Module 20) — a business-model pivot inside a
business-model pivot: the PREPAID CREDITS WALLET replaces §5.6c's monthly
commission-invoice mechanism as the PRIMARY and ONLY active collection
path for v1.0.** §5.6c is unchanged as written but is now itself a
**dormant** mechanism (marked so at its own top, exactly like §5.6/§5.6a/
§5.6b before it) — preserved for a possible future enterprise/post-paid
reactivation, never deleted. New **§5.6e (Prepaid Credits Wallet, v1.0
model)** is the actual v1.0 mechanism: a seller tops up a ledger-backed
wallet (extends Module 11's `LedgerEntry`, new entry types alongside the
existing `commission_accrued`/`commission_waived`); publishing a store
(accepting real orders) requires the wallet to have received at least one
top-up meeting a configurable minimum (default Rs. 500) on top of the
existing payment-instruction/CNIC gates (FR-6.14/FR-30.1) — new FR-6.21.
Commission still accrues only on a confirmed sale (Financial Truth
Invariant unchanged) but now debits the wallet directly instead of
accruing toward a monthly invoice — FR-6.22. Top-ups follow the same
direct-collection, manually-verified pattern already proven for invoices,
behind a new `TopUpAdapter` interface (mirrors the Payment Adapter
pattern, §3.5) so a future gateway auto-top-up doesn't touch this logic
— FR-6.23. A new **low-balance grace ladder** (warning → configurable
grace days → `orders_paused`, a new store state distinct from admin
`suspended`: storefront stays browsable, checkout is blocked with a
respectful notice — instant auto-restore on a verified top-up) replaces
the old grace-period-then-suspend mechanism for commission debt —
FR-6.24. A configurable negative-float floor means a confirmed sale's
commission debit can never fail mid-transaction even if it dips the
balance below zero — FR-6.25. **FR-7.2 is revised again** (superseding
v0.20's "monthly `plan_subscription` invoice" pin): a paid plan's fee,
a Team leader's per-seat group total (FR-7.15/7.18), and the FR-25.7
extra-device-slot add-on all debit the same seller wallet monthly-in-
advance instead of generating an invoice; insufficient balance for a
plan fee is a **downgrade-to-Free** event (FR-7.13's existing mechanism),
never a store action — the wallet's `orders_paused` ladder is strictly a
commission/store-operations concern. **FR-7.10 is supplemented**: the
Supplier Premium Plan's fee debits a **separate, supplier-scoped
wallet** (own small ledger table, no commission/team/device entry types
— a supplier only ever pays its own plan fee), and `Subscription`/
`SettingsContext` gain real supplier support (both were seller-only
placeholders per the v0.20 amendment note) as part of the same Module 20
build that finally ships the supplier-facing aggregated dashboard UI.
The admin commission-invoice verification screen Module 17 just built is
**repurposed**, not rebuilt: same list-and-verify pattern, now verifying
top-up requests instead of invoices. §14.6c gains a one-line dormancy
notice at its top (mechanism preserved, no longer what v1.0 runs); new
**§14.6e** covers the wallet checklist (publish gate; commission debits
only a confirmed sale; grace-ladder transitions incl. instant restore;
negative-float cap; `orders_paused` storefront behavior — browsable,
checkout blocked; wallet transaction history completeness and plain-
language rendering); §14.7's FR-7.2 line is revised to match.

**v0.25 (post-Module-20 fix) — the negative-float floor (FR-6.26) was
seeded but never enforced.** The commission debit itself correctly never
blocked (§14.6e's FR-6.26 guarantee held), but nothing bounded the floor
as an actual limit: during a low-balance grace period a store could keep
taking orders indefinitely while its balance ran arbitrarily negative.
Fixed as an **immediate, grace-bypassing pause**, distinct from the
gentler warn-then-grace ladder (FR-6.25): the moment a seller's balance
crosses below the floor — checked right after a commission debit lands
(`OrdersService.markAsPaid`, never blocking the debit) and again on every
low-balance sweep pass — their active stores pause immediately, no grace
days. Restore is the same existing instant-restore path (a verified
top-up) — no second "floor" restore threshold. §14.6e's FR-6.26 checklist
line is updated to reflect active enforcement.

**v0.26 (new section, build TBD — see build-plan.md for slotting) — new
§5.33/§14.33 Growth & Partner Programs:** four gated (never self-serve)
acquisition channels — Certified Ambassador, Student Referral, Creators,
and Careers — all crediting the existing wallet/ledger (§5.6e) via three
new entry types and reactivating the dormant Payout Request &
Disbursement Engine (§5.6b) for withdrawal, rather than building parallel
commission or payout machinery. A `ReferralAttribution` row enforces
single-referral-source-per-seller at the data-model level (FR-33.3);
commission is calculated only against a referred seller's own paid
plan-subscription amount, never GMV/sales/wallet top-ups (FR-33.4).
Creator view-based rewards are gated by manual admin content
verification, never an automatic view-count payout (FR-33.7). Fraud
controls extend the existing T&S engine (§5.29) rather than a new
detector. **One item (FR-33.1, referral-source attribution captured at
seller signup) is called out to build ahead of the rest of this section**,
independent of program tables existing yet — that data cannot be
backfilled once real signups start arriving.

**v0.27 (new sections, build TBD — see build-plan.md for slotting) — new
§5.34/§14.34 Store Health Score, §5.35/§14.35 Verified Store Program, and
§5.36/§14.36 Seller Data Export to Personal Cloud Storage; a roadmap-only
note added to §5.22 (FR-22.10, future seller mobile app — documented, not
built in v1.0):** a per-store composite score (0-100, Settings-Registry-
weighted) computed entirely from data this SRS already collects — order
timeline events, cancellations, disputes, the existing §5.30 Risk Score
Engine output, and profile completeness — closes with one small, real
schema gap called out rather than glossed over (stores have no policy-text
field yet, needed for the completeness signal FR-34.1 asks for). The
Verified Store Program (§5.35) is the health score's first real consumer:
a live self-serve eligibility check, a paid application (fee is for
processing, never a guarantee — mandatory human admin audit, no
criteria-pass auto-approval), a buyer-facing badge at the storefront header
and checkout, and a revocable status with both automatic re-review
triggers and a standing admin override, all audit-logged. Data Export
(§5.36) is fully independent of both — a seller-value convenience reusing
three already-built mechanisms (CSV export, PDF generation, the Google
Drive integration) end to end, explicitly **not** a substitute for the
platform's own off-box backup NFR (§6), which stays binding regardless of
whether a given seller has Drive connected.

**v0.29 (new sections; §5.37/§14.37 built as Module 26, §5.38/§14.38 built
as Module 27 (v0.30 extended it with the tracking timeline), §5.39/§14.39
built as Module 28) — new
§5.37/§14.37 Order Verification Channel Adapter, §5.38/§14.38 Orders
Command Center, and §5.39/§14.39 Inventory Management (founder-requested,
competitive-gap-driven — Shopify ships none of the three):** Order
Verification (§5.37) is the headline item: a per-store Verification
Channel Adapter (§3.5's established pattern — one interface, swappable
implementations) with three v1.0 channels a seller picks between —
WhatsApp OTP (manual/link-assisted in v1.0, interface designed for a
future automated WhatsApp Business API adapter), Email OTP (sent from the
seller's own connected SMTP account, never the platform's, credentials
encrypted at rest the same way as the existing Drive refresh token/CNIC
identity fields), and Prepaid Confirmation (a small advance the seller
collects directly, same Direct Seller Collection trust model as
everything else — the platform never touches it). An order placed against
a store with verification enabled is held out of every sale count exactly
the way an unpaid order already is (§3.12's Financial Truth Invariant is
extended, not duplicated — verification becomes an additional gate on the
same `confirmed` transition, not a second source of truth). OTP handling
(TTL, rate limit, retry cap, single-use, per-email daily send cap with
rotation across up to five connected sender addresses) is fully
Settings-Registry-driven, never hard-coded. Orders Command Center (§5.38)
adds one new read — a bucketed order-state aggregation (pending,
awaiting-verification, prepaid-received, awaiting-tracking, shipped,
delivered, cancelled/returned) plus the supplier fulfillment checklist —
computed entirely from state Module 9 already tracks (`OrderStatus`,
`OrderItemFulfillmentStatus`, this amendment's new verification status);
no new source of truth, purely a derived, Simplicity-Invariant-governed
view. Inventory Management (§5.39) is a dedicated stock screen — levels,
low-stock alerts (Settings-driven threshold), bulk edits reusing the
existing CSV import machinery (FR-18.1/18.3), and a new append-only stock-
adjustment log (who/when/why) — reusing `stockQuantity` and the existing
oversell-protection logic verbatim (no change to checkout's stock-decrement
path). An inventory CSV becomes a new artifact in the existing Data Export
bundle (§5.36), under the same explicit non-substitution statement
(FR-36.5) as every other export artifact. **Explicitly deferred, roadmap-
only, not built in v1.0:** automated WhatsApp/SMS API-based verification
(FR-37.9) and any third-party AI (ChatGPT/Claude-class) integration
anywhere in inventory or elsewhere (FR-39.7) — the latter is withheld
until a dedicated AI-integration/data-liability policy exists, not because
of any technical gap.

**v0.30 (new sections; §5.38/§14.38's tracking-timeline extension built as
part of Module 27, §5.40/§14.40 built as Module 29, §5.41/§14.41 built as
Module 30, §5.42/§14.42 built as Module 31) —
extends §5.38/§14.38 Orders Command
Center with a public/seller tracking timeline, and adds §5.40/§14.40
Delivery-Time Badges, §5.41/§14.41 WhatsApp Semi-Automation, and
§5.42/§14.42 Automated Profit & Loss Engine (founder-requested,
competitive-gap-driven):** The Orders Command Center extension (§5.38) is
the smallest of the four in practice — role-based
tracking upload (seller for self-fulfilled items, supplier for their own,
ownership-checked) has existed correctly since Module 8/9; the actual gap
is that the public order-status page and the seller's own order-detail
view only ever showed a flat status string, never a placed → confirmed →
shipped → delivered timeline. This amendment adds that one computed,
derived-from-existing-state timeline to both surfaces — no new upload
path, no new source of truth. Delivery-Time Badges (§5.40) is similarly
smaller than it first appears: Module 8's per-listing delivery-estimate
and supported-countries data is already computed and attached to every
storefront product payload (`supplierShipping`) — it has simply never
been rendered; this amendment is close to pure frontend. WhatsApp
Semi-Automation (§5.41) generates a ready-to-send `wa.me` deep link (reusing
§5.37's WhatsApp Otp Adapter's exact link-construction pattern) for three
seller-triggered moments — order confirmation, shipping/tracking update,
and abandoned-cart recovery — with seller-editable message templates
(Settings Registry, same pattern as FR-37.6); abandoned carts (flagged
since Module 9/15.2 but never surfaced to any seller) get their first
seller-facing list. **Explicitly deferred, roadmap-only:** a fully
automated WhatsApp Business API send sequence (paid, Meta-gated) — v1.0 is
always a seller-clicked, one-message-at-a-time send, never a background
push. The Automated Profit & Loss Engine (§5.42) is the one genuinely new
financial-data surface: seller-entered per-variant base cost, optional
per-order courier/handling costs, and manual/CSV ad-spend entries per
period are subtracted from the revenue/commission/discount/shipping/tax
data every order already carries (§3.12's Financial Truth Invariant
applies unchanged — only `confirmed`+ orders are ever counted) to compute
true net profit, per order and per period. **Explicitly deferred,
roadmap-only:** automated Facebook/TikTok ad-account API sync and
automated local-courier-API cost sync — v1.0's manual/CSV ad-spend entry
point is designed so a future ad-spend source can plug in without
reworking the aggregation, but no such integration exists yet.

**v0.31 (new sections; build TBD — see build-plan.md for slotting) — adds
§5.43/§14.43 Built-in Email Verification Service, §5.44/§14.44 One-Click
Shopify Migration, §5.45/§14.45 Cost-Savings Calculator, §5.46/§14.46
Seller Trust & Achievement Badge Engine, §5.47/§14.47 Emotional &
Retention Layer, and §5.48/§14.48 Community & Belonging (founder-requested,
acquisition/retention-driven). Platform stays English-only in v1.0 (no
Urdu/Hinglish) — §3.9's i18n-readiness discipline (no hard-coded UI
strings/date/currency formatting outside a translation-key/locale layer)
stays binding regardless, so a future locale is content work, not a
rewrite:** The Built-in Email Verification Service (§5.43) is a fourth
option inside §5.37's existing Verification Channel Adapter — a
platform-hosted send path requiring zero seller setup, plan-quota-gated,
architected behind a new `EmailServiceProvider` interface specifically so
it can be extracted into a standalone SaaS later without touching any
caller (same adapter-extraction discipline as §3.5) — and explicitly
documented as a convenience default, never the sole verification path,
given v1.0 platform email has no SPF/DKIM/DMARC alignment or sender-
reputation warming yet. One-Click Shopify Migration (§5.44) extends the
existing CSV import engine (FR-18.1/18.3) with Shopify-format parsers for
products/variants/images, customers, and orders, plus a guided
mapping/preview/error-report flow — no new import engine, and every
imported product still passes the existing Moderation Engine (§5.27)
exactly like a manually-created one. The Cost-Savings Calculator (§5.45)
is a marketing-site widget computing estimated annual savings
(UZEYN's plan fee + 1% commission vs. Shopify's subscription + fees) from
every comparison figure as admin-editable Settings Registry data, never
hard-coded, always labeled as an estimate. The Seller Trust & Achievement
Badge Engine (§5.46) is one shared, Settings-Registry-threshold-driven
evaluation engine computing earned, auto-revocable badges from data this
SRS already tracks (Store Health Score §5.34, fulfillment speed, order
volume, tenure) — badges are derived, never seller-settable — with two
consumers: this section's own public storefront badges (buyer trust,
distinct from §5.40's logistics-only Delivery-Time Badges) and §5.47's
private dashboard achievement badges (same engine, a different badge set,
seller-facing only). The Emotional & Retention Layer (§5.47) reframes the
existing onboarding wizard (FR-20.1) as a guided, encouraging tour with a
completion celebration, adds once-per-threshold milestone celebrations
computed from confirmed-sale data only (§3.12's Financial Truth Invariant
reaffirmed, not duplicated), and builds its private achievement badges on
§5.46's engine. Community & Belonging (§5.48) is a deliberately lean v1.0
foundation — seller-submitted success stories, admin curation (reusing
§5.27/§5.33's existing submit → moderate → publish shape), and an opt-in
Featured Sellers surface tying into the already-built §5.33 Growth &
Partner Programs (Ambassador/Teams) infrastructure — richer community
features (forums, seller-to-seller messaging) are an explicit roadmap
note, not a v1.0 gap.

**v0.32 (new sections; build TBD — see build-plan.md for slotting) — adds
§5.49/§14.49 Gift Cards, §5.50/§14.50 Customer Segments, §5.51/§14.51
Email Campaigns, §5.52/§14.52 Staff Accounts (plan-tier), §5.53/§14.53
Admin Email Section, and §5.54/§14.54 Advanced Granular Admin Control
(founder-requested "Pre-Launch Enhancements" batch — built BEFORE the
design phase resumes so these new features don't force a UI redesign
later). Gift Cards (§5.49) mirrors §5.7's `DiscountCode` store-scoped
unique-code pattern plus a wallet-ledger-style derived balance (redemptions
are an append-only ledger, balance is always re-derivable, never a bare
mutable column) and is explicitly subject to §3.12's Financial Truth
Invariant — a gift card's balance activates only once its purchase order
is confirmed/paid, exactly like every other revenue-bearing event in this
SRS. Customer Segments (§5.50) adds no new source of truth — segments are
saved filter criteria evaluated live against `Customer.ordersCount`/
`totalSpent`/`lastOrderAt` (already tracked since FR-13.x), with location
derived from the customer's most recent order's shipping address (no new
column) since buyer accounts don't exist in v1.0. Email Campaigns (§5.51)
sends to one segment via the seller's own connected SMTP — reusing
Module 26's exact `SellerVerificationEmail` credential record and AES-
256-GCM encryption utility rather than a second credential store — gated
by a new plan-tier numeric Settings Registry quota (same resolution
pattern as `catalog.product_limit`), and ships this codebase's **first**
unsubscribe mechanism (none existed before this amendment). **Staff
Accounts (§5.52) is a deliberate, founder-directed reversal of a
previously repeated deferral, not a silent contradiction:** SRS v0.6
(§ near line 494), §4 User Roles, and §10's Phase 3 bullet each
previously stated seller staff sub-accounts remain "Phase 3+, reaffirmed"
— this amendment pulls seller staff accounts forward into v1.0 as a
plan-tier differentiator at the founder's explicit request; all three
prior deferral statements are marked superseded in place (not deleted)
so the SRS's own decision history stays intact. The "general admin
sub-role/permissions system" half of that same original deferral remains
deferred — §5.53/§5.54 extend admin capability through existing/new
admin-scoped mechanisms, not a new generic permissions framework. Admin
Email Section (§5.53) is UZEYN's own unified inbox — admin-global (no
RLS, same category as `AdminAuditLog`/`ImpersonationSession`), SMTP+IMAP
credentials encrypted at rest under their own independent key (same
"rotates independently" convention `SMTP_CREDENTIAL_ENCRYPTION_KEY`
already established), no AI in v1.0 (roadmap note only, §5.22) — the
founder replies personally. Advanced Granular Admin Control (§5.54) adds
four narrow, audit-logged admin actions (block a seller's new-listing
ability, instant single-product takedown via a new `admin_removed`
moderation state, supplier-listed-product block/approve through the
existing moderation queue, and per-seller feature-flag override) — closing
the exact gap `seller-lifecycle.service.ts`'s own doc comment already
disclosed, additive to (not a replacement for) the existing
`SellerLifecycleStatus` ladder (§5.29). **Roadmap-only notes added to
§5.22** (not built, documented so v1.0's schema isn't redesigned later):
sell-on-social/marketplaces, sell-in-AI-chats, B2B catalogs, POS/
in-person selling, multi-currency selling, storefront translation,
headless commerce, AI-assisted store design, and AI-assisted email
(covering both §5.51's campaigns and §5.53's admin inbox). Also:
`docs/launch-runbook.md` gains a founder-ops section on business email
setup for the UZEYN domain (Cloudflare Email Routing + Gmail "send as" as
the v1 approach, self-hosted Mailcow/Mailu noted as a later option) —
operational documentation, not application code, so it carries no FR
number.**

**v0.33 (deep-audit Phase A — launch blockers; six findings where a
business decision changed in discussion but never reached the code,
found by a full pre-audit sweep of the built platform against this
document). Also corrects a long-standing drift: the header **Version:**
marker above had been stuck at 0.31 since before v0.32 shipped — bumped
to 0.33 here, and this paragraph is the authoritative record of what
changed in both v0.32 and v0.33 relative to the last time it moved.**
**(1) No Free Plan, no free trial (§5.7, §5.23, §5.31, §5.6e) —
CRITICAL.** FR-7.3 is rewritten in place: there is no Free plan tier.
Every seller starts on a discounted first-billing-cycle entry (**First
Month**, a real, distinct, paid `Plan` row at `tierOrder 0`, full Starter
feature set, 2% commission, Rs. 1,499 for the first cycle) that
auto-transitions to Starter at its regular current price via the
existing `Subscription.pendingPlanId`/next-cycle mechanism FR-7.5 already
defines — no new transition machinery. FR-7.2's "insufficient balance
downgrades to Free" clause is struck and replaced: a plan-fee shortfall
now folds into the **same** `orders_paused` wallet grace ladder FR-6.25
already runs for commission shortfalls (one mechanism, not two) — a
seller without an active paid subscription simply cannot publish
(FR-6.21 unchanged) or keeps operating in a paused state, **never** a
free tier to fall back to. This retires all three
`plan.findFirst({tierOrder: 0})` Free-plan-fallback call sites the audit
found (`plan-fee-debit.service.ts` ×2, `subscriptions.service.ts`'s
team-leave-triggered downgrade) — FR-7.13 (§5.31) is amended to match:
leaving a team pauses the member's store(s) at period end instead of
reassigning them to Free. FR-23.1/23.2/23.3/23.4/23.5 (§5.23) are
reworded to drop every "Free-Plan"-specific frame — quota enforcement,
dormant-store lifecycle, and the no-trial principle all already applied
generically per-tier and read cleaner without a tier that no longer
exists; FR-23.3 is strengthened, not weakened, by this change (there is
now no free entry point of any kind to time-box, so "no trial" is
trivially, structurally true rather than merely enforced). The
now-purposeless Free-store-per-identity velocity limit (FR-23.5's second
clause, and its entire backing `FreeStoreLimitService`) is retired along
with the free/paid store split the FR-23.4 unit-economics dashboard used
to report — both existed only to guard a tier that no longer exists.
**(2) Full pricing data model (§5.7, new FR-7.19).** `Plan` gains a
`regularPrice` column (nullable; the plan editor and pricing page render
it struck through beside the current `price` whenever the two differ —
`price` remains the single field that's actually billed, so "campaign"
pricing is simply an admin lowering `price` further for a window,
requiring no third price field or new mechanism). Launch defaults for
all four tiers (First Month, Starter, Growth, Pro — the SRS's own FR-7.1
illustrative tier names are hereby made real, replacing the as-seeded
`Standard`/`Pro` naming drift the audit also flagged) are founder-set
plan-editor **data**, documented in `docs/database-schema.md`'s seed
notes, never hard-coded — consistent with FR-7.1's binding "plan
data, not code" discipline. Yearly billing = 10 months' price (2 months
free) is FR-7.6's existing `yearlyDiscountPercent` mechanism, seeded at
16.67% (2/12) for every tier — no new field. The pricing page (FR-7.19)
must render a struck-through regular price, a "Most Popular" badge on
one admin-designated tier, a long value-stacked per-tier feature list,
and a Shopify cost-comparison line — all plan/settings data per FR-7.17's
existing "never hard-coded in the frontend" rule, extended to price
display, not a carve-out from it. **(3) Commission rate hard cap
(§5.7, FR-7.4 amended).** `billing.commission_rate_percent`'s
`SettingsDefinition.validation.max` tightens from 100 to **2** — a real
business ceiling, not the previous purely-mathematical percent bound.
`SettingsService.validateValue()` already enforces `validation.min`/`max`
generically (confirmed: zero new validation code needed), and the admin
settings screen's existing `isHighImpact()` check already matches every
`billing.`-prefixed key including this one (confirmed: zero new
confirmation-UI code needed) — this fix is a data/seed change plus a
test proving an over-cap `setValue()` call is rejected, not new
mechanism. **(4) Self-fulfilled stock protection (§5.5, §5.39 FR-39.5
corrected).** FR-39.5's claim that checkout already reuses "the existing
oversell-protection decrement logic" for every product was false — the
audit confirmed the atomic conditional-decrement pattern
(`supplierListingId`-gated `updateMany({where: {stockQuantity: {gte:
qty}}}`) is wired **only** to supplier-fulfilled line items;
self-fulfilled `ProductVariant.stockQuantity` is fetched for pricing but
never checked or decremented at checkout. FR-39.5 is rewritten:
self-fulfilled checkout now applies the identical atomic pattern,
gated by a new `ProductVariant.trackInventory` boolean (default `true`;
a seller can mark a variant untracked/unlimited-stock, the explicit
opt-out the audit called for) — one oversell-protection mechanism across
both fulfillment paths, not two. **(5) Wallet balance — running total,
not re-aggregation (§5.6e, FR-6.21 amended, new FR-6.29).** FR-6.21's
"Balance = sum of credits minus sum of debits, always computed, never
stored redundantly" principle is **reversed** here, deliberately: at
nine call sites across every hot path (checkout, the grace-ladder sweep,
payouts, the publish gate), `getBalance()` was re-summing a seller's
entire ledger history on every call — both a scaling problem and, more
seriously, a correctness one (two concurrent orders reading the same
stale re-aggregated balance can both pass an affordability check that
only one should). A new `WalletBalance.balance` running-total column
(one row per seller) is updated atomically, in the same transaction as
every `LedgerEntry` insert; the ledger stays the append-only source of
truth, the column becomes its verified, race-free cache — `getBalance()`
becomes an O(1) read. A new daily reconciliation job (FR-6.29; none
existed before this amendment — confirmed by the audit, not a
regression) recomputes each seller's ledger sum and flags any drift from
the cached column for admin visibility. **(6) Facebook/Instagram Shop
feed + WhatsApp catalog links (new §5.55, Growth+).** Two genuinely new,
plan-gated capabilities, both reusing existing machinery rather than
building new integrations: a Meta Commerce Catalog-compliant product
feed (extends FR-24.9's existing Product Feed API's field set —
`availability`/`condition`/`description`/`brand`/`currency` — the
existing feed's minimal shape was built for a different, founder-owned
Social Media SaaS product and was never Meta-format-compliant, so this
ships as a new endpoint alongside it, not a breaking change to it), and
a product-level "share on WhatsApp" deep link extending §5.41's existing
`wa.me` link generator to a fourth, product-scoped trigger not tied to
an existing Order/Cart (the three existing generators all require one).
Both are gated Growth-tier-and-above via the Settings Registry
`allowedScopes: ["plan"]` pattern FR-7.1's product-limit gating already
established — the idiomatic template, not a new gating mechanism. Full
WhatsApp Business API catalog sync remains FR-41.4's existing
roadmap-only deferral, unchanged.

**Changelog v0.1 → v0.2:** Added platform's-own-site design requirement, advanced/
custom theme code option for sellers, seller-initiated supplier invite flow, generic
supplier adapter/plugin interface, hold-graduation mechanism, shared-identity hook
for the future social SaaS, explicit tenant-isolation enforcement mechanism,
expanded security section, explicit statelessness/connection-pooling/session-
handling requirements for scaling, a Risk Register, content-moderation requirement,
and resolved open decisions (supplier integration order, payment gateway direction,
solo-founder pacing).

**Changelog v0.2 → v0.3:** Added the **Settings Registry** architectural pattern
and rebuilt the Admin Terminal section into a full **Admin Control Plane** — feature
flags, plan/pricing editing, commission & hold configuration, seller/supplier
lifecycle control with audited impersonation, template management, announcements/
maintenance mode, risk & fraud controls, an enforced-immutable audit log, and live
analytics — all as DB-backed configuration every module reads at runtime, so
day-to-day operational changes never require a code deployment.

**Changelog v0.3 → v0.4:** v1.0 became Safepay-only (prepaid); COD reclassified as a
deferred, per-seller, balance-gated Settings Registry feature. Added the **Payout
Request & Disbursement Engine**, supplier listing transparency + checkout country-
blocking + live price re-validation + an admin adapter registry, self-fulfilled
shipping settings, basic discount codes, a currency-ready schema, the
**self-host-first principle** (object storage moved to self-hosted MinIO), same-VPS
staging, the first **Acceptance Checklists** (§14) with a binding module-gating
process rule, admin-editable **Content Pages**, and `docs/legal/` drafts.

**Changelog v0.4 → v0.5:** Added 16 new v1.0 commerce features (Customers/CRM,
product reviews, cart persistence + abandoned-cart flagging, storefront discovery &
merchandising, manual/draft orders, order notes/tags/timeline + editing, CSV
import/export, self-hosted PDF invoices, tax settings, seller onboarding wizard);
documented 7 v1.1 features ahead of time; expanded the pricing/plan mechanism (Free
Plan, inverse commission laddering, yearly billing, launch campaigns); added
Business Guard-Rails; recorded Phase 2+ roadmap items (RTL/i18n-readiness, Markaz,
template-marketplace hook); added a cross-cutting buyer-facing "luxury" polish NFR;
and flagged four of the sixteen new features as timeline risks for the founder's
cut decision, without resolving them unilaterally.

**Changelog v0.5 → v0.6 (this revision):**
- **Fixed a documentation regression:** v0.5 replaced the full text of §3.1–§3.8,
  §4, §5.0–§5.12, §6.5, §9's v0.4 rows, §11, Risks 1–14, Open Questions 1–4, and
  Acceptance Checklists §14.0–§14.12 with "unchanged, see prior version" summaries.
  **All of that content is restored in full below** — the SRS is the living master
  document and no requirement may exist only in git history. The same regression was
  present in `docs/database-schema.md` (v0.4 table column definitions were
  summarized to a bare table-name list) and is fixed there too.
- **Resolved all four v0.5 timeline-risk flags** (Risks 15–18), each with bounded
  v1.0 scope per the founder's decision: CSV import maps core fields only, with
  unmapped fields listed explicitly per upload (FR-18.1); manual orders ship
  mark-as-paid only in v1.0, the payment-link path moves to v1.1 (FR-17.1); cart
  email-capture timing is now a **locked UX decision** — checkout is email-first
  (FR-15.1); PDF invoices ship exactly one template meeting a "clean and
  professional" bar with a single founder sign-off (FR-19.2).
- **Two external-SaaS integration hooks specified** (§5.24): a **Template Store**
  hook (built-in free templates always ship; a premium-template showcase links out;
  a signed Template Install/License API imports a purchased template directly into
  a seller's account — import-only, no downloadable files, license-validated) and a
  **Social Media SaaS** hook (a "Marketing" entry point in the seller dashboard
  using the existing SSO hook, no second login; a seller-scoped, rate-limited,
  revocable **Product Feed API**). uzeyn.com builds only its own side of each hook.
- **Small v1.0 storefront additions** (§5.16 extended): social media links,
  an FAQ accordion section type, and richer footer content blocks.
- **Confirmed, not pulled forward:** seller staff sub-accounts / admin sub-roles
  remain Phase 3, exactly as already documented — reaffirmed, not expanded.
  **Superseded by v0.32/§5.52:** seller staff sub-accounts specifically were
  later pulled forward into v1.0 as a plan-tier differentiator, at the
  founder's explicit direction — this v0.6 statement is preserved for
  decision-history purposes, not deleted. The "general admin sub-role/
  permissions system" half of this statement remains deferred.
- **Two new risks** (19–20) for the SaaS hooks' license/entitlement and API-token
  attack surfaces; several small consistency fixes (see §12, and the completeness
  audit delivered alongside this revision).

**Changelog v0.6 → v0.7 (build-phase amendments, this revision):**
- **Pinned the Settings Registry precedence** (§3.8) to `seller > store > plan >
  category > global`, resolved during Module 1 planning (previously an open
  proposal in `docs/build-plan.md`).
- **Added §5.25 Authentication & Account Security** (FR-25.1–25.4): self-serve
  password reset, approved as a genuine gap found during Module 1 planning and
  built in Module 1 alongside signup/login.
- **Approved before Module 2 — seven further additions**, each slotted into the
  existing build sequence (see `docs/build-plan.md` for exact module numbers):
  regional launch gating with an admin-managed allowed-countries list and a
  waitlist for non-launched countries (FR-25.5); admin-granted plans and
  platform-level subscription promotion codes, distinct from store-level
  discount codes (FR-7.8–7.9); in-app messaging — banners, popups, and
  in-app notifications, each targetable and scheduled (FR-8.15, extends FR-8.7);
  platform brand-asset management (logo/favicon/hero images), plus a confirmation
  that per-plan template-tier gating already has no gap (FR-12.3); a mobile-app-
  readiness NFR making the API the single source of truth (§6); a Phase 4+
  region-sharded-deployment architecture note, not a v1.0 build item (§3.6); and
  referral attribution plus cross-SaaS discount eligibility for both external-SaaS
  hooks (FR-24.13–24.14).
- **One inconsistency found and fixed while amending:** `docs/mvp-v1-cutlist.md`
  listed "scheduled/multi-banner announcements" as deferred to v1.1, which had
  already been contradicted by v0.6's own FR-8.7 (which specified *scheduled*
  banners for v1.0). FR-8.15 supersedes both — targeted, scheduled messaging
  across three channels is now explicitly v1.0 scope, and the cutlist is
  corrected accordingly.
- **One genuine spec gap found and closed while planning Module 2, flagged to
  the founder before any code was written (per the binding "stop and flag"
  rule):** FR-9.1 (Google Drive import) always assumed an OAuth connection but
  no version of this SRS or `docs/database-schema.md` ever defined where those
  tokens live. Resolved: a new `google_drive_connections` table (seller-scoped)
  stores an **encrypted** refresh token only; the short-lived access token is
  never persisted to Postgres — Redis only, for an active import job's
  duration. Revocation is seller-initiated and audit-trailed. See FR-9.1, the
  new §6.5 bullet, and §14.2's new checklist items.

**Changelog v0.7 → v0.8 (build-phase amendment, approved before Module 4):**
- **Platform Event Log added** (§3.11, FR-26.1–26.5): an append-only
  `platform_events` table, same insert-only-grant immutability discipline as
  `admin_audit_logs`. Lean, business-lifecycle-only taxonomy (a new event
  type must pass the "would this appear on a growth or unit-economics
  report" test) — explicitly not page-view/click tracking. No PII in
  `metadata` (§6.5). Non-blocking emission — a failed event write never fails
  the user's action. Retention/archival threshold is a Settings Registry
  entry (`platform_events.retention_days`); no archival job exists yet.
- **Backfilled into Modules 1–3** (already-built, already-approved code):
  `seller.signup`, `store.created` (Module 1); `product.created`,
  `media.imported` (Module 2); `domain.attached`, `domain.verified`
  (Module 3) — a small addition, not a redesign of any of those modules.
  Every module from Module 4 onward emits its own lifecycle events as part
  of that module's build, and gains an "events emitted" line in its §14
  checklist.
- **Zero dashboard work in this revision:** FR-8.10 (real-time analytics) and
  FR-23.4 (unit-economics) are unchanged today — they read from live
  transactional tables exactly as before; `platform_events` is a substrate
  they read from *later*, per explicit founder instruction.

**Changelog v0.8 → v0.9 (build-phase amendment, mid-Module-4, genuine gap
closure — flagged before being silently improvised):**
- **FR-1.5 rewritten.** No version of this SRS through v0.8 ever specified
  where SEO meta title/description actually live in the schema, despite
  FR-16.6 already requiring structured-data/Open Graph tags to read from
  them. Resolved as nullable `seo_title`/`seo_description` columns directly
  on `stores` (storefront homepage default/fallback), `products` (product
  pages), and `collections` (once that table is built, Module 5); v1.1 store
  pages/blog posts (FR-22.4) get the same pair when that module ships. A
  binding fallback rule is now documented: null `seo_title` renders the
  entity's own name/title; null `seo_description` derives from the entity's
  own description (truncated), or the store-level default if the entity has
  neither. One source of truth — FR-16.6 never gets a second, parallel set of
  SEO data.
- **Sitemap/robots.txt scope pulled forward into Module 4** (previously
  unscheduled): per-store `sitemap.xml`/`robots.txt`, generated dynamically
  per request (no static file, no cron), covering whatever public pages exist
  as of Module 4 (storefront home + products) — Module 5 extends the same
  generator with collection pages once those exist, not a redesign. URLs use
  the store's verified custom domain (FR-11.2) when one exists, otherwise the
  free subdomain. A store in `coming_soon`/`password_protected` access mode
  (FR-16.5) serves a `noindex` robots.txt and no sitemap at all.
- **§14.1 gains three checklist items:** the SEO fallback chain renders
  correctly when fields are null; sitemap URLs match the store's active
  domain; a hidden store serves `noindex` with no sitemap.
- See `docs/database-schema.md`'s `stores`/`products`/`collections` table
  notes for the exact column definitions.

**Changelog v0.9 → v0.10 (build-phase amendment, approved before Module 5):**
- **Seller Account Security (§5.25, FR-25.6–25.7, new):** TOTP 2FA for
  sellers, reusing the exact `User.mfaSecret`/`mfaEnabled` fields and
  `otplib` machinery Module 1 already built for admin MFA — a second
  controller/flow, not new infrastructure. Enforcement mode
  (`auth.seller_mfa_enforcement`: `optional` / `required_for_payout_actions`
  / `required_always`) and the concurrent-device limit
  (`auth.max_concurrent_devices`, default 3) are both Settings Registry keys,
  the second usable at `global`/`plan`/`seller` scope so an individual
  seller's paid extra-device-slot add-on is just a seller-scoped override —
  no new scope type, no billing flow built now (mechanism now, monetization
  decision at launch, per founder instruction). Sellers see and can revoke
  their active sessions/devices from the dashboard; the underlying session
  store is Redis (§3.2a, already built), extended with device-label/IP/
  last-active metadata per entry. **Slotted as a new module inserted
  immediately before Payouts & Disbursement** (`docs/build-plan.md`) because
  `required_for_payout_actions` enforcement is meaningless unless 2FA already
  exists by the time a seller can request a payout.
- **Financial Truth Invariant (§3.12, new, binding NFR):** an order/sale
  exists in any seller-visible or admin-visible surface — dashboards,
  analytics, reports, `platform_events` — **only** after payment is verified
  via a signed gateway webhook, or an explicit mark-as-paid for a manual
  order. No pending/unconfirmed/failed order counts as a sale anywhere.
  Pinned now, **before Orders, Cart & Checkout and Payments & Ledger are
  designed**, specifically so their schemas are built around this
  rule rather than retrofitted to it. Every money-adjacent module's §14
  checklist (14.5, 14.6, 14.8, 14.21, 14.23) gains a line requiring a test
  that proves unpaid orders are excluded from every count.
- **Listing Moderation Engine (§5.27, FR-27.1–27.7, new):** admin-managed
  banned/restricted keyword lists and restricted-category rules (Settings
  Registry-backed, no new table), new-seller probation (first N products
  manually reviewed, N configurable), trusted-seller auto-approve
  (`sellers.is_trusted`), a moderation queue, and a new, narrowly-scoped
  **REVIEWER** admin sub-role (§4) that sees only the moderation queue —
  every decision audit-logged via the existing `admin_audit_logs` mechanism,
  no new audit table. Products under review are not publicly visible.
  **Slotted as a new module immediately after Discovery & Merchandising**
  (`docs/build-plan.md`) — zero-cost and rule-based by design, required live
  before public launch, not gated on anything Discovery-specific. Building it
  will require a small follow-up amendment adding a moderation-status filter
  to Module 4's public storefront product listing and Module 5's Discovery
  search/collection queries — flagged now, not a silent gap when that module
  starts.
- **FR-1.1 reaffirmed, one line:** the premium visual bar is **apple.com-level
  minimalism** and **horizonx.so-level motion**, including video hero banners
  in themes — still gated on founder-delivered branding assets (same
  Module 18/Module 4 dependency `docs/build-plan.md` already flagged).
- **§4 gains a narrow exception, not a reversal:** a full fine-grained
  admin-permission system stays Phase 3+ (unchanged), but REVIEWER is added
  now as one purpose-built sub-role scoped to exactly one surface (the
  moderation queue), required for the Listing Moderation Engine's launch-
  blocking legal-safety requirement.

**Changelog v0.10 → v0.11 (build-phase amendment, approved after Module 6):**
- **FR-27.6 amended, one slotting confirmation, no behavior change:** the
  REVIEWER sub-role's moderation queue needs a bare functional admin page
  (list the queue, view a queued product, approve/reject with notes — no
  design pass) before public launch. Module 6 itself was built API-only by
  design (the queue's four endpoints, no dashboard route) since §14.25 is
  entirely backend-behavioral and doesn't require rendering anything to
  pass; that meant no module currently on the books actually builds the
  page. Explicitly slotted into **Module 16 (Admin Control Plane
  completion)**, alongside that module's other bare-functional admin
  surfaces, rather than left implicit. §14.8 (Module 16's checklist) gains
  one line for it.

**Changelog v0.11 → v0.12 (build-phase amendment, approved after Module 7):**
- **New Seller Dashboard UI module (§5.28, FR-28.1–28.3):** Modules 2
  (Catalog & Media) and 7 (Shipping, Tax & Discounts) both shipped API-only
  by deliberate precedent — no seller-dashboard pages existed for products/
  media or shipping/tax/discount codes, only the endpoints those pages will
  call. Reviewing the sequence after Module 7 surfaced that **no module
  owned building those pages** — §14.2's checklist tests backend behavior,
  not a rendered screen, and the Seller Onboarding Wizard (old Module 15)
  assumes real dashboard screens already exist to link a new seller into.
  Closed now with a dedicated module, inserted **immediately after Module 9
  (Orders, Cart & Checkout)** so order-management screens are included too,
  and before the Onboarding Wizard (renumbered accordingly, see
  `docs/build-plan.md`). Scope also sweeps in any other seller-facing
  screen still missing its UI by the time this module is actually built
  (e.g. the Supplier Portal's seller-side view), confirmed against the
  then-current module list rather than assumed complete from this list alone.
- **New SIMPLICITY INVARIANT (§3.13, binding NFR):** "advanced under the
  hood, effortless on the surface" — the seller dashboard must be more
  readable and beginner-friendly than Shopify's, never more complex. Five
  rules: (a) glanceable, plain-language screens; (b) progressive disclosure
  — advanced options behind expanders, never cluttering the default view;
  (c) every core task (add product, set shipping, create discount, view
  orders) completable with zero documentation; (d) consistent layout
  patterns across every screen; (e) purposeful empty states that explain
  the screen and offer the next action. Governs the Seller Dashboard UI
  module first, and every seller-facing screen in any module after it.
  §14.26 (new) is that module's Acceptance Checklist, including a
  "beginner walkthrough" review against these five rules for each core task.

**Changelog v0.12 → v0.13 (build-phase amendment, approved after Module 8):**
- **FR-27.8 (new, §5.27) - the Listing Moderation Engine now covers
  supplier-sourced listings too, closing a gap identified during Module
  8's review.** Module 8 shipped supplier-sourced products with
  `moderation_status: "not_required"` set unconditionally, reasoning that
  the seller's own listing-review approval (FR-2.7/FR-3.2) already served
  a launch-blocking-legal-safety purpose. On review, that conflated two
  distinct decisions: a seller approving a supplier's listing is judging
  *fulfillment quality* ("I want to sell this in my store"), not the
  platform's own legal-safety content check - the same check every
  self-fulfilled listing already goes through. FR-27.8 runs
  `ModerationService.evaluateNewProduct()` at the moment of seller
  approval: a banned keyword blocks the approval outright; a restricted
  keyword/category still lets the seller approve, but the resulting
  product enters the moderation queue (invisible until a Reviewer/Admin
  also approves it); a trusted seller's approval bypasses the engine
  entirely, identically to a trusted seller's self-fulfilled submission.
  **New-seller probation (FR-27.3) is explicitly scoped to self-fulfilled
  listings only** - a supplier-sourced listing already passed the seller's
  own review gate, so counting it toward "first N submitted products"
  would double-gate the same decision. §14.25 gains two lines (a banned
  supplier listing is blocked at approval; a restricted supplier listing
  stays invisible until platform approval, proven as two independent
  gates).

**Changelog v0.13 → v0.14 (build-phase amendment, approved after Module 9):**
- **Module 9 (Orders, Cart & Checkout) built**, completing FR-5.x/FR-15.x/
  FR-17.x per §14.5/§14.15/§14.17, and - now that a real order exists to
  wire against - finishing three things Module 8 explicitly deferred here:
  FR-3.3/FR-3.4 (supplier multi-store order view + tracking upload),
  FR-4.5/FR-4.7/FR-4.8 (oversell protection, country-block, and price
  revalidation, all wired into a live checkout).
- **FR-2.7/FR-3.2 completeness fix, found while building Module 9:** a
  supplier listing's approval was creating only the `products` row, never
  the `product_variants` row every cart/order line references by
  `variantId` - a supplier-sourced product was therefore approved but
  silently unpurchasable. Fixed in `ListingReviewsService.approve()`,
  which now creates exactly one variant per approved listing (v1.0's
  supplier listings have no options/variants of their own).
- **FR-5.3 clarified and correctly implemented:** a `suspended` store now
  resolves to a distinct, buyer-facing "temporarily unavailable" state
  (`403 store_suspended`) rather than the same generic 404 a truly
  nonexistent/banned/archived store returns - the difference this FR
  always called for, not implemented until Module 9 needed it for
  checkout's own suspended-store gate.
- **§14.6 (Payments, Commission, Ledger & Payout Engine) remains entirely
  out of Module 9's scope**, per `docs/build-plan.md`'s dependency table -
  `ledger_entries` does not exist until Module 10/11. Module 9 builds only
  what's real without it: a `payments` row for the v1.0 manual mark-as-paid
  path (FR-17.1), and `order.placed` firing at that same confirmation
  point (§3.11/§3.12). **FR-17.5's "compensating ledger entry" clause is
  correspondingly deferred**: an edit to a confirmed order's total is
  computed and stored correctly on the order itself (and its stock/
  timeline effects are real), but no ledger-side compensating entry is
  written - there is no ledger yet to compensate. Module 10/11 closes this
  the same way Module 9 closed Module 8's FR-4.5/4.7/4.8 deferral.

**Changelog v0.14 → v0.15 (major business-model amendment, approved before
Module 10 - timed deliberately, since Payments/Ledger had not yet been
built):**
- **Payment model pivot: Direct Seller Collection replaces platform-collected
  payments for v1.0 (new §5.6c, FR-6.14-6.20).** Buyers pay sellers directly
  via seller-configured instructions (bank transfer/JazzCash/Easypaisa, plus
  an unconditionally-permitted COD - the commission-inversion problem that
  gated COD before doesn't apply once the platform never holds any sale's
  funds). Module 9's existing `markAsPaid()` is unchanged and is now the
  universal payment-confirmation path for every order - the Financial Truth
  Invariant (§3.12) is unaffected.
- **Commission becomes invoice-based, default 1% (down from 3%).** Accrued
  per confirmed sale as a `commission_accrued` ledger entry (the append-only
  `LedgerEntry` structure is retained; only the entries' direction changes -
  receivable from the seller, not payable to them); a scheduled job
  generates one monthly invoice per seller; v1.0 payment verification is
  manual (an admin marks an invoice paid, audit-logged); non-payment past a
  configurable grace period triggers **automated store suspension**, reusing
  Module 9's existing `suspended`/`403 store_suspended` mechanism (FR-5.3) -
  the platform's only enforcement lever without held funds.
- **Anti-underreporting guard-rails (FR-6.19):** since the platform can no
  longer independently verify a sale happened, per-seller cancellation-rate
  and pending-forever-rate monitors feed the new Trust & Safety system,
  identified in the risk register as v1.0's central new financial-integrity
  risk (Risk 21, effectively replacing the now-inapplicable Risk 6).
- **§5.6/§5.6a/§5.6b (Safepay, hold, hold-graduation, rolling reserve,
  payout/disbursement) are retitled DORMANT, not deleted.** Not one word of
  their content changed - they are the exact specification for reactivating
  platform-held payment collection later (international expansion, a
  regulatory requirement, or scale). Every existing cross-reference to
  FR-6.1-6.13 elsewhere in this document (risk register, checklists, role
  descriptions) is unaffected in meaning; only §5.6/5.6a/5.6b's heading and
  §14.6's checklist gained an explicit "dormant" framing. The Payment
  Adapter and Disbursement Adapter patterns (§3.5) stay in the architecture
  unchanged, ready for that reactivation.
- **New §5.29 Trust & Safety System:** a versioned Seller Agreement (FR-29.1,
  timestamp+IP acceptance, forced re-acceptance on version change), its
  facilitation-workspace/indemnification legal grounding (FR-29.2, drafted
  in `docs/legal/terms-of-service.md`, flagged for counsel review per the
  same discipline as every other legal draft), a zero-cost rule-based T&S
  engine that extends existing mechanisms rather than duplicating them
  (FR-29.3 - Module 6 moderation history, FR-23.5 signup-velocity limits,
  FR-6.19's new monitors, plus new bypass-attempt detection), and an
  enforcement ladder (FR-29.4: warning → restriction → suspension →
  permanent ban) built entirely on FR-8.4's existing seller-lifecycle admin
  controls - no parallel permissions system.
- **Supplier Premium Plan (new monetization, FR-7.10):** the plan mechanism
  (FR-7.1-7.9) gains a `supplier` plan type; the multi-store aggregated
  dashboard (FR-3.3) becomes the paid tier's flagship feature, free tier
  covers single-seller basics. **Confirmed, no gap:** a seller's own
  multi-supplier management (one seller, many linked suppliers, one
  dashboard) was already fully covered by FR-2.6/FR-2.7 and Module 8/9's
  store-scoped design - only the *supplier's* cross-store view needed this
  new FR.
- **Seller dashboard personalization (FR-28.4, slotted into the existing
  Seller Dashboard UI module, Module 10):** plan-gated dashboard themes/
  wallpapers, reusing the exact Settings-Registry plan-gating mechanism
  FR-7.1 already established for template tiers - cheap to build, still
  governed by the SIMPLICITY INVARIANT (§3.13).
- Module 10/11's scope is correspondingly simplified - see
  `docs/build-plan.md`'s revised module sequence for the concrete
  renumbering.

**Changelog v0.33 → v0.34 (approved after Phase B closed — "PROFESSIONAL
SELLER READINESS," founder rationale: positioning is beginner-friendly but
revenue comes from Growth/Pro sellers, and the platform can't yet handle
their daily workload; ships before the UI/design phase):** ten new FR
groups, §5.56-5.65, all researched against the live codebase before being
specified so each one states precisely what's reused vs. genuinely new -
see `docs/build-plan.md`'s "Professional Seller Readiness (Modules 49-58)"
section for the dependency-ordered build sequence and full research
findings.
- **§5.56 Multi-Store Per Seller (FR-56.x, plan-gated).** The schema, RLS,
  and dashboard URL structure (`/stores/[storeId]/...`) already support one
  seller owning multiple stores with full tenant isolation - confirmed, not
  assumed. What's missing is a plan-tier store-count limit (First
  Month/Starter 1, Growth 2, Pro 3-5, Settings-Registry-driven, same
  `staff.max_accounts`-style per-seller-scoped pattern) and a store-switcher
  UI over the already-existing `GET /stores` endpoint.
- **§5.57 Product Organization at Scale (FR-57.x, tags + filters).**
  Free-form seller-defined product tags (net-new `Product.tags` array
  column + GIN index - not to be confused with the existing, unrelated
  `Order.tags` field from FR-17.3) plus a dashboard product-list
  search/filter bar (SKU, tag, stock status reusing Module 28's existing
  low-stock-threshold computation, price range, category, moderation
  state) - the list endpoint has none of this today. Slotted **before**
  §5.58 (bulk product operations) since both touch the same page and
  bulk-select is easiest to add on top of an already-filterable list, not
  the reverse.
- **§5.58 Bulk Product Operations (FR-58.x).** Multi-select on the (now
  filterable) product list - price update (fixed/%), stock update,
  category/collection assign, publish/unpublish, archive/delete, tag
  assign - with a confirmation step stating exact affected-row counts. Per
  the admin moderation queue's own precedent (Module 25 P2), this reuses
  the existing single-item endpoints via a client-side fan-out rather than
  new bulk-specific backend endpoints, wrapped in the CSV-import module's
  existing discipline that every write goes through the same
  service/moderation/plan-limit path a manual edit would. **Closes a real,
  pre-existing gap surfaced by this research, not created by it:**
  `ProductsService.update()` currently never re-checks moderation on
  publish or price changes, single-item or bulk - FR-58.3 closes this for
  both paths at once, since bulk operations multiply the exposure of an
  already-live gap.
- **§5.59 Bulk Order Operations, Tracking Entry & Advanced Search
  (FR-59.x).** Multi-select bulk mark-as-paid/status-change/fulfill (each
  routed through the existing single-order `markAsPaid()`/tracking methods
  per order, never a bare `updateMany`, to preserve the Financial Truth
  Invariant's commission-accrual and customer-stats side effects); three
  tracking-entry paths (CSV upload, inline quick-entry in the orders list,
  the existing per-order detail entry, kept unchanged); and advanced
  search/filters (date+time range, status, payment state, verification
  state, courier, customer, amount range, with per-filter result counts) -
  none of which exist on the orders list endpoint today (`?status=`,
  `?bucket=`, `?tag=` only). **New schema: `Order.orderNumber`** (a
  per-store sequential human-readable identifier, backfilled for existing
  orders) - orders are UUID-only today, and a CSV mapping "order number →
  courier/tracking" needs something a seller can actually read and type.
- **§5.60 Returns & Refunds Workflow (FR-60.x, launch-critical).** Buyer-
  initiated return request (new Server Action on the existing order-status
  page, modeled directly on FR-14.1's review-submission pattern - same
  confirmed-order gate, same public-token auth) → seller approve/reject
  with a reason → refund recorded via a compensating `refund_adjustment`
  ledger entry (an enum value that has existed since v1.0's schema but was
  never wired into `WalletService`'s sign-convention sets until now - a
  live gap this amendment closes, not new architecture) → new `refunded`/
  `partially_refunded` `Order.status` values, excluded from the P&L
  engine's and unit-economics dashboard's existing `CONFIRMED_OR_BEYOND`
  gates, so a refunded sale stops counting as revenue everywhere at the
  same instant its ledger reversal lands, per the Financial Truth
  Invariant's "exactly one signal for 'this is a real sale', applied
  uniformly" clause (§3.12). Partial refunds supported (a `refundAmount`
  distinct from the order total). Admin can override seller decisions.
  This promotes and completes the `return_requests` table already reserved
  in `docs/database-schema.md`'s v1.1-ahead section (formerly deferred
  FR-22.3) rather than inventing new schema from nothing. Slotted **after**
  §5.59 since it depends on that module's order-status-transition
  groundwork (today there is no formal allowed-transitions map anywhere in
  Orders - this is the first module that needs one).
- **§5.61 Analytics Depth (FR-61.x, seller-facing).** Top products by
  revenue/units, sales-over-time charts (day/week/month), repeat-customer
  rate (derivable directly from the existing `Customer.ordersCount`/
  `totalSpent` columns Module 33 already populates), return rate (overall
  and per-product - this is why §5.61 is slotted **after** §5.60, not
  before: there is no return data to rate until returns exist), average
  order value, best sales days/times. All queryable from existing schema -
  no new tables - but genuinely new query/aggregation code (Module 17's
  analytics and Module 31's P&L engine are both admin-facing/single-period,
  with zero time-bucketing logic to reuse) and a **new frontend charting
  library** (none is installed today - both existing "analytics" pages are
  plain HTML tables). Every query applies the same `status: {not:
  "pending"}`-or-stricter filter the Financial Truth Invariant already
  requires elsewhere, so a new analytics surface doesn't become the one
  place that invariant quietly doesn't apply.
- **§5.62 Seller Notifications (FR-62.x, transactional + admin
  newsletter).** Four transactional emails, all genuinely new (new-order
  alert, daily sales summary - reusing §5.61's new time-bucketed queries,
  which is why this module is slotted **after** it - low-stock alert,
  payment/verification events); an admin-composed newsletter capability
  (informational, 2-3/week, sent from the admin terminal, with per-seller
  opt-out) modeled on Module 34's background-job-send + unsubscribe-token
  infrastructure but with the **platform's** own SMTP as sender, not a
  seller's connected mailbox - a materially different, new code path, not
  a reuse of Module 36's admin inbox (which is a personal 1:1 reply tool,
  not a broadcast mechanism, despite the adjacent name). New
  `SellerNotificationPreference` opt-out fields (no seller-side
  notification-preference model exists today - `Customer.unsubscribedAt`
  is the closest analog and is a different table for a different
  audience). Templates editable via Settings Registry where sensible,
  extending that mechanism's existing `valueType: "string"` capability to
  a new use case (email bodies), not a proven template-specific pattern in
  this codebase yet - flagged so nobody assumes otherwise.
- **§5.63 One-Click Full Export, Pro Gate (FR-63.x).** Module 24's
  on-demand export already produces one bundle covering products + orders
  + customers + inventory together, with Drive/email delivery - exactly
  the founder's ask. The only real gap is that `requestOnDemandExport()`
  has no plan-tier check at all today (only a time-based cooldown) - this
  wires in the same `SubscriptionsService.getPlanContext()` +
  Settings-Registry `allowedScopes: ["global","plan"]` pattern used
  everywhere else in this SRS. No new export engine, confirmed.
- **§5.64 Invoice/Receipt Customization, limited (FR-64.x).** New
  `Store.taxNumber`, `Store.invoiceFooterText`, `Store.invoiceTermsText`
  fields, plus wiring the already-existing-but-currently-unused
  `Seller.businessName` field into the invoice template
  (`invoice-template.ts`, currently hardcoded, one v1.0 template).
  `Store.logoMediaId` already renders on invoices today - no change needed
  there. UZEYN's own branding on the template stays mandatory and
  non-removable at every plan tier, unaffected by any of the new seller-
  controlled fields - this is a constraint on the template renderer, not a
  new mechanism.
- **§5.65 Advanced Store SEO Control (FR-65.x, plan-gated where
  sensible).** Extends the existing `resolveSeoFallback()` cascade
  (already the SRS's own binding "one, not a second parallel set of SEO
  data" mechanism, per FR-16.6) rather than adding a competing resolver:
  canonical URL, per-page robots directives, OG/social-share image+title+
  description override, structured-data toggle, and sitemap-inclusion
  control, added to `Product` and `Collection` (both already have
  `seoTitle`/`seoDescription` to extend) plus store-level defaults on
  `Store`. Custom URL slugs: `Collection.slug` already exists and is
  already seller-set - this closes the update path if one is missing.
  **`Product.slug` is genuinely new** and is additive only (a new nullable,
  unique-per-store column used for canonical-URL purposes) - v1.0's
  `/storefront/products/[productId]` UUID route is **not** replaced or
  migrated, to keep this module's scope bounded and avoid a redirect/
  legacy-URL project nobody asked for. The custom head-tag field is
  **sanitized to an explicit allowlist** (`meta`, `link`, and
  `script[type="application/ld+json"]` only, nothing else, ever) using a
  new sanitization dependency - no such utility exists anywhere in this
  codebase today (`ContentPage.bodyHtml`, the closest precedent, renders
  admin-authored HTML completely unsanitized, which is an acceptable trust
  boundary for admin-only input and an unacceptable one for seller input
  that could reach a buyer's browser) - this field is genuinely new
  infrastructure, not an extension of an existing safe pattern, and is
  scoped store-wide, not per-product, to keep the sanitization surface and
  UI both bounded.
- **Not building now (roadmap notes only, founder-specified):**
  customer-visible order notes, multi-currency display, draft products
  beyond what exists.
- See `docs/build-plan.md` for the full ten-module dependency-ordered
  build sequence (Modules 49-58) and the complete per-item research
  findings this amendment is grounded in.

---

## 1. Introduction

### 1.1 Purpose
This document defines the requirements for **uzeyn.com**, a multi-tenant e-commerce
platform (Shopify-class) that lets sellers launch premium-designed online stores,
connects them to dropshipping suppliers, and gives sellers deep control over store
design and operations through an advanced dashboard. It is the reference point for
all architecture and build decisions going forward — every phase of the product
should trace back to a requirement in this document, and every module has an
Acceptance Checklist (§14) that gates when it is considered done. **This document
is the single source of truth; no requirement is considered documented if it exists
only in a prior version's git history.**

### 1.2 Scope
In scope for uzeyn.com (this SRS): uzeyn.com's own premium public site; the
multi-tenant store builder (premium templates, customizer, coded-theme escape
hatch); storefront discovery & merchandising (collections, search, navigation,
announcement bar, coming-soon mode, SEO, social links, FAQ); the seller admin
dashboard (catalog, customers, reviews, shipping, tax, discounts, orders — including
manual/draft orders — CSV import/export, onboarding); the supplier portal and
adapter-based dropshipping integrations with buyer-facing delivery transparency; the
payments, commission, hold, reserve, and payout/disbursement engine; subscription
plans including a discounted First Month paid entry (no free tier, v0.33 —
§5.7); Business Guard-Rails; the admin Control
Plane; custom domain attachment; and two external-SaaS integration hooks (§5.24).
Full detail is in §5.

Explicitly **out of scope** for this SRS (separate products the founder builds and
runs independently), each with a documented integration hook so uzeyn.com doesn't
have to be rewritten to connect to them later:
- **Social media scheduling/management SaaS** — SSO hook via the Auth module
  (§3.2a) plus a Product Feed API (§5.24b). Monetization lives entirely in that
  product; uzeyn.com is the bridge.
- **Template Store (premium template marketplace)** — a signed Template Install/
  License API (§5.24a). uzeyn.com always ships its own built-in free templates
  regardless of whether the Template Store exists or is connected.

### 1.3 Definitions & Abbreviations
| Term | Meaning |
|---|---|
| Seller | A merchant who creates and owns a store on uzeyn.com |
| Supplier | An entity that lists products for sellers to sell (dropship or own inventory) |
| Buyer | End customer purchasing from a seller's storefront |
| Tenant | A single seller's store instance within the shared platform |
| GMV | Gross Merchandise Value — total value of goods sold through the platform |
| Hold period | Time platform withholds a new seller's payout before releasing funds |
| Rolling reserve | An additional, ongoing holdback (percentage of sales) separate from the hold, used to cover future risk |
| Dormant store | A free-plan store inactive beyond a configurable threshold, subject to the lifecycle in §5.23 |
| Template entitlement | A record granting one specific seller the right to use one specific (typically marketplace-purchased) template — distinct from plan-based template-tier gating |
| VPS | Virtual Private Server |
| RLS | Row-Level Security (Postgres feature enforcing tenant scoping at the DB level) |

### 1.4 Vision Statement
Be the cheaper, Pakistan-first entry point into e-commerce for sellers who want a
**premium-feeling store** (advanced visuals, animation, AI-assisted design) without
Shopify's cost or complexity — with genuine day-one commerce feature parity
(customers, reviews, discounts, manual orders, receipts), built-in access to
dropship suppliers, a control panel simple enough that non-technical sellers can run
a professional-looking store, a free tier that is complete rather than a ticking
trial, and clean bridges into the founder's other products (premium templates,
social media marketing) without uzeyn.com ever having to build those products
itself.

---

## 2. Overall Description

### 2.1 Product Perspective
Direct competitor: **Shopify**. Differentiation strategy:
1. **Cheaper entry plans**, including a steeply discounted **First Month**
   paid entry — no free tier (§5.7, FR-7.3, v0.33) — Pakistan-first pricing.
2. **Premium visual templates** as a standard offering — the aesthetic of
   horizonx.so — with the same visual bar applied to buyer-facing surfaces beyond
   the storefront (receipts, order-status pages, emails, §6) and to uzeyn.com's own
   marketing site (§5.0, §13: apple.com-level polish + horizonx.so motion). A
   **Template Store** (a separate SaaS by the founder) extends this further with
   purchasable premium templates, bridged via a clean install API (§5.24a) — the
   built-in free tier never depends on that store existing.
3. **Built-in supplier network** with buyer-facing delivery transparency (§5.4).
4. **Genuine commerce parity from day one** — customers, reviews, carts, discovery/
   merchandising, manual orders, CSV data portability, receipts/tax — so switching
   from Shopify (or starting fresh) doesn't mean giving up features sellers expect.
5. **Simple, advanced control panel** with an admin-side Control Plane and Business
   Guard-Rails (§5.23) that protect the platform's own unit economics as it grows.
6. **A growth bridge, not a growth silo** — a "Marketing" entry point (§5.24b) hands
   a seller off to the founder's separate social-media SaaS with no second signup,
   so uzeyn.com benefits from that product's existence without building it.

### 2.2 Product Functions (high level)
- Store creation, premium template selection (built-in free + Template Store
  showcase), and storefront discovery (collections, search, navigation, announcement
  bar, coming-soon mode, social links, FAQ, footer content)
- Product catalog, inventory, shipping-rate, tax, and discount-code management
- Customers/CRM, product reviews, cart persistence
- Supplier onboarding with delivery transparency, via a pluggable adapter interface
  with an admin-managed adapter registry
- Order management — storefront and manual/draft orders, notes/tags/timeline,
  supplier fulfillment tracking, and a no-account buyer order-status lookup
- Data portability (CSV import/export) and self-hosted branded PDF receipts/invoices
- Payments (prepaid at launch), commission (with plan-based laddering), hold,
  reserve, and payout/disbursement through an admin approval queue
- Subscription plans including a discounted First Month paid entry (no
  free tier, v0.33), yearly billing, and launch-campaign pricing
- Platform-wide administration, Business Guard-Rails, and admin-editable content
- Custom domain + Google Drive media connection per seller
- Bridges to the founder's Template Store (template install/license) and Social
  Media SaaS (product feed) — uzeyn.com's side of each hook only

### 2.3 User Classes and Characteristics
| Role | Description |
|---|---|
| **Buyer** | Shops on a seller's storefront; needs no account (v1.0) — order status via a secure emailed link (FR-5.4); optional accounts are v1.1 (FR-22.1) |
| **Seller** | Owns a store; manages catalog, design, discovery, customers, orders (including manual/phone orders), shipping, discounts, tax, payment collection instructions, commission invoices, and connections to the Template Store/Social Media SaaS |
| **Supplier** | Lists products for one or more sellers; fulfills orders and provides tracking |
| **Platform Admin** | uzeyn.com staff; manages sellers, suppliers, commission invoices, Trust & Safety enforcement, disputes, platform health, content pages, business guard-rails, and the external-API client registry (§5.24) |

### 2.4 Operating Environment
Single VPS at Phase 1 (app, DB, Redis, MinIO, worker, same-VPS staging stack),
scaling out per §3.6 as load grows. Every feature added since v0.4 — including both
v0.6 SaaS integration hooks — is plain application code, Postgres tables, and (for
the hooks) a small, rate-limited API surface. **None of it changes the Phase 1
operating environment or adds infrastructure**, reconfirmed explicitly in this
revision per the founder's request (§9, §10).

### 2.5 Design & Implementation Constraints
- Payments **must** go through a licensed payment processor / gateway partner —
  uzeyn.com must never custom-build raw card/payment handling (PCI-DSS liability).
  Commission, hold, reserve, and payout logic are custom and gateway-independent
  (§5.6).
- **Self-host-first (binding):** the default choice for any infrastructure
  component is to self-host on the platform's own VPS; a recurring paid third-party
  service is used only where self-hosting is genuinely infeasible (email
  deliverability, licensed payment processing) — each exception is justified in §9.
- Must support Pakistan-first payment rails from Phase 1 (§5.6a); international
  gateways are a later phase.
- Hosting/domain for each storefront is owned and attached by the seller.
- **Team constraint:** solo founder + AI pair-programming. Every phase ships in
  small, independently-releasable increments; no module begins until the previous
  module's Acceptance Checklist (§14) is verified.
- **i18n-readiness (binding, §3.9):** no template or dashboard string is
  hard-coded outside a translation-key layer, and all number/currency/date
  formatting is locale-aware from v1.0 — even though only one locale (English)
  ships at launch — specifically so RTL/Urdu (§10, Phase 2+) is a content and
  CSS-direction task later, not an architecture rewrite.
- **No trial-of-paid-features (binding, §5.23; strengthened v0.33):** there
  is no free tier at all — the First Month entry (§5.7) is a discounted
  paid purchase with full Starter capability from day one, never a
  time-boxed trial of paid capability.
- **External-SaaS hooks are one-directional contracts, not shared builds (binding,
  new in v0.6):** uzeyn.com implements and owns only its side of the Template
  Store and Social Media integration hooks (an inbound API each product calls, or
  is called by). It never depends on either product's own infrastructure,
  monetization, or roadmap to function — a seller with neither connected sees a
  fully working platform.
- **Regional launch gating (binding, new — founder decision):** seller account
  creation is Pakistan-only at launch (FR-25.5); buyer-side storefront access is
  never gated by country. The allowed-country list is a Settings Registry entry,
  not a hard-coded check, so opening a new region is an admin operation, never a
  deploy.
- **Region-sharding readiness (binding, Phase 4+ architecture note only, new):**
  no module may hard-code an assumption that all data lives in one region beyond
  the existing i18n/currency rules already binding above. This is a documentation
  constraint now, not a build requirement — the actual per-region DB/stack split
  is Phase 4+ (§3.6, §10) and is not being built in v1.0.
- **API-first / mobile-app readiness (binding, new):** the NestJS API is the
  single source of truth for every business rule; `apps/web` (Next.js) consumes
  it like any other client and must never hold logic the API doesn't also
  enforce. This is what makes future iOS/Android apps (Phase 4, §10) a new client
  against an existing API, not a rewrite — no app work ships now.

### 2.6 Assumptions & Dependencies
- Safepay's sole-proprietor-friendly onboarding (§5.6a, §11) is assumed sufficient
  to take uzeyn.com's first live payment without waiting on a registered legal
  entity; a registered entity is still needed for Phase 1.x gateways and for
  hold-graduation identity verification (§13).
- Dropship supplier integrations depend on those suppliers exposing usable APIs.
  AliExpress has no official public dropship API — deferred, added later via the
  adapter interface once legally reviewed. Markaz's API viability is an open
  research item (§5.4, FR-4.10, §13).
- The Template Store and Social Media SaaS are assumed to exist as **separate**
  products built independently by the founder; this SRS assumes nothing about their
  timeline, and uzeyn.com's hooks (§5.24) function correctly whether or not either
  product has launched yet.

---

## 3. System Architecture Overview

### 3.1 Architectural Style
**Modular monolith** — one deployable application composed of clearly bounded
modules (Auth/Identity, Store/Tenant, Catalog, Orders, Commerce Ops, Payments/
Ledger, Payouts, Suppliers, Theme Engine, Media, Notifications, Admin), each with
its own internal boundary (own folder/package, own DB schema namespace,
communicating through defined interfaces — not through shared global state). This
gets Phase 1 to market fast while keeping a clean seam to extract any module into
its own service later without a rewrite.

Microservices are explicitly **not** used at Phase 1 — the operational overhead
(service discovery, distributed tracing, network failure handling) is not justified
until traffic/team size demands it, and would be actively harmful to solo-founder
velocity.

**Statelessness principle (binding on every module):** application server processes
hold no persistent state of their own. All state that must survive a request lives
in Postgres, Redis, or object storage — never on local disk or in-process memory
beyond the lifetime of a single request/job. This one rule is what makes the
single-VPS → multi-VPS transition (§3.6) a pure infrastructure change instead of a
rewrite; it is treated as a code-review-blocking rule from the first commit, not an
aspiration.

### 3.2 Multi-Tenancy Model
Shared database, **row-level tenancy**: every tenant-scoped table carries a
`store_id`. This is simpler and cheaper to operate than schema-per-tenant or
database-per-tenant, and is sufficient until a single store's data volume genuinely
requires isolation — at which point that one store can be migrated out without
affecting the model for everyone else.

**Enforcement mechanism (not just convention):** tenant scoping is not left to
per-query discipline, because a single missed `WHERE store_id = ...` is a data-leak
bug between two sellers — the single most reputation-damaging bug class this
platform can ship.
- The data-access layer wraps every tenant-scoped query through a mandatory scoping
  helper/middleware that injects `store_id` from the authenticated session context
  — there is no code path that can query a tenant table without it.
- **Postgres Row-Level Security (RLS) is enabled as a hard backstop** on every
  tenant-scoped table, keyed to the session's `store_id`, so that even an
  application bug that forgets to scope a query still cannot return another
  tenant's rows.
- Automated tests explicitly assert cross-tenant access is impossible (e.g. "seller
  A's session cannot read seller B's orders/products/media/ledger no matter what
  endpoint is hit") — this test suite is a release gate, not optional coverage
  (§14). This rule applies uniformly to every tenant table added in v0.5/v0.6
  (customers, reviews, carts, collections, navigation menus, order notes/timeline,
  import jobs, tax settings) — new tables are never a special case.

### 3.2a Identity & Auth (shared-platform hook)
Auth is its own bounded module from day one, independent of the Store/Catalog/
Orders modules, specifically so that:
- The Social Media SaaS (§5.24b) can authenticate against the same identity service
  / user table via SSO instead of forcing a second signup — the contract for this
  is a stable `User` identity + token-issuance API, not a monolith merge.
- Sessions are **stateless** (signed JWT access tokens) or backed by Redis (shared,
  not in-process) — never held in a single app server's memory — so any app server
  behind a load balancer can serve any request (required for §3.6 Phase 3+).

### 3.3 Data & Storage Layer
- **Primary DB:** PostgreSQL (relational integrity for orders/payments/inventory),
  accessed through a **connection pooler (PgBouncer)** from Phase 1 onward — this is
  specified now, not deferred, because adding a pooler after multiple app-server
  instances already exist in production is a disruptive migration, not a config
  change.
- **Cache / queues:** Redis (session cache, rate limiting, job queue backend).
- **Object storage:** **self-hosted MinIO** (S3-compatible) running as a container
  on the same VPS, fronted by **Cloudflare's free-tier CDN** for bandwidth offload —
  per the self-host-first principle (§9), a paid object-storage service isn't
  justified when a self-hosted, S3-API-compatible alternative runs on
  infrastructure already paid for. Because MinIO speaks the S3 API, migrating to a
  managed provider (Cloudflare R2, AWS S3) later is a configuration change, not a
  rewrite. Google Drive remains a seller-side **import source**, never the runtime
  dependency.
- **Search:** Postgres full-text search (a generated `tsvector` column + GIN index,
  `docs/database-schema.md`) for storefront search (FR-16.2); move to a dedicated
  search engine only once catalog scale requires it.

### 3.4 Background Processing
A job queue (Redis + BullMQ or equivalent) handles: payout hold-release scheduling,
rolling-reserve release scheduling, scheduled-payout-request generation, supplier
order sync, tracking-status polling, notification dispatch, template asset
processing, **abandoned-cart flagging, the dormant-store lifecycle job, CSV
import/export processing, and self-hosted PDF invoice generation** (all new in
v0.5/v0.6). Workers are stateless processes that pull from the shared queue — any
number of worker instances can run concurrently across one or many VPS with no
coordination logic beyond the queue itself, by design.

### 3.5 Adapter Pattern (Supplier, Payment, Disbursement Integrations)
Per the founder's decision, every external integration point in the platform —
where suppliers connect, where money is charged, and where money is paid out — is
built the same way: never as a one-off, hard-coded connection.
- **Supplier Adapter:** `listProducts()`, `syncStock()`, `submitListingForReview()`,
  `forwardOrder()`, `pullTrackingUpdate()` — implemented by Printify, CJ
  Dropshipping, etc. (FR-4.1–4.2). Admin can register/enable/disable a supplier
  adapter from the admin terminal without a deploy (FR-4.9).
- **Payment Adapter:** a single interface each gateway (Safepay, later PayFast/
  JazzCash/Stripe, and the gated future COD flow) implements so `PaymentsM`'s
  commission/ledger logic never talks to a specific gateway's SDK directly (§5.6a).
- **Disbursement Adapter:** v1.0's manual adapter and a future API-based adapter
  both implement the same interface so the payout queue/ledger/notification logic
  never changes when the disbursement mechanism does (FR-6.11, §5.6b).
- **Verification Channel Adapter (new, v0.29):** a single interface each order-
  verification channel (WhatsApp OTP, Email OTP, Prepaid Confirmation)
  implements, so the checkout/order-confirmation logic (§5.37) never
  branches on which channel a given store picked. v1.0 ships three
  implementations, all either manual/link-assisted or seller-credential-
  based; a future automated WhatsApp Business API or SMS gateway adapter
  plugs in later with zero change to the orchestrating order-verification
  logic, same as every adapter above.
- **v0.15 pivot note:** both patterns above remain specified exactly as written,
  for the **dormant "Platform-Collected Payments" mode** (§5.6d) — v1.0 ships
  under **Direct Seller Collection** (§5.6c) instead, which needs neither a
  payment gateway nor a disbursement mechanism at all (the platform never holds
  buyer funds). Nothing here is deleted; a future re-activation (international
  expansion, a regulatory requirement, or scale) implements these two adapters
  exactly as already specified, with zero redesign.

In every case, the orchestrating module (Suppliers, Payments, Payouts) contains zero
gateway/supplier-specific branching — that logic lives entirely inside the adapter
implementation. Adding a new integration of any of these three kinds is "write one
adapter," never "touch core order/ledger/catalog code." The two external-SaaS hooks
(§5.24) follow the same *spirit* — a documented, versioned contract rather than a
bespoke integration — though they are inbound/outbound API contracts rather than
pluggable adapters, since uzeyn.com does not orchestrate across *multiple*
template stores or social-media platforms the way it orchestrates across multiple
suppliers.

### 3.6 Scaling Path (designed in from day one)
| Phase | Setup |
|---|---|
| 1 | Single VPS: app + DB + Redis + MinIO + worker, all containerized on one box |
| 2 | Move DB to its own VPS; add a read replica; app stays on original VPS |
| 3 | Separate worker/queue VPS; dedicated media/CDN edge (MinIO or migrated to R2/S3); app servers behind a load balancer (2+ VPS) |
| 4 | Multi-region app servers; DB read replicas per region; extract highest-load modules (e.g. Orders, Catalog) into standalone services |

Because tenancy is row-based, sessions are stateless, workers are stateless, media
lives in object storage (not local disk) behind an S3-compatible API, and DB access
already goes through a pooler, each phase transition above is an **infrastructure
change**, not an application rewrite — verified module-by-module.

**Phase 4+ architecture note — region-sharded deployments (roadmap only, not a
v1.0 build item):** beyond Phase 4's regional read replicas, a further evolution
is a full per-region deployment (its own DB + app/worker stack per region) with a
**global admin aggregation view** that queries across regions for platform-wide
analytics (FR-8.10/FR-23.4) and control-plane actions. This is documented here so
today's build avoids closing off the option — no v1.0 module may hard-code an
assumption that all tenants/data live in a single region beyond the existing
i18n/currency rules (§3.9, §2.5) that are already binding. No region-sharding code
is written until Phase 4.

### 3.7 Release & Versioning Strategy
- Environments: `dev` → `staging` → `production`. **Staging runs as a separate
  Docker Compose stack on the same single VPS**, under a staging subdomain (e.g.
  `staging.uzeyn.com`) — separate containers, database, and Redis instance from
  production, so a staging bug cannot touch production data. Zero additional
  infrastructure cost at launch; moves to its own VPS once cashflow supports it.
- Database migrations are versioned, reversible, and **backward-compatible with the
  previous release** — this is what makes zero-downtime, rolling deploys possible
  on a single VPS.
- Deploys are rolling/blue-green even on a single VPS, with a documented rollback
  runbook as a release-gate requirement.
- Feature flags gate new functionality for staged rollout, rolled back instantly
  without a deploy.
- Platform releases are semantically versioned with a changelog.
- **Versioned releases are reserved for genuinely new capability.** Anything that
  is merely an operational tuning change belongs in the Settings Registry (§3.8),
  not a deploy.
- **Module-gated build process (binding):** during build, no module or phase starts
  until the previous module's Acceptance Checklist (§14) is 100% verified and
  explicitly approved — a process rule, not a suggestion, governing the roadmap
  (§10) at the module level.

### 3.8 Settings Registry (Config-as-Data — the Admin Control Plane's foundation)
The founder's requirement that "day-to-day operational changes must never require a
code deployment" is implemented as a single, reused mechanism rather than one-off
switches scattered per feature:

- **`settings_definitions`** is a catalog of every tunable key the platform
  recognizes, each declaring its value type, which scopes it may be set at, a
  default, and a validation rule (e.g. a percentage must be 0–100) — so a bad admin
  edit is rejected before it reaches the database, not after it breaks billing.
- **`settings_values`** holds the actual values, each row scoped to `global`,
  `plan`, `seller`, `category`, or `store`. Every module resolves a setting through
  one `SettingsService.resolve(key, context)` call that checks the most specific
  applicable scope first — modules never read a hard-coded constant for anything
  the admin terminal is meant to control.
- **Precedence order (pinned, resolved during Module 1 planning):**
  `seller > store > plan > category > global` — most-specific-wins. A given
  setting key only participates at the scopes listed in its
  `settings_definitions.allowed_scopes`; irrelevant scopes in the chain are
  skipped, never reordered. This is a single universal rule applied consistently
  by every module, rather than a per-key bespoke order: e.g. a per-category
  commission override (`category` scope) is meaningful for FR-6.1/FR-8.3 exactly
  where a seller or store hasn't set a more specific override, and falls back to
  the plan's rate, then the global default, if neither is set.
- **Cache layer:** resolved values are cached in the same Redis instance already
  used for sessions/queues (§3.3) — **no new infrastructure**. An admin write
  invalidates the specific cache key immediately, so a setting change is visible to
  every module on the very next request, with no restart and no deploy.
- **Binding rule:** if a behavior is something an admin should be able to tune
  operationally, it is registered as a setting, not a constant guarded by a flag
  that itself needs a deploy to introduce.
- Every write to `settings_values` is captured in `admin_audit_logs` with the old
  and new value — configuration changes are first-class audited actions.

This one pattern is what makes essentially all of §5.8 (Admin Control Plane) and
§5.6b (Payout & Disbursement) possible without a dedicated table and a dedicated
admin-UI screen per feature.

### 3.9 Internationalization Readiness (binding)
Every feature is built with the following non-negotiable rules, specifically so
that RTL/Urdu storefront support (§10, Phase 2+) is **content and CSS-direction
work later, not an architecture change now**:
- No UI copy (storefront, dashboard, emails, receipts) is hard-coded inline in
  template/component code — every string is sourced through a translation-key
  layer, even though v1.0 ships exactly one locale (English).
- All number, currency, and date formatting goes through a locale-aware formatting
  utility, never manual string concatenation — this also directly serves the
  Currency Strategy (`docs/database-schema.md`).
- Storefront CSS is written so that a direction switch (`dir="rtl"`) re-flows
  layout correctly using standard logical CSS properties — this costs nothing
  extra and is a discipline, not new infrastructure.
- This is a code-review-blocking rule from the first commit, the same way the
  statelessness principle (§3.1) is.

### 3.10 External-SaaS Integration Hooks — architectural summary (new in v0.6)
Full functional detail is in §5.24; this subsection states the shared architectural
shape both hooks follow, so they read as one coherent pattern rather than two
one-off integrations:
- Both hooks are **small, versioned, authenticated API surfaces** uzeyn.com owns —
  never a shared database, shared session, or shared deploy with the external
  product.
- Both are gated by an `external_api_clients` registry (mirroring the Supplier
  Adapter registry, §3.5) so admin can see, enable, and disable each integration
  from the admin terminal without a deploy.
- Both are rate-limited and scoped exactly like every other public API surface
  (§6.5) — a compromised or misbehaving external client can be revoked/disabled
  without touching the rest of the platform.
- Neither hook introduces a new database, a new server, or a new paid service —
  they are new API routes plus two small tables (`docs/database-schema.md`).

---

### 3.11 Platform Event Log (Business Analytics Substrate — new)
The founder's growth/unit-economics reporting (FR-8.10, FR-23.4) needs a
history of *when things happened*, not just current-state tables — and that
history cannot be reconstructed retroactively once a signup or a sale has
already happened without being recorded. Recording starts with whichever
module is being built when this is approved (Modules 1–3, backfilled;
Module 4 onward, built in from the start), even though no dashboard reads
from it yet.

- **`platform_events`** (global, append-only): `event_type`, `actor_type`/
  `actor_id`, `store_id` (nullable — not every event is store-scoped),
  `entity_type`/`entity_id` (a generic reference to the row the event is
  about), a small `metadata` JSON object, `created_at`. Same immutability
  discipline as `admin_audit_logs`/`user_security_events`: the application's
  runtime role has `INSERT` only, no `UPDATE`/`DELETE`.
- **Lean taxonomy, binding rule:** only business-lifecycle events that would
  plausibly appear on a growth or unit-economics report qualify —
  `seller.signup`, `seller.verified`, `store.created`, `product.created`,
  `media.imported`, `domain.attached`, `domain.verified`, and the equivalent
  lifecycle events each future module introduces (`order.placed`,
  `payout.requested`, `plan.changed`, etc.). **No page-view/click tracking,
  no per-request noise.** A module proposing a new event type asks "would
  this appear on a growth or unit-economics report?" — if not, it doesn't
  get logged here.
- **No PII in `metadata`, ever:** IDs only (already-scoped by `actor_id`/
  `entity_id`/`store_id`) — never an email, name, phone number, or address.
  This is the same discipline §6.5's PII-handling rule already states for
  application logs, applied to this table specifically.
- **Non-blocking emission (binding):** a failed event write is logged and
  swallowed — it must never fail the user-facing action that triggered it.
  An event log that could break a signup or an order is worse than no event
  log.
- **Retention/archival threshold** is a Settings Registry entry
  (`platform_events.retention_days`), not hard-coded — no archival job exists
  yet (nothing needs one at launch volume), but the tunable is in place so
  adding one later is a worker job, not a schema change.
- **Zero new infrastructure, zero dashboard work now:** one Postgres table,
  reusing the exact insert-only-grant pattern already proven on
  `admin_audit_logs` (Module 1). The already-specified admin analytics
  (FR-8.10) and unit-economics (FR-23.4) dashboards read from this later;
  nothing about either FR changes today.
- **`order.placed` means a confirmed, paid order (binding, cross-referenced
  from §3.12):** the Financial Truth Invariant applies here too — this event
  fires only once a payment is verified (or a manual order is explicitly
  marked paid), never on cart/checkout submission. Whoever designs Orders,
  Cart & Checkout (Module 9 as of v0.10's renumbering, `docs/build-plan.md`)
  emits it at that point, not earlier.

### 3.12 Financial Truth Invariant (binding NFR, new — pinned before Orders/Cart/Checkout and Payments & Ledger are designed)
An order/sale **exists** — in a seller's own dashboard, in any analytics or
report view (seller-facing or admin-facing), and in `platform_events` — **only
after its payment has been verified**: a signed, verified gateway webhook
confirming payment (§5.6a/§5.6d, the dormant Platform-Collected mode), or an
explicit seller mark-as-paid action for a manual/offline order (§5.17). This is
a binding constraint on every module that touches orders, payments, ledger
entries, payouts, or analytics, pinned now specifically so Orders, Cart &
Checkout and Payments & Ledger (Modules 9 and 10 as of v0.10's renumbering,
`docs/build-plan.md`) are **designed around it from their first schema draft**,
not retrofitted afterward.

**v0.15 pivot note (Direct Seller Collection, §5.6c):** v1.0 ships no gateway
webhook path at all — `OrdersService.markAsPaid()` (Module 9, already built)
is the **sole** confirmation path for every order regardless of source. This
invariant is unchanged by the pivot; it is, if anything, *more* load-bearing
now, since it is also the mechanism the new commission-invoicing model
(§5.6c) accrues commission against — a pending order is not just "not a sale
yet," it is also not yet a commission-bearing event.

- **No pending/unconfirmed/failed order counts as a sale, anywhere,** even
  transiently. A cart that has been submitted but not yet paid is not an
  order in any seller-visible or admin-visible sense until the invariant
  above is satisfied — it may exist internally as a pending/draft row, but
  no count, total, dashboard figure, or `platform_events` row treats it as
  a sale.
- **Applies uniformly, not per-feature:** the seller order list, seller
  analytics, the admin unit-economics dashboard (FR-23.4), the admin
  real-time analytics (FR-8.10), commission/ledger entries (§5.6), and
  payout eligibility calculations (§5.6b) all read the same underlying
  "confirmed" state — there is exactly one signal for "this is a real sale,"
  never a second, looser definition computed differently by a different
  module.
- **Testable, cross-cutting §14 requirement:** every money-adjacent module's
  Acceptance Checklist (§14.5, §14.6, §14.8, §14.21, §14.23) includes a test
  proving an unpaid/pending/failed order is excluded from every count and
  total it could otherwise appear in — not assumed correct because the happy
  path was tested.

### 3.13 SIMPLICITY INVARIANT (binding NFR, new — governs the Seller Dashboard UI module and every seller-facing screen thereafter)
"Advanced under the hood, expertly capable — effortless on the surface." The
seller dashboard must be **more readable and beginner-friendly than
Shopify's, never more complex.** This is a binding design constraint on the
Seller Dashboard UI module (§5.28, new in v0.12) and on every seller-facing
screen built in any module after it — pinned now so it governs design from
that module's first mockup, not retrofitted after screens already exist.

- **(a) Glanceable:** every screen answers its main question at a glance —
  plain language, no jargon. Urdu-friendly phrasing is a later i18n-readiness
  concern (§3.9), not required in v1.0's English-only UI, but no v1.0 label
  or copy may be written in a way that would resist a clean translation later.
- **(b) Progressive disclosure:** advanced options exist but sit behind
  clearly-labeled expanders/sections, never cluttering the default view. A
  screen's first paint shows only what a seller needs for the common case.
- **(c) Zero-documentation core tasks:** a brand-new seller must be able to
  complete every core task — add a product, set a shipping rate, create a
  discount code, view orders — without reading documentation.
- **(d) Consistent layout patterns:** the same placement for save/cancel
  actions, the same list/detail structure, across every screen — learning one
  screen teaches the seller how every other screen works.
- **(e) Purposeful empty states:** an empty screen always explains what the
  screen is *for* and offers the next action (e.g. "No products yet — add
  your first product" with the button right there), never a bare empty table.
- **Testable, cross-cutting §14 requirement:** the Seller Dashboard UI
  module's Acceptance Checklist (§14.26) includes a "beginner walkthrough"
  review against rules (a)-(e) for each core task, and any later module that
  adds a new seller-facing screen re-affirms it still holds for that screen.

## 4. User Roles & Permissions (summary)

| Role | Key permissions |
|---|---|
| Buyer | Browse, checkout, and look up order status via a secure emailed link — no platform account required (FR-5.4); optional account in v1.1 (FR-22.1) |
| Seller | Full control of own store(s): design, catalog, discovery, customers, shipping, discounts, tax, orders (including manual), supplier links, payment collection instructions, commission invoices, and revocable connections to the Template Store/Social Media SaaS |
| Supplier | Submit listings, view/fulfill orders **only** across stores they are explicitly linked to — never a global view of the platform's orders |
| Platform Admin | Full oversight: approve/suspend sellers & suppliers, configure commission/plans, verify commission-invoice payment, enforce Trust & Safety actions, resolve disputes, manage template & adapter registries (including the external-API client registry, §5.24), edit content pages, view platform analytics |
| Reviewer (new, v0.10) | **One narrow admin sub-role, not a general permissions system:** sees only the Listing Moderation Engine's queue (§5.27); can approve or reject a queued product with notes. No access to any other admin surface — commission/plans, payouts, seller/supplier lifecycle, settings, or the audit log itself |

Fine-grained permission scopes (e.g. seller staff sub-accounts, a general
admin sub-role/permissions system) remain a **Phase 3+ item — reaffirmed in
this revision, not pulled forward**: a single "platform admin" role with no
internal separation is itself a security concern at scale (§6.5), but
building a whole scoped-permissions framework is out of scope until the
platform has more than one admin/support person to actually scope roles for.
**Superseded by v0.32/§5.52 for seller staff sub-accounts specifically:**
at the founder's explicit direction, seller staff sub-accounts were pulled
forward into v1.0 as a plan-tier differentiator (coarse, explicit,
auditable scopes — not the generic framework this paragraph continues to
defer). The general admin sub-role/permissions system half of this
paragraph remains Phase 3+, unchanged.
**Reviewer is a deliberate, narrow exception to that deferral, not a reversal
of it:** it exists because the Listing Moderation Engine (§5.27) is a
launch-blocking legal-safety requirement that specifically needs a
limited-access reviewer who cannot also touch payouts, settings, or the
audit log — one purpose-built role, not the start of a general framework.

---

## 5. Functional Requirements

### 5.0 uzeyn.com's Own Site
- FR-0.1: The public marketing/signup site is held to the same premium visual bar
  as the seller storefront templates — specifically **apple.com-level minimal
  premium polish combined with the horizonx.so motion aesthetic** (§13) — it is the
  platform's own advertisement for what sellers will get, and ships as a
  first-class Phase 1 deliverable, not an afterthought once the app is done.

### 5.1 Store Builder & Theme Engine
- FR-1.1: Seller selects from a library of premium templates at store creation.
  Even before any AI-assisted generation ships, Phase 1 templates must be
  hand-built to the same "advanced/motion-rich" visual bar described in the
  vision — a generic theme does not satisfy this requirement. **Reaffirmed,
  v0.10:** the visual bar is concretely **apple.com-level minimalism** and
  **horizonx.so-level motion**, including video hero banners in themes — this
  remains gated on founder-delivered branding assets not yet received (the
  same Module 18/Module 4 dependency `docs/build-plan.md` already flags; the
  three built-in Module 4 themes are structurally, not yet visually, at this
  bar). **Superseded, v0.31 design phase:** the three placeholder themes are
  replaced by **four genuinely distinct, hand-designed built-in templates —
  Editorial, Studio, Market, Atelier** (docs/architecture.md's Template
  Package Spec has each one's visual direction) — bare-functional-but-real
  for this pass, full premium visual/motion polish (the apple.com/horizonx.so
  bar above) still pending the founder's Figma-involved design phase.
- FR-1.2: The visual customizer's **v1.0 scope** is: colors, fonts, logo/banner
  images, and section show/hide + reorder — no code required. **Animation/motion
  preset customization is Phase 3** (FR-1.7), not v1.0.
- FR-1.3: Live preview of changes before publishing.
- FR-1.4: All templates are mobile-responsive by default, and the seller dashboard
  itself is usable on mobile (not just the storefront).
- FR-1.5: **SEO controls per store/page** (schema gap found and closed while
  planning Module 4 — no version of this SRS ever specified where these
  fields live): `seo_title`/`seo_description` are nullable columns directly on
  `stores` (the storefront homepage default/fallback) and `products` (product
  pages); `collections` gets the same pair once that table is built (Module
  5); v1.1 store pages/blog posts (FR-22.4) get the same pair when that
  module ships. **Fallback rule (binding):** if `seo_title` is null, render
  the entity's own name/title; if `seo_description` is null, derive it from
  the entity's own description (truncated) or fall back to the store-level
  default. FR-16.6's structured-data/Open Graph tags read from these same
  fields — one source of truth, never a second set of SEO data. **Sitemap and
  robots.txt are built in Module 4**, generated dynamically per request (no
  static file, no cron job) covering whatever public pages exist as of that
  module (storefront home + products); Module 5 extends the same generator
  with collection pages once those exist — not a redesign. URLs use the
  store's verified custom domain (FR-11.2) when one exists, falling back to
  the free subdomain otherwise. A store in `coming_soon`/`password_protected`
  access mode (FR-16.5) serves a `noindex` robots.txt and no sitemap at all —
  this requires `stores.access_mode` to exist ahead of Module 5's originally
  planned introduction of it (see database-schema.md's note on this column).
- FR-1.6: **Advanced/self-coded mode** — a seller who wants full control can switch
  a store (or section) into a code-level theme editor (custom HTML/CSS/template
  overrides) instead of the visual customizer. This is an opt-in escape hatch for
  technical sellers, gated behind a plan tier (Phase 2).
- FR-1.7 (Phase 3+): Animation/motion preset customization and AI-assisted
  content/image suggestions inside the customizer.
- FR-1.8: **Template marketplace showcase & install hook** — the theme-selection UI
  always shows uzeyn.com's own **built-in free templates** first and foremost, and
  additionally surfaces a **premium-templates showcase** linking out to the
  founder's separate Template Store SaaS. Full detail — including the Template
  Install/License API — is specified in §5.24a, since it's a full integration hook,
  not a one-line FR.
- FR-1.9 (new, v0.31 design phase): **"Start from blank" option.** A fifth
  entry alongside the four built-in templates (FR-1.1) — every section
  starts hidden and the seller composes their storefront from scratch using
  the exact same bounded customizer (FR-1.2), never a different or freer
  system. Positioned honestly: this is not the free-form page-builder FR-1.6
  reserves for Phase 2 — it's the existing section catalog at its emptiest
  starting state, still a genuine "more editable than Shopify" claim since
  every seller (on any template or blank) can freely use every section type
  from day one, unlike a theme-locked competitor.
- FR-1.10 (new, v0.31 design phase; tier mapping revised v0.33 — no Free
  plan to anchor "mandatory" against): **Storefront branding mark.** A
  small "Managed by UZEYN" mark in the storefront's shared footer chrome —
  **mandatory through First Month, Starter, and Growth** (the platform's
  own organic marketing on every tier below the top), **removable only on
  Pro**, where the plan grants the capability. Resolved server-side (never
  left to the client), via two independent Settings Registry keys — the
  same "capability the plan grants + the seller's own stored preference,
  ANDed" mechanism as before, now anchored to Pro-and-above instead of a
  Free-vs-paid split; a seller who downgrades below Pro always reverts to
  showing the mark regardless of their stored preference — see
  docs/architecture.md's Template Package Spec section for the exact
  mechanism.
- **THE ISOLATION RULE (new, v0.31 design phase, binding on FR-1.1/1.2/1.9
  onward):** template selection and all customization affect presentation
  only. Cart, checkout, orders, payments, verification, wallet, and every
  functional button/action must behave and compute identically no matter
  which template is active or how heavily a store is customized — editing
  design can never touch functional logic. Enforced three ways (structural
  component boundary, a static CI import-check, and a template-invariance
  e2e proving byte-identical order totals/commission/wallet-delta/P&L across
  every template) — full detail in docs/architecture.md's Template Package
  Spec section, tested in §14.1's checklist below.

### 5.2 Seller Admin Dashboard
- FR-2.1: Product/catalog CRUD, variants, inventory tracking.
- FR-2.2: Order list with status, filtering, and fulfillment actions.
- FR-2.3: Store design panel (entry point to Theme Engine, §5.1).
- FR-2.4: **Sales/traffic analytics view** — v1.0 scope is basic: orders, revenue,
  and top products, computed via live queries, scoped strictly to that seller's own
  store.
- FR-2.5: Payout/commission breakdown view (available vs. pending vs. reserved
  balance, with the hold-release date visible per pending entry and the
  reserve-release date visible per reserved entry).
- FR-2.6: **Seller-initiated supplier connection** — a seller can invite/create a
  supplier link directly from their own dashboard (generating an invite a supplier
  accepts), in addition to a supplier independently registering and requesting a
  link. Either path lands in the same place: a `StoreSupplierLink` pending the
  seller's review.
- FR-2.7: Listing review/approval — every listing a linked supplier submits is
  queued for the seller's explicit approval before it can appear in that seller's
  store; no auto-publish path exists.
- FR-2.8: Google Drive connect (OAuth) for bulk media import.
- FR-2.9: Custom domain attachment (DNS instructions + verification status).
- FR-2.10: **Store shipping settings** — a seller configures a flat shipping rate
  and, optionally, a free-shipping threshold for **self-fulfilled** products.
  Shipping zones and weight-based rates are Phase 2. Supplier-fulfilled items use
  the rate provided by that supplier's adapter instead (FR-4.6, FR-5.6).
- FR-2.11: **Discount code management** — a seller creates percentage-off or
  fixed-amount codes for their store, each with an optional expiry date and usage
  limit (§5.5, FR-5.5). Advanced discount types (auto-apply, BOGO, scheduled sales)
  are Phase 2.
- FR-2.12: **Marketing entry point** — the dashboard includes a "Marketing" section
  serving as the polished handoff to the founder's Social Media SaaS. Full detail
  in §5.24b.
- FR-2.13: **UI build note (v0.12):** the FRs above describe this dashboard's
  required data and behavior; the actual rendered screens for product/media
  and shipping/tax/discount management are built in the dedicated Seller
  Dashboard UI module (§5.28), not each functional module that defines them
  — see that section for why, and for the SIMPLICITY INVARIANT (§3.13) every
  screen it builds must satisfy.

### 5.3 Supplier Portal
- FR-3.1: Supplier registration and verification workflow (independent
  self-registration, or acceptance of a seller-initiated invite per FR-2.6).
- FR-3.2: Supplier submits product listings — including shipping cost, estimated
  delivery time, and supported delivery countries (FR-4.6) — against the Supplier
  Adapter interface (§3.5); each seller reviews and approves before a listing goes
  live in their store (FR-2.7).
- FR-3.3: **Multi-store dashboard** — a supplier connected to multiple sellers'
  stores sees all their listings and orders across every connected store in one
  unified view, scoped strictly to the stores they are linked to (§4).
- FR-3.4: Fulfillment workflow per order, rendered as a literal per-order checklist
  in both the supplier's and the seller's dashboards: `Pending → Confirmed →
  Shipped (tracking added) → Delivered → Completed`. Supplier uploads tracking ID;
  system relays it to the buyer and ticks the corresponding checklist item in the
  seller's dashboard automatically.

### 5.4 Dropshipping Supplier Integrations
- FR-4.1: Phase 1 integration target: **Printify**, as the first Supplier Adapter
  implementation (§3.5) — chosen first for its well-documented, modern API and
  print-on-demand model that needs no separate stock-sync complexity.
- FR-4.2: Phase 1.1: **CJ Dropshipping**, as the second adapter — deliberately
  chosen second specifically to prove the adapter interface is genuinely generic.
- FR-4.3: Product price/stock sync from supplier catalogs on a scheduled interval,
  with a cached last-known catalog so a supplier API outage degrades gracefully
  (stale but available data) instead of breaking the live storefront.
- FR-4.4: AliExpress has no official dropship API; deferred, added later as a
  third-party-API-backed adapter once evaluated for API stability and legal/ToS
  risk — never as a special-cased core integration.
- FR-4.5: **Oversell protection** — when the same supplier product is listed by
  multiple sellers, stock sync (FR-4.3) must decrement a shared supplier-stock
  figure on order placement so two sellers cannot both sell the last unit.
- FR-4.6: **Supplier listing transparency** — every supplier-sourced listing
  displays to the buyer: shipping cost, estimated delivery time, and the countries
  the supplier can deliver to.
- FR-4.7: Checkout **blocks** placing an order when any item in the cart is a
  supplier listing that does not support delivery to the buyer's shipping country
  — a hard stop, not a warning.
- FR-4.8: Supplier price changes propagate through the existing sync mechanism
  (FR-4.3); checkout **re-validates** each item's price against the latest synced
  `supplier_listings.price` at the moment of order placement — a storefront page is
  never allowed to complete a sale at a stale cached price.
- FR-4.9: **Supplier adapter registry** — admin can register, enable, or disable a
  supplier adapter from the admin terminal without a deploy; disabling an adapter
  stops new listing syncs and order forwarding through it but does not affect
  orders already placed.
- FR-4.10: **Markaz — named research item (Phase 2+ roadmap)** — Markaz (a
  Pakistani dropship supplier) is recorded as a candidate for the Supplier Adapter
  interface, exactly like Printify/CJ. Before committing build time: verify public
  API availability and stability. If viable, it is added as a standard adapter with
  zero core-platform changes; if not, it stays a research note. AliExpress/Alibaba
  remain future adapter candidates under the same evaluate-first discipline (FR-4.4).

### 5.5 Order & Fulfillment Management
- FR-5.1: Unified order dashboard per seller, spanning both self-fulfilled and
  supplier-fulfilled orders.
- FR-5.2: Automated buyer notification on status change (order confirmed, shipped
  with tracking, delivered).
- FR-5.3: Defined suspended/banned-store behavior: if a store is suspended by admin
  (§5.8), its storefront shows a clear "temporarily unavailable" state to buyers
  rather than a broken page, and in-flight orders remain fulfillable so existing
  buyers aren't stranded.
- FR-5.4: **Buyer order-status lookup** — since buyers do not have accounts (guest
  checkout, §2.3), order confirmation emails include a secure, unguessable link to
  a status page for that order; the link uses a signed token, not a
  sequential/guessable order number.
- FR-5.5: **Discount code validation** — at checkout, a code is accepted only if it
  is active, not past its expiry date, and under its usage limit; an invalid code
  is rejected with a clear reason, never silently ignored. Commission (FR-6.1) is
  calculated on the post-discount amount.
- FR-5.6: Order shipping cost is computed **per fulfillment source** in a mixed
  cart: self-fulfilled items use the seller's shipping settings (FR-2.10);
  supplier-fulfilled items use their adapter-provided rate (FR-4.6); the order
  total is the sum of both.

### 5.6 Payments, Commission & Ledger Engine — DORMANT in v1.0 (Platform-Collected Payments mode, §5.6d)
**v0.15 pivot:** v1.0 ships under **Direct Seller Collection** (§5.6c) instead
of this section's model — the platform never holds buyer funds, so nothing
below is built for launch. **Nothing here is deleted or wrong** — it is the
exact, unchanged specification for reactivating platform-held payment
collection later (international expansion, a regulatory requirement, or
scale), preserved verbatim so that future work is "flip this mode back on,"
never "redesign it from scratch." Every FR-6.1–FR-6.13 number below keeps its
existing meaning; every other place in this document that cites one of them
(risk register, checklists, role descriptions) is describing this dormant
mode specifically.
- FR-6.1: Commission of 3% is deducted per completed sale, calculated on the
  **product + shipping subtotal actually charged to the buyer, net of any discount
  code applied (FR-5.5), before payment-gateway fees** (gateway fees are a
  separate, itemized deduction, and are recorded as **zero** for orders paid via
  the `manual` payment type, FR-17.1, since no real gateway fee is incurred) —
  configurable per plan/category/seller by admin via the Settings Registry, not
  hard-coded. All monetary amounts are expressed in the store's configured currency
  — no logic anywhere assumes PKR specifically.
- FR-6.2: New-seller payout hold: funds from a new seller's sales are held for a
  configurable period (default 21–22 days), applied **per transaction**, not as an
  account-wide lock.
- FR-6.3: **Hold graduation** — once a seller reaches a configurable trust
  threshold (e.g. N successfully completed, non-disputed orders, and identity
  verification per §6.5 complete), the hold period shortens or is removed for that
  seller going forward.
- FR-6.4: Internal ledger per seller: tracks `pending_balance`, `available_balance`,
  `reserved_balance`, `total_paid_out` as **computed sums over an append-only
  `LedgerEntry` table** — every commission, hold-release, reserve-hold,
  reserve-release, gateway fee, and payout is its own entry; no balance field is
  ever directly mutated.
- FR-6.5: Dispute/refund workflow that freezes a specific ledger entry without
  affecting the seller's other available funds; disputes are handled manually via
  the admin terminal in Phase 1.
- FR-6.6: A daily reconciliation job compares the ledger's computed totals against
  the payment gateway's settlement report and alerts admin on any mismatch. **Scope
  clarification (new in v0.6):** this job reconciles only against real external
  settlement reports (i.e. Safepay); `manual`-type payments (FR-17.1) and any
  future gated COD payments have no external settlement report to reconcile
  against and are excluded from this specific job — their correctness relies on the
  admin's own manual confirmation at the point of marking an order paid, which is
  itself an audited action (FR-8.9).

### 5.6a Payment Gateway Strategy (Pakistan-first, prepaid launch) — DORMANT in v1.0, see §5.6 note above
- **v1.0 launch: Safepay only.** A prepaid-only launch keeps commission capture
  clean: buyer pays → platform receives the full amount → 3% commission is
  deducted in the ledger (FR-6.1) → the remainder is credited to the seller's
  balance under the standard hold (FR-6.2).
- **Cash on Delivery (COD) — deferred, not deleted.** COD inverts commission
  collection: the seller (or courier) collects payment directly, so the platform
  never holds money to deduct 3% from. COD returns in a later phase as a
  **controlled, per-seller feature**: a Settings Registry flag
  (`payments.cod_enabled`, scope `seller`) enabled only for **verified sellers with
  sufficient available ledger balance** to cover the commission on outstanding COD
  orders. The schema/ledger already anticipates it (`payments.gateway` includes
  `cod`), switched off for every seller at launch.
- **Phase 1.x:** add a second aggregator (PayFast PK) and/or direct
  JazzCash/Easypaisa merchant APIs once a registered company + transaction volume
  justify their more enterprise-paced onboarding.
- **Phase 4:** Stripe via a foreign entity for international buyers.
- Commission, hold, reserve, and payout logic are implemented entirely in
  uzeyn.com's own ledger and are **gateway-agnostic by construction** — switching
  or adding a gateway never touches that code, only a new Payment Adapter (§3.5).

### 5.6b Payout Request & Disbursement Engine — DORMANT in v1.0, see §5.6 note above
- FR-6.7: A seller can request a payout of any amount **up to their current
  `available_balance`** (post-hold, post-reserve); a request exceeding available
  balance is rejected before it reaches the approval queue.
- FR-6.8: An optional **scheduled payout mode** — a seller may opt into automatic
  payout requests generated on a fixed monthly date. Both the mode's availability
  and its parameters are Settings Registry entries.
- FR-6.9: Every payout request enters an **admin approval queue**. Each request
  displays an auto-generated **risk summary**: seller KYC status, dispute/refund
  rate, count of flagged orders/listings, account age, and an abnormal
  sales-velocity signal (v1.0: a simple threshold check). All thresholds are
  Settings Registry entries.
- FR-6.10: A seller with an active prohibited-goods flag has payouts **fully
  frozen** and is routed toward the store-suspension path — not a soft warning.
- FR-6.11: **Disbursement Adapter pattern** (§3.5): v1.0 ships the **manual
  adapter** — an approved request appears on an admin batch screen (payee, amount,
  bank/IBAN or Raast account, copy-ready); the admin transfers funds outside the
  platform and marks the request **Paid**, creating the corresponding
  `payout_debit` ledger entry and a seller notification. Phase 1.x adds an
  **API-based adapter** implementing the same interface, with zero changes to the
  queue/ledger/notification logic.
- FR-6.12: Payout status is visible to the seller through the full lifecycle:
  `requested → approved → processing → paid` (or `rejected`, with a reason).
- FR-6.13: **Rolling reserve** — an additional, ongoing holdback **on top of** the
  per-transaction hold (FR-6.2): a per-seller reserve percentage (default **0%**)
  admin-settable or auto-applied when risk-flagged. The reserved portion of each
  sale is its own ledger entry class (`reserve_hold`), released via
  `reserve_release` after a configurable period if undisputed. All parameters are
  Settings Registry entries.

### 5.6c Direct Seller Collection & Commission Invoicing — DORMANT as of v0.24, see §5.6e
**Superseded as v1.0's active mechanism by §5.6e (Prepaid Credits Wallet),
approved before Module 20 — this section is preserved verbatim, exactly
like §5.6/§5.6a/§5.6b's dormancy note below, as a possible future
enterprise/post-paid reactivation path, not deleted.** Everything below
this point describes the monthly-invoice mechanism as originally built in
Module 11; where it conflicts with §5.6e, §5.6e governs v1.0 behavior.
**The platform never touches buyer money in any v1.0 flow.** A buyer pays the
seller directly, out-of-platform; the platform's revenue is a commission
*invoice* the seller owes it after the fact, not a deduction from funds it
held. This is a full inversion of §5.6's ledger direction — the ledger now
tracks what a seller **owes the platform**, not what the platform owes the
seller.
- FR-6.14: **Seller payment instructions.** A seller configures the payment
  methods their storefront accepts and the exact instructions buyers see:
  bank transfer (account title/number/bank name), JazzCash number, Easypaisa
  number, and a **Cash on Delivery** toggle — COD is unconditionally
  permissible in v1.0 (unlike the dormant mode's gated version, FR-6.1's
  note) since the platform never holds money to deduct a commission from at
  the point of sale either way. At least one method must be configured before
  a store can go live; checkout/order-confirmation surfaces the seller's
  configured instructions to the buyer once an order is placed.
- FR-6.15: **Order confirmation is unchanged from Module 9.** An order stays
  `pending` until the seller marks it paid (`OrdersService.markAsPaid()`,
  FR-17.1, already built) — this *is* the payment-confirmation step under
  Direct Seller Collection, not merely a manual-order convenience path
  anymore. The Financial Truth Invariant (§3.12) is unchanged: no pending
  order counts as a sale anywhere.
- FR-6.16: **Invoice-based commission, default 1%.** Marking an order paid
  accrues a `commission_accrued` ledger entry (default **1%** of the same
  post-discount product+shipping subtotal FR-6.1 already defines) —
  configurable per plan/category/seller via the same Settings Registry
  mechanism FR-6.1/FR-8.3 already specify, unchanged. The ledger itself
  (append-only `LedgerEntry` table, FR-6.4's structure) is retained; only the
  entry types and the direction of what a computed balance represents
  change (§5.6c's entries net to a seller's **outstanding commission
  balance**, not an available-for-payout balance).
- FR-6.17: **Monthly commission invoice.** A scheduled job generates one
  invoice per seller per billing period, summing that period's
  `commission_accrued` entries. **v1.0 payment verification is manual** — an
  admin marks an invoice `paid` once the seller has settled it outside the
  platform (bank transfer to the platform's own account), an audit-logged
  control-plane action (FR-8.9) exactly like every other admin mutation. No
  online invoice-payment gateway ships in v1.0 (would reintroduce the
  gateway dependency this pivot removes) — a future phase may add one behind
  the same Payment Adapter interface (§3.5) without changing the invoicing
  logic itself.
- FR-6.18: **Grace period → automated suspension.** An invoice unpaid past a
  configurable grace period (Settings Registry, `billing.invoice_grace_period_days`)
  triggers **automated store suspension** — reusing the exact `suspended`
  store status and buyer-facing "temporarily unavailable" behavior Module 9
  already built (FR-5.3), not a new suspension mechanism. Suspension lifts
  automatically once an admin marks the invoice paid. This is the platform's
  only enforcement lever for non-payment, since it never holds seller funds
  to withhold instead.
- FR-6.19: **Anti-underreporting guard-rails.** Because the platform cannot
  independently verify a direct-collection sale happened, every
  storefront-placed order is recorded regardless of its eventual status
  (already true — Financial Truth Invariant + Module 9's own design), and two
  new per-seller monitors feed the Trust & Safety system (§5.29):
  a **cancellation-rate** monitor (share of a seller's orders marked
  `cancelled` rather than paid, over a rolling window) and a
  **pending-forever-rate** monitor (share of orders that sit in `pending`
  past a configurable age without being marked paid *or* cancelled — the
  most direct proxy for "buyer paid the seller directly and the seller never
  told the platform"). Both thresholds are Settings Registry entries; both
  feed admin risk views (§5.29), never a silent auto-penalty.
- FR-6.20: **Commission disputes/adjustments.** If a seller disputes an
  accrued commission (e.g. the underlying order was genuinely cancelled
  before fulfillment), an admin can record a `commission_waived` ledger entry
  against that specific line — same "freezes/adjusts one entry, never a
  blanket balance rewrite" discipline as the dormant mode's FR-6.5.

### 5.6d Platform-Collected Payments (dormant — Phase 2+/international re-activation)
This is the same mode §5.6/§5.6a/§5.6b already fully specify (Safepay-first
gateway strategy, per-transaction hold, hold graduation, rolling reserve,
payout request/approval, manual-then-API disbursement) — this subsection
exists only as an explicit pointer so a future reactivation effort starts
here, not by re-reading the whole document to find it. **Reactivation
trigger conditions (non-binding guidance, not a build item):** international
buyers/sellers where direct bank-detail exchange is impractical or
unsafe, a regulatory requirement that the platform hold funds in escrow, or
transaction volume high enough that direct-collection's trust-based model
no longer scales. None of these are expected at v1.0 launch.

### 5.6e Prepaid Credits Wallet (v1.0 model — replaces §5.6c, new v0.24)
**v1.0's actual collection mechanism.** Direct Seller Collection (§5.6c's
opening principle) is unchanged — the platform still never touches buyer
money — but the platform's own revenue (commission, plan fees, add-ons)
is now collected **up front, from a wallet the seller funds themselves**,
not billed after the fact via a monthly invoice. This closes the
practical gap §5.6c's invoice-then-suspend model had: a seller could
trade for a full billing period before the platform ever saw a rupee, and
non-payment only had one lever (suspend). A prepaid wallet makes the
platform's own revenue collection-risk-free by construction and gives the
founder a single, simple lever (top up or don't) instead of a grace-
period/suspend cycle.
- FR-6.21: **Wallet ledger & activation gate.** Every seller has one
  wallet: a balance derived from the same append-only `LedgerEntry` table
  §5.6c already uses (extends it — new entry types for a top-up credit
  and each debit kind below, alongside the existing
  `commission_accrued`/`commission_waived` — never a parallel ledger
  table). **Balance computation is revised in v0.33 — see FR-6.29:** the
  ledger stays the sole append-only source of truth, but the balance
  itself is now a maintained running-total column, not re-summed on
  every read (the original "derive, don't cache the derivable" framing
  here is superseded — the v0.33 audit found nine hot-path call sites
  re-aggregating a seller's entire ledger history per call, both a
  scaling problem and a concurrency-correctness one). **Signup, store
  setup, and the onboarding wizard (Module 16) stay entirely free** — no
  wallet interaction is required to build a store. **Publishing a store**
  (the point at which it can accept a real, checkout-completed order) is
  gated on three conditions, all already-established patterns except the
  third: a configured payment method (FR-6.14, existing), a verified CNIC
  (FR-30.1, existing), and the wallet having received at least one top-up
  bringing its balance to or above a configurable minimum (Settings
  Registry, `billing.wallet_min_initial_topup`, default **Rs. 500**) —
  this third condition is new and doubles as a light seriousness filter
  on who actually goes live, not merely a revenue mechanism.
- FR-6.22: **Commission debits the wallet directly.** `OrdersService.
  markAsPaid()` still accrues commission at the exact same point and rate
  as FR-6.16 (default 1%, plan/seller-overridable, unchanged Settings
  Registry mechanism) — the only change is where that accrual goes: it
  debits the wallet's computed balance immediately instead of accumulating
  toward a future monthly invoice. The Financial Truth Invariant (§3.12)
  is unchanged and, if anything, sharper here: no pending order ever
  produces a wallet debit, proven the same way §14.6c already proves it
  for the invoice model. FR-6.20's commission-waiver mechanism (a
  `commission_waived` entry against one specific line) is unchanged.
- FR-6.23: **Top-up flow, behind a `TopUpAdapter`.** A seller requests a
  top-up (a Settings-driven set of preset amounts plus a custom amount,
  with a plan-tier-specific minimum where applicable) and pays it to the
  platform's own business account — the same direct-collection,
  manually-admin-verified pattern §5.6c already proved for invoices, not
  a new trust model. The credit lands in the wallet only once an admin
  verifies the payment, an audit-logged control-plane action (FR-8.9)
  exactly like every other admin mutation. This flow sits behind a new
  `TopUpAdapter` interface (mirroring the existing Payment Adapter
  pattern, §3.5) specifically so that a future gateway-based auto-top-up
  can plug in later as a second adapter implementation without touching
  wallet/ledger logic itself — v1.0 ships exactly one implementation
  (manual bank-transfer verification). The Module 17 admin
  commission-invoice verification screen is **repurposed** for this — same
  list-and-verify UI pattern, now listing top-up requests instead of
  invoices, not a new screen built from scratch.
- FR-6.24: **Deductions beyond commission.** A paid plan's fee, a Team
  leader's monthly per-seat group total (FR-7.15/7.18, unchanged math —
  active sponsored member count × the leader's Team tier's seat price),
  and the FR-25.7 extra-device-slot add-on all debit the same seller
  wallet, monthly in advance, on the seller's existing billing-cycle
  cadence — see the revised FR-7.2 (§5.7) for the plan-fee case
  specifically, since its overdue consequence differs from commission's.
- FR-6.25: **Low-balance grace ladder.** All thresholds and day-counts
  below are Settings Registry entries (global scope). When a wallet's
  balance drops below a configured low-balance threshold
  (`billing.wallet_low_balance_threshold`), the seller sees a dashboard
  warning and receives a warning email; if the balance is not restored
  above the threshold within a configured grace window
  (`billing.wallet_grace_days`, default **3**), the store transitions to
  a new **`orders_paused`** state — distinct from admin-issued
  `suspended` (FR-8.4): the storefront stays fully browsable (catalog,
  product pages, cart) and shows a respectful "temporarily not accepting
  orders" notice only at the point checkout would otherwise complete,
  never a blanket "store unavailable" the way `suspended` reads. A
  verified top-up that brings the balance back above the threshold lifts
  `orders_paused` **instantly** — no admin action needed, unlike
  suspension's admin-driven lift. `orders_paused` never overwrites an
  independently admin-issued `suspended`/`banned` state, same
  non-clobbering discipline §14.6c's suspend/lift sweep already
  established.
- FR-6.26: **Negative-float cap.** The wallet is permitted to go
  negative, down to a configurable floor
  (`billing.wallet_negative_float_limit`, default a small Rs. amount) —
  this exists purely so a confirmed sale's commission debit can never
  fail or roll back mid-transaction because of a balance that was
  positive when the buyer paid but dipped below zero by the time
  `markAsPaid()` runs the debit. Crossing into negative territory is
  exactly the kind of balance drop FR-6.25's low-balance threshold is
  expected to already have caught upstream; the floor is a hard backstop,
  not the primary mechanism.
- FR-6.27: **Wallet dashboard.** A "Balance" summary is visible on the
  seller's dashboard at all times; a dedicated top-up screen (presets +
  custom amount, FR-6.23) and a full transaction history — every credit
  and debit, in plain language ("Top-up verified", "Commission — Order
  #1234", "Monthly plan fee — Growth", never a raw ledger-entry-type
  string) — are both one click away. **Paginated** (Phase B pre-launch
  audit finding — `page`/`limit` query params, default 20/page, capped at
  100/page; a high-volume seller's history no longer returns every ledger
  row in one unbounded response) — Previous/Next controls on the dashboard
  screen, same pagination shape reused by the admin Seller-360 page's
  recent-activity panel.
- FR-6.28: **§5.6c's monthly invoice-generation job, overdue sweep, and
  suspend-on-nonpayment mechanism are DORMANT**, preserved as working code
  behind their existing settings/scheduler, simply unscheduled — a future
  enterprise/post-paid mode may re-enable them. `seller_invoices.
  invoice_type = 'commission'` rows stop being generated going forward;
  `plan_subscription` and `group_sponsorship` rows are superseded by
  FR-6.24/FR-7.2's wallet debits and never generated either. The table and
  its `InvoiceType` enum are unchanged in shape — nothing is dropped, only
  unused.
- FR-6.29: **Running wallet balance + daily reconciliation (new v0.33).**
  A new `WalletBalance` table (one row per seller: `balance`, `updatedAt`)
  is updated **atomically, in the same database transaction** as every
  `LedgerEntry` insert — a single, shared write path so no caller can
  create a ledger entry without the balance column moving with it in
  lockstep. `WalletService.getBalance()` becomes a plain O(1) read of
  this column instead of re-aggregating the ledger; every existing caller
  (the publish gate, the grace-ladder sweep, the negative-float check,
  payout eligibility, the plan-fee sweep, the wallet dashboard, the
  Verified Store Program application-fee check) is unchanged at the call
  site — only what `getBalance()` does internally changes. This also
  closes a concurrency gap the v0.33 audit found: two orders completing
  near-simultaneously previously could each read the same stale
  re-aggregated balance and both pass an affordability check that only
  one should — the atomic column update, inside the same transaction as
  the debit it represents, makes that race structurally impossible. A new
  **daily reconciliation job** (none existed before v0.33 — confirmed
  gap, not a regression) recomputes each seller's true ledger sum and
  compares it against `WalletBalance.balance`; any drift is flagged for
  admin visibility (the same admin-notification-center precedent FR-39.2
  already established) rather than silently auto-corrected, so a real
  bug is surfaced, not masked.

### 5.6f Commission & Wallet — Confirmed Active, Dual Revenue Model (v0.35's deactivation CANCELLED and reverted, v0.36)
**v0.35 (above, superseded) specified deactivating commission to 0% and
hiding the wallet from every seller-facing surface.** That change was
built end-to-end (Module 59: `billing.commission_rate_percent` and every
per-plan override zeroed; commission copy stripped from the order detail
P&L, seller P&L page, wallet page, returns page, pricing page, and
homepage FAQ) and shipped in two commits — before reaching the founder's
sign-off it was **cancelled by explicit founder directive** and **fully
reverted** via `git revert` of both commits, restored byte-for-byte to
the pre-Module-59 tree. FR-6.30/FR-6.31/FR-6.32 below replace the v0.35
versions of the same FR numbers outright — the 0%/hidden-wallet design
they described was never approved and must never be re-attempted.

**The locked model going forward: UZEYN earns from two independent,
simultaneously-active streams —** (a) subscription plan fees, and (b)
commission per confirmed sale, debited from the seller's prepaid wallet
balance. Both the commission engine (`LedgerService.accrueCommission()`,
`commission_accrued`/`commission_waived`/`refund_adjustment` entry types,
`PnLService`'s commission subtraction, `InvoicesService`'s
commission-invoice generation) and the wallet engine (§5.6d/§5.6e,
Module 20/47's top-up, running balance, grace ladder, and reconciliation)
stay exactly as originally built, fully live and fully seller-visible —
neither is dormant, neither is hidden.
- FR-6.30 (revised v0.36 — supersedes v0.35's FR-6.30): **Global and
  every plan-scoped `billing.commission_rate_percent` stay at their
  original nonzero values — the commission ladder is Basic/Starter 2%,
  Growth 1.5%, Pro 1%** (identical numerically to the pre-v0.35 First
  Month/Starter/Growth/Pro values; Basic simply inherits the value First
  Month already had, per FR-7.20's rename), subject to the existing 2%
  hard cap (Module 45). `LedgerService.accrueCommission()` posts a real,
  nonzero `commission_accrued` entry on every confirmed sale, exactly as
  before v0.35 was ever drafted.
- FR-6.31 (revised v0.36 — supersedes v0.35's FR-6.31): **Every
  seller-facing surface that displays a commission rate, amount, or
  commission-related copy stays visible** — the order detail page's P&L
  breakdown, the seller P&L page, the wallet page, the returns page's
  "commission portion reverses" copy, the pricing page's "X% commission
  on sales" bullets, and the marketing homepage FAQ's commission mention
  are unchanged from their pre-v0.35 state. **"0% commission" must not
  appear anywhere in marketing or product copy** — see FR-7.21 for the
  corrected positioning (direct-to-seller payment, transparent low
  commission, "your money never sits with us").
- FR-6.32: **`program_commission_credit` (Growth & Partner Programs
  referral commission, §5.33) is a distinct concept and remains
  unaffected** — it is a payout the platform makes to an ambassador/
  referrer, not a charge on a seller's sale, and was never displayed as a
  seller-facing "commission" line to begin with. (Unchanged from v0.35;
  restated here for completeness since FR-6.30/6.31 above it changed.)

### 5.6g Combined Entry-Flow Payment — Plan Fee + Wallet Top-Up as One Transaction (new v0.36; supersedes v0.35's "Wallet & Top-Up Hidden" design below in full — that design was drafted and never built, since Module 59 only covered §5.6f's commission side before cancellation)
**The wallet is not hidden — it funds both commission debits and plan-fee
debits, and a new seller funds it in the same payment as their first
plan-fee charge.** At signup, a seller pays their chosen plan's
first-cycle price (FR-7.20) **and** a minimum wallet top-up together, in
**one combined transaction**, never two separate payment steps — e.g. a
Starter signup screen reading "Get started — Rs 2,198" with a visible
breakdown "Rs 1,499 first month + Rs 699 wallet credit" (Starter's
`firstCyclePrice` per FR-7.20's v0.37 defaults + the Rs 699 minimum
top-up). This reuses the existing
top-up-and-verify mechanism (§5.6d/e's `WalletTopUpRequest` submit →
`AdminWalletController` verify/reject flow) rather than inventing a
second payment/claim system — the claim simply carries a plan-fee portion
alongside its top-up portion, and one admin verification credits both in
the same transaction.
- FR-6.33 (redefined v0.36 — supersedes v0.35's FR-6.33 `SubscriptionPaymentClaim`
  design, which was never built): **New Settings Registry key
  `billing.minimum_signup_wallet_topup`** (Decimal, default **699**,
  global scope, admin-editable like every other Settings value). The
  signup/first-payment screen computes and displays
  `firstCyclePrice + minimum_signup_wallet_topup` as one combined total
  and one combined breakdown line; the seller submits one proof-of-payment
  for that combined amount via the existing top-up submission form
  (`WalletTopUpRequest`, extended with a `planFeePortion` field alongside
  its existing top-up amount). Verifying it is a single audit-logged
  transaction, structurally the same `AdminWalletController` verify action
  already defined, that in one commit: (a) posts a `wallet_topup` ledger
  entry for the top-up portion exactly as an ordinary top-up already does,
  and (b) activates/advances `Subscription.currentPeriodEnd` for the
  plan-fee portion exactly as the plan-fee-payment path already does.
  Rejecting requires a reason, mirroring the existing top-up rejection
  flow; nothing is activated or credited on a rejected claim.
- FR-6.34 (reaffirmed v0.36 — v0.35's FR-6.34 "PlanFeeDebitService becomes
  a pure sweep" redesign is retracted): **Subsequent billing-cycle plan
  fees continue to be debited from wallet balance**, exactly as
  `PlanFeeDebitService` already does per FR-7.2/§5.6e — commission
  accrual and plan-fee debits continue to share the same wallet, the same
  grace ladder (FR-6.25), and the same `orders_paused`/restore mechanics.
  Only the very first cycle is paid via the combined signup transaction
  (FR-6.33); every renewal after that draws from the running wallet
  balance as it always has.
- FR-6.35 (reaffirmed v0.36 — v0.35's FR-6.35 "drop the wallet-balance
  publish condition" is retracted): **Publish gate keeps all three
  original conditions unchanged** — payment method, verified CNIC, and
  wallet balance above the configured minimum (FR-6.21, unmodified).
- FR-6.35a (new v0.36): **Full re-verification of existing wallet
  mechanics against the four-tier plan structure (FR-7.20).** The grace
  ladder, `orders_paused`-on-insufficient-balance, the negative-float
  floor, the running-balance column, and the daily reconciliation job
  (§5.6e, Module 47) are unchanged in mechanism, but every plan-fee debit
  amount they act on must be re-confirmed correct now that a plan carries
  three price fields (`regularPrice`/`price`/`firstCyclePrice`) and three
  billing-cycle multipliers (FR-7.20) instead of the single price a plan
  had when these mechanics were first built — tracked as a Module 63
  build/test task (§14.65), not a mechanism change.

### 5.6h Seller Payment Gateway Connect (new v0.35; Raast priority + bank adapter added v0.36)
**How a buyer's payment auto-confirms an order without UZEYN ever touching
the money.** A seller may connect **their own** Raast, Easypaisa, JazzCash,
or bank account; when a buyer pays through it, UZEYN verifies the payment
against the seller's own account and auto-confirms the order — funds
settle directly with the seller, never passing through or being held by
UZEYN, the same "platform never touches buyer money" principle §5.6c's
opening line already established for Direct Seller Collection, now
extended to an automated (rather than manual mark-as-paid) confirmation
path. **Raast is the first-priority provider** (State Bank of Pakistan's
free instant-payment rail — zero merchant fee, unlike card/wallet
processors), offered first in the connect flow and in the checkout
provider list when a seller has multiple connections active; Easypaisa,
JazzCash, and a generic bank-transfer adapter follow as additional,
equally-supported options. The manual mark-as-paid flow remains the
fallback for any seller who connects no gateway at all.
- FR-6.36: **`StorePaymentGatewayConnection` (new model, RLS-protected,
  store-scoped).** `storeId`, `provider` (enum, extensible:
  **`raast`**, `easypaisa`, `jazzcash`, `bank`), `merchantId`,
  `apiKeyEncrypted`/`apiSecretEncrypted` (AES-256-GCM at rest, reusing the
  exact `drive-token-crypto.util.ts` primitive already shared by Google
  Drive tokens, CNIC, and SMTP credentials — a new dedicated
  encryption-key env var, not a new algorithm), `isActive`, `connectedAt`,
  a new `priorityOrder` (Int, default derived from provider — Raast
  lowest/first) so the checkout provider list has a stable, seller-
  visible ordering. Credentials are **never returned by any API
  response** — enforced the same way `SellerVerificationEmail`'s SMTP
  password already is, an explicit `SAFE_SELECT` field allowlist on every
  query rather than a decorator, with decryption happening only inside
  the gateway adapter's own internal call, never on a response path.
- FR-6.37: **`SellerPaymentGatewayAdapter` interface + a registry, mirroring
  `VerificationChannelAdapter`'s exact shape (§14.37).** One interface
  (`provider` + `verifyPayment(context): Promise<GatewayVerifyResult>`),
  one implementation per provider (**`RaastGatewayAdapter`** first,
  `EasypaisaGatewayAdapter`, `JazzCashGatewayAdapter`,
  `BankTransferGatewayAdapter`), registered into a `Map<provider, adapter>`
  inside a new orchestrator service that never branches on provider type
  beyond the map lookup — identical structure to the three
  `VerificationChannelAdapter` implementations already shipped in Module
  26, and extensible to any future provider by adding one more map entry,
  never a code branch. Real, structurally complete implementations calling
  each provider's documented server-to-server merchant-verification API
  (Raast via SBP's participant-bank API surface) — **not live-tested
  against a real Raast/Easypaisa/JazzCash sandbox**, since no such
  credentials exist in the build environment, the same disclosed
  limitation already noted for the Safepay/COD adapters. Every provider
  also supports the existing manual mark-as-paid fallback so a seller is
  never blocked from confirming an order while a gateway connection is
  pending or unavailable.
- FR-6.38: **Checkout wiring reuses the one shared confirmation core, not
  a second one.** A gateway is offered as a checkout payment option only
  when the seller has an active connection for it. On return from the
  gateway's own payment page, UZEYN calls `verifyPayment()`; on a verified
  match it calls the **same** `markAsPaid()`/order-confirmation path
  Modules 52/53 already established as the one shared write core for
  order confirmation — never a parallel confirmation mechanism. The
  Financial Truth Invariant is unchanged: confirmation happens only on a
  positively verified payment, exactly as `isClearedForConfirmation()`
  already gates the OTP/manual paths. The existing manual mark-as-paid
  flow (COD, bank transfer) stays as the fallback for sellers who have not
  connected a gateway.
- FR-6.39: **Seller-facing settings screen** — a new "Payment Gateway"
  screen (alongside the existing Payment Instructions screen) to pick a
  provider, enter credentials (write-only, never re-displayed, matching
  FR-30.1's CNIC pattern), test the connection, and toggle it
  active/inactive.

### 5.6i Subscription Business Readiness (new v0.38)
**Ten operational-readiness items for the wallet+commission model, founder-
validated against real Shopify sellers' top complaint (payment failure at
checkout) and the business mechanics around it.** Every item below reuses
an existing mechanism (Settings Registry, wallet ledger, email
infrastructure, invoice/PDF pipeline, admin analytics) rather than
inventing a parallel one — consistent with this SRS's standing discipline
of extension over duplication. Slotted as Modules 63-72, one FR per
module, after Module 62 (Payment Gateway Connect) and Modules 59-61
(Combined Entry-Flow Payment; Wallet/Commission Re-Verification; Four-Tier
Plan Pricing) and Module 48 (Facebook/Instagram Shop Feed + WhatsApp
catalog links) — see `docs/build-plan.md` for the founder-directed
resequencing.

- FR-6.40 (Module 63): **MRR analytics.** Extends FR-8.10's real-time
  platform analytics (GMV, revenue, commission, active stores, top
  sellers) with subscription-specific figures — MRR, new MRR, churned MRR
  (a seller whose subscription entered terminal `orders_paused`, FR-6.25),
  and expansion/contraction MRR (a seller's plan-fee change on upgrade/
  downgrade, FR-7.5) — computed live against `Subscription`/`Plan`/wallet
  ledger tables, same "computed live at launch volume, not a precomputed
  rollup" discipline FR-8.10 already commits to. Admin-only, on the
  existing admin analytics surface, not a new page.
- FR-6.41 (Module 64): **14-day data-retention window when a subscription
  reaches terminal non-payment.** Deliberately conservative scope,
  flagged for review: this is a *visibility/access* window, never a
  deletion mechanism — no destructive data-purge exists anywhere else in
  this SRS, and inventing one here would be a much bigger decision than
  "business readiness" implies. When a store's grace ladder (FR-6.25)
  reaches its terminal `orders_paused` state and stays unpaid, the
  seller's dashboard, data, and the ability to top up and republish stay
  fully intact for a new 14-day window (`Store.terminalPausedAt` + a
  Settings Registry `billing.data_retention_days`, default 14); the
  *storefront itself* (already unreachable to buyers under
  `orders_paused`, FR-6.25 unchanged) gains no new buyer-facing state.
  After the window elapses with no top-up, nothing is deleted — the store
  simply stays paused indefinitely, exactly as it already would; the only
  new behavior is a countdown surfaced to the seller (dashboard banner,
  reusing FR-8.15's in-app messaging pattern) and a matching win-back
  email (FR-6.42) timed to fire before the window closes. Actual data
  deletion, if ever wanted, is out of scope here and would need its own
  founder-approved SRS amendment.
- FR-6.42 (Module 65): **Renewal reminders + win-back, triggered
  transactional emails.** Reuses Module 55's per-seller transactional
  email-hook infrastructure (not Module 55's separate admin-broadcast
  `PlatformNewsletter` mechanism — these are individually triggered, not
  a composed campaign): (a) a low-balance reminder when the wallet balance
  falls below the next scheduled plan-fee debit amount (computed off the
  same `PlanFeeDebitService` figures FR-7.2/FR-6.35a already use) with a
  new Settings Registry lead-time key
  (`billing.renewal_reminder_lead_days`, default 3); (b) one win-back
  email fired partway through FR-6.41's 14-day retention window (a new
  `billing.winback_email_lead_days` key, default 7, i.e. roughly the
  window's midpoint) for a seller in terminal `orders_paused`. Both reuse
  the seller-opt-out toggle Module 55 already built — a seller who has
  disabled notifications gets neither, same as every other transactional
  hook.
- FR-6.43 (Module 66): **Multi-store downgrade rule, 30-day pause
  window.** Extends FR-7.5's plan-change mechanism for the specific case
  where a downgrade's new tier's `stores.max_per_seller` (Module 49) is
  less than the seller's current store count. The plan change still takes
  effect at the next billing cycle exactly as FR-7.5 already specifies;
  additionally, at that same moment, every store beyond the new limit
  (seller chooses which ones to keep, via a new confirmation step on the
  downgrade flow — never an automatic least-recently-active pick, since
  that's a business decision belonging to the seller) enters a 30-day
  pause window (a new `Store.overLimitPausedAt` marker, reusing the
  existing `orders_paused` status verbatim — this is not a fourth store
  status) during which the seller may upgrade back to reclaim it. After
  30 days with no upgrade, the store stays `orders_paused` indefinitely,
  the same "no forced deletion" discipline FR-6.41 establishes.
- FR-6.44 (Module 67): **Payment gateway health monitoring, admin-facing
  and aggregate.** Distinct from Module 62's own per-checkout fallback
  (FR-6.37/6.38, which already keeps a single buyer's checkout from
  blocking on one gateway's outage) — this is the founder-facing rollup:
  each `StorePaymentGatewayConnection` (FR-6.36) accumulates a rolling
  success/failure count and a `lastVerifiedAt` timestamp from every
  `verifyPayment()` call (FR-6.37), surfaced on the existing admin System
  Status page (FR-8.11) as a per-provider health rollup (e.g. "Raast:
  97% verified, last outage 2h ago" aggregated across every seller's
  connection to that provider) — so a platform-wide provider degradation
  is visible before individual sellers start reporting it, not a new
  monitoring page.
- FR-6.45 (Module 68): **Support SLA by plan.** New Settings Registry
  keys (`support.sla_hours`, plan-scoped, launch defaults Basic 48 /
  Starter 24 / Growth 12 / Pro 4) define a response-time commitment per
  tier, surfaced to the seller (dashboard + pricing page, FR-7.21) as a
  stated commitment. Deliberately scoped to *displaying and configuring*
  the commitment, not a full support-ticket SLA-tracking/escalation
  engine — no ticketing system exists anywhere in this codebase today
  (FR-8.15's in-app messaging is the closest existing support-adjacent
  mechanism, and remains the actual support channel); building ticket
  SLA enforcement is a materially larger, distinct project flagged here
  for a future amendment, not silently expanded into this one.
- FR-6.46 (Module 69): **Seller health funnel, admin analytics.** Extends
  FR-23.4/FR-8.10's computed-live discipline with a funnel view — seller
  counts at each lifecycle stage (signed up → first product listed →
  first sale → active/repeat-selling in the trailing 30 days → paused/
  churned) — computed from existing `Seller`/`Product`/`Order`/
  `Subscription` state, no new tracking table or event beyond what
  `platform_events` (§3.11) already captures.
- FR-6.47 (Module 70): **Monthly seller report + UZEYN subscription
  invoice.** Two related but distinct deliverables, both automated and
  both reusing existing pipelines: (a) a monthly summary email per seller
  (orders, revenue, commission paid, wallet activity for the trailing
  month) built on Module 55's email-hook infrastructure and Module 31's
  P&L engine data, opt-out via the same notification toggle FR-6.42
  reuses; (b) a downloadable **UZEYN subscription invoice** PDF — the
  seller's own record of what they paid *to the platform* (plan fee +
  commission for the period), a distinct document from Module 57's
  buyer-facing order invoices, built on the same PDF-generation pipeline
  (Module 11/57's `invoice-template.ts` rendering approach) but scoped to
  the seller's own wallet-ledger entries for that period rather than an
  order.
- FR-6.48 (Module 71): **First-cycle discount abuse prevention.** Guards
  FR-7.20's `firstCyclePrice` discount against a seller creating repeat
  accounts solely to reclaim it. Reuses `Seller.cnicHash` (FR-30.1) as
  the durable per-person key: FR-6.33's combined signup flow checks
  whether any other seller account sharing the same `cnicHash` has ever
  completed a `firstCyclePrice`-priced first cycle on any plan, and if
  so, silently substitutes that tier's standing `price` for
  `firstCyclePrice` in the combined total shown at signup — no accusatory
  messaging, the same quiet-substitution UX principle FR-25.5's regional
  gating already uses. Since CNIC is collected at seller *activation*,
  not at signup (FR-30.1), a new seller with no CNIC on file yet is
  provisionally granted the discount; the check re-runs the moment
  `cnicHash` is set, and a retroactive match adds the price difference as
  a one-time wallet debit rather than silently absorbing the loss.
- FR-6.49 (Module 72): **Subscription refund policy, 50%.** New Settings
  Registry keys (`billing.subscription_refund_window_days`, default 7;
  `billing.subscription_refund_percent`, default 50) define an
  admin-editable cancellation-refund policy for a seller's very first
  billing cycle. A qualifying cancellation posts a `refund_adjustment`
  wallet-ledger entry (FR-8.8's existing entry type, unchanged — not a
  new one) crediting the configured percentage of the cycle's
  `firstCyclePrice` back to the seller's wallet; this is a wallet credit,
  never an external gateway reversal, consistent with the wallet being
  the one place platform-owed money is settled (distinct from FR-6.36-39's
  buyer-to-seller payment rails, which UZEYN never touches).

### 5.6j Subscription-Only Business Model — Commission Deactivated, Wallet Hidden (new v0.39; supersedes §5.6f/§5.6g's wallet-active mechanics; §5.6i's Modules 63-72 will each be individually re-amended when their turn comes, since several assume the wallet-active model this section retires)
**Final, locked business-model decision — UZEYN earns from subscriptions
only (plus template sales later via the separate Template Store SaaS).**
Commission requires either collecting buyer funds (payment-aggregator
regulation, needs a registered entity UZEYN doesn't have yet) or gateway
split-payment (confirmed unsupported by Safepay and every gateway
evaluated for Module 62). Rather than delay launch, UZEYN ships
subscription-only now and re-activates commission later once a Pvt Ltd
and a split-payment-capable gateway exist. This is the same design intent
as the founder's original (cancelled) Module 59 — reapplied here
permanently, on the mechanisms this SRS actually built since then
(Modules 20/47/59-61), not a fresh design.

- FR-6.50 (Module 73): **Subscription-only renewal mechanism.** The
  publish gate (FR-6.21) drops its wallet-balance condition entirely —
  payment method + verified CNIC are the only two conditions left. A
  seller's plan fee — first cycle **and every renewal after it** — is
  paid through the same `WalletTopUpRequest`/`AdminWalletController`
  admin-verify flow FR-6.33 already built, now plan-fee-only (never a
  bundled wallet top-up; `amount` is always 0, `planFeePortion` carries
  the whole amount due). A seller's first-ever verified payment
  **activates** `Subscription.currentPeriodEnd` fresh from verification
  time, at the tier's discounted `firstCyclePrice`; every payment after
  that **advances** (stacks onto) the existing `currentPeriodEnd`, at the
  tier's full active (campaign-aware) price for the subscription's own
  billing-cycle multiplier (FR-7.20, unchanged computation, now read by
  `WalletService` instead of the retired auto-debit path).
  `PlanFeeDebitService`'s wallet-auto-debit renewal (FR-6.34) is retired
  in favor of this; it now performs only overdue detection — a
  subscription becomes due at `currentPeriodEnd` but stays un-paused for
  a new `billing.plan_fee_grace_days` (default 3, admin-editable) more
  days, covering ordinary admin-verification lag, before
  `WalletGraceLadderService.pauseActiveStores()` pauses it (the same
  mechanism the now-dormant wallet-low-balance ladder used); a verified
  payment restores instantly via a new unconditional
  `restoreAfterPlanFeePayment()`. The wallet-low-balance sweep and its
  scheduler are unscheduled (not deleted) — with the wallet hidden and
  commission going to 0% (FR-6.51 below), every balance would sit at 0
  forever, which is *below* any positive warning threshold, so a
  still-scheduled sweep would eventually pause every seller for a debt
  that was never real. Referral commission (FR-33.4) collapses back to
  exactly one call site — `AdminWalletController.verify()` — since
  `PlanFeeDebitService` no longer has a successful-debit branch to accrue
  from. The seller dashboard's wallet page is retired; a new Billing page
  (`/stores/:id/billing`) shows only the plan fee due right now and
  payment history — no balance, no top-up, no transaction ledger visible
  to a seller anywhere.
- FR-6.51 (Module 74): **Commission → 0% on every tier, removed from
  every seller-facing surface** (dashboards, invoices, settings, pricing
  page). The commission engine (`LedgerService.accrueCommission()`,
  `billing.commission_rate_percent`) stays fully intact and tested in
  code, exactly as dormant and re-activatable as the Safepay/COD adapters
  — only the seeded per-tier rate changes, alongside the tier
  rename/repricing below.
- FR-7.22 (Module 74): **Renamed, repriced tiers — GO/RUN/RISE/FLY,**
  replacing Basic/Starter/Growth/Pro (data-only change, same `Plan` rows
  — see `docs/build-plan.md` for the founder-approved price table). New
  Settings Registry key `billing.first_cycle_discount_percent` (default
  50, global) replaces the per-plan `firstCyclePrice` column as the
  first-cycle computation — every tier's first cycle bills at 50% off its
  standing price, admin-configurable in one place rather than per plan;
  `firstCyclePrice` goes dormant/unread, same treatment as the already-
  dormant `yearlyDiscountPercent`. Promotional coupon codes remain a
  separate, admin-controlled mechanism, out of scope here.
- FR-7.23 (Module 75): **Feature-gate ladder across GO/RUN/RISE/FLY** —
  store limits, staff accounts, email-campaign quotas, gift cards,
  customer segments, premium-template access, D-Studio/team-leader
  eligibility (closing the latent gap where the last two were defined but
  never actually enabled for any tier) — per the founder-approved matrix.
- FR-6.52 (Module 76): **Prepaid partial-advance (5%), a new anti-fake-
  order verification channel.** A buyer pays 5% of the order total via
  the seller's own connected Module 62 payment gateway at checkout; the
  order auto-confirms on verified partial payment, the remainder stays
  COD. Free from RUN upward; GO keeps only email + WhatsApp verification
  free (no partial-advance option).
- FR-6.53 (Module 77): **Verification-channel pricing.** Email
  verification stays free on every tier, always. WhatsApp verification
  becomes plan-gated (real per-message cost). SMS verification does not
  exist as a channel in this codebase and is explicitly out of scope
  here — not invented to satisfy this FR.
- FR-33.5 (Module 78): **Referral program renamed "Commerce Students
  Support."** Rs 345 per referral, payable for up to 2 renewal cycles if
  the referred seller renews that many times; still requires admin
  approval to join (FR-33.x's existing approval gate, unchanged).
- FR-33.6 (Module 79): **Ambassador Program repricing.** Rs 499 per
  referred store per renewed month, up to 3 months (pro-rated); still
  requires admin approval to join. Approved ambassadors gain a new
  Settings-configurable number of free platform accounts to demo/generate
  their own sales.
- FR-7.24 (Module 80): **Pricing page rebuild.** Every existing feature
  (badges, on-demand export, gateway connect, etc.) surfaced, grouped
  into readable sections (Selling / Design / Marketing / Operations /
  Trust & Security / Support); copy positions on "0% commission — keep
  every rupee you earn" and "your money never sits with us — buyers pay
  you directly"; local-dropshipping positioning ("connect with local
  suppliers, sell without holding stock") on the homepage/pricing page,
  copy only, no new backend.
- Explicitly NOT built (founder's decision, documented for the record):
  AI store design via MCP/agent linking (security risk, revisit
  post-launch only if ever); a customizable/build-your-own plan
  (roadmap note, not v1.0).

### 5.6k Subscription Business Readiness — Re-Amended for the Subscription-
Only Model (v0.41)
**§5.6j flagged this exact re-amendment as coming ("§5.6i's Modules 63-72
will each be individually re-amended when their turn comes, since several
assume the wallet-active model this section retires") — this is that
amendment.** FR-6.40 through FR-6.49 below replace §5.6i's text in place
(same FR numbers, same module numbers — this is a revision, not a
supersession); §5.6i's original prose stays in the document unmodified as
the historical record of what v0.38 specified before the pivot. Two new
FRs (FR-8.17, FR-8.18) cover genuinely new scope the founder added when
authorizing this batch: real bulk-action backend endpoints, and a minimal
support-ticket system to back FR-6.45's SLA numbers with something an SLA
can actually be enforced against.

- FR-6.40 (Module 63, revised v0.41): **MRR analytics.** Extends FR-8.10's
  admin analytics surface with: MRR (sum of every active paid
  `Subscription`'s plan price, normalized to a monthly figure — a yearly
  or six-month subscription's price divided by its interval's month
  count); active subscriptions per plan tier (GO/RUN/RISE/FLY); upcoming
  renewals in the next 7 and 30 days (`currentPeriodEnd` falling in that
  window); expired-not-renewed count (`currentPeriodEnd` in the past,
  store not yet re-verified — i.e. currently paused or within FR-6.41's
  retention window); churn rate (sellers whose subscription entered
  terminal pause in the trailing 30 days, as a percentage of active
  subscriptions at the start of that window); average revenue per seller
  (ARPS — trailing-30-day plan-fee revenue ÷ active seller count); an LTV
  estimate (ARPS ÷ churn rate, the standard approximation, clearly labeled
  as an estimate); first-cycle-to-full-price conversion rate (of sellers
  whose first cycle billed at `billing.first_cycle_discount_percent` off,
  the percentage who have since paid at least one full-price renewal);
  and expected revenue this month (sum of `Plan.price` for every
  subscription renewing this calendar month, at its post-first-cycle
  price). All computed live against `Subscription`/`Plan` and (for
  historical revenue figures) verified `WalletTopUpRequest` rows with
  `planFeePortion` set — the actual record of a real plan-fee payment
  under FR-6.50's admin-verify flow, confirmed by that flow's own
  documented behavior ("never posts a `wallet_plan_fee_debit` for the
  plan-fee portion, since that money never entered the wallet") — plus
  `refund_adjustment` `LedgerEntry` rows for FR-6.49's refunds. Admin
  analytics reads seller wallet/payment data it always could; nothing new
  is exposed to the seller. Admin-only, on the existing admin analytics
  surface, not a new page.
- FR-6.41 (Module 64, revised v0.41): **14-day data-retention window,
  now with a real scheduled deletion job (founder-authorized scope
  expansion over §5.6i's original delete-never stance).** When a seller's
  store transitions `active` → `orders_paused` specifically for plan-fee
  non-payment (`WalletGraceLadderService.pauseActiveStores()`, called from
  `PlanFeeDebitService.debitDuePlanFees()`), a new `Store.terminalPausedAt`
  timestamp is set (distinct from FR-6.43's `Store.overLimitPausedAt` —
  the two pause reasons never share a timer, and only a
  `terminalPausedAt` pause is ever eligible for deletion). A new Settings
  Registry `billing.data_retention_days` (default 14, global) sets the
  window. **Exact scope, founder-specified:**
  - **Deleted, permanently, when the window elapses with no verified
    renewal payment:** the store's products, variants, media references,
    and inventory records; its orders, order items, and any `Customer`
    row that exists only for that store; store-specific settings (theme
    customization, domain attachment, discount codes, gift cards,
    campaigns, segments); and that store's analytics/P&L history.
  - **Never deleted, retained permanently regardless of expiry:** the
    seller's own account (login, profile, CNIC/identity, security
    settings — a returning seller logs back in with no active store, and
    may start a new one from scratch); billing/subscription history and
    `LedgerEntry`/invoice records; `platform_events` and
    `admin_audit_logs` referencing the seller; and any record this SRS
    elsewhere designates immutable for legal/tax reasons.
  - **Before deletion, not after:** three warning emails — at expiry
    (day 0), day 7, and day 13 — each restating exactly what will be
    deleted and reminding the seller that their own Module 24 Google
    Drive export is their one backup, encouraging them to run one if they
    haven't. Reuses Module 55's transactional-hook infrastructure and its
    seller notification opt-out (FR-6.42's reuse note applies here too —
    though this warning is disclosure of an impending destructive action,
    not a marketing/reminder message, so it is **not** gated by the
    opt-out; a seller cannot suppress the one notice that their data is
    about to be permanently deleted).
  - **Race safety, binding:** the deletion job's very last step, inside
    the same transaction as the deletes themselves, re-checks that the
    store is still in `orders_paused` with `terminalPausedAt` still set
    and unchanged since the job queried it — a verified renewal payment
    (which calls `restoreAfterPlanFeePayment()`, clearing
    `terminalPausedAt` and restoring `active`) landing at any point up to
    that final check cancels the deletion for that store. Proven by an
    e2e test that verifies a payment concurrently with the deletion job
    running and asserts the store's data survives.
  - Deletion is transactional (one store's delete-set succeeds or fails
    as a unit) and audit-logged (`admin_audit_logs`, actor `system`,
    one entry per store deleted, recording what was deleted and when).
  - A seller who returns after deletion re-signs up a new store from
    scratch; nothing links it to the deleted one except their (retained)
    seller account and CNIC.
- FR-6.42 (Module 65, revised v0.41): **Renewal reminders + win-back,
  triggered transactional emails, admin-editable templates (new scope: a
  small `EmailTemplate` model, admin-editable body/subject with
  `{{placeholders}}`, one row per trigger key below — previously these
  would have been hardcoded strings in `EmailService`).** Six triggers,
  each keyed off `Subscription.currentPeriodEnd` (the wallet-balance
  trigger this FR originally used is retired along with the wallet-active
  model): pre-expiry reminders at 7, 3, and 1 day(s) before
  `currentPeriodEnd`; an expiry-day email the day `currentPeriodEnd`
  passes; and two win-back emails during FR-6.41's retention window, at 3
  and 7 days after `terminalPausedAt`, plus a final one at day 14 (the
  window's close, immediately before the deletion job's warning-email-13
  overlaps it — the two are distinct sends with distinct copy, both
  reusing the same admin-editable template mechanism). Correction to
  §5.6i's original text: Module 55 (FR-62.3) only ever built an opt-out
  for the admin-composed platform newsletter (`Seller.newsletterOptOut`)
  — its own schema comment is explicit that transactional emails (FR-62.1)
  are "never opt-outable," and no other transactional hook in the
  codebase (dormant-store warning, wallet low-balance warning, FR-6.41's
  retention warnings) checks it. These six are transactional, individually
  triggered per-seller lifecycle notices in that same category, so — like
  every other transactional hook, and consistent with FR-6.41's deletion
  warnings — they are **not** gated by any opt-out.
- FR-6.43 (Module 66, revised v0.41 — mechanically unchanged, confirmed
  wallet-independent): **Multi-store downgrade rule, 30-day pause
  window.** Extends FR-7.5's plan-change mechanism: when a downgrade's
  new tier's `stores.max_per_seller` is less than the seller's current
  store count, the seller chooses (via a new confirmation step on the
  downgrade flow) which store(s) stay active; every unchosen store gets
  `Store.overLimitPausedAt` set (reusing `orders_paused` verbatim, not a
  new status) at the moment the downgrade takes effect. If the seller
  does not choose, the oldest store (by `Store.createdAt`) stays active
  by default and every newer store is paused. An upgrade back within 30
  days clears `overLimitPausedAt` and restores every paused store for
  that seller up to the new limit; after 30 days with no upgrade, the
  store(s) simply remain `orders_paused` indefinitely — never deleted,
  never touched by FR-6.41's retention/deletion mechanism (that mechanism
  only ever acts on `terminalPausedAt`).
- FR-6.44 (Module 67, revised v0.41 — adds an active health-check sweep
  and seller-facing surfacing, both new over §5.6i's admin-only-aggregate
  original): **Payment gateway health monitoring.** Two mechanisms: (a) a
  new 6-hourly scheduled health-check sweep pings each distinct
  `PaymentGatewayProvider` currently connected by at least one store
  (a lightweight connectivity/auth check against the provider, not a real
  transaction) and records the result; (b) immediate detection piggybacks
  on every real `verifyPayment()` call already made at checkout
  (FR-6.37/6.38) — a failed verification updates that provider's rolling
  health stats the instant it happens, not just on the 6-hourly cadence.
  Both feed the same per-provider rollup already spec'd (success rate,
  `lastVerifiedAt`) surfaced on the admin System Status page. **New:**
  when a provider's rolling success rate drops below a
  `billing.gateway_health_alert_threshold_percent` (default 90, global)
  Settings Registry key, every seller with an active connection to that
  provider gets an email and a dashboard banner (reusing FR-8.15's
  in-app messaging pattern) naming the degraded provider. **Checkout
  itself never blocks:** Module 62's existing per-checkout fallback
  (FR-6.37/6.38 — a failed gateway verification already falls back to
  manual/COD confirmation for that one order) is unchanged and is what
  this monitoring surfaces the aggregate picture of, not a new blocking
  gate.
- FR-6.45 (Module 68, revised v0.41 — the SLA hours are now enforced
  against a real ticket, built as Module 90/FR-8.18 below, rather than
  only displayed): **Support SLA by plan.** Settings Registry
  `support.sla_hours` (plan-scoped: GO 48, RUN 24, RISE 12, FLY 4) is
  published on the seller dashboard and pricing page exactly as §5.6i
  specified, and is now also the deadline Module 90's ticket system
  computes and enforces per ticket (see FR-8.18).
- FR-6.46 (Module 69, revised v0.41 — mechanically unchanged): **Seller
  health funnel, admin analytics.** A funnel view — seller counts at each
  stage (signed up → store created → first product listed → published →
  first sale), with the drop-off count between each consecutive stage —
  plus a list of sellers "stuck" at a stage for longer than a
  `growth.funnel_stuck_days` (default 14, global) Settings Registry key,
  for founder/admin intervention. Computed live from existing
  `Seller`/`Store`/`Product`/`Order` state, no new tracking table.
- FR-6.47 (Module 70, revised v0.41 — "commission paid" becomes
  "subscription paid" under the 0%-commission model): **Monthly seller
  report + UZEYN subscription invoice.** (a) A monthly summary email per
  seller (orders, revenue, wallet-hidden-but-still-real subscription
  payments for the trailing month), Module 55 infrastructure. Correction
  to §5.6i's original text, same correction as FR-6.42's: no general
  seller notification opt-out exists for this category of email — Module
  55's own `sendDailySalesSummaryEmail` (the closest existing precedent,
  a periodic summary in the same style) checks no opt-out either, and
  `Seller.newsletterOptOut` is scoped to the admin-composed platform
  newsletter only. This monthly summary is unconditional, the same as the
  daily one. (b) a downloadable UZEYN
  subscription invoice PDF — the seller's own record of what they paid to
  the platform (plan fee only now; commission is 0%, FR-6.51) — a
  distinct document from Module 57's buyer-facing order invoices, built
  on the same `invoice-template.ts` rendering pipeline, scoped to the
  seller's own verified `WalletTopUpRequest` (`planFeePortion`) rows and
  any `refund_adjustment` `LedgerEntry` rows for the period.
- FR-6.48 (Module 71, revised v0.41 — widened from CNIC-only to a
  multi-signal match, reusing every relevant existing T&S signal, and
  updated for the global `billing.first_cycle_discount_percent` discount
  mechanism that replaced per-plan `firstCyclePrice`): **First-cycle
  discount abuse prevention.** A new `SubscriptionAbuseService` checks a
  signup (and re-checks at two later points, below) against every
  identity signal already captured elsewhere in this SRS for a different
  purpose, reused rather than duplicated: `Seller.cnicHash` (FR-30.1);
  `User.phone`, when present; the signup-time IP/device-fingerprint
  cluster match `RiskScoreService` already computes
  (`hasDeviceIpSignal`/`matchesSuspendedSellerCluster`); and, once set, a
  store's `StorePaymentInstructions` bank/JazzCash/Easypaisa account
  number. Three trigger points, since not every signal is available at
  every point: (1) **at signup** — cnicHash isn't collected until
  activation (FR-30.1), but phone and device cluster are; a match denies
  the first-cycle discount immediately (full standing price shown at
  signup, no accusatory messaging) and flags the seller for the existing
  Trust & Safety review surface (mirroring `selfReferralFlags`' live-
  computed pattern, `admin/trust-safety`); no match provisionally grants
  the discount. (2) **When CNIC is set** (`SellerIdentityService.setCnic`)
  — re-runs the full signal set; a retroactive match on a seller who
  already received the provisional discount posts a one-time
  `wallet_plan_fee_debit` for the price difference and flags for review.
  (3) **When a store's payment instructions are first set** — same
  retroactive-match/one-time-debit/flag treatment, since a bank/mobile-
  wallet account number is often the strongest repeat-identity signal and
  is only available at this later point. A confirmed repeat match on any
  future subscription cycle for that identity is never offered the
  discount again — the flag is durable, not one-time.
- FR-6.49 (Module 72, revised v0.41 — "first billing cycle" now means the
  `billing.first_cycle_discount_percent`-discounted cycle, mechanically
  otherwise unchanged): **Subscription refund policy, 50%.** Settings
  Registry `billing.subscription_refund_window_days` (default 7) and
  `billing.subscription_refund_percent` (default 50) define an admin-
  editable cancellation-refund policy for a seller's first billing cycle.
  A qualifying cancellation (admin-actioned, with a required reason,
  audit-logged) posts a `refund_adjustment` wallet-ledger entry crediting
  the configured percentage of that cycle's actually-paid (discounted)
  price back to the seller's wallet — a wallet credit, never an external
  gateway reversal. Published in the plan terms shown at signup and on
  the pricing page.
- FR-8.17 (Module 89, new v0.41): **Bulk-action backend endpoints.**
  Replaces the client-side `Promise.all` per-item fan-out pattern the
  admin terminal used for moderation bulk approve/reject and wallet-
  topup bulk verify/reject (both flagged in the UI feature inventory
  audit) with a real dedicated endpoint per action
  (`POST admin/moderation/queue/bulk-decide`,
  `POST admin/wallet-topups/bulk-decide`): a single transactional
  request, one `admin_audit_logs` entry for the whole batch (not one per
  item), and a real partial-failure response shape
  (`{succeeded: string[], failed: {id, reason}[]}`) instead of the
  frontend inferring failure from `Promise.allSettled` rejections. This
  is a correctness fix at scale (a partial failure among 200 selected
  rows should be reported precisely, not approximated client-side), not
  merely a performance one.
- FR-8.18 (Module 90, new v0.41): **Minimal support-ticket system,
  backing FR-6.45's SLA numbers with something an SLA can be enforced
  against.** §5.6i's original FR-6.45 explicitly disclosed that no
  ticketing system existed and that building one was "a materially
  larger, distinct project flagged here for a future amendment" — this
  is that amendment, deliberately scoped minimal: a `SupportTicket`
  model (store-scoped, subject, body, status `open`/`resolved`,
  `slaDeadline` computed at creation from the store's plan's
  `support.sla_hours`), a seller-facing create/list/view surface, and an
  admin-facing list/respond/resolve surface — both bare functional UI,
  same discipline as every other admin-terminal screen pending Phase 6's
  re-skin. Time-remaining-until-breach is computed and shown on both
  sides; a scheduled sweep posts an internal near-breach flag (visible on
  the admin list, plus one email to the responsible admin queue) when a
  ticket crosses 80% of its SLA window unresolved. Explicitly out of
  scope, matching the original disclosure's spirit: no rich text, no
  attachments, no multi-department routing, no canned responses — a
  ticket is a subject, a body, and a thread of plain-text replies.

### 5.7 Subscription Plans, Pricing & Billing
- FR-7.1: Tiered plans — **First Month, Starter, Growth, Pro** (v0.33: these
  were previously illustrative names; they are now the real, seeded v1.0
  individual tiers, replacing the as-built `Free`/`Standard`/`Pro` naming
  drift) — priced in the platform's configured currency (PKR at launch),
  gating features (product count, storage, template tiers, custom domain,
  coded-theme mode, analytics depth) via the Settings Registry.
- FR-7.2: **Recurring billing cycle for paid plans (revised v0.33 — no
  Free-Plan fallback; supersedes v0.24's downgrade-to-Free clause; see
  FR-6.24/§5.6e).** A seller on a paid plan is billed monthly-in-advance
  via a **wallet debit**, not a `seller_invoices` row — the same prepaid
  wallet FR-6.21 already gates publishing on. **Non-payment folds into
  the same mechanism FR-6.25 already runs for a commission shortfall —
  one grace ladder, not two:** a plan-fee debit that cannot be collected
  is treated identically to a low wallet balance and, after the same
  grace window, transitions the seller's store(s) to `orders_paused`.
  **There is no Free Plan to fall back to (§5.23's binding no-trial
  principle, strengthened by v0.33 — see FR-23.3) — a seller without an
  active paid subscription cannot publish a store at all (FR-6.21
  unchanged), and an existing paid seller who stops paying is paused,
  never silently moved to a free tier.** This retires the three
  `plan.findFirst({tierOrder: 0})` Free-plan-fallback lookups the v0.33
  audit found (two in the plan-fee debit sweep, one in the team-leave
  flow, FR-7.13) — none has a replacement lookup, since there is nothing
  to look up. The Teams group total (FR-7.15/7.18, leader-billed) and the
  FR-25.7 extra-device-slot add-on debit the same wallet on the same
  cadence, per FR-6.24, and non-payment of either folds into the same
  `orders_paused` ladder on the same terms.
- FR-7.3: **First Month (discounted paid entry — replaces the Free Plan,
  v0.33).** There is no free tier and no time-boxed trial (§5.23's
  binding no-trial principle applies to this tier as much as any other —
  see FR-23.3). Every new seller's **first billing cycle** is priced at a
  steep, founder-set discount off Starter's regular price (launch default:
  Rs. 1,499 vs. Starter's Rs. 5,799 discounted/launch price) while
  carrying **Starter's full feature set** from day one — 1 store, 100
  products, 2% commission, order verification, P&L dashboard, custom
  domain, all four storefront templates, WhatsApp tools. This is a real,
  distinct, paid `Plan` row (`tierOrder 0`, same tier-ordering mechanism
  FR-7.17 already defines) assigned at signup in place of the old
  Free-Plan assignment — a seller is never without a `Subscription` row,
  and that row is never free. At the end of the first billing cycle, the
  subscription **auto-transitions to Starter** at Starter's then-current
  price via the existing `Subscription.pendingPlanId` next-cycle
  mechanism (FR-7.5) — the same transition machinery already used for
  every other plan change, not a new one built for this case. Non-payment
  at any point (including the first cycle) is FR-7.2's `orders_paused`
  path, never a downgrade.
- FR-7.4: **Inverse commission laddering, with a hard ceiling (amended
  v0.33).** The plan editor (FR-8.2) exposes a per-plan commission-rate
  override such that higher-tier plans carry a **lower** commission —
  launch defaults: First Month/Starter 2%, Growth 1.5%, Pro 1% — using
  the same Settings Registry mechanism already defined for per-plan/
  per-seller/per-category overrides (FR-6.1, FR-8.3).
  **`billing.commission_rate_percent`'s validation ceiling is a hard
  2% maximum (v0.33) — not the previous purely-mathematical 100% percent
  bound.** `SettingsService.setValue()` rejects any write above this
  ceiling at any scope (global/plan/seller); the admin settings screen's
  existing high-impact-key confirmation step (already matching every
  `billing.`-prefixed key) applies unchanged — no admin can silently push
  commission past the ceiling, confirmed or not.
- FR-7.5: **Plan change flow (v1.0 simple rule)** — a plan upgrade or downgrade
  takes effect at the start of the seller's **next billing cycle**; no prorated
  mid-cycle billing in v1.0 (Phase 2 item).
- FR-7.6: **Yearly billing option** — the plan editor supports an annual billing
  interval alongside monthly, with an admin-configurable discount relative to
  twelve months at the monthly rate.
- FR-7.7: **Launch-campaign pricing** — time-limited or first-N-sellers
  promotional pricing/commission rates, expressed as Settings Registry entries
  with an optional expiry timestamp or a counter condition.
- FR-7.8: **Admin-granted plans (new)** — an admin can directly grant any
  plan to a specific seller from the plan editor (FR-8.2), bypassing
  normal checkout/billing for that one assignment. Recorded in
  `admin_audit_logs` like every other control-plane mutation (before/after plan).
- FR-7.9: **Platform-level subscription promotion codes (new)** — an admin can
  create a one-time discount code for **subscription billing** (a plan/billing
  discount), optionally targeted at a specific user, distinct from a seller's own
  store-level `discount_codes` (FR-2.11/FR-5.5), which discount products at
  checkout, not the seller's own subscription. A platform promo code is redeemed
  at most once (or up to an admin-set redemption limit) and can carry an expiry.
- FR-7.10: **Supplier Premium Plan (new monetization, v0.15).** The plan
  mechanism (FR-7.1–7.9) gains a second **plan type** — `seller` (existing) and
  `supplier` (new) — reusing the exact same Settings Registry-gated plan
  editor (FR-8.2), not a parallel billing system. A **free supplier tier**
  covers single-seller basics (registration, listing submission to one linked
  store, FR-3.1/FR-3.2); the **paid supplier tier** unlocks the **multi-store
  aggregated dashboard** (FR-3.3) as its flagship feature — a supplier
  connected to more than one seller's store sees the unified cross-store view
  only on a paid plan; a free-tier supplier connected to multiple stores still
  functions correctly per-store, just without the aggregated view. Pricing is
  founder-set data via the same plan editor, same as every other plan.
  **Full completion in Module 20 (new v0.20):** the plan DATA (Free/Premium
  supplier tiers) and the aggregation API/data (FR-3.3, `SupplierOrdersService`)
  both already exist (Module 14 and Module 9 respectively) — what's missing
  is the actual gate between them (`Subscription`/`SettingsContext` support a
  seller, not a supplier, today) and the supplier-facing dashboard UI itself,
  since no supplier login/dashboard surface has ever been built in `apps/web`.
  **Supplier wallet (supplemented v0.24):** the Premium tier's fee is
  collected via the identical prepaid-wallet mechanism §5.6e defines for
  sellers, but from a **separate, supplier-scoped wallet** — a supplier
  only ever owes its own plan fee (no commission, no team seats, no
  device slots), so this is a small, dedicated ledger rather than
  overloading the seller wallet's richer entry-type set with a second,
  unrelated owner. `TopUpAdapter` (FR-6.23) is reused as-is.
- **Confirmation (no gap found):** a **seller's own** multi-supplier management
  — one seller, many linked local suppliers, one seller-side dashboard — is
  already fully covered by existing FRs and requires no new work: FR-2.6/
  FR-2.7 (a seller can link and review listings from any number of suppliers)
  and FR-27.8/Module 8's build already scope the seller's listing-review queue
  and Module 9's order dashboard to the **store**, not to a single supplier —
  a seller with five linked suppliers already sees all five suppliers'
  listings/orders in one place with zero additional FRs. FR-7.10 above is
  specifically the **supplier's own** cross-store view, a distinct concern.
- FR-7.17: **Plan groups and tiers (architecture, new v0.19 — Cursor-style
  structure, mechanism only).** Plans are organized into named **plan
  groups** — v1.0 ships three: **Individual** (self-fulfilled/normal seller
  plans, e.g. Free → Starter → Standard → Pro), **Team** (leader-facing,
  itself tiered — three sub-tiers, §5.31), and **Supplier** (Free → Premium,
  FR-7.10) — each containing an **ordered list of tiers**. The plan editor
  (FR-8.2) supports creating, reordering, and retiring both groups and
  tiers as data; adding a new tier or re-ordering existing ones never
  requires a deploy. Every existing plan-gating mechanism (Settings
  Registry precedence, FR-7.1's feature gates, FR-7.4's inverse commission
  laddering, FR-7.16's developer perks, FR-28.4's dashboard-personalization
  gating) keys off a seller's resolved **(group, tier)** pair — the
  addressable unit every gate checks against, replacing the flat, single
  plan-id assumption FR-7.1–7.9 were originally written against (no
  behavior change to any of those FRs, only the underlying addressing
  scheme). **Tier comparison / upgrade UI** (the public pricing page and
  in-dashboard upgrade prompts) renders entirely from plan-editor data —
  tier names, prices, per-tier feature lists, and which tier is
  "recommended"/"current" are all read from the plan/tier records, never
  hard-coded in the frontend; adding or changing a tier is a data
  operation, identical in spirit to FR-12.1's "publishing is a data
  operation, never a deploy" discipline applied here to pricing UI.
- FR-7.18: **Team plan per-seat pricing (new v0.19 — revises FR-7.15's
  group-invoice math).** A Team plan tier defines a **seat price** and
  team-level limits/perks (e.g., max sponsored members, analytics-depth
  level) as founder-set plan data — **not** each sponsored member's own
  individually-chosen plan price. While sponsored, a member's individual
  plan **becomes whatever the leader's chosen Team tier grants** (a
  uniform per-seat plan-equivalent, the same way Cursor's Business plan
  gives every seat the same feature set regardless of what an invitee
  might otherwise have picked) — FR-7.13's "downgrades to Free on leave"
  rule is unchanged, since Free is simply what a member's plan reverts to
  once no longer occupying a sponsored seat. A leader's monthly group
  invoice (FR-7.15, Module 11 invoicing verbatim) is therefore computed as
  **(active sponsored member count) × (the leader's Team tier's seat
  price)** — every seat on one team bills at the same price, never a
  per-member-chosen amount. FR-7.15's text is amended accordingly (see
  §5.31); §14.31's group-invoice-math checklist line is updated to match.
- FR-7.19: **Struck-through regular pricing + campaign pricing (new
  v0.33).** `Plan` gains a `regularPrice` column (nullable Decimal,
  alongside the existing `price` — the field that's actually billed).
  Whenever `regularPrice` is set and exceeds `price`, the plan editor and
  the public pricing page (FR-7.17) render `regularPrice` struck through
  beside the current `price` — no new mechanism for a further "campaign"
  discount: an admin lowering `price` again for a limited window (e.g.
  the launch defaults' First Month Rs. 1,499 / Starter Rs. 5,799 /
  campaign Rs. 4,999) is the same single-field edit, consistent with
  FR-7.7's existing time-limited-promotional-pricing concept and FR-7.17's
  "pricing UI is a data operation, never a deploy" discipline. Launch
  default data for all four tiers (First Month/Starter/Growth/Pro —
  `regularPrice`/`price`/commission %/product limit/feature flags) is
  founder-set plan-editor data, recorded in `docs/database-schema.md`'s
  seed notes, never hard-coded. Yearly billing stays FR-7.6's existing
  mechanism, seeded at a 2-months-free (16.67%) discount for every tier —
  no new field. The pricing page must additionally render a "Most
  Popular" badge on one admin-designated tier (a new
  `plans.most_popular_tier_id`-style Settings Registry pointer, not a
  hard-coded tier name), a long value-stacked per-tier feature list, and
  a Shopify cost-comparison line — all sourced from plan/settings data,
  the same "never hard-coded in the frontend" rule FR-7.17 already binds
  tier names/prices/features to, extended here to cover price display and
  comparison copy too.
- FR-7.20: **Four permanent tiers, three price points each, three billing
  cycles (new v0.35 — retires FR-7.3's "First Month is a separate,
  auto-transitioning tier" framing).** The individual plan group is
  **Basic, Starter, Growth, Pro** — Basic **replaces** the old "First
  Month" tier as a real, permanent tier a seller can stay on indefinitely
  (no more auto-transition to Starter at `pendingPlanId`'s next cycle;
  that mechanism is retired for this purpose, though `pendingPlanId`
  itself is unchanged and still used for ordinary upgrade/downgrade,
  FR-7.5). Every tier carries **three price fields**, all monthly-cycle
  figures: `regularPrice` (struck-through reference, unchanged field from
  FR-7.19), `price` (the standing discounted/billed recurring price,
  same field FR-7.19 already defines), and a new **`firstCyclePrice`**
  (nullable Decimal) — a one-time discount applied only to a subscription's
  very first billing cycle, replacing FR-7.3's tier-level "First Month"
  concept with a **per-tier** one: whichever tier a seller signs up for,
  their first cycle is billed at that tier's `firstCyclePrice`, and every
  subsequent cycle at `price` — never a forced transition to a different
  tier. **Launch defaults, revised v0.37 — lowered from the v0.35 figures
  now that commission (FR-6.30) is confirmed active alongside subscription
  fees rather than zeroed** (the v0.35 prices were raised on the
  now-cancelled assumption that subscriptions would be UZEYN's only
  revenue stream): Basic regular 3,999 / price 2,999 / firstCycle 999,
  2% commission; Starter regular 6,499 / price 5,299 / firstCycle 1,499,
  2% commission; Growth regular 16,999 / price 13,999 / firstCycle 2,999,
  1.5% commission; Pro regular 32,999 / price 26,999 / firstCycle 4,999,
  1% commission — founder-set plan-editor data, per FR-7.17's "never
  hard-coded" discipline, recorded in `docs/database-schema.md`'s seed
  notes like every other launch default.
  A new nullable `campaignPrice` (Decimal) plus `campaignActive` (Boolean,
  default false) lets a tier carry a **second**, separately-toggleable
  discounted price alongside its standing `price` — e.g. Basic's launch
  data also seeds `campaignPrice: 2,499` (revised v0.37 alongside the
  lowered base prices above, kept below the new `price` of 2,999 so the
  campaign variant is still a genuine discount) — for a time-boxed campaign
  variant that doesn't require overwriting the standing `price` the way
  FR-7.19's original single-field campaign framing did (that framing is
  superseded for tiers that set `campaignPrice`; a tier that never sets it
  behaves exactly as FR-7.19 always described). When `campaignActive` is
  true, the pricing page shows `campaignPrice` as the active price
  (`regularPrice` still struck through above it); otherwise it shows
  `price`.
  **Three billing cycles, computed, not stored per-cycle:** monthly (the
  stored figures above, unchanged), **six-month** (**5.5×** the active
  monthly price — the seller is billed for 5.5 months' worth but the
  cycle covers 6 months' service) and **yearly** (**10×** the active
  monthly price, covering 12 months) — both fixed multipliers, held as new
  global Settings Registry keys (`billing.six_month_price_multiplier`
  default 5.5, `billing.yearly_price_multiplier` default 10, replacing
  FR-7.6's admin-configurable-percent framing with the founder's exact
  fixed-multiplier model), applied by a small pricing-derivation utility
  the same way `computeYearlyPrice()` already derives the yearly figure
  today — no new stored per-cycle price rows. `firstCyclePrice` applies
  only when a seller chooses the monthly cycle at signup; choosing
  six-month or yearly at signup bills the corresponding multiplier off
  `price`/`campaignPrice` with no separate first-cycle discount (a
  documented simplifying assumption, not implied by the founder's
  message — flagged for review, not blocking). All three cycles are
  selectable on both the public pricing page and the admin plan editor. A
  new `Subscription.billingInterval` field (extends `PlanBillingInterval`
  with a `six_month` value) records which cycle a given subscription is
  on, so `PlanFeeDebitService`'s expiry sweep (FR-6.34) advances
  `currentPeriodEnd` by the correct span (1/6/12 months) and
  `SubscriptionPaymentClaim`'s amount-due reflects the correct multiplied
  price.
- FR-7.21: **Pricing page psychology (new v0.35, extends FR-7.19's
  rendering rules; headline-benefit clause corrected v0.36).** The public
  pricing page must render: the struck-through `regularPrice` beside the
  active selling price (FR-7.19, unchanged); a "Most Popular" badge on
  Growth (the existing `plans.most_popular_tier_id`-style Settings
  pointer, FR-7.19, simply re-pointed at Growth as launch data — still
  admin-editable, never hard-coded to "Growth" in the frontend); **a
  headline benefit block corrected v0.36 to drop the retracted "0%
  commission" claim (§5.6f) in favor of three positioning points, all
  Settings Registry strings, none hard-coded: "buyer payments go straight
  to your own account," "transparent low commission, only [ladder]% —
  never a payment-processor markup on top," and "your money never sits
  with us"** — this replaces the v0.35 single-line "0% commission — keep
  every rupee you earn" claim outright, never displayed alongside it; a
  long, value-stacked per-tier feature list (already required by FR-7.19,
  reaffirmed); a savings callout on the six-month/yearly toggle stating
  the effective monthly rate and rupee amount saved versus paying monthly
  twelve times; and a one-line comparison against Shopify's nearest
  equivalent tier (copy, not a live price feed — a Settings Registry
  string, editable without a deploy, same discipline as every other
  pricing-page string).

### 5.8 Platform Admin Terminal — the Control Plane
The admin terminal is not "a management screen" — it is the platform's control
plane. Every item below is implemented as Settings Registry entries (§3.8) and
small, purpose-built tables, so that operating the platform day to day never
requires the founder to ask an engineer for a deploy.

- FR-8.1: **Feature flags** — any feature-gated behavior can be enabled/disabled
  instantly at global, per-plan, or per-seller scope through the Settings Registry;
  precedence is seller > plan > global.
- FR-8.2: **Plans & pricing editor** — create, edit, and retire plans directly from
  the admin UI; each plan's limits are Settings Registry entries scoped to that
  plan.
- FR-8.3: **Commission & payout engine settings** — global commission %, category-
  and seller-level overrides, the default hold duration, hold-graduation
  thresholds, and rolling-reserve parameters are all editable via the Settings
  Registry. Changing a rate affects only *new* ledger entries going forward.
- FR-8.4: **Seller lifecycle control** — approve, suspend, ban, or limit a seller;
  read-only "view any store" access; a secure, time-boxed, reason-required
  **"login as seller" impersonation** mode, fully audit-logged; instant
  force-disable of a single store. **This is the admin action surface the
  Trust & Safety enforcement ladder (§5.29) escalates into** — warning and
  restriction are lighter-weight states this same lifecycle control already
  needs to express (a "limited" seller), suspension and ban are the existing
  actions verbatim.
  - **Impersonation transparency (new, v0.23):** a persistent "support mode"
    banner is visible for the entire duration of an impersonation session;
    starting one emits a `platform_event` (§3.11); the impersonated seller's
    own Security card (§5.25/FR-25.7's screen) shows a support-access history
    line — when it happened and for how long, never the admin's identity.
    Impersonation is otherwise read-write, but **mark-as-paid, payment-
    instruction changes, and payout/invoice actions are blocked outright**
    while impersonating — support can fix a seller's settings, never move
    money or money-adjacent state on their behalf.
- FR-8.5: **Supplier lifecycle control** — the same approve/suspend/ban controls as
  FR-8.4, plus platform-level listing approve/reject for policy violations.
- FR-8.6: **Template management** — publish/unpublish a template, mark it free or
  premium, and assign which plans can access it — extended in v0.6 by the
  Template Store entitlement model (§5.24a).
- FR-8.7: **Announcements & maintenance mode** — scheduled, platform-wide banners,
  and a global maintenance-mode toggle checked by a lightweight middleware in
  front of every module, with an admin-IP allowlist.
- FR-8.8: **Risk & fraud controls** — flag a suspicious order for review; freeze or
  release a specific seller's payouts; initiate a refund, recorded as a
  `refund_adjustment` ledger entry.
- FR-8.9: **Immutable audit log** — every control-plane action is recorded with
  actor, action, target, before-value, after-value, and, where applicable, the
  impersonation session it occurred under. Immutability is enforced at the
  database level (no `UPDATE`/`DELETE` privilege for the application's runtime
  role).
- FR-8.10: **Real-time platform analytics** — GMV, revenue, commission earned,
  active store count, and top sellers, computed live against the transactional
  tables at launch volume; extended by the unit-economics view (FR-23.4). Both
  this and FR-23.4 are the intended eventual readers of `platform_events`
  (§3.11/FR-26.x) — recording starts now (Module 1 onward, backfilled), no
  dashboard work changes today.
- FR-8.11: System health dashboard (queue depth, error rates, VPS resource usage).
- FR-8.12: Admin accounts require mandatory MFA (not optional).
- FR-8.13: **Listing/content moderation queue** — supplier listings and store
  content can be flagged for prohibited/counterfeit goods, with a takedown action
  that also triggers the payout freeze in FR-6.10.
- FR-8.14: **External-API client registry (new in v0.6)** — admin can view,
  enable, or disable the Template Store and Social Media SaaS API clients from the
  admin terminal, mirroring the Supplier Adapter registry (FR-4.9). Disabling a
  client immediately rejects further calls from it without affecting any other
  integration.
- FR-8.15: **In-app messaging (extends FR-8.7, new)** — announcements are not
  limited to a single platform-wide banner. An admin can create a message on any
  of three channels — **banner**, **popup**, or **in-app notification** — each
  independently **targeted** (all sellers / a specific plan / a specific seller)
  and **scheduled** (start/end window, same mechanism as FR-8.7's existing
  scheduling). Maintenance mode (FR-8.7) remains the one global, non-targetable
  kill-switch — targeting only applies to the messaging channels, not to
  maintenance mode.
- FR-8.16: **Confirmation-required destructive/money-moving actions (new, v0.40
  — closes a gap the UI feature inventory audit found: near-zero confirm steps
  existed anywhere in the admin terminal).** A shared, reusable confirmation
  step — not a per-page reimplementation — that any admin control-plane action
  can require before it fires. On trigger it shows, in plain language, what is
  about to happen; for a money- or value-changing action, the exact amount or
  the old value → new value (the same shape FR-8.1's Settings Registry editor
  already used for a "high-impact key" before this FR, now generalized). At
  minimum required on: wallet balance adjustment and growth-program clawback
  (FR-8.4's Seller-360 view); invoice mark-paid and commission waive; return
  refund completion (FR-8.8); any seller lifecycle status change including ban
  (FR-8.4); moderation force-remove (FR-8.13); plan retirement (FR-8.2);
  external API client secret regeneration (FR-8.14); unlinking an admin email
  account; deleting an in-app message (FR-8.15); supplier/adapter enable-
  disable toggling (FR-8.5); and every bulk-action variant of the above
  (moderation bulk approve/reject, wallet-topup bulk verify/reject). **Sending
  a platform-wide newsletter is the single highest-blast-radius action in the
  terminal** (broadcasts to every seller with no per-recipient undo) and
  requires the strongest variant — the admin must type an exact confirmation
  word, not just click through a dialog. **High-impact-key detection is
  data-driven, not a frontend guess:** a new `requiresConfirmation` boolean
  field on each Settings Registry key definition (admin-settable per key,
  seeded `true` on every `billing.*`, `*commission*`, and `platform.maintenance*`
  key at launch) replaces the prior hardcoded frontend string-match, and every
  write path for a Settings Registry value — including Seller-360's own
  settings-override mini-editor, which previously bypassed this check entirely
  — reads the same field. Styling is intentionally minimal at this checkpoint
  (this FR is a safety-mechanism fix, not part of the UI/UX Design Phase); the
  Phase 6 admin-terminal re-skin re-styles this component like every other
  admin primitive, without changing its behavior.

### 5.9 Media Management
- FR-9.1: Seller connects Google Drive via OAuth to bulk-import product
  images/video. The connection is **seller-scoped** (one Google account per
  seller, reused across all of that seller's stores), recorded in
  `google_drive_connections` (schema gap found and closed in v0.7 — see
  `docs/database-schema.md`): the seller's OAuth **refresh token is stored
  encrypted at rest** (app-level AES-256-GCM, key from env, never logged, never
  returned by any API response); the short-lived **access token is never
  persisted to Postgres at all** — it lives only in Redis for the duration of an
  active import job. A seller can **revoke** the connection at any time from the
  dashboard; revocation deletes the stored refresh token and makes a best-effort
  revocation call to Google, and is **audit-trailed** the same way a Product Feed
  API token revocation is (FR-24.10).
- FR-9.2: Imported media is copied into platform object storage (self-hosted
  MinIO, §3.3) fronted by the CDN for storefront delivery — Drive is a source, not
  the runtime dependency.

### 5.10 Notifications
- FR-10.1: Email notifications for order/payout/listing events at launch
  (including the buyer order-status link, FR-5.4, and payout status changes,
  FR-6.12); SMS/WhatsApp as a Phase 2+ addition.

### 5.11 Custom Domain
- FR-11.1: Every store gets a free subdomain (`storename.uzeyn.com`) by default.
- FR-11.2: Seller can attach an owned custom domain via CNAME/A-record
  instructions with automated verification and TLS issuance.
- FR-11.3: **Domain upsell referral (link-out only, new v0.18).** The
  custom-domain dashboard screen additionally renders a "Get a domain"
  affiliate block pointing to a domain-registrar partner. The link URL, the
  partner's display name, and an enabled flag are Settings Registry entries
  (`domains.referral_enabled`, `domains.referral_url`,
  `domains.referral_partner_name`), so the founder can change or disable the
  affiliate partner without a deploy. This is presentation/link-out only,
  the same spirit as FR-24.2's premium-templates showcase — uzeyn.com does
  not sell, resell, process, or fulfill any domain purchase; clicking
  through hands the seller off to the partner's own site entirely. The
  block renders nothing at all when the enabled flag is off.

### 5.12 Content Pages (legal, about, contact)
- FR-12.1: Platform content pages — Terms of Service, Privacy Policy, Refund
  Policy, About, Contact — are stored as **versioned, rich-text content in the
  database** and edited from the admin terminal; publishing a text change is a
  data operation, never a deploy. Each edit creates a new version; prior versions
  remain retrievable.
- FR-12.2: Draft legal content for Terms of Service, Privacy Policy, and Refund
  Policy — covering the marketplace model, the 3% commission, the per-transaction
  hold, and the rolling reserve — ships as `docs/legal/*.md` for human legal
  review before launch.
- FR-12.3: **Platform brand asset management (new)** — the admin-editable content
  capability in FR-12.1 extends to the platform's own visual assets (logo,
  favicon, marketing hero images), stored and versioned the same way as content
  pages (a current pointer + an append-only revision history), so a brand refresh
  is a data operation, never a deploy.
  - **Confirmation (no gap found):** per-plan visual/template tiers are already
    fully covered by existing FRs — FR-7.1 (plan editor gates `themes.tier`
    access) and FR-8.6 (template management assigns which plans can access a
    given template) — independently of, and layered under, the marketplace
    entitlement mechanism (FR-24.5). FR-12.3 only adds **platform-owned** brand
    assets to admin control; it does not change how seller-facing template tiers
    are gated.

### 5.13 Customers (CRM)
- FR-13.1: A **customer record** is automatically created (or matched by email) in
  a per-store `customers` table the first time a buyer checks out at that store —
  name, email, phone, order count, and total spent are tracked and updated on
  every subsequent order from the same email. **This applies uniformly regardless
  of order source** (clarified in v0.6): a manual/draft order (FR-17.1) updates the
  same customer record a storefront order would.
- FR-13.2: Seller dashboard customer list (searchable, sortable by total
  spent/order count) and a per-customer detail view showing their order history at
  that store.
- FR-13.3: Customer records are tenant-scoped exactly like every other store table
  — a seller never sees another seller's customers, even for the same buyer email.

### 5.14 Product Reviews & Ratings
- FR-14.1: A buyer can submit a review (rating 1–5, text) against a product they
  purchased, identified via the order-status link (FR-5.4) rather than an account.
- FR-14.2: A review is flagged `verified_purchase` when it is linked to a real
  order for that product at that store; unverified submissions are allowed but
  shown as unverified, never hidden as spam by default.
- FR-14.3: A seller **moderates** reviews for their own store — approve or hide —
  before a review counts toward the product's displayed average rating; no review
  publishes automatically.
- FR-14.4: A product's average rating and review count are shown on its storefront
  page, recomputed whenever a review's moderation status changes (denormalized for
  page-load speed — the highest-traffic read path a review touches).
- FR-14.5 (Module 93, new v0.44 — founder batch item A9): **Review detail
  view.** The seller moderation queue (FR-14.3) gets a per-review detail
  view (buyer email in addition to name, order reference, full media
  gallery, and — once a review reaches the deleted state below — its
  deletion reason and timestamp) alongside the existing compact list row;
  it is a read surface only, not a second moderation entry point (the
  approve/hide/delete actions stay exactly where FR-14.3 already put
  them).
- FR-14.6 (Module 93, new v0.44 — founder batch item A9): **Reason-audited
  soft-delete, seller-initiated.** `ReviewStatus` gains a fourth value,
  `deleted`, alongside `pending`/`approved`/`hidden` — a harder, one-way
  action from a seller's perspective (no "undelete" surfaced anywhere),
  distinct from `hidden` (which stays freely reversible via the existing
  approve/hide toggle). Soft, not physical, exactly like every other
  "delete" in this system with a downstream audit/legal reason to keep
  the row (returns, order cancellation) — a deleted review's row,
  `deletedAt`, and `deletedReason` persist, it is simply excluded from
  the product's public rating/count recomputation (FR-14.4) the same way
  `hidden` already is. A reason is **required** to delete (mirrors
  FR-60.3's reject-a-return-request reason requirement — same "a reason
  is required" `BadRequestException` discipline, not merely a UI-level
  nudge) and is recorded two places: directly on the row for the detail
  view (FR-14.5) to render without a join, and as a Platform Event Log
  entry (§3.11) — `actorType: "seller"` — so the action has the same
  non-blocking, best-effort audit trail every other platform event does.
  Deleting a review this way is a store-scoped seller action only in
  this pass — no admin-side review moderation surface exists yet
  (disclosed scope decision, not an oversight: nothing in this SRS gives
  admins visibility into individual reviews today, and adding that is a
  separate, larger surface than "add a delete reason field").

### 5.15 Cart Persistence & Abandoned Carts
- FR-15.1: **Checkout is email-first (locked UX decision, new in v0.6).** Email is
  the first field/step in checkout, captured before any payment details — this
  defines exactly when a shopping cart is persisted to the database: **once the
  email-first step is completed.** Carts before that point are client-side/
  anonymous and not tracked server-side. This was previously an open design
  question (v0.5, Risk 17); it is now a locked decision, not an implementation
  detail to be discovered mid-build.
- FR-15.2: A scheduled job flags a captured-email cart as `abandoned` once it has
  been inactive beyond a configurable window (`cart.abandoned_after_hours`,
  Settings Registry). **v1.0 ships the flagging mechanism and the underlying table
  only; recovery emails are v1.1** (§5.22, FR-22.2).

### 5.16 Storefront Discovery & Merchandising
- FR-16.1: **Collections** — a seller defines named product groupings (distinct
  from the admin-managed global `categories`) rendered as storefront sections; a
  product can belong to multiple collections.
- FR-16.2: **Storefront search & filters** — in-store product search via Postgres
  full-text search, plus filtering by price range, category, and collection.
- FR-16.3: **Navigation editor** — a seller edits header and footer menus, each
  entry linking to a collection, a content page, or an external URL. **Extended in
  v0.6:** the footer location supports richer content blocks beyond simple menu
  links — a free-text block and a social-links row (FR-16.8) — not only linked
  menu items.
- FR-16.4: **Announcement bar** — a dismissible or persistent banner, configured as
  a Theme Engine customizer setting.
- FR-16.5: **Coming-soon / password-protected mode** — a store owner can gate the
  entire storefront behind a "coming soon" page or a shared password before public
  launch.
- FR-16.6: **SEO structured data** — schema.org `Product` JSON-LD markup,
  OpenGraph tags, and an auto-generated `sitemap.xml` + `robots.txt` per store.
- FR-16.7: **WhatsApp chat/order button** — a seller sets a WhatsApp number and
  toggles a floating chat/order button on their storefront.
- FR-16.8: **Social media links (new in v0.6)** — a seller enters their social
  profile URLs (Facebook, Instagram, TikTok, etc.) in store settings; the
  storefront renders them as icons, typically in the header/footer — a Theme
  Engine customizer setting, not a new content system.
- FR-16.9: **FAQ accordion section (new in v0.6)** — a reusable template section
  type: a seller enters a list of question/answer pairs, rendered as an
  expand/collapse accordion anywhere a template supports section placement (§5.1).

### 5.17 Manual/Draft Orders & Order Management Enhancements
- FR-17.1: **Manual/draft orders — v1.0 scope: mark-as-paid only (bounded per
  founder decision, v0.6).** A seller creates an order directly from the dashboard
  (critical for phone/WhatsApp selling) and marks it paid directly, recorded via a
  `manual`-type payment entry that still produces the correct ledger entries —
  commission is still deducted (FR-6.1); a manual order is not a way to avoid
  commission. **The payment-link flow (generating a hosted Safepay checkout link
  tied to a manual order) is deferred to v1.1** — this was previously the v0.5
  Risk 16 flag; the founder's decision bounds v1.0 to the smaller, lower-integration-
  risk slice.
- FR-17.2: **Order notes** — free-text, seller/admin-only notes on an order, never
  shown to the buyer.
- FR-17.3: **Order tags** — free-form labels a seller can filter the order
  dashboard by.
- FR-17.4: **Order timeline** — an append-only, per-order activity log (status
  changes, notes added, edits made, tracking uploaded) rendered chronologically.
  Timeline events for an edit (FR-17.5) record both the before and after value, the
  same discipline as `admin_audit_logs` (clarified in v0.6).
- FR-17.5: **Basic order editing** — an order's line items, shipping, or applied
  discount may be edited only while its status is `pending` or `confirmed` (never
  after `shipped`). An edit that changes the total after a ledger entry already
  exists produces a **compensating ledger entry** (never a rewrite of the original)
  and appends a timeline event. **Clarified in v0.6:** an edit that changes item
  quantities correspondingly adjusts `product_variants.stock_quantity` (restoring
  stock for a removed/reduced item, decrementing it for an added/increased one) —
  an order edit is never a ledger-only operation that silently leaves inventory
  out of sync.

### 5.18 Data Portability (CSV Import/Export)
- FR-18.1: **Bulk product import — v1.0 scope: core fields only (bounded per
  founder decision, v0.6).** A CSV import maps a standard **Shopify
  product-export CSV**'s core fields: title, description, price, variants/options,
  images, and inventory (stock quantity). **The import screen explicitly lists
  which fields in the uploaded file were and were not mapped, per upload** — a
  seller always sees what did and didn't come across, rather than silent data
  loss. Metafields and complex/nested option combinations are a **v1.1 fast-follow**,
  not a v1.0 gap left undocumented. This bounds what was previously the v0.5 Risk
  15 flag to a scope the founder has explicitly accepted.
- FR-18.2: Import runs as a **background job** (existing BullMQ infrastructure), not
  a synchronous request, with a per-row error log a seller can review and fix
  rather than an all-or-nothing failure.
- FR-18.3: **Product and order CSV export**, for the seller's own records or to
  move to another platform — exporting a seller's own data is treated as a right,
  not a retention lever.

### 5.19 Receipts, Invoices & Tax
- FR-19.1: **Self-hosted PDF invoice/receipt generation** (no paid invoicing
  service, per the self-host-first principle) — a branded, downloadable PDF
  (seller logo, currency, tax line) is attached to the order-confirmation email
  and available from the buyer order-status page.
- FR-19.2: **v1.0 ships exactly ONE well-designed, branded invoice template
  (bounded per founder decision, v0.6),** meeting a **"clean and professional, not
  generic" bar**, verified by a **single founder sign-off** (§14.19) — not an
  open-ended "make it feel luxury" iteration loop. Further visual polish is an
  explicitly **time-boxed backlog item**, never a pre-launch gate. This bounds what
  was previously the v0.5 Risk 18 flag.
- FR-19.3: **Basic tax settings** — a seller sets a per-store tax rate and whether
  displayed prices are tax-inclusive or tax-exclusive; the applicable tax amount is
  computed at checkout and itemized as its own line on the invoice. One rate per
  store in v1.0 — no multi-jurisdiction complexity.

### 5.20 Seller Onboarding Wizard
- FR-20.1: A guided, post-signup checklist walks a new seller through: pick a
  template → set a logo → add a first product → configure a domain (or accept the
  free subdomain) — with visible progress state.

### 5.21 Subscription Plans (see §5.7)
*(Consolidated into §5.7 above in this revision to avoid duplicate numbering —
§5.7's FR-7.1–FR-7.7 is the complete plans/pricing/billing specification.)*

### 5.22 v1.1 Roadmap Features (documented ahead of time)
Not v1.0 scope — documented now so v1.1 work can start immediately after v1.0
ships, and so v1.0's schema doesn't need to be redesigned to accommodate them.
- FR-22.1: **Optional buyer accounts** — guest checkout remains the v1.0 default.
  Already **schema-ready**: `orders.buyer_id` has been nullable-FK-to-`users` since
  v0.4 specifically for this.
- FR-22.2: **Abandoned-cart recovery emails** — sends against the `carts` table's
  `abandoned` flag already shipping in v1.0 (FR-15.2). v1.1 adds only the email
  template and send job.
- FR-22.3: **Returns/refunds seller-side workflow** — a buyer-initiated return
  request, a seller accept/reject action, and completion linked to the existing
  refund/ledger flow (FR-6.5) — a new `return_requests` table, no change to the
  ledger mechanism itself.
- FR-22.4: **Per-store content pages + blog** (for SEO) — mirrors the
  platform-level versioned content-page pattern already built for FR-12.1, just
  tenant-scoped.
- FR-22.5: **Built-in support/ticket system** (seller ↔ platform admin),
  self-hosted — no third-party helpdesk SaaS.
- FR-22.6: **Seller referral program** — referral links, conversion tracking, and
  reward parameters (amount, trigger condition) expressed as Settings Registry
  entries.
- FR-22.7: **Low-stock alerts + storefront email-capture (newsletter list)** —
  low-stock alerting is a threshold check against existing
  `product_variants.stock_quantity`; the newsletter list is a new, tenant-scoped,
  exportable subscriber table.
- FR-22.8: **Manual/draft order payment-link flow** (deferred from v1.0, FR-17.1)
  — generating a hosted Safepay checkout link tied to a manual order, reusing the
  existing Payment Adapter.
- FR-22.9: **CSV import metafields/complex option combinations** (deferred from
  v1.0, FR-18.1) — the fast-follow to the core-fields-only v1.0 importer.
- FR-22.10: **A UZEYN seller mobile app (roadmap note only, v0.27 — not
  built, no schema/architecture change implied by this entry).** Would
  carry push notifications and in-app document delivery (invoices,
  §5.36's export bundles) as native capabilities email cannot offer,
  built on the **existing** SSO handoff (§5.24) and API-first architecture
  (§3.1) — no new auth mechanism or parallel API surface anticipated.
  Email remains the only transactional channel in v1.0; this entry exists
  so a future mobile build doesn't have to re-litigate the auth/API
  approach, same "documented ahead of time" purpose as every other entry
  in this section.
- FR-22.11: **Sell on social/marketplaces** (roadmap note only, v0.32) —
  syndicating storefront listings to social/marketplace channels. No
  schema/architecture change implied by this entry.
- FR-22.12: **Sell in AI chats** (roadmap note only, v0.32) — transacting
  through third-party AI chat/agent surfaces. Not built; documented so a
  future integration doesn't require redesigning the checkout/order
  model.
- FR-22.13: **B2B catalogs** (roadmap note only, v0.32) — tiered/
  wholesale pricing and bulk-order flows for business buyers, distinct
  from the existing consumer storefront.
- FR-22.14: **POS / in-person selling** (roadmap note only, v0.32) — a
  point-of-sale surface reusing the existing order/inventory model for
  in-person transactions.
- FR-22.15: **Multi-currency selling** (roadmap note only, v0.32) — the
  schema is already currency-ready (§3's currency-ready schema decision,
  v0.4); this entry is the storefront/checkout multi-currency
  presentation layer, not yet built.
- FR-22.16: **Storefront translation** (roadmap note only, v0.32) —
  §3.9's i18n-readiness discipline (no hard-coded UI strings/date/
  currency formatting outside a translation-key/locale layer) is already
  binding for exactly this reason; this entry is the actual locale
  content work, not a schema change.
- FR-22.17: **Headless commerce** (roadmap note only, v0.32) — a public,
  versioned storefront-data API for a seller's own custom frontend,
  distinct from §5.24's Product Feed API (which is for external
  marketplaces, not custom storefronts).
- FR-22.18: **AI-assisted store design** (roadmap note only, v0.32) — AI
  generation/suggestion inside the theme customizer (§5.4), distinct from
  and additive to the existing coded-theme escape hatch (FR-1.6).
- FR-22.19: **AI-assisted email** (roadmap note only, v0.32) — AI
  drafting/suggestion for both §5.51's Email Campaigns and §5.53's Admin
  Email Section; both sections explicitly ship with no AI in v1.0
  (FR-51.5, FR-53.4) so this entry exists precisely to avoid
  re-litigating either section's architecture when AI assist is added
  later.

### 5.23 Business Guard-Rails & Platform Economics
Every threshold below is a Settings Registry entry, not a hard-coded constant.
- FR-23.1: **Plan-tier limit enforcement (reworded v0.33 — no Free-Plan
  framing; there is no free tier, §5.7)** — storage quota is metered per
  store against the seller's resolved plan tier's Settings-Registry-
  defined limit; the product-count limit is enforced **at creation time**
  (a create request beyond the limit is rejected with a clear reason),
  not merely displayed as a soft warning. Applies identically to every
  tier, First Month included — a discounted first cycle is a price
  reduction, never a looser or stricter limit than the Starter tier it
  shares (FR-7.3).
- FR-23.2: **Dormant-store lifecycle (reworded v0.33 — plan-agnostic, as
  it has always actually run in code)** — a scheduled job flags any store
  inactive beyond a configurable threshold (`lifecycle.dormant_warning_days`)
  and sends a warning email, regardless of plan tier; after a further
  configurable period (`lifecycle.dormant_suspend_days`) it is suspended;
  after a further configurable period (`lifecycle.dormant_archive_days`)
  it is **archived** — a store status distinct from `suspended`: data
  retained, storefront fully and permanently offline until the seller
  re-engages.
- FR-23.3: **No trial-of-paid-features (binding product principle,
  strengthened v0.33)** — there is no free tier and no time-boxed trial
  anywhere in the platform (§5.7's First Month is a discounted **paid**
  entry, not a trial — full price applies from the very first rupee, it
  is simply a lower price for one cycle). A paid-plan-only feature is
  inaccessible below the tier that grants it regardless of account age,
  enforced by the same plan-scoped Settings Registry checks used
  everywhere else — no separate "trial expired" code path exists to
  build or accidentally leave open, and, as of v0.33, no free-tier code
  path either.
- FR-23.4: **Unit-economics admin dashboard (reworded v0.33 — the
  free-vs-paid split is retired along with the Free Plan itself, and NOT
  replaced with a per-tier breakdown — a disclosed scope decision; a
  per-tier view was never one of the audit's six named items)** —
  extends FR-8.10 with: total active store count, total commission
  earned, per-store storage usage, and a monthly platform-cost-vs-revenue
  break-even view where the cost figure is **admin-entered**
  (`finance.monthly_infra_cost`) rather than computed.
- FR-23.5: **Velocity/abuse limits (reworded v0.33 — the free-store
  velocity limit is retired; it existed only to guard a tier that no
  longer exists)** — signup-rate limiting at the auth layer, a
  Settings-Registry-tunable threshold.

### 5.24 External-SaaS Integration Hooks (new in v0.6)
The founder runs two separate future SaaS products. uzeyn.com builds **only its
own side** of each hook — a small, versioned, authenticated API surface — never the
external product itself. See §3.10 for the shared architectural pattern both hooks
follow.

#### 5.24a Template Store Hook
- FR-24.1: uzeyn.com **always** ships its own built-in free templates (the
  existing `themes` catalog, FR-1.1) — the theme-selection UI's core functionality
  never depends on the Template Store existing or being reachable.
- FR-24.2: The theme-selection UI additionally includes a **premium-templates
  showcase** — a curated, visually consistent panel linking out to the Template
  Store SaaS. This is a presentation/link-out feature only; uzeyn.com does not
  proxy or mirror the Template Store's own catalog or checkout.
- FR-24.3: **Template Install/License API** — after a seller completes a purchase
  on the Template Store, that external system calls a **signed, authenticated**
  uzeyn.com API endpoint to grant the seller a **template entitlement**: the
  purchased template is registered into uzeyn.com's `themes` catalog (if not
  already present) and a `template_entitlements` row is created linking that
  specific seller to that specific theme.
- FR-24.4: **Import-only, no downloadable files (anti-piracy, luxury UX).** At no
  point does a seller receive a raw template file/package to download — the
  Template Store's purchase flow leads directly into an installed, selectable
  template in the seller's own theme-selection UI. This is both a piracy control
  (the template's source never leaves uzeyn.com-controlled storage in a form a
  buyer could redistribute) and a UX one (no manual install step).
- FR-24.5: A seller's access to a marketplace-purchased template is gated by their
  **template entitlement**, a mechanism distinct from — and layered on top of —
  the existing plan-based template-**tier** gating (FR-7.1, `themes.tier`): a
  First-Month-tier seller who purchases a premium marketplace template still has
  that one specific template available to them, without their plan's tier otherwise
  changing. The two gating mechanisms are checked independently and both must pass.
- FR-24.6: The Template Install/License API's authenticity is verified via a
  signed-request scheme (§6.5) before any entitlement is granted; every grant is
  captured in `admin_audit_logs` (as an automated/system actor, not a human admin)
  so a forged or duplicate grant attempt is traceable. Revocation (e.g. a refunded
  purchase) is symmetric: the same API surface accepts a revoke call, which removes
  the entitlement without deleting the underlying `themes` catalog entry others may
  legitimately hold.
- FR-24.7: uzeyn.com does not implement or assume anything about the Template
  Store's own billing, refund policy, or catalog management — those are that
  product's concern; uzeyn.com only honors grant/revoke signals it receives
  through this API.
- **Template Package Spec (architecture decision, new v0.18 — pinned now,
  no code):** every storefront template — the three built-in v1.0 themes and
  every future Template Store import — is a self-contained frontend package
  (its own markup/styles/scripts, preview assets, and a manifest declaring
  name/version/settings-schema), consuming the same storefront data API and
  theme-settings backend as every other template; **the backend never
  changes per template.** An imported template is validated against the
  manifest/spec at install time (this API, FR-24.3), and a hard isolation
  rule applies platform-wide: one template's code can never affect another
  template or the dashboard. Full manifest field list and the isolation
  mechanism are documented in `docs/architecture.md` (Template Store Hook
  section) — this pins the spec for Module 15's build, the three built-in
  themes are **not** rebuilt now.

#### 5.24b Social Media SaaS Hook
- FR-24.8: The seller dashboard includes a **"Marketing" section** — a polished
  entry point that hands the seller off to the founder's separate Social Media
  SaaS **using the existing SSO hook (§3.2a)** — no second signup, no second
  password.
- FR-24.9: **Product Feed API** — an authenticated, **seller-scoped**, read-only
  API exposing that seller's products (title, price, images, storefront URL) so
  the Social Media SaaS can auto-fill post templates. The feed exposes only fields
  already public on the seller's own storefront — nothing a buyer couldn't already
  see.
- FR-24.10: Access is via a **seller-scoped, revocable API token** — a seller can
  see which external app(s) are connected and **revoke access at any time** from
  the "Marketing" section, immediately invalidating that token.
- FR-24.11: The Product Feed API is **rate-limited** like every other public API
  surface (§6.5) and strictly **tenant-isolated** — a token scoped to seller A can
  never return seller B's products, exactly like every other tenant-scoped access
  path in the platform.
- FR-24.12: Monetization of the Social Media SaaS (subscriptions, usage billing,
  etc.) lives **entirely inside that product** — uzeyn.com is the bridge (identity
  + product data), not a party to that product's billing relationship with the
  seller.

#### 5.24c Shared hook requirements (referral attribution & cross-SaaS discounts, new)
Both SaaS products are founder-owned and connect via the same signed-API-key
pattern (§3.10); these two requirements apply identically to both hooks:
- FR-24.13: **Referral attribution** — every SSO handoff (FR-24.8) and every
  signed API call from either SaaS (FR-24.3, FR-24.9) carries a verifiable
  signal that the seller originated from uzeyn.com, so the founder can confirm
  (and, later, revenue-share against) genuine cross-product attribution. This is
  **distinct from the seller-to-seller referral program** (FR-22.6, Phase 1.1) —
  that rewards a seller for referring another seller to uzeyn.com; this
  attributes a uzeyn.com seller's activity on a *different, founder-owned*
  product. No new table: the attribution event is recorded in
  `admin_audit_logs` as a system actor, the same pattern already used for
  Template Install grants (FR-24.6).
- FR-24.14: **Cross-SaaS discount eligibility** — uzeyn.com exposes a small,
  signed, read-only eligibility-check endpoint (e.g. "is this seller on an
  active paid plan") that either SaaS can call to decide whether a seller
  qualifies for a cross-product discount on *that SaaS's own* pricing. uzeyn.com
  never applies or knows the discount terms themselves — it only answers the
  eligibility question, consistent with FR-24.7/FR-24.12's rule that each
  product's own billing stays inside that product.

### 5.25 Authentication & Account Security (new — closes a gap identified during Module 1 planning)
No prior version of this SRS specified password reset, despite specifying signup,
login, and email verification. Approved for Module 1:
- FR-25.1: **Self-serve password reset** — any account holder (seller, supplier,
  or admin) can request a reset link sent to their verified email; the link
  contains a signed, single-use, **time-limited token** (expiry short enough to
  bound the attack window, e.g. 30–60 minutes — exact value is a Settings Registry
  entry, `auth.password_reset_token_ttl_minutes`, not hard-coded).
- FR-25.2: A reset request, and a reset completion, are both **rate-limited** per
  account and per IP (extends §6.5's existing auth-endpoint rate limiting) —
  requesting many reset emails cannot be used to spam a user's inbox or brute-force
  the token.
- FR-25.3: Every password reset (request and completion) is **audit-logged**
  (`admin_audit_logs`-style event for admin accounts; a lighter user-security-event
  record for seller/supplier accounts — not conflated with platform-admin
  control-plane actions) so an account-takeover attempt leaves a trace.
- FR-25.4: Completing a reset invalidates the token immediately (single-use) and
  invalidates all of that user's existing Redis-backed sessions (§3.2a) — a
  compromised session cannot outlive a password reset.
- FR-25.5: **Regional launch gating (new).** Signup captures the applicant's
  country. **Seller** account creation succeeds only for countries on an
  admin-managed **allowed-countries list** — a Settings Registry entry
  (`auth.seller_signup_allowed_countries`), so opening a new region is a config
  change, never a deploy. A non-allowed-country visitor attempting seller signup
  sees a "launching in your region soon" message instead of an error, and their
  email + country is captured in a `seller_signup_waitlist` table for future
  launch-campaign outreach — never silently dropped. **Buyer-side access is never
  gated by country** — a buyer anywhere can shop any storefront. Built in
  **Seller Onboarding Wizard** (renumbered Module 15 as of v0.10's two module
  insertions, `docs/build-plan.md`), not reworked into Module 1's
  already-approved signup endpoint; the admin allowed-countries list reuses the
  Settings Registry admin CRUD already shipped in Module 1.
- FR-25.6: **Seller TOTP 2FA (new, v0.10).** Sellers can enroll in TOTP-based
  2FA through the exact same mechanism Module 1 already built for admin
  accounts — the `User` table's `mfaSecret`/`mfaEnabled` fields and the
  `otplib` enroll/verify flow are shared, not duplicated. **Enforcement
  mode** is a Settings Registry entry (`auth.seller_mfa_enforcement`,
  scoped `global`/`plan`): `optional` (seller's own choice),
  `required_for_payout_actions` (2FA must be verified before a payout
  request or a payout-account change succeeds, regardless of the seller's
  own enrollment preference), or `required_always` (2FA mandatory at every
  login, admin-style). Slotted as a new module inserted immediately before
  Payouts & Disbursement (`docs/build-plan.md`) — `required_for_payout_actions`
  is meaningless if 2FA doesn't exist yet by the time a seller can request one.
- FR-25.7: **Seller session/device management (new, v0.10).** A seller's
  dashboard lists their active sessions/devices (device label, IP,
  first-seen/last-active timestamps) and can revoke any one of them
  individually — revoking a session ends it immediately, same mechanism as
  FR-25.4's password-reset-triggered invalidation, applied to a single
  session rather than all of them. **Concurrent-device limit:** a Settings
  Registry entry (`auth.max_concurrent_devices`, default 3), usable at
  `global`/`plan`/`seller` scope — a plan-level override raises the limit
  platform-wide for that plan, and a **seller-scoped override represents an
  individual seller's paid extra-device-slot add-on** (no new Settings
  Registry scope type needed; the existing `seller` scope already resolves
  with higher precedence than `plan`, per §3.8's precedence order). A new
  login beyond the resolved limit does not silently evict the oldest
  session — it is rejected with a clear "device limit reached, revoke a
  session first" response. The add-on's **price** is a separate global-scope
  Settings Registry entry (`auth.extra_device_slot_price`) for a later
  billing flow to read — **mechanism now, monetization/checkout decision at
  launch**, per explicit founder instruction; no billing UI is built as part
  of this FR.

### 5.26 Platform Event Log (Business Analytics Substrate — new)
The architecture and table shape are specified in §3.11; this section is the
functional requirement that emission actually happens, module by module.
- FR-26.1: **Every module emits its own lifecycle events** into
  `platform_events` at the point of the state change (signup, verification,
  creation, attach/verify, etc.) — never inferred after the fact from other
  tables. Modules 1–3 are backfilled with their events retroactively (this is
  a small addition to existing code, not a redesign); every module from
  Module 4 onward emits its events as part of that module's own build, not a
  follow-up pass.
- FR-26.2: **Lean taxonomy is enforced at review time, not by a schema
  constraint** — `event_type` is free text (a fixed enum would fight future
  modules), but §3.11's "would this appear on a growth or unit-economics
  report" rule is a binding review gate for any new event type.
- FR-26.3: Emission is **non-blocking**: an event-write failure is caught,
  logged, and discarded — it never surfaces as an error to the user and never
  rolls back the action it's describing.
- FR-26.4: **No PII in `metadata`** — enforced by convention and code review
  (same as §6.5's general PII-in-logs discipline), not by a runtime PII
  scanner, which would be disproportionate machinery for a lean internal
  analytics log.
- FR-26.5: The Module 1–3 backfill emits, at minimum: `seller.signup`,
  `store.created` (Module 1); `product.created`, `media.imported` (Module 2);
  `domain.attached`, `domain.verified` (Module 3).

### 5.27 Listing Moderation Engine (new, v0.10 — launch-blocking legal safety, zero-cost/rule-based)
A rule-based content-moderation layer for seller product listings, required
**live before public launch** — this is a legal-safety requirement, not a
discovery/UX feature, so it is slotted as its own module immediately after
Discovery & Merchandising rather than folded into either Catalog (Module 2,
already built) or Discovery (Module 5) themselves. **Amended in v0.13
(FR-27.8, below): applies to supplier-sourced listings too, not only
self-fulfilled ones** — a seller's approval of a supplier's listing
(§5.3/§5.4, Module 8) is a fulfillment-quality gate, not a substitute for
this module's legal-safety checks.

- FR-27.1: **Admin-managed banned/restricted keyword lists**, Settings
  Registry-backed (`moderation.banned_keywords`, `moderation.restricted_keywords`
  — both JSON string arrays, `global` scope, admin-editable through the
  already-generic Settings Registry admin API — no new admin UI mechanism
  needed). A banned keyword in a product's title/description blocks
  submission outright with a clear reason; a restricted keyword routes the
  listing to manual review instead of blocking it.
- FR-27.2: **Restricted-category rules** (`moderation.restricted_categories`,
  JSON array of category ids, `global` scope): a product in a restricted
  category always enters the moderation queue regardless of keyword
  matches, for categories the founder judges to need a human look
  regardless of wording (e.g. supplements, electronics safety claims).
- FR-27.3: **New-seller probation.** A seller's first N submitted products
  require manual review regardless of keyword/category checks passing; N is
  a Settings Registry entry (`moderation.new_seller_probation_count`,
  default e.g. 10). Once a seller has N **approved** products, subsequent
  products skip probation (still subject to keyword/category checks).
- FR-27.4: **Trusted-seller auto-approve.** An admin can mark a seller
  `is_trusted` (a new boolean on `sellers`); a trusted seller's listings
  skip both probation and the keyword/category queue entirely (still
  logged, per FR-27.6) — a manual, admin-granted status, not automatically
  earned by a threshold, so the founder retains judgment over who bypasses
  review.
- FR-27.5: **Moderation queue + product visibility gate.** A product that
  triggers any of FR-27.1–27.3 above is created with a `moderation_status`
  of `pending` and is **not publicly visible** — excluded from the public
  storefront (Module 4) and Discovery search/collections (Module 5) alike —
  until a Reviewer or Admin approves it. Rejecting a listing records the
  reviewer's notes and keeps the product hidden; the seller sees the
  rejection reason and notes in their own dashboard.
- FR-27.6: **REVIEWER admin sub-role (§4, new).** A narrowly-scoped admin
  account type that sees only the moderation queue and can approve/reject
  with notes — nothing else in the admin terminal. Every decision (approve,
  reject, and the keyword/category/probation reason that queued it) is
  captured in the existing `admin_audit_logs` table (Module 1) — no new
  audit mechanism. **A bare functional admin page for this queue (list,
  view a product, approve/reject with notes; no design pass) is required
  before public launch — v0.11 slots it into Module 16 (Admin Control Plane
  completion, §14.8), since Module 6 itself is API-only by design.**
- FR-27.7: **Zero-cost, rule-based only — explicitly not AI moderation.**
  No ML/LLM content-classification service is introduced by this FR; keyword/
  category/probation rules are the entire mechanism, kept deliberately
  simple and free to run, matching this SRS's existing "lean, Settings-
  Registry-driven" discipline. An AI-assisted moderation upgrade, if ever
  wanted, is a distinct future FR, not implied by this one.
- FR-27.8 (new, v0.13 — closes a gap identified during Module 8's review):
  **Supplier-sourced listings run through this same engine, not a
  parallel or weaker one.** A seller approving a supplier's submitted
  listing (§5.3 FR-2.7, §5.4 FR-3.2) is a *fulfillment-quality* decision —
  "I want to sell this" — not a substitute for the platform's own
  legal-safety check on the listing's content. Concretely, at the moment
  of seller approval: a banned keyword (FR-27.1) in the listing's title
  blocks the approval outright, exactly as it would block a self-fulfilled
  product's submission; a restricted keyword (FR-27.1) or restricted
  category (FR-27.2) still creates the product but routes it into the
  moderation queue (FR-27.5) — approved by the seller, but not publicly
  visible until a Reviewer/Admin also approves it; a trusted seller's
  approval (FR-27.4) bypasses this engine entirely, identically to a
  trusted seller's self-fulfilled submission. **New-seller probation
  (FR-27.3) is explicitly scoped to self-fulfilled listings only** — a
  supplier-sourced listing already passed through the seller's own
  listing-review gate before reaching this point, so counting it toward
  "first N submitted products" would double-gate the same decision rather
  than add a distinct check. §14.25 gains two lines for this (a banned
  supplier listing is blocked; a restricted supplier listing is invisible
  until platform approval).
- **Follow-up amendment required in already-built modules (flagged, not a
  silent gap):** shipping this module requires adding a
  `moderation_status = 'approved'` filter to Module 4's public storefront
  product-listing query and Module 5's Discovery search/collection queries —
  both currently show every `active` product regardless of moderation state,
  which was correct at the time each shipped (this FR didn't exist yet) and
  is disclosed here as the follow-up this module's own build must make.

### 5.28 Seller Dashboard UI (new, v0.12 — closes a gap identified across Modules 2 and 7)
Modules 2 (Catalog & Media) and 7 (Shipping, Tax & Discounts) both shipped
API-only, by deliberate precedent at the time — apps/web had no seller-
dashboard pages for products, media, shipping, tax, or discount codes, only
the underlying endpoints those pages will eventually call. Reviewing the
module sequence after Module 7 surfaced that **no module actually owns
building those pages** — §14.2's checklist tests backend behavior, not a
rendered screen, and Module 15 (Seller Onboarding Wizard) assumes real
dashboard screens exist to link a new seller into, rather than building
them itself. This is a genuine gap, not a deferred decision, closed now by
a dedicated module rather than left implicit.

- FR-28.1: **Scope.** The core "run my store" seller-dashboard screens still
  missing a UI as of this amendment: product/variant/media management
  (Module 2), shipping/tax/discount-code settings (Module 7), and order
  management (Module 9, Orders/Cart/Checkout) — slotted immediately after
  Module 9 specifically so order screens can be included, per founder
  instruction. Any other seller-facing screen still missing its UI by the
  time this module is actually built (e.g. the Supplier Portal's seller-
  side view, Module 8) is swept into this module's scope too rather than
  left as yet another silent gap — confirmed against the then-current
  module list before this module's implementation plan is written, not
  assumed complete from this list alone.
- FR-28.2: **Governed by the SIMPLICITY INVARIANT (§3.13, binding NFR)** —
  see that section for the five rules this module's every screen must
  satisfy. This is the module where that invariant is first applied, and
  the bar every seller-facing screen in every later module must also clear.
- FR-28.3: **Consistent component set, not per-screen bespoke layout.** A
  shared list/detail/form pattern (§3.13(d)) is established once in this
  module and reused by every screen it builds, rather than each screen
  inventing its own layout.
- FR-28.4: **Dashboard personalization (new, v0.15).** A seller can choose a
  dashboard theme/wallpaper for their own admin experience (purely cosmetic —
  never the storefront theme, which stays FR-1.1/FR-1.2's separate system).
  **Plan-gated:** the entry First Month/Starter tier offers a small
  built-in set; higher plans unlock more options — gated the same
  Settings-Registry way FR-7.1 already gates template tiers, cheap to
  build since it reuses the existing plan-scoped feature-gate mechanism
  rather than introducing a new one. Still
  governed by the SIMPLICITY INVARIANT (§3.13) — personalization is an
  option behind a settings screen, never a default-view distraction.

### 5.29 Trust & Safety System (new, v0.15 — expanded into its own section given Direct Seller Collection's pivot)
Direct Seller Collection (§5.6c) removes the platform from the money path,
which removes the built-in accountability a payment gateway/hold/reserve
model gave the platform for free. This section is the compensating control:
legal grounding (a versioned agreement every seller explicitly accepts) plus
a zero-cost, rule-based detection-and-enforcement engine, extending
mechanisms this SRS already specifies rather than inventing a parallel
system.

- FR-29.1: **Versioned Seller Agreement.** A seller must accept the current
  version of the Seller Agreement (`docs/legal/terms-of-service.md`, once
  finalized) at signup — acceptance records a timestamp and the accepting
  IP address, the same discipline FR-25.3's security-event logging already
  applies to auth actions. **Re-acceptance on version change:** publishing a
  new agreement version (reusing FR-12.1's existing versioned-content-page
  mechanism — this is not a new content system) requires every seller to
  re-accept before their next dashboard action succeeds; a seller who has
  not re-accepted sees only the acceptance prompt, nothing else.
- FR-29.2: **Facilitation-workspace legal grounding (drafted in
  `docs/legal/terms-of-service.md`, flagged for human counsel review, same
  discipline as every other legal draft, FR-12.2).** The agreement states
  plainly that the platform provides a facilitation workspace only; sellers
  bear full responsibility for their own listings, sales, fulfillment, and
  legal compliance; and a seller indemnifies the platform against losses
  caused by that seller's own Trust & Safety bypass attempts or platform
  abuse. This is legal text, not application logic — no code enforces
  indemnification directly, but FR-29.1's acceptance record is what makes
  the agreement enforceable if it's ever needed.
- FR-29.3: **T&S engine (zero-cost, rule-based) — extends existing
  mechanisms, introduces no parallel system:**
  - **Signup velocity** — extends FR-23.5's existing per-identity/signup-rate
    limiting; a T&S flag (not just a hard block) fires when a configurable
    threshold is crossed, for admin review rather than only a rejection.
  - **Listing-content flags** — extends the Listing Moderation Engine
    (§5.27) directly; every FR-27.1–27.8 decision already recorded is itself
    a T&S-relevant signal, not a new detector.
  - **Cancellation-rate / pending-forever-rate flags** — FR-6.19, above.
  - **Bypass-attempt detection (new)** — repeated banned/restricted-keyword
    submissions from the same seller in a short window (a configurable
    count/window, Settings Registry) is itself a signal distinct from any
    single blocked listing: one blocked attempt is normal moderation;
    *repeated* attempts to word around the same block is a bypass pattern.
    Detected from data the Listing Moderation Engine already writes (no new
    write path) — a read-side rule over existing `platform_events`/
    moderation-decision history.
  - **All thresholds are Settings Registry entries**, matching every other
    rule engine this SRS specifies (§5.27, FR-23.5) — never hard-coded.
  - **All enforcement actions are audit-logged** (`admin_audit_logs`,
    FR-8.9) — no exception, same as every other control-plane mutation.
  - **Zero new infrastructure:** signals are computed from tables that
    already exist (`orders`, `platform_events`, moderation decisions) and
    surfaced as admin **risk views** — read queries, not a new persistent
    "flags" table for every signal. Where a flag needs to persist past a
    single admin session (e.g. "this seller is under a bypass-attempt
    review"), it reuses the existing seller lifecycle state (FR-8.4's
    "limit a seller") rather than introducing a separate flag store.
- FR-29.4: **Enforcement ladder (admin-controlled, not automated
  escalation)** — warning → restriction → suspension → permanent ban.
  Warning and restriction are two states of FR-8.4's existing "limit a
  seller" control (a restricted seller might be blocked from new listings
  or new orders while remaining otherwise operational); suspension and ban
  are FR-8.4's existing actions verbatim. **No step auto-fires from a T&S
  flag** — every escalation is an explicit admin action reviewing the
  flag(s) first, consistent with this SRS's existing "risk summary informs
  a human, never auto-penalizes" discipline (the same pattern the dormant
  mode's FR-6.9 already used for payout risk). The one exception remains
  FR-6.18's automated invoice-grace-period suspension, which is a distinct,
  narrowly-scoped billing mechanism, not a T&S escalation.

### 5.30 Seller Identity & Commission-Fraud Defense (new, v0.16)
Direct Seller Collection means the platform bills commission on a seller's
*self-reported* sales (§5.29's anti-underreporting guard-rails already cover
under-reporting volume). This section closes the adjacent gap: proving the
seller behind an account is a real, singular, accountable person, and that
the payment instrument they collect buyer money on is actually theirs — so a
banned or non-paying seller cannot simply re-register under a new email and
keep operating.

- FR-30.1: **CNIC required at seller activation.** A seller cannot activate a
  store (same activation gate as FR-6.14's payment-instruction requirement)
  without a valid CNIC number on file: 13 digits, format- and
  checksum-validated at entry (reject malformed input before it is ever
  stored). **Unique, permanent, one CNIC = one seller account, for life** —
  a CNIC attached to a `banned` seller can never be used to activate another
  seller account, enforced by a database-level unique constraint on the
  CNIC's deterministic hash (never the plaintext) spanning every seller
  regardless of lifecycle state, since sellers are never hard-deleted
  (§3.2's existing soft-lifecycle discipline). **Encrypted at rest**
  (app-level AES-256-GCM, same mechanism and key-management discipline as
  the Google Drive refresh token, §6.5) — the plaintext CNIC is never
  logged and never returned in any API response; only the seller's own
  masked view (last 4 digits) is ever rendered. **No CNIC image/document
  upload in v1.0** — document-based verification is an explicit, documented
  future upgrade (FR-30.4 describes the adapter seam it will plug into).
- FR-30.2: **Name-consistency rule for payment instruments.** Every payment
  instrument a seller adds (bank account, JazzCash, Easypaisa —
  `store_payment_instructions`, §5.6c) requires a self-declared account
  title at entry, plus an explicit checkbox declaration ("this account is
  registered in my own legal name") — both required before the instrument
  can be saved. A normalized string-similarity check (transliteration- and
  whitespace/case-tolerant, since Urdu-to-Roman transliteration variance is
  normal in Pakistan) compares the declared title against the seller's
  registered legal name (`business_name` today; a future FR-30.5 field
  described below distinguishes "legal name" from "trading/business name"
  if the founder later wants that split). **A mismatch never hard-blocks
  — it queues the instrument into the same admin review-queue pattern as
  the Listing Moderation Engine (§5.27)**, consistent with this SRS's
  "flag for human review, don't auto-punish on a fuzzy signal" discipline
  (§5.29's FR-29.4 uses the identical principle for T&S escalation). A
  reviewer may additionally require documentary proof (a bank/wallet
  statement or app screenshot, uploaded the same way as any other admin-
  reviewed attachment) before approving a **high-risk** seller's instrument
  — "high-risk" is itself an input from FR-30.4's risk score, not a
  separate ad hoc judgment call.
- FR-30.3: **Payment-account uniqueness across sellers.** A bank account
  number, JazzCash number, or Easypaisa number can back at most one seller
  account platform-wide — enforced the same way as FR-30.1's CNIC
  uniqueness, a unique constraint over each instrument type's normalized,
  hashed fingerprint (never the plaintext account number, which is not
  otherwise sensitive enough to warrant full encryption but is still hashed
  here purely to make the uniqueness constraint queryable without a
  plaintext-equality index). A second seller attempting to save an
  already-claimed account number is rejected outright (this one **is** a
  hard block, not a review-queue flag — two accounts legitimately sharing
  one bank account is not a real-world case worth tolerating false
  positives for, unlike name spelling variance).
- FR-30.4: **Automated title verification — adapter-seamed, deferred.**
  Raast/1Link (or an equivalent bank-account-name-lookup API) is the
  documented **first paid Trust & Safety upgrade** once revenue supports
  the integration cost — automatically confirming a declared account title
  matches the bank's own name-on-file, removing the manual review step for
  the common case. Built the same way this SRS already handles every
  future-swap point (the Payment Gateway Adapter interface, §5.6d; the
  Supplier Adapter interface, §5.3): a `TitleVerificationAdapter` interface
  with exactly one implementation in v1.0 (`ManualReviewAdapter`, which
  always returns "unverified, pending human review" and does nothing
  else) — swapping in a real API-backed adapter later is a new
  implementation of the same interface, never a rewrite of FR-30.2's
  review-queue logic. Phone-number OTP verification and a NADRA
  identity-verification API are noted here as further **future** upgrades
  in the same category — documented, not built, in v1.0.
- FR-30.5: **Risk score (rule-based, zero-cost, Settings-Registry-weighted)**
  computed at seller activation and re-evaluated whenever a scored input
  changes (a new payment instrument, a flagged name-consistency result,
  etc.): inputs are email-verified (boolean), CNIC present-and-valid
  (boolean), FR-30.2's name-consistency result, FR-30.3's account-number
  reuse check, a device fingerprint and IP history at signup (extending
  `user_security_events`, FR-25.3 — a new `device_fingerprint` column and a
  `signup` event type on that existing table, not a new one), and
  business-name similarity to other sellers' business names (a cheap
  reuse-pattern signal, same string-similarity utility as FR-30.2). Every
  input's weight and the auto-approve/manual-review/block thresholds are
  Settings Registry entries (matching every other rule engine this SRS
  specifies, §5.27/§5.29/FR-23.5) — **never hard-coded.** **Exactly three
  outcomes, no finer gradation:** auto-approve, manual review (the same
  reviewer-queue pattern as FR-30.2 and §5.27), or block. **Device
  fingerprint and IP history are score inputs only — never, by themselves,
  a sole automated block trigger** (consistent with §5.29's "a flag informs
  a human, never auto-penalizes past what's explicitly specified"
  discipline; only FR-30.3's exact-match account reuse and FR-6.18's
  invoice-grace-period suspension remain hard, fully-automated actions).
  Every score computation and every resulting decision is audit-logged
  (`admin_audit_logs` if a human acted on it; a `platform_events` entry —
  IDs only, no PII in `metadata`, per §6.5 — for the automated computation
  itself, the same "zero new infrastructure" pattern §5.29 already uses).
- FR-30.6: **Tied to commission enforcement.** FR-6.18's existing
  unpaid-invoice suspension is unchanged; this adds one new check on top of
  it: a seller attempting to re-register whose CNIC hash, any payment
  fingerprint (FR-30.3), or device-fingerprint/IP cluster (FR-30.5) matches
  a seller currently `suspended` for non-payment is **flagged and blocked
  pending review** rather than silently allowed to activate a fresh store —
  closing the exact evasion path a purely email-based ban could never stop.

### 5.31 Teams & Community Sponsorship (new, v0.17 — slotted into Module 14, Subscription Plans)
A seller on a qualifying paid plan tier (a "leader" — the trainer/influencer
case: someone who brings a cohort of other sellers onto the platform) can
sponsor those sellers' subscriptions directly. This reuses the existing plan
mechanism (FR-7.1–7.10) and Module 11's invoice machinery verbatim — it is
a new relationship between existing sellers and existing plans/invoices,
not a parallel billing system.

- FR-7.11: **Team creation and invitation.** A seller on a qualifying plan
  tier (founder-set plan data, same "which tier gates what" mechanism as
  every other plan-gated feature, FR-7.1) can create a team and invite other
  sellers by email, mirroring the existing invite-by-email pattern
  (`StoreSupplierLink`'s `InviteSupplierDto`, §5.3) rather than inventing a
  new invitation flow. A seller can belong to **at most one team as a
  sponsored member at a time** — joining a second team first requires
  leaving the current one (FR-7.13).
- FR-7.12: **Binding consent model.** The invite-acceptance screen must
  state, in plain language, exactly what the leader will and will not see
  **before** acceptance is possible — read-only analytics only (a sales/
  orders/growth summary view per FR-7.14), never store access, never
  editing rights, never customer PII. An invitee who has not seen and
  accepted this exact disclosure cannot become an active sponsored member.
  This is a stricter, member-facing sibling of FR-29.1's versioned-
  agreement acceptance discipline, not a new legal-content system.
- FR-7.13: **Leave-team flow (member-initiated, always available; amended
  v0.33 — no Free-Plan fallback).** A sponsored member can leave their
  team at any time from their own dashboard settings. Leaving ends
  sponsorship **gracefully**: at the **current billing period's end**
  (the same "next-cycle" rule FR-7.5 already uses for ordinary plan
  changes, not immediate) the member's store(s) fold into the same
  `orders_paused` mechanism FR-7.2/FR-6.25 already define for any
  seller without an active paid subscription — **never** a downgrade to
  a free tier (there is none, §5.7), and the member's account/store is
  **never** deleted or suspended as a consequence of leaving — leaving is
  the member's right, not a penalty condition. A member who subscribes to
  their own paid plan before or at period end is never paused at all.
- FR-7.14: **Leader's team dashboard — read-only, and only that.** The
  leader sees: a member list, each member's sponsorship status (active/
  left), and a **read-only** per-member analytics summary (sales, order
  count, growth trend — the same shape of summary Module 10's own
  dashboard-home screen already computes for a seller's own store, FR-28.1,
  reused as a read query against a teammate's store rather than a new
  metric engine). The leader's session has **no** access to a member
  store's products, orders, customers, or any write capability whatsoever
  — enforced identically to how a supplier's session is scoped to only its
  own linked stores (§6.5's existing permission-boundary discipline),
  applied here to a leader/member relationship instead of a supplier/store
  one. No leaderboards, chat, or messaging in v1.0 (documented future
  upgrade, same "defer, don't build a parallel system" discipline as every
  other Phase 2+ item in this SRS).
- FR-7.15: **Invoicing (reuses Module 11 verbatim, no parallel mechanism).**
  A leader receives one consolidated **monthly group invoice** —
  **(active sponsored member count) × the leader's Team tier's seat price**
  (revised v0.19, FR-7.18: every seat on one team bills at the same,
  tier-determined price, never "that member's own individually-chosen plan
  price" as originally specified here) — **alongside** — never merged
  into — their own separate commission invoice (Module 11, FR-6.16
  onward). Both invoices use the identical manual-admin-verification and
  grace-period-suspension mechanism. **Suspension never crosses the team
  boundary**: non-payment of the leader's own commission invoice suspends
  only the leader's own store; non-payment of the group sponsorship invoice
  suspends the *sponsorship* (members' stores fold into `orders_paused`
  per FR-7.13's amended v0.33 rule, exactly as if the leader had stopped
  sponsoring voluntarily) but never a member's store outright, and never
  the leader's own store either. A member's own separate commission
  invoice (on whatever their team tier currently grants them while
  sponsored, FR-7.18, or their own paid plan if no longer sponsored) is
  entirely independent
  of the leader's billing and can suspend only that member's own store.
- FR-7.16: **Standard/Pro plan tiers bundle developer perks.** The plan
  editor (FR-8.2) expresses that qualifying paid tiers include coded-theme
  mode access (the existing `theme.coded_mode_enabled` Settings Registry
  key, FR-1.6, already plan-context-capable) as a bundled perk alongside
  team-leader eligibility — both gates read the same seller's resolved
  plan, no second gating mechanism. Tier names and exactly which tier
  unlocks which perk remain founder-set plan data (FR-7.1), same as every
  other plan-gated feature.

### 5.32 Storefront Buyer Purchase Flow & Store Branding (new, v0.22 — Module 15.5, closes a gap identified during Module 15)

Module 9 (Orders, Cart & Checkout) shipped the full cart/checkout/order-
status **API** — FR-4.x/5.x/15.x are all implemented and e2e-tested — but
by the same "backend-only, no owning module" gap the Seller Dashboard UI
module (§5.28) already found and fixed once for the *seller* side, no
module ever built the **buyer-facing** cart/checkout UI in `apps/web`.
This surfaced only while building Module 15's order-status page (FR-19.1/
FR-14.1 both hard-depend on a buyer-reachable page existing) — a launch-
blocking gap, since nothing sells without it. Bundled into the same module:
store logo upload, a small but real gap across three buyer-visible surfaces
(invoice header, storefront header, transactional emails) discovered
while building Module 15's invoice template, which had nothing to render
but a typographic mark because no logo-upload capability existed anywhere
in the platform.

- FR-32.1: **Storefront purchase flow — the buyer-facing UI for FR-4.x/
  5.x/15.x's already-built API, not new backend behavior.** Product page
  add-to-cart (variant selection, quantity, live stock/price per FR-4.8),
  a cart page (view/edit line items and quantities, calls the existing
  `PATCH /storefront/cart`), and an email-first checkout flow — email
  captured **before** any payment/shipping detail, per FR-15.1's locked UX
  decision, which is what actually persists the cart server-side in the
  first place. Checkout displays the shipping/tax/discount breakdown
  (`computeOrderTotals`'s existing math, never a second calculation) and,
  in the same step, the seller's payment instructions framed exactly as
  the existing confirmation email already frames them — **"pay the seller
  directly; once they confirm receipt, your order moves to confirmed"**
  (Direct Seller Collection, §3.12) — never implying the platform holds or
  processes the payment itself.
- FR-32.2: **Order confirmation page.** Shown immediately after a
  successful `POST /storefront/checkout`, summarizing the placed order and
  linking to that order's own order-status page (FR-5.4, Module 15) as the
  buyer's durable reference — the confirmation page itself is not
  bookmarked or reachable again independently.
- FR-32.3: **Financial Truth Invariant applies to every buyer-visible
  surface this FR builds (§3.12), with no exception.** An order is
  `pending` (awaiting payment) from the instant checkout completes; this
  UI must never imply otherwise — no "order confirmed," no "payment
  received," no success-styled messaging until the seller actually marks
  it paid. The confirmation page and the order-status page both display
  `pending` using the same honest, awaiting-payment framing already
  established for the seller dashboard and the confirmation email.
- FR-32.4: **Storefront design bar applies in full (§5.0, §13, the
  "Buyer-facing polish" NFR).** Premium, mobile-first, the same visual bar
  the marketing site and PDF invoices are held to — this is not a bare
  functional pass like Modules 2/5/7 originally shipped, precisely because
  it is the surface where a buyer decides whether to trust the store
  enough to pay.
- FR-32.5: **Store logo upload.** A seller uploads a single logo image in
  store settings, reusing the existing media-upload pipeline
  (`MediaAssetsService`/`ObjectStorageService`, Module 2) rather than a new
  upload path. The logo is consumed by three buyer-visible surfaces: the
  storefront header, the PDF invoice template's header (FR-19.1), and
  transactional emails, wherever each surface can practically render an
  image. **When no logo is set, each surface's existing typographic-mark
  fallback stays exactly as built in Module 15** — this FR adds an image
  option, it does not remove the fallback or make a logo mandatory.

### 5.33 Growth & Partner Programs (new, v0.26 — bare-functional in v1.0, real design pass deferred to the founder)
Four acquisition/growth channels, all gated the same way (eligibility check
→ application → admin approval — never direct join), all crediting the
existing wallet/ledger (§5.6e) rather than a parallel payments system, and
all reusing the existing T&S engine (§5.29), reviewer-role/audit-log
pattern (§5.8, FR-27.6), and the dormant Payout Request & Disbursement
Engine (§5.6b) for withdrawal — this section reactivates that engine
rather than building a second one. UI is bare-functional (the Simplicity
Invariant baseline every module before a design pass has shipped at,
§3.13) — the founder does the real visual pass later, same discipline as
every other module.

- FR-33.1: **Referral-source attribution at signup (build first, ahead of
  the rest of this section — the data is unbackfillable).** Signup gains
  an optional `referralSource` capture (a referral code/slug resolved
  against whichever program tables exist at the time — Ambassador/
  Student/Creator link, or none) written once, at signup, onto that
  seller's `Subscription` row. If no valid code is present, or the
  program tables this FR depends on don't exist yet, the field is simply
  null — this FR does not require Programs 1–3 to be built first, only the
  column and the capture-at-signup write path to exist before real seller
  signups start arriving in production, since a seller who signs up
  without it recorded can never be attributed retroactively.
- FR-33.2: **No direct joining, any program.** Every program (33.3–33.6)
  follows the identical shape: a seller/candidate must first pass an
  eligibility check (program-specific, e.g. Ambassador requires an
  existing eligible paid plan), then submits an application, then an
  admin approves or rejects it (with notes, `admin_audit_logs`-recorded,
  same audit discipline as every other control-plane mutation). No
  program has a self-serve join button. An admin may also suspend or
  terminate any approved participant's access, in-flight rewards, or
  account at any time for Terms violation, fraud, or suspicious activity
  — also audit-logged.
- FR-33.3: **Single referral source per seller, enforced in the data
  model.** A `ReferralAttribution` record is keyed uniquely per referred
  seller (one row, ever) — the first valid attribution across any
  program wins and is written once; a later application from a different
  program/link for the same seller cannot create a second attribution
  row (unique constraint, not application-level convention). Commission
  and reward calculations for a given seller read this one row — they
  never stack across programs, structurally, not by discipline.
- FR-33.4: **Commission base — plan-subscription amounts only.**
  Every program's referral commission (33.5–33.6) is calculated
  exclusively against amounts the referred seller actually pays the
  platform for their own plan subscription (§5.6e's wallet plan-fee
  debits, FR-6.24) — **never** against that seller's storefront GMV,
  sales, or wallet top-ups collected for commission. A referred seller
  who never upgrades past the First Month/Starter entry tier's own plan
  fee generates minimal-to-zero referral commission by the same design —
  the mechanism is unaffected by v0.33's removal of the Free Plan, since
  it was never keyed to any specific tier, only to actual plan-fee
  payments.
- FR-33.5: **Program 1 — Certified Ambassador.** Eligibility: applicant
  must already hold an eligible paid plan (a Settings-Registry-configured
  plan-tier list, same "which tier gates what" mechanism as every other
  plan-gated feature, FR-7.1) before applying. On approval, the ambassador
  receives a unique referral link/code. **Commission:** 8% (Settings
  Registry value) of a referred seller's paid plan-subscription amount
  and its renewals, for that seller's **first 6 months only** (Settings
  Registry value) — after which that seller permanently stops generating
  commission for this ambassador, tracked per-attribution (FR-33.3), not
  per-ambassador-lifetime. **Monthly performance reward:** referring 12+
  (Settings Registry value) *paid* store subscriptions within a calendar
  month grants a selected premium plan free for the ambassador (or a
  refund of that plan's fee if already purchased that period) —
  evaluated by a scheduled monthly sweep, same "idempotent, safe to
  re-run" discipline as the wallet's own sweeps (§5.6e). **Certificate
  tiers**, unlocked by lifetime referred paid-sales count crossing
  admin-configured thresholds (illustrative only: 100/500/1,000/10,000+
  → Silver/Gold/Diamond/higher) — tier names, thresholds, and count are
  **Settings-Registry/plan-data**, never hard-coded, mirroring how plan
  groups/tiers are already founder-editable data (§5.7).
- FR-33.6: **Program 2 — Student Referral.** Application + admin approval,
  same shape as FR-33.2. Commission: 5% (Settings Registry value) of a
  referred seller's paid plan-subscription amount, renewals limited to
  the **first 3 months only** (Settings Registry value). Earnings post to
  the same wallet/ledger mechanism as every other program in this section
  (FR-33.9) — no separate accounting.
- FR-33.7: **Program 3 — Creators.** Application + admin approval, same
  5%/3-month referral terms as FR-33.6 (Student Referral), **plus** a
  per-million-views reward (a Settings Registry rate, PKR per million
  views, per platform) for promotional content on TikTok, Instagram,
  YouTube, Snapchat, Facebook, X, and Pinterest. **Anti-fraud requirement
  (binding — view counts are trivially purchasable): a view count is an
  eligibility SIGNAL only, never an automatic payout trigger.** Every
  view-based reward requires, in order: (a) the creator submits a content
  link as proof; (b) an admin manually verifies the content against
  published per-platform posting guidelines (proper platform mention/
  branding/quality — a checklist the admin confirms, not an automated
  check); (c) a configurable monthly cap per creator (Settings Registry
  value) bounds total view-reward payout regardless of reported views.
  Only content that has passed manual verification is reward-eligible —
  an unverified or rejected submission generates nothing.
- FR-33.8: **Program 4 — Careers.** A new admin-editable content type,
  `JobPosting` (role, description, status: draft/open/closed) — reuses
  FR-12.1's versioned-admin-content mechanism, not a new CMS. A public
  careers listing shows only `open` postings. A candidate applies through
  the site with contact details plus a CV upload (the existing
  object-storage substrate, §3.3 — a dedicated size/type limit for
  documents, same "explicit limit, no silent truncation" discipline as
  every other upload path in this SRS, e.g. FR-9.2). An admin sees an
  application pipeline per posting with status tracking (received →
  reviewing → interviewing → rejected/hired — Settings-Registry-editable
  labels, not hard-coded English strings, matching FR-33.5's tier-naming
  discipline). Applicant data (contact details, CV) is **never** exposed
  on any public endpoint — admin-only, same access discipline as customer
  PII elsewhere in this SRS (§5.13).
- FR-33.9: **Earnings post to the existing wallet/ledger as new entry
  types** — `program_commission_credit` (FR-33.5/33.6/33.7's referral
  commission), `program_reward_credit` (FR-33.5's monthly performance
  reward, FR-33.7's view-based reward), `program_clawback_debit`
  (FR-33.10's fraud recovery) — extending §5.6e's `LedgerEntry` the same
  way the wallet itself extended Module 11's ledger, never a parallel
  ledger. **Withdrawal reactivates the dormant Payout Request &
  Disbursement Engine (§5.6b)** rather than building a second one: a
  participant requests a withdrawal once their earned balance crosses a
  configurable threshold (Settings Registry value, **in PKR**, never a
  hard-coded USD amount), an admin approves it, funds move via the
  existing **manual disbursement adapter** (FR-6.11, unchanged), and
  status is visible to the participant through the same
  `requested → approved → processing → paid`/`rejected` lifecycle
  FR-6.12 already specifies.
- FR-33.10: **Fraud controls extend the existing T&S engine (§5.29),
  introduce no parallel detector.** Self-referral detection (an
  applicant's own CNIC, payment account, device fingerprint, or IP
  cluster matching the seller they're claiming credit for — reusing
  FR-30.3/FR-30.5's existing identity/fingerprint signals), fake-account
  clusters, and abnormal referral-to-conversion velocity all extend
  FR-29.3's rule-based signal set; detection surfaces on the same admin
  risk view, never auto-penalizes (FR-29.4's "informs a human" discipline
  applies here too). A confirmed fraud finding triggers reward
  cancellation and/or **clawback** — a `program_clawback_debit` entry
  that can take a participant's wallet balance negative even against
  **already-withdrawn** earnings (the recovery path is the same negative-
  balance mechanism §5.6e already prices for the commission wallet, not a
  new one) — and, at admin discretion, suspension per FR-33.2.
- FR-33.11: **Admin control terminal gains**, per program: an application
  queue (approve/reject with notes), a withdrawal approval queue, a
  content-link verification queue (Creators only, FR-33.7), participant
  suspension controls, and a per-program report (referrals, conversions,
  payouts, rejection rate) — all built on the existing admin
  queue/reviewer-role/audit-log pattern (§5.8, FR-27.6), not a new admin
  framework.
- FR-33.12: **Legal drafts.** Program terms — eligibility, the commission
  window per program, clawback, suspension grounds, and an explicit
  no-guarantee-of-approval statement — ship as a `docs/legal/*.md` draft,
  flagged for human legal review, same discipline as every other legal
  text in this SRS (FR-12.2).

### 5.34 Store Health Score (new, v0.27 — foundation for §5.35's Verified
Store Program, standalone seller value on its own)
A per-store composite score, 0-100, computed entirely from data this SRS
already collects elsewhere — no new tracking subsystem, only the one small
schema gap called out in FR-34.1's completeness signal.

- FR-34.1: **Composite score, seven weighted inputs, each concretely
  defined against existing data (no vague "quality signal"):**
  1. **On-time fulfillment rate** — for delivered/completed order items,
     the elapsed time from the order's `confirmed` timeline event
     (FR-17.4's `OrderTimelineEvent`) to its `shipped` event, compared
     against a Settings Registry target duration (`storehealth
     .fulfillment_target_days`) — there is no per-order promised-delivery
     date in this schema, so "on-time" means "within the platform's
     configured fulfillment SLA," not a literal broken promise.
  2. **Cancellation rate** — `orders.status = cancelled` ÷ total orders,
     trailing window (Settings Registry days).
  3. **Pending-forever rate** — `orders.status = pending` for longer than a
     Settings Registry staleness threshold (`storehealth
     .stale_pending_days`) ÷ total orders in the window.
  4. **Dispute/refund signals** — `orders.status = disputed` count
     (FR-6.5's existing dispute status) plus FR-6.20's commission-dispute
     count, in the same trailing window. v1.1's formal returns workflow
     (FR-22.3) is not built yet — this input uses what exists today, not a
     future table.
  5. **Profile completeness** — a store logo present (FR-32.x), at least
     one payment method configured (`StorePaymentInstructions`), CNIC
     verified (`Seller.cnicEncrypted` present, FR-30.1), **and a store
     policy statement present — the one real, disclosed schema gap**:
     `Store` has no policy-text field today (verified against
     `schema.prisma` while planning this FR, not assumed). This module
     adds one (`Store.policyText`, freeform, seller-editable, shown on the
     storefront) purely to make this completeness signal real, not a
     placeholder that always scores zero.
  6. **Account age** — `Seller.createdAt` — a fixed input, never
     improvable except by time passing, so it is capped at a modest weight
     (Settings Registry) — this score should never be dominated by "has
     existed a long time" over actually running a good store.
  7. **Moderation/risk history** — reuses §5.30's existing Risk Score
     Engine output (`Seller.riskScore`) and §5.29's `lifecycleStatus`
     directly, rather than re-deriving a parallel signal from raw
     moderation events.

  Each input's **weight** (summing to 100) is a Settings Registry value,
  editable without a deploy, same discipline as every other tunable
  business constant in this SRS (e.g. FR-6.1's commission rate).
- FR-34.2: **Recomputed on a schedule** (a new scheduler, same idempotent/
  safe-to-re-run discipline as `WalletLowBalanceSweepScheduler` and every
  other sweep in this SRS), plus **history kept** (one row per computation,
  `StoreHealthScoreHistory`) so the seller dashboard can render a trend,
  not just a single number.
- FR-34.3: **Seller dashboard display** — the current score plus a
  plain-language breakdown naming exactly which input(s) are lowering it
  and a concrete suggestion for each (e.g. "3 orders have been pending for
  over 5 days — mark them shipped or cancel them to improve this"),
  following the Simplicity Invariant (§3.13) — no raw weighted-sum math
  shown to a non-technical seller.

### 5.35 Verified Store Program (new, v0.27 — strict/earned-trust model:
the fee is for processing an application, never a purchase of the badge)
Deliberately modeled on "earn it, keep earning it" rather than "pay once,
keep forever" — every eligibility criterion below is Settings-Registry-
configurable, and the badge is revocable, never a one-time grant.

- FR-35.1: **Live eligibility portal.** A seller-facing screen evaluates
  the seller's current standing against every criterion in real time and
  shows a pass/fail per criterion in plain language (Simplicity Invariant,
  §3.13) — never a single opaque "not eligible" message. Default criteria
  (each a Settings Registry value, admin-editable):
  - **6+ months continuous selling on the same custom domain** —
    evaluated from the store's current `Domain.verifiedAt` (§5.3/FR-11.x);
    attaching a *different* domain resets this clock, since it is a new
    `Domain` row with its own `verifiedAt` — no new field needed, existing
    data already expresses "continuous on the same domain" correctly.
  - **Store Health Score ≥ 80** (Settings Registry value) — reads §5.34's
    score directly.
  - **CNIC verified** — `Seller.cnicEncrypted` present (FR-30.1).
  - **Zero unresolved T&S flags** — `Seller.lifecycleStatus = active`
    (§5.29) — `warned`/`restricted`/`suspended`/`banned` all fail this
    criterion.
  - **Minimum confirmed-sales volume** (Settings Registry value) — a count
    of `orders` at `confirmed` status or later for that store.
- FR-35.2: **Application, fee, mandatory admin audit — in that order,
  never auto-approved even when every criterion above passes.** An
  eligible seller applies and the verification fee (Settings Registry
  amount) debits their existing wallet (§5.6e, a new `LedgerEntry` type
  `verification_fee_debit`) at application time, **before** admin review —
  this is a processing fee, not a result purchase, and the copy/UX must
  say so explicitly (binding, not just a legal footnote). The application
  then enters a **mandatory** admin audit queue (same reviewer-role/
  audit-log pattern as every other admin queue in this SRS, §5.8/FR-27.6):
  the reviewer sees the full picture — health score breakdown, T&S/risk
  history, KYC status — and can approve or reject with notes. A reviewer
  may reject an applicant who technically passes every automated criterion
  (e.g. a documented pattern of borderline behavior the automated checks
  don't catch) — the eligibility portal states clearly that passing every
  criterion means "you may apply," never "you will be approved."
- FR-35.3: **Reject refunds the fee** (Settings Registry policy: full
  refund is the v1.0 default, expressed as data so the founder can change
  it without a deploy) via a `verification_fee_refund_credit` ledger
  entry, same mechanism FR-33.x's clawback entries already established —
  no new refund pathway.
- FR-35.4: **Badge rendering** — a buyer-facing trust mark on the
  storefront header (every page) and at checkout (the moment a buyer is
  deciding to trust the seller with payment, per the founder's framing) —
  reads live status, never a cached/stale flag; the badge disappears the
  instant status is no longer `verified` (revocation, FR-35.5), with no
  propagation delay beyond normal page-render freshness.
- FR-35.5: **Revocation — automatic re-review trigger, plus a standing
  admin override, both audit-logged.** If a verified store's Store Health
  Score drops below the configured threshold, or a T&S enforcement action
  lands against the seller (`lifecycleStatus` leaves `active`), the store
  is **automatically flagged for re-review** (not auto-revoked — a human
  confirms, same "informs a human" discipline as FR-29.4) and the badge is
  suspended pending that review. An admin may also revoke verified status
  directly, at any time, for any reason, with notes — `admin_audit_logs`-
  recorded, same as every other control-plane mutation in this SRS.
- FR-35.6: **Annual re-verification** — a Settings Registry toggle
  (default: on). When enabled, a verified store's status expires after 12
  months unless the seller re-applies (no new fee by default — a second
  Settings Registry value can require one) and passes the same live
  eligibility/admin-audit path as the original application, never a
  rubber-stamp renewal.
- FR-35.7: **Legal draft.** Program terms — the fee is for processing, not
  a purchase; eligibility criteria are subject to change; approval is
  never guaranteed even when criteria pass; revocation grounds and the
  re-verification cadence — ship as a `docs/legal/*.md` draft, flagged for
  human legal review (same discipline as FR-33.12).

### 5.36 Seller Data Export to Personal Cloud Storage (new, v0.27 — a
seller convenience, explicitly **not** a replacement for the platform's
own off-box backup NFR, §6, which remains binding regardless)
Reuses three already-built mechanisms end to end — CSV export (FR-18.2),
PDF generation (FR-19.1's invoice template engine), and the Google Drive
integration (§3.3/Module 2) — no new export format, PDF engine, or
storage integration.

- FR-36.1: **Triggers.** (a) automatically on each subscription renewal
  (§5.7's billing cycle), and (b) on-demand from the seller's own settings
  screen, rate-limited (Settings Registry value, e.g. once per rolling 24
  hours) to prevent an accidental tight loop from hammering Drive's API or
  the export job.
- FR-36.2: **Contents** — the seller's own trailing-period products,
  orders, and customers as CSVs (the existing exporter, FR-18.2, scoped to
  the period since the last export) plus one summary PDF (reuses FR-19.1's
  PDF engine with a new summary template, not the invoice template
  itself).
- FR-36.3: **Delivery** (revised, v0.28 security fix — supersedes the
  original "time-limited download link" wording, which never matched
  reality; see the disclosed discrepancy this replaces below). If the
  seller has an active Google Drive connection (§3.3) with the upload
  scope granted, the export uploads there directly, in a dedicated
  app-created folder (never writing into a folder the seller didn't
  create for this purpose) — this path is unaffected by the fix, since
  it's the seller's own Drive, not this platform's storage. Every file in
  the bundle (products/orders/customers CSVs, summary PDF) **contains
  customer PII and is stored under a non-public object-storage prefix**;
  the only read path is an ownership-checked, authenticated endpoint
  (`GET sellers/me/data-export/:exportId/download/:file`, `JwtAuthGuard`
  + a same-seller check, 404 for anyone else) that streams the bytes —
  never a public URL, signed or otherwise. If Drive isn't connected (or
  only holds the pre-existing `drive.readonly` scope), the fallback is an
  email (the existing `EmailService`) linking to the dashboard's Data
  export card — login required — never a direct link to the file itself.
  **Disclosed limitation:** the application never emits the raw storage
  key/URL to any client (proven by e2e test), but true "unreachable by an
  unauthenticated raw request" also depends on the production MinIO
  bucket policy denying anonymous reads on this prefix — a deploy-time
  infra step (`docs/launch-runbook.md`), not something a Node-level test
  against this repo's own code can mechanically prove end to end.
- FR-36.4: **Non-blocking, binding.** This job runs as best-effort
  background work; a failure (Drive API error, generation error) is
  logged and **never** blocks, delays, or affects the subscription renewal
  itself, same "a seller's legitimate action must never fail because of
  bookkeeping" discipline this SRS already applies elsewhere (e.g. §5.26's
  `EventsService.emit()`).
- FR-36.5: **Explicit non-substitution statement.** This feature is
  seller-facing convenience only. The platform's own automated, off-box
  database and media backups (§6's Availability NFR) are the actual
  disaster-recovery mechanism and remain mandatory regardless of whether
  any given seller has ever connected Drive or received an export — this
  FR must never be read, marketed, or relied upon internally as satisfying
  that NFR.

### 5.37 Order Verification Channel Adapter (new, v0.29 — founder-requested
competitive edge: no mainstream platform, including Shopify, ships buyer-
intent order verification; fake/prank COD orders and refused-at-the-door
deliveries are Pakistani sellers' single largest operational pain point)
A per-store, seller-selected mechanism confirming a **real, reachable buyer
actually placed and wants** an order, independent of and prior to payment.
This is deliberately not a payment-verification concept — Direct Seller
Collection (§5.6c) means most orders are COD or a direct bank/wallet
transfer the platform never sees — it is a **buyer-intent** gate, built the
same swappable-adapter way as every other integration point (§3.5's new
Verification Channel Adapter).

- FR-37.1: **Per-store channel selection.** A Settings Registry key
  (`orders.verification_channel`, `store` scope, one of `none` /
  `whatsapp_otp` / `email_otp` / `prepaid_confirmation`, default `none`)
  lets each seller opt into exactly one channel per store — never
  mandatory, never multiple channels simultaneously for the same store (a
  seller wanting to switch channels changes this one setting; in-flight
  verifications on the old channel are unaffected). `none` is a fully
  supported, first-class choice — a seller who trusts their own judgment,
  or whose buyer base is loyal enough not to need this, pays no UX cost.
- FR-37.2: **WhatsApp OTP channel.** v1.0 is manual/link-assisted: the
  system generates the OTP and a pre-filled `wa.me` deep link (buyer's
  WhatsApp number + the seller's message template with the OTP
  interpolated in); the seller's own dashboard surfaces a "send via
  WhatsApp" action that opens the link in their own connected WhatsApp
  (personal or Business app) for them to tap-send — the platform never
  sends the WhatsApp message itself in v1.0. Built behind the Verification
  Channel Adapter interface (§3.5) specifically so a real WhatsApp
  Business API integration (automated send, delivery receipts) can replace
  this implementation later with **zero change** to checkout, the OTP
  generation/verification logic, or the Financial Truth Invariant tie-in
  below — documented explicitly as future work (FR-37.9), not a v1.0 gap
  glossed over.
- FR-37.3: **Email OTP channel, sent from the seller's own SMTP.** The
  seller connects their own SMTP credentials (host/port/username/
  password or app-password) via a new dashboard connection flow — the
  same "seller connects their own third-party credential" shape as the
  existing Google Drive connection (§3.3/FR-9.1). Credentials are
  encrypted at rest (AES-256-GCM, application-layer, mirroring
  `drive-token-crypto.util.ts`'s existing pattern, under a new,
  independently-rotatable `SMTP_CREDENTIAL_ENCRYPTION_KEY` — never the
  same key as `DRIVE_TOKEN_ENCRYPTION_KEY`, same one-key-per-purpose
  discipline as `EXTERNAL_API_SECRET_ENCRYPTION_KEY`), **never logged,
  and never returned by any API response** (same discipline as FR-30.1's
  CNIC handling and the Drive refresh token). OTP emails are sent through
  the seller's own connected account specifically so **the platform's own
  email-sending reputation/deliverability is never spent on this** — an
  abusive or careless seller can only damage their own account's standing,
  never the platform's shared sending domain.
  - A seller may connect **1 to 5** sender email accounts. When more than
    one is connected, sends rotate across them (round-robin, skipping any
    account currently at its daily cap) — this exists purely to raise the
    effective daily ceiling for a high-volume store, not to obscure which
    account sent what (every `OrderVerification` row records exactly which
    connected sender address was used).
  - **Daily per-email send cap:** a Settings Registry value
    (`orders.verification_email_daily_send_cap`, default **450**,
    `store`-overridable) tracked per connected sender address, resetting
    on a rolling 24-hour window; a send attempt against a capped-out
    account is rejected (falling through to the next rotation candidate,
    or a clear "all connected senders are at today's limit" error if none
    remain) — never silently dropped.
- FR-37.4: **Prepaid Confirmation channel.** A small advance amount (an
  amount the seller sets, e.g. a flat Rs 100/200) the buyer pays **directly
  to the seller** by whatever method that store's existing payment
  instructions already specify (bank transfer/JazzCash/Easypaisa) — the
  platform never processes, holds, or sees this money, identical trust
  model to every other Direct Seller Collection payment. v1.0 is a manual
  "seller marks deposit received" action on the order (the exact same
  human-in-the-loop confirmation shape `OrdersService.markAsPaid()`
  already established, not a new pattern) — the deposit's own possible
  future automation (matching an incoming bank/wallet notification) is out
  of scope for v1.0, same "manual first, adapter allows automation later"
  posture as the other two channels.
- FR-37.5: **OTP rules (channels 37.2/37.3 only — 37.4 has no OTP).** All
  Settings-Registry-driven, never hard-coded:
  - **Time-limited:** `orders.verification_otp_ttl_minutes` (default 10,
    validated 5-60) — an expired OTP is rejected with a clear "expired,
    request a new one" response, never silently treated as still valid.
  - **Rate-limited:** `orders.verification_otp_resend_cooldown_seconds`
    (default 60) — a resend request inside the cooldown is rejected, not
    silently queued or double-sent (same "explicit rejection over silent
    duplication" precedent as FR-36.1's export rate limit).
  - **Retry-capped:** `orders.verification_otp_max_attempts` (default 5) —
    exceeding this many wrong-code submissions against the same OTP marks
    that verification attempt `failed` and requires an explicit fresh OTP
    request, not an infinite guess loop.
  - **Single-use:** an OTP is invalidated the instant it's either
    successfully verified or superseded by a newer one for the same order
    — never re-checkable after either event.
  - OTPs are stored hashed (never plaintext, same discipline as password/
    security-token storage elsewhere in this SRS), compared via a
    constant-time check.
- FR-37.6: **Seller-editable message template.** Each store may customize
  the OTP message's surrounding text (a free-text template with an
  `{{otp}}` token the system interpolates at send time, plus optional
  store-name/order-number tokens) — never a platform-wide fixed string.
  Applies to both the WhatsApp deep-link message (FR-37.2) and the email
  body (FR-37.3).
- FR-37.7: **Financial Truth Invariant tie-in (binding, extends §3.12,
  does not duplicate it).** For a store with `orders.verification_channel`
  set to anything other than `none`, an order is held in a
  not-yet-confirmed state — excluded from every sale count, total, and
  `platform_events` row exactly as an unpaid order already is under
  §3.12 — **until verification succeeds**. Verification succeeding is a
  precondition alongside (not a replacement for) the existing
  `markAsPaid()`/mark-as-paid confirmation path; a store with
  verification `none` is entirely unaffected and behaves exactly as
  today. This is one invariant with one additional gate, never a second,
  parallel definition of "confirmed."
- FR-37.8: **Buyer-provided checkout fields.** Every order collects
  buyer email, WhatsApp number, and delivery location (already collected
  today via the existing shipping-address flow) plus any additional
  fields a seller marks required for their store (a small, seller-
  configurable field set — not an open-ended form builder). These are the
  fields the verification channels above act on (WhatsApp number for
  FR-37.2, email for FR-37.3).
- FR-37.9: **Explicit roadmap note, not built in v1.0.** Automated,
  API-based WhatsApp Business or SMS-gateway verification is the
  documented next step behind the same Verification Channel Adapter
  (§3.5) — no redesign required when it's built, per the adapter pattern's
  whole purpose.

### 5.38 Orders Command Center (new, v0.29 — the underlying data has
existed since Module 9; this section is the first consolidated read over
it, governed by the SIMPLICITY INVARIANT, §3.13)
- FR-38.1: **Bucketed order-state aggregation.** One endpoint returning
  live counts across: pending, awaiting-verification (§5.37's new gate),
  prepaid-received (§5.37.4's channel, awaiting fulfillment), awaiting-
  tracking (confirmed, no tracking uploaded yet), shipped, delivered,
  cancelled/returned — plus the existing supplier fulfillment checklist
  (Module 8/9). Every bucket is a **derived** read computed from
  `OrderStatus`, `OrderItemFulfillmentStatus`, and this amendment's new
  verification status — no new source of truth, no count computed a
  second, looser way elsewhere (same cross-cutting discipline §3.12
  already requires of every money-adjacent read).
- FR-38.2: **"What needs my attention," at a glance.** Each bucket count
  is a live filter into the existing order list (FR-17.x) — clicking
  "awaiting-verification: 4" shows exactly those 4 orders, never a
  separate, differently-filtered list. No action requires more than two
  clicks from this screen, per the Seller Dashboard UI module's existing
  SIMPLICITY INVARIANT precedent (§3.13).
- FR-38.3: **Slotting note.** The backing aggregation endpoint (FR-38.1)
  ships now (see `docs/build-plan.md` for the module number); its bare
  functional frontend surface reuses the existing Orders page route — a
  premium visual treatment is deferred to Module 19's dashboard design
  phase (Phase 4), same "bare functional now, designed later" posture
  every other module in this SRS has followed since the design system was
  founder-approved.
- FR-38.4: **(new, v0.30) Role-based tracking upload — reaffirmed, not
  rebuilt.** Both upload paths already exist and are already correctly
  scoped: the seller uploads tracking for a self-fulfilled item
  (`OrdersService.uploadTracking`), and a supplier uploads tracking only
  for their own supplier-fulfilled items, ownership-checked against
  `OrderItem.supplierId` (`SupplierOrdersService.uploadTracking`). This
  amendment reuses both verbatim — no new upload endpoint, no change to
  either method's authorization check.
- FR-38.5: **(new, v0.30) Public + seller status timeline.** The buyer's
  public order-status page (`storefront/order-status/:token`, reached via
  the same unguessable `statusLookupToken` as today — no account, no
  change to that access model) and the seller's own order-detail view both
  render a **placed → confirmed → shipped → delivered** timeline (plus a
  cancelled state where applicable), each completed stage carrying its
  timestamp. The timeline is a **derived, computed** read over
  `Order.status`, `Order.placedAt`, `OrderTimelineEvent` rows, and
  `TrackingUpdate` (courier + tracking ID already stored per item since
  Module 9) — no new "timeline" table, no second copy of state that could
  drift from `Order.status` itself.
- FR-38.6: **(new, v0.30) The Financial Truth Invariant governs every
  count on this screen, unchanged.** An order sitting in `pending`,
  `awaiting-verification`, or `prepaid-received` is visible on the Command
  Center (so the seller knows to act on it) but is never counted toward
  any confirmed-sale total anywhere — on this screen, in seller order
  totals, or in admin real-time analytics. This is a reaffirmation of
  §3.12/§5.37's existing invariant applied to a new read surface, not a
  new rule.

### 5.39 Inventory Management (new, v0.29 — a dedicated screen; no new
stock-tracking concept, reuses `stockQuantity` and the existing oversell-
protection logic verbatim)
- FR-39.1: **Dedicated stock screen.** Stock levels across every product
  and variant in a store, in one place — distinct from the Products
  catalog-editing screen (FR-2.x), which stays focused on listing content,
  not day-to-day stock operations.
- FR-39.2: **Low-stock alerts.** A per-store Settings Registry threshold
  (`inventory.low_stock_threshold`, default 5, `store`-overridable) flags
  any variant at or below it — a visible badge/filter on this screen, not
  a new notification-channel build (reuses the existing Module 25
  admin-notification-center precedent's "surface it where the relevant
  person already looks" principle, applied seller-side).
- FR-39.3: **Bulk stock edits via CSV.** Reuses the existing CSV import
  machinery (FR-18.1/FR-18.3) in a stock-only mode (SKU + new quantity
  columns) — no new import engine, no new file-parsing code path.
- FR-39.4: **Manual stock adjustments with an adjustment log.** A single-
  row stock change (increment/decrement/set-to) is always recorded in a
  new, append-only log — who (which seller-account user), when, the
  before/after quantity, and a required reason string. Never silently
  overwritten or editable after the fact, same append-only-history
  discipline as `AdminAuditLog`/`PlatformEvent` elsewhere in this SRS,
  scoped to the seller's own store rather than the admin side.
- FR-39.5: **Oversell protection, corrected to actually cover
  self-fulfilled products (v0.33 — this FR previously claimed checkout
  already reused the same mechanism for every product; the v0.33 audit
  found that was false: the atomic conditional-decrement pattern
  (`updateMany` gated on `stockQuantity >= quantity`, FR-4.5) was wired
  only to supplier-fulfilled line items — a self-fulfilled variant's
  `stockQuantity` was read for pricing but never checked or decremented
  at checkout, a real oversell bug).** Checkout now applies the identical
  atomic pattern to `ProductVariant.stockQuantity` for self-fulfilled
  items, gated by a new `trackInventory` boolean on `ProductVariant`
  (default `true`) — a seller can mark a variant untracked/unlimited-
  stock (the explicit opt-out this correction requires), in which case
  no check or decrement happens for that variant, same as today's
  behavior. This screen remains a read/adjust surface over
  `stockQuantity` and the now-corrected checkout decrement logic — one
  oversell-protection mechanism across both fulfillment paths, still no
  second code path that could decrement stock differently than checkout
  does.
- FR-39.6: **Inventory export, as a new Data Export artifact.** A new
  optional CSV (current stock levels across all products/variants) added
  to the existing Seller Data Export bundle (§5.36) — the seller's own
  Google Drive backup convenience, delivered exactly the way FR-36.3
  already delivers the products/orders/customers CSVs. **Explicitly
  reaffirmed (not a new rule): this is not a replacement for the
  platform's own off-box database backups (§6)** — FR-36.5's exact
  non-substitution statement applies unchanged to this new artifact.
- FR-39.7: **No third-party AI integration — explicit roadmap-only note,
  not a gap.** No ChatGPT/Claude-class (or any third-party LLM) feature is
  built anywhere in inventory management, or elsewhere, in v1.0. This is
  withheld deliberately until a dedicated AI-integration and data-
  liability policy exists (what seller/buyer data, if any, could ever be
  sent to a third-party model, under what consent and retention terms) —
  revisited post-launch, not blocked on any technical dependency.

### 5.40 Delivery-Time Badges (new, v0.30 — buyer-trust surface for
supplier-sourced items; the underlying data has existed since Module 8,
this is the first time it's ever shown to a buyer)
- FR-40.1: **Storefront badge, supplier-sourced items only.** A product
  card (search/collection/discovery grids) and a product detail page show
  a small badge — "Ships in X-Y days" and "Delivers to: …" — sourced from
  `SupplierListing.estimatedDeliveryMinDays`/`estimatedDeliveryMaxDays`/
  `supportedCountries`, already computed per-request into
  `StorefrontService`'s existing `supplierShipping` payload field (never a
  new query, never cached stale).
- FR-40.2: **Self-fulfilled items show nothing.** A product with no
  supplier listing behind it (`supplierShipping` is `null`) renders no
  badge at all — never a placeholder, never a default estimate invented
  for it.
- FR-40.3: **Hidden, not broken, when data is incomplete.** A supplier
  listing missing either delivery-estimate field or an empty
  `supportedCountries` array suppresses only the affected badge line, not
  the whole card/page.

### 5.41 WhatsApp Semi-Automation (new, v0.30 — free v1.0 seller-clicked
message generation, reusing §5.37's WhatsApp OTP Adapter's exact `wa.me`
deep-link construction; full Business API automation explicitly deferred)
- FR-41.1: **Three trigger points, one seller-clicked send each.** A
  ready-to-send WhatsApp deep link (buyer's WhatsApp number + a seller-
  editable, Settings-Registry-driven message template with order/tracking/
  cart details interpolated in) is generated on demand for: (a) order
  confirmation, from the seller's order-detail view once an order is
  `confirmed`; (b) a shipping/tracking update, from the same view once
  tracking is uploaded (FR-38.4's existing upload path, untouched); (c)
  abandoned-cart recovery, from a new seller-facing list of this store's
  `abandoned` carts (Module 9/15.2's existing flagging — write-only until
  now). Every send is a seller click that opens `wa.me` in their own
  WhatsApp — v1.0 never sends anything itself, same "manual/link-assisted"
  posture as FR-37.2.
- FR-41.2: **Abandoned-cart recovery requires a captured buyer WhatsApp
  number.** `Cart.buyerWhatsapp` (column added in Module 26's migration
  batch, never wired to capture) is now populated at cart-creation time,
  optionally, alongside the existing required `buyerEmail` — a cart with
  no WhatsApp number captured is still listed (so the seller sees it) but
  has no recovery-link action available.
- FR-41.3: **Seller-editable templates per trigger, Settings-Registry-
  driven.** `whatsapp.order_confirmation_template`,
  `whatsapp.shipping_update_template`, and `whatsapp.cart_recovery_template`
  (`store`/`global` scope, same precedence pattern as every other
  Settings-Registry-driven template in this SRS) — never hard-coded
  message copy.
- FR-41.4: **Explicitly deferred, roadmap-only, not built in v1.0:** a
  fully automated WhatsApp Business API send sequence (paid, Meta-gated,
  requiring a verified business phone number and template pre-approval) —
  the seller-clicked deep-link shape is deliberately chosen so this
  remains a pure addition later, never a rework of the message-generation
  logic itself.

### 5.42 Automated Profit & Loss Engine (new, v0.30 — the one genuinely
new financial-data surface in this amendment; slotted after Inventory
Management since it reads cost data that lives naturally near it; free
v1.0, no paid third-party integration required)
- FR-42.1: **Seller-entered cost inputs.** A per-product-variant base cost
  (COGS, optional — a variant with no cost entered is visibly flagged as
  such everywhere its profit would otherwise be computed, never silently
  treated as zero), optional per-order courier/handling costs, and
  manual or CSV-imported ad-spend entries scoped to a date period (reusing
  the existing CSV import machinery's shape, FR-18.1/18.3 — no new parser).
- FR-42.2: **True net profit, per order.** For every `confirmed`+ order:
  `revenue (Order.totalAmount − Order.taxAmount, the same tax-exclusion
  convention §5.6c's commission accrual already uses) − commission_accrued
  (from the existing `LedgerEntry`, never recomputed a second way) −
  Σ(variant base cost × quantity) − courier/handling costs`. **Build-time
  correction:** an earlier draft of this formula also subtracted
  `Order.discountAmount` a second time here. `computeOrderTotals()`
  (§5.6/order-totals.util.ts) already nets the discount out of
  `totalAmount` before shipping/tax are added
  (`taxableAmount = subtotal − discountAmount`), so `totalAmount −
  taxAmount` is already post-discount revenue — subtracting
  `discountAmount` again would have silently understated every discounted
  order's revenue and profit by the discount amount a second time. Fixed
  before ship; locked in by an explicit regression test
  (`pnl.util.spec.ts`, "never double-counts the discount already netted
  into totalAmount"). An order with any line item missing a base cost
  shows its profit figure as incomplete/flagged, never a number that
  silently understates the true cost.
- FR-42.3: **True net profit, per period.** The same per-order figures
  summed across a seller-chosen date range, minus every ad-spend entry
  whose period overlaps that range — one clear revenue-vs-net-profit
  comparison, the headline view of this module.
- FR-42.4: **The Financial Truth Invariant applies unchanged.** Only
  `confirmed`+ orders are ever included in any revenue, commission, or
  profit figure on this screen — a `pending`/`awaiting-verification` order
  contributes exactly nothing, the same rule §3.12 already enforces
  everywhere else money is shown.
- FR-42.5: **Tenant-isolated cost data.** Every cost input (variant base
  cost, per-order courier/handling, ad-spend entries) is scoped to the
  seller's own store via the same RLS discipline (§3.2) as every other
  tenant-owned table — a seller can never see or influence another
  seller's cost/profit figures.
- FR-42.6: **Ad-spend input designed as a clean extension point, not an
  adapter build.** v1.0 ships exactly one ad-spend entry path (manual
  form + CSV import) behind a narrow internal interface a future
  automated source (Facebook/TikTok Ads API) can implement without
  reworking the period-aggregation logic — unlike §3.5's Adapter pattern,
  this is a documented seam, not a second implementation shipped now.
- FR-42.7: **Explicitly deferred, roadmap-only, not built in v1.0:**
  automated Facebook/TikTok ad-account API sync and automated local-
  courier-API cost sync — both withheld until those integrations are
  actually built, not because of any schema gap (FR-42.6 already leaves
  room for them).

### 5.43 Built-in Email Verification Service (new, v0.31 — a fourth
option inside §5.37's existing Verification Channel Adapter, alongside
WhatsApp OTP, Email OTP via the seller's own SMTP, and Prepaid
Confirmation; a zero-setup platform-hosted convenience default)
- FR-43.1: **`PlatformEmailOtpAdapter`.** A new implementation of the
  same `VerificationChannelAdapter` interface (§5.37) a seller can pick
  per store — no seller SMTP credentials, no seller WhatsApp API key,
  works immediately.
- FR-43.2: **`EmailServiceProvider` abstraction.** Sends route through a
  new interface (initially one concrete implementation on top of the
  platform's existing `EmailService`/`EMAIL_PROVIDER`), architected —
  same adapter-extraction discipline as §3.5 — so it can be pulled out
  into a standalone SaaS later without any caller (this OTP path, or any
  future transactional-email use) changing. The extraction seam itself
  is documented in `docs/architecture.md`.
- FR-43.3: **Plan-based monthly quota.** A Settings-Registry-driven
  quota (`verification.platform_email.monthly_quota`, per plan tier),
  enforced via a per-seller monthly counter reset at each billing-period
  boundary (same reset discipline as Module 20's existing counters).
  Sending at quota returns a graceful "quota reached — connect your own
  SMTP or upgrade" message to the seller, never a silent failure.
- FR-43.4: **Deliverability honesty, documented not just coded.**
  Platform-sent email has no SPF/DKIM/DMARC alignment or sender-
  reputation warming at v1.0 launch (§6 NFRs cross-reference this); the
  verification-channel settings screen discloses that WhatsApp OTP and a
  seller's own connected SMTP remain the recommended first-class
  channels — this service is a convenience default, never the sole path
  a seller is forced into.
- FR-43.5: **Quota visibility.** Remaining/consumed quota is shown on
  the same settings screen as the other three channels — no separate
  ledger UI, reusing Module 20's "show what's left, plainly" pattern.

### 5.44 One-Click Shopify Migration (new, v0.31 — extends the existing
CSV import engine, FR-18.1/FR-18.3, into a guided multi-entity migration
flow; the highest-priority acquisition feature, killing the "switching
is hard" objection)
- FR-44.1: **Reuses the existing `ImportJob` engine.** New Shopify-export
  CSV parsers (products+variants+images, customers, orders) plug into
  the same import job/error-report machinery Module 15 already built —
  no new import engine, no new file-handling code path.
- FR-44.2: **Guided flow.** Upload → field-mapping preview (auto-mapped
  where Shopify's column names match the platform's, manual mapping for
  the rest, unmapped fields surfaced explicitly rather than silently
  dropped) → per-row validation preview → import execution → a per-row
  error/skip report (same shape as FR-18.3's existing report).
- FR-44.3: **Moderation applies unchanged.** Every imported product
  passes the existing Moderation Engine (§5.27) exactly as a manually
  created product would — a bulk migration is never a way to bypass
  banned/restricted-keyword screening.
- FR-44.4: **Plan limits apply unchanged.** Whatever caps a seller's plan
  already enforces (product count, etc.) apply identically to migrated
  data; a migration that would exceed a limit is blocked/truncated with
  a clear message, never silently allowed to overrun.
- FR-44.5: **Imported orders are historical record only.** Already-
  fulfilled Shopify orders are created directly in their final status —
  never run through the live checkout/payment flow — and are explicitly
  excluded from the Orders Command Center's (§5.38) action-needed
  buckets and from platform commission calculation (they were not
  platform-facilitated sales).
- FR-44.6: **Explicitly deferred, roadmap-only:** a direct Shopify API
  connect (OAuth, live/ongoing sync). v1.0 is upload-based only.

### 5.45 Cost-Savings Calculator (new, v0.31 — an interactive marketing-
site conversion tool, homepage/pricing)
- FR-45.1: **Interactive, public, no auth required.** A seller enters
  monthly order volume and average order value (or monthly sales
  directly); the calculator outputs estimated annual savings comparing
  UZEYN's cost (plan fee + 1% commission) against Shopify's (subscription
  tier + transaction/card-processing fees + a typical-app-cost estimate).
- FR-45.2: **Every comparison figure is Settings Registry data.** Shopify
  plan tiers/pricing, transaction fee %, typical-app-cost estimate, and
  UZEYN's own plan fees/commission % are all admin-editable settings,
  never hard-coded in frontend or backend code — a pricing change
  (either platform's) is a data update, not a deploy.
- FR-45.3: **Honest "estimate" framing.** Output is clearly labeled
  "Estimated savings" with a visible disclaimer that figures are based
  on typical/average costs, not a guarantee.
- FR-45.4: **Placement.** Embedded on the homepage and/or `/pricing`
  page; bare-functional in v1.0 per the standing premium-redesign-later
  rule.

### 5.46 Seller Trust & Achievement Badge Engine (new, v0.31 — public
storefront badges, distinct from §5.40's logistics-only Delivery-Time
Badges; a shared evaluation engine also consumed by §5.47's private
dashboard badges)
- FR-46.1: **Settings-Registry-driven thresholds.** Every badge type
  (e.g. `badges.top_rated.min_avg_rating`,
  `badges.fast_shipper.max_avg_fulfillment_hours`,
  `badges.high_volume.min_order_count`,
  `badges.established.min_tenure_days`) has its threshold as admin-
  editable Settings data — no hard-coded threshold anywhere in
  badge-evaluation code.
- FR-46.2: **Derived read, no new source of truth.** A single
  `BadgeEvaluationService` computes a store's current earned badges
  entirely from data this SRS already tracks — Store Health Score
  (§5.34), fulfillment-speed data from existing `OrderItem`/tracking
  timestamps, order-volume counts, store/seller tenure — same
  Simplicity-Invariant-governed derived-read discipline as the Orders
  Command Center (§5.38).
- FR-46.3: **Auto-revocable, never seller-settable.** Badges are
  recomputed on the same recompute cadence as Store Health Score and are
  revoked the instant underlying criteria lapse — never a one-time award
  that outlives the performance that earned it. No endpoint lets a
  seller claim, request, or otherwise set a badge directly; it is always
  derived.
- FR-46.4: **Storefront + checkout rendering.** Public badges render on
  storefront product/store pages and at checkout, reusing the existing
  Verified Store badge's (§5.35) established placement/rendering
  precedent.
- FR-46.5: **Shared engine, two consumers.** §5.47's private dashboard
  achievement badges are built on this same `BadgeEvaluationService` —
  one evaluation engine with two independent badge sets and rendering
  surfaces, never two parallel badge systems.

### 5.47 Emotional & Retention Layer (new, v0.31 — celebratory onboarding,
milestone celebrations, private dashboard achievement badges; reuses
§5.46's Badge Evaluation Engine. FR-47.2/47.3 built as part of the UI/UX
Design Phase's Dashboard Home addendum — the dismissible milestone banner;
FR-47.1/47.4/47.5 remain not yet built)
- FR-47.1: **Celebratory onboarding.** The existing onboarding wizard
  (FR-20.1's progress tracking) is reframed presentation-wise as a
  guided, encouraging tour with a completion-celebration screen — a
  presentation-layer change over already-existing progress state, no new
  backend model.
- FR-47.2: **Milestone celebrations (built).** Settings-Registry-driven
  thresholds (`milestones.order_count_thresholds`,
  `milestones.sales_amount_thresholds`) trigger an in-dashboard
  celebratory moment the first time a store crosses each one, computed
  from the same confirmed-sale data the Financial Truth Invariant
  already governs (§3.12) — only `confirmed`+ orders ever count toward
  any milestone.
- FR-47.3: **Fires exactly once per threshold (built).** An append-only
  `MilestoneEvent` record (same immutable-history discipline as
  `PlatformEvent`/`AdminAuditLog`, own dedicated table rather than reusing
  `PlatformEvent` so a real `@@unique(storeId, metric, threshold)`
  constraint can guarantee it) prevents a threshold from re-celebrating
  on every subsequent qualifying order.
- FR-47.4: **Private dashboard achievement badges.** Built on §5.46's
  `BadgeEvaluationService`, a distinct badge set from the public
  storefront badges, seller-facing only — never rendered on the public
  storefront.
- FR-47.5: **Dashboard personalization tie-in.** The already-built
  dashboard personalization (themes/wallpapers) is reaffirmed, not
  rebuilt, as part of the same "this is MY store" ownership feeling this
  layer is designed around.

### 5.48 Community & Belonging (new, v0.31 — a deliberately lean v1.0
foundation: success-story submissions + admin curation + a simple
Featured Sellers surface; ties into the existing §5.33 Growth & Partner
Programs / Ambassador-Teams infrastructure)
- FR-48.1: **Success-story submissions.** A seller submits a story (free
  text + optional store link) from their dashboard; never public until
  admin-approved — the same submit → moderate → publish shape as §5.27's
  Listing Moderation Engine and §5.33's existing growth-program
  submission queues, not new machinery.
- FR-48.2: **Admin curation queue.** Reuses the existing admin-queue UI
  precedent (Module 25) for approve/reject; only approved stories are
  ever publicly visible.
- FR-48.3: **Featured Sellers surface, opt-in only.** A public page
  showing admin-approved success stories plus, optionally, stores
  holding §5.46 public badges — inclusion always requires the seller's
  own submission or an explicit opt-in flag, never automatic inclusion
  from data alone.
- FR-48.4: **No PII beyond what the seller has published.** Same
  PII-discipline precedent as every other public surface in this SRS
  (e.g. the Product Feed API's FR-24.10 "only fields already public") —
  nothing beyond store name and already-public storefront content is
  ever surfaced.
- FR-48.5: **Explicitly deferred, roadmap-only:** richer community
  features (seller forums, seller-to-seller messaging, comments/
  reactions) — v1.0 is submission + curation + a featured surface only,
  an explicit scope cut, not a gap.

### 5.49 Gift Cards (new, v0.32 — purchasable + seller-issued store gift
cards, redeemable at checkout with partial redemption; reuses §5.7's
`DiscountCode` code pattern and the wallet's ledger-derived-balance
discipline)
- FR-49.1: **`GiftCard` model, store-scoped unique code.** Mirrors
  `DiscountCode`'s `@@unique([storeId, code])` pattern exactly; carries an
  `initialValue`, optional `expiresAt`, and `isActive` flag (same
  optional-expiry/active-flag shape `DiscountCode` already has).
- FR-49.2: **Two issuance paths.** Buyer-purchased (a real checkout
  transaction) and seller-issued (a dashboard action, e.g. goodwill/store
  credit) both create a `GiftCard` row; only the buyer-purchased path is a
  revenue event — a seller-issued card never contributes to revenue,
  commission, or any Financial Truth aggregate.
- FR-49.3: **Financial Truth Invariant applies (§3.12).** A
  buyer-purchased gift card's balance activates only once its purchase
  order reaches `confirmed`+ status; a `pending` gift-card order
  contributes exactly zero to any revenue/commission aggregate, and the
  code is unusable for redemption until paid — proven the same
  before/after assertion style as every other Financial-Truth-gated flow
  in this SRS.
- FR-49.4: **Ledger-derived balance, not a bare mutable column.** Each
  redemption creates an append-only `GiftCardRedemption` row (amount,
  order id, timestamp); current balance is always `initialValue` minus
  the sum of redemptions — the same derived-balance discipline
  `WalletService.getBalance()` already established, so balance is always
  re-auditable from history, never a number that can drift from its own
  ledger.
- FR-49.5: **Order settlement interaction.** A redeemed amount reduces
  the buyer's amount-due at checkout (`Order.giftCardAmount`, alongside
  the existing `discountAmount`), but the order still follows the
  existing Direct Seller Collection confirm/mark-as-paid flow (§5.6c) for
  any remaining balance; even a gift-card-fully-covered order requires an
  explicit seller confirmation before it counts toward commission/revenue
  — never auto-confirmed.
- FR-49.6: **Partial redemption across multiple orders.** A redemption
  cannot exceed the card's remaining balance (validated at redemption
  time); a card may be redeemed across several separate orders until
  exhausted or expired/deactivated.
- FR-49.7: **Tenant-isolated.** `GiftCard`/`GiftCardRedemption` are
  `store_id`-keyed with `ENABLE`+`FORCE ROW LEVEL SECURITY` and the same
  seller-ownership-checked RLS policy pattern as every other tenant table.

### 5.50 Customer Segments (new, v0.32 — saved segments over existing CRM
customer data; foundation for §5.51 Email Campaigns)
- FR-50.1: **`CustomerSegment` model, store-scoped.** A name plus
  structured filter criteria (JSON — min/max order count, min/max total
  spent, last-order-before/after, location), never a free-text query.
- FR-50.2: **Derived membership, no new source of truth.** A segment's
  member list is always computed live from `Customer.ordersCount`/
  `totalSpent`/`lastOrderAt` (already tracked since FR-13.x) — same
  Simplicity-Invariant derived-read discipline as Store Health Score
  (§5.34) and the Orders Command Center (§5.38); never a separately
  maintained membership list that can go stale.
- FR-50.3: **Location, derived — explicit scope choice, not a gap.**
  `Customer` has no location column; the location filter is derived from
  the customer's most recent order's shipping address (city/country) at
  segment-evaluation time. This is disclosed as the only location signal
  that exists, since buyer accounts don't exist in v1.0 (§4) — no new
  `Customer` column added for this.
- FR-50.4: **Always current.** A segment recomputes on every view/use
  (e.g. selected as an Email Campaign audience) — never a snapshot frozen
  at creation time.
- FR-50.5: **Standard CRUD + tenant isolation.** Create/edit/delete/
  preview-member-count from a seller-dashboard screen; RLS-isolated like
  every other seller-scoped table.
- FR-50.6: **The only interface §5.51 consumes.** Email Campaigns reads a
  segment's resolved, non-unsubscribed member list — it never queries
  `Customer` directly.

### 5.51 Email Campaigns (new, v0.32 — basic campaigns/newsletters to a
saved segment via the seller's own SMTP; reuses Module 26's connected-
sender machinery; no AI)
- FR-51.1: **Sends via the seller's own connected SMTP.** Reuses the
  exact connected-sender record and AES-256-GCM credential encryption
  Module 26 already built for verification email
  (`SellerVerificationEmail` + `smtp-credential-crypto.util.ts`) rather
  than a second credential-storage mechanism; a campaign targets exactly
  one saved segment (§5.50).
- FR-51.2: **Monthly send quota, plan-tier gated.** A new numeric
  Settings Registry key (`email_campaigns.monthly_send_limit`,
  `allowedScopes` including `plan`) resolved via the exact
  `SubscriptionsService.getPlanContext(sellerId)` →
  `settings.resolve<number>()` pattern `catalog.product_limit` already
  established (`ProductsService.create()`) — a send that would exceed
  the seller's remaining monthly quota is blocked entirely before any
  email leaves, never partially sent.
- FR-51.3: **Unsubscribe handling — the first such mechanism in this
  codebase.** Every campaign email carries a unique per-recipient
  unsubscribe link; an unsubscribed `Customer` (store-scoped) is
  permanently excluded from every future campaign to that store
  regardless of which segment they'd otherwise match — checked at send
  time, not only at list-build time.
- FR-51.4: **Honest deliverability note, in the composer UI itself.**
  Because v1.0 sends through the seller's own SMTP credentials (no
  platform-level SPF/DKIM/DMARC alignment or sender-reputation warming —
  same disclosed limitation as §5.43's platform email), the campaign
  composer states plainly that deliverability depends on the seller's own
  email provider's reputation and sending limits — never an implied
  inbox-placement guarantee.
- FR-51.5: **No AI — explicit scope cut.** Campaign content (subject +
  body) is composed entirely by the seller; no generation, subject-line
  suggestion, or send-time optimization. AI email-assist is a
  roadmap-only note (§5.22), not a v1.0 gap.
- FR-51.6: **Background job, not a synchronous send.** A campaign send
  runs on the existing BullMQ infrastructure (same precedent as CSV
  import/export and §5.36's data export) so a large segment never blocks
  the request/response cycle.
- FR-51.7: **Send history via the existing Platform Event Log (§14.23).**
  No new logging mechanism — every campaign send is an event on the
  cross-cutting log already required of every module from Module 3
  onward.

### 5.52 Staff Accounts, plan-tier (new, v0.32 — pulls the previously
Phase-3-deferred staff-sub-account concept forward as a paid-plan
differentiator, at the founder's explicit direction)
- FR-52.1: **Explicit, documented reversal — not a silent
  contradiction.** SRS v0.6's changelog note, §4 User Roles, and §10's
  Phase 3 bullet each previously stated seller staff sub-accounts remain
  "Phase 3+, reaffirmed." This amendment pulls seller staff accounts
  forward into v1.0; all three statements are marked **superseded by
  v0.32/§5.52** in place, not deleted, preserving the SRS's own decision
  history. The separate "general admin sub-role/permissions system" half
  of that same original deferral remains deferred — §5.53/§5.54 extend
  admin capability through existing/new admin-scoped mechanisms, not a
  new generic permissions framework.
- FR-52.2: **`StaffAccount` model, coarse role-based scopes.** Seller-
  owned, carrying a fixed set of explicit permission scopes (`orders`,
  `catalog`, `discounts`, `customers`, and **`design`**) —
  `billing`/`payment-instructions`/`wallet`/`plan` are never assignable
  to a staff scope, owner-only always. Same "coarse, explicit, auditable
  scopes" discipline as the platform's own 3-value `AdminRole` enum, not
  a fully generic permissions framework (that ambition stays deferred per
  FR-52.1). The **`design`** scope is deliberately narrow — theme
  customization (Module 4's customizer) and storefront branding only, no
  orders/catalog/customer/discount access — added at the founder's
  explicit direction (v0.32, pre-Module-35-build) so a seller can hand a
  contracted designer store-design-only access without exposing business
  data; this is also the seller-side access model the future D-Studio
  designer-marketplace concept (roadmap-only, §5.22) will build on, not a
  new concept invented for that roadmap item.
- FR-52.3: **Scoped session, modeled on impersonation's shape.** A staff
  login issues a JWT carrying a `staffAccountId` and its scopes (same
  additive-field pattern as `JwtAccessPayload`'s existing
  `impersonatingAdminUserId`/`impersonationSessionId`), with an opt-in,
  scope-checking route decorator mirroring `@BlockDuringImpersonation()`'s
  pattern — a new, purpose-built mechanism following impersonation's
  proven shape, not a repurposing of impersonation itself.
- FR-52.4: **Audit-logged via the Platform Event Log.** Every write a
  staff session performs is tagged with its `staffAccountId` and recorded
  to the existing Platform Event Log (§14.23) — the seller-side
  equivalent of how `AdminAuditLog` tags admin/impersonation actions;
  `AdminAuditLog` itself stays reserved for platform-admin actions only.
- FR-52.5: **Plan-tier numeric limit, Settings-Registry-driven.** A new
  `staff.max_accounts` key (numeric, `allowedScopes` including `plan`)
  resolved via the identical `getPlanContext(sellerId)` pattern as
  FR-51.2/`catalog.product_limit` — creating a staff account beyond the
  seller's plan limit is blocked with the same "your plan's limit has
  been reached" pattern already established.
- FR-52.6: **Zero on the entry tier (revised v0.33 — no Free plan).** The
  First Month/Starter default is zero staff accounts (owner-only) — staff
  accounts are a paid-tier differentiator from day one, unlocked starting
  at Growth (`staff.max_accounts`'s plan-scoped default), never available
  below it.

### 5.53 Admin Email Section (new, v0.32 — UZEYN's own unified inbox in
the admin terminal; admin-global, not tenant-scoped)
- FR-53.1: **`AdminEmailAccount` model, admin-global.** Same "no RLS,
  gated by `AdminAuthGuard`, inherently precedes tenant context" category
  as `AdminAuditLog`/`ImpersonationSession` — this is the founder's own
  inbox, not a seller-facing feature.
- FR-53.2: **SMTP+IMAP credentials, encrypted at rest under their own
  independent key.** Mirrors `SellerVerificationEmail`'s AES-256-GCM
  `iv:authTag:ciphertext` encryption utility, keyed by a new
  `ADMIN_EMAIL_CREDENTIAL_ENCRYPTION_KEY` env var — same "rotates
  independently" convention the SMTP credential key already established
  relative to the Drive token key.
- FR-53.3: **Unified read/reply across multiple linked accounts.**
  IMAP fetch on demand/poll merges all linked accounts (e.g. support@,
  helpdesk@) into a single inbox list; a reply sends via that specific
  account's own SMTP credentials — the founder replies personally as
  themself from the correct address, never a generic platform sender.
- FR-53.4: **No AI in v1.0 — explicit scope cut, not a gap.** No
  summarization, suggested replies, or auto-triage. AI-assist for this
  section is a roadmap-only note (§5.22), documented now so the schema
  isn't redesigned later to add it.
- FR-53.5: **Every link/unlink audit-logged.** Linked accounts are
  admin-manageable (add/remove/test-connection) from a new admin terminal
  section; every change calls the existing `AuditLogService.record()` —
  this is a genuine admin action on an admin-scoped resource, distinct
  from Staff Accounts' seller-side Platform-Event-Log logging (FR-52.4).

### 5.54 Advanced Granular Admin Control (new, v0.32 — four narrow,
audit-logged admin actions beyond the existing suspend/ban ladder;
closes the gap `seller-lifecycle.service.ts`'s own doc comment already
disclosed)
- FR-54.1: **Block a seller from listing new products.** A new
  admin-settable per-seller Settings Registry flag
  (`catalog.listing_blocked`, `scopeType: "seller"`) — the seller-scope
  plumbing already exists in `PUT /admin/settings/values` per §3.8's
  precedence but had no exercised call site before this section — checked
  at product-creation time alongside the existing `catalog.product_limit`
  check. Does not affect the seller's already-listed products.
- FR-54.2: **Instant single-product suspend/remove.** Extends
  `ModerationStatus` (currently `not_required | pending | approved |
  rejected`, with no takedown state for an already-approved product) with
  a new `admin_removed` value; an admin can move any product straight to
  `admin_removed` regardless of its current status, immediately excluded
  by the same storefront-visibility WHERE clause the existing moderation
  filter already uses — no new visibility mechanism, one more value in an
  existing gate.
- FR-54.3: **Supplier-listed product block/approve.** Reuses the existing
  Moderation Queue (§5.27/Module 6) exactly as already built —
  supplier-sourced products already flow through the same
  `moderationStatus` gate (the supplier-listing moderation gap closed
  after Module 8); this section adds no new queue, only surfaces
  block/approve actions against supplier-attributed products from the
  admin terminal's product-detail view.
- FR-54.4: **Disable a specific feature per seller.** Generalizes
  FR-54.1's pattern: any existing boolean/numeric Settings Registry key
  that gates a feature can be admin-overridden at `seller` scope from the
  admin terminal's Seller 360 page (Module 25) — no new mechanism,
  exercising the Settings Registry's existing seller-scope precedence at
  the UI layer for the first time.
- FR-54.5: **Every action audit-logged with before/after values.** All
  four controls above call `AuditLogService.record()` with the
  seller/product id as target and the before/after state — same
  insert-only, no-UPDATE/DELETE-grant discipline as every other admin
  action.
- FR-54.6: **Additive to, not a replacement for, the existing
  `SellerLifecycleStatus` ladder** (§5.29's active → warned → restricted
  → suspended → banned). These are narrower, single-purpose controls (one
  seller's listing ability, one product, one feature) rather than a full
  account-level escalation.

### 5.55 Facebook/Instagram Shop Feed & WhatsApp Catalog Links (new, v0.33
— deep-audit Phase A item 6; two Growth+-gated capabilities, both reusing
existing machinery rather than building new integrations) — **BUILT,
Module 48**
- FR-55.1: **Meta-compatible product catalog feed.** A new,
  Meta-Commerce-Catalog-compliant feed endpoint, extending FR-24.9's
  existing Product Feed API field set to what Meta's own catalog format
  requires — `id`, `availability`, `condition`, `description`, `brand`,
  and an explicit `currency` field (the existing feed has none, PKR is
  implicit) — alongside the fields FR-24.9 already exposes
  (title/price/image/storefront URL). This ships as a **new** endpoint
  alongside FR-24.9's existing one, not a breaking reshape of it — that
  feed already serves a different, founder-owned Social Media SaaS
  product with its own consumer(s); this one is purpose-built for a
  seller to paste into Meta Commerce Manager themselves. Free — no paid
  Meta API tier required for a seller to self-connect their own feed URL.
- FR-55.2: **Plan-gated, Growth tier and above.** Access to the feed
  endpoint is gated via the Settings Registry `allowedScopes: ["plan"]`
  pattern FR-7.1's product-limit gating already established (the
  idiomatic template for every plan-gated feature in this SRS) — not a
  new gating mechanism. A First-Month or Starter seller's feed URL
  returns a clear "upgrade to Growth" response, never partial/degraded
  data.
- FR-55.3: **Tenant isolation, identical to FR-24.11's existing
  guarantee.** The feed is seller-scoped and rate-limited exactly like
  FR-24.9/24.11's existing Product Feed API — a feed token/URL scoped to
  seller A can never return seller B's products.
- FR-55.4: **WhatsApp product-share link (new fourth trigger point,
  extends §5.41).** A product-level "share on WhatsApp" deep link —
  reusing §5.41's exact `wa.me` link-construction utility and
  Settings-Registry-driven template mechanism (FR-41.1/41.3) — generated
  from a product's own page/editor, with a pre-filled message
  (product name, price, storefront URL) interpolated in. This is a
  **fourth** generator alongside FR-41.1's existing three (order
  confirmation, shipping update, cart recovery) and, unlike all three of
  those, is **not** tied to an existing `Order`/`Cart` row — it is
  reachable for any published product at any time, gated Growth+ per
  FR-55.2's mechanism.
- FR-55.5: **Full WhatsApp Business API catalog sync remains
  roadmap-only, unchanged.** FR-41.4's existing deferral of a paid,
  Meta-gated, automated WhatsApp Business API send/catalog-sync sequence
  is unaffected by FR-55.4 — the product-share link is a free,
  seller-clicked convenience, not a step toward automation.

**Implementation notes (Module 48):** `GET external/social-media/
meta-catalog-feed` ships as a new endpoint alongside the existing `GET
external/social-media/product-feed` (unchanged route, unchanged shape,
still ungated) in `ProductFeedController`/`ProductFeedService` — same
bearer-token auth, same RLS tenant-isolation (FR-55.3), a shared private
`resolveToken()` extracted so both endpoints validate identically without
duplicating the auth/revocation/disabled-client checks. The new feed adds
`id`/`availability`/`condition`/`description`/`brand`/`currency`:
`availability` is derived (`trackInventory === false || stockQuantity >
0` → "in stock"), `condition` is a constant `"new"` (no schema field
tracks used/refurbished — nothing else needed one), `brand` reuses
`Store.name` (no separate manufacturer-brand field exists on `Product`),
`currency` reuses the already-existing `Store.currency` column. Gated via
a new `social_media.meta_catalog_feed_enabled` key (`allowedScopes:
["global","plan"]`, same FR-7.1 idiom), own rate-limit key
(`external_api.meta_catalog_feed_rate_limit_per_hour`) so the two feeds
never share a budget. FR-55.4's product-share link extends
`buildWhatsAppDeepLink()` to accept a nullish phone (omits the recipient
segment — `wa.me/?text=...` opens WhatsApp's own share picker, since
unlike the three Order/Cart-scoped triggers there is no captured buyer
number to address it to) and adds `WhatsAppMessagingService.
generateProductShareLink()` as the fourth generator, following the exact
same fetch/validate/template-interpolate/build-link shape as the existing
three, behind its own `whatsapp.product_share_enabled` gate (own key,
same RISE+FLY/Growth+ boundary as the Meta feed gate — FR-55.4's "gated
Growth+ per FR-55.2's mechanism" read as "same pattern," not "literally
the same key across two unrelated owning modules," matching this SRS's
standing "own key, shared boundary" precedent from Modules 76/77). Both
gates' values are set in `plans.seed.ts`'s existing tierOrder >= 2 loop,
alongside the other RISE+FLY gates it already sets (`teams.
leader_eligible` etc.) — Growth is "RISE" under the GO/RUN/RISE/FLY
rename (FR-7.22). No new dashboard UI — the founder scoped this as the
final backend/feature module before the UI/UX design phase; the feed
consumer is external (the Social Media SaaS/Meta) and the product-share
button's placement is left to that phase, same as every other
already-built-but-not-yet-designed dashboard surface. Proven by new
`module48-social-commerce-links.e2e-spec.ts`: Meta feed returns the
extra fields correctly for a RISE seller and stays tenant-isolated; a
GO/RUN seller is rejected with a clear upgrade message on the new feed
while the pre-existing, ungated product-feed endpoint is unaffected;
product-share link generation is gated identically, omits the phone
segment, rejects a draft product, and honors a seller-edited template.

---

### 5.56 Multi-Store Per Seller (new, v0.34 — Professional Seller Readiness
item 1; plan-gated)
- FR-56.1: **Plan-tier store-count limit.** A new Settings Registry key
  `stores.max_per_seller` (`allowedScopes: ["global", "plan"]`), seeded per
  tier — First Month/Starter: 1, Growth: 2, Pro: 3-5 (founder to pick the
  exact Pro ceiling at seed time) — resolved via
  `SubscriptionsService.getPlanContext(sellerId)` exactly like FR-52.1's
  `staff.max_accounts` (per-seller-scoped count, not per-store), and
  enforced as a new check in `StoresService.create()`, which today only
  checks slug uniqueness. A seller at their limit gets a clear "upgrade to
  add another store" response, never a silent failure.
- FR-56.2: **Tenant isolation holds per store, unchanged.** Confirmed by
  research, not newly built: `TenantPrismaService.run()` keys RLS off
  `sellerId`, and every per-store service method already does its own
  explicit `store.sellerId === sellerId` application-layer check inside the
  RLS-scoped transaction. A seller with 2+ stores already cannot leak one
  store's data into another's dashboard view today — this FR is a
  confirmation, not new work, and exists so a future refactor can't
  silently weaken it (same discipline as FR-RLS-defense-in-depth from
  Phase B item 4).
- FR-56.3: **Store switcher.** A new dashboard UI element (not present
  today) that calls the already-existing `GET /stores` endpoint
  (`StoresService.listOwn`) and lets a seller switch between their stores
  without re-authenticating — the URL structure
  (`/stores/[storeId]/...`) already supports this; only the switcher
  affordance itself is new.
- FR-56.4: **Per-store settings/limits are unaffected.** Product limits
  (`catalog.product_limit`), payment instructions, theme, and every other
  store-scoped Settings Registry value remain independently resolved per
  `storeId` — multi-store does not pool or share any per-store limit
  across a seller's stores unless a specific FR says otherwise (it
  doesn't). One exception, already true today and unchanged: the wallet is
  per-seller, not per-store (§14.6e), by original design.

### 5.57 Product Organization at Scale (new, v0.34 — Professional Seller
Readiness item 6, built ahead of §5.58 since both touch the product list)
- FR-57.1: **Free-form product tags.** New `Product.tags String[]
  @default([])` column with a GIN index (`idx_products_tags`), seller-
  defined and dashboard-private by default (not automatically exposed on
  the public storefront — see FR-57.4 for the explicit opt-in). Distinct
  from the existing `Order.tags` field (FR-17.3) and from `Collection`
  (FR-2.5's curated, page-having groupings) — tags have no dedicated page,
  are lightweight labels only.
- FR-57.2: **Dashboard product-list filters.** SKU/title search, tag
  filter, stock-status filter (in/low/out — reusing Module 28's existing
  `inventory.low_stock_threshold`-driven computation, no new threshold
  logic), price range, category, and moderation state — none of which
  exist on `ProductsService.list()` today (it is an unfiltered,
  unpaginated `findMany`). Pagination added at the same time (`page`/
  `limit`, matching Phase B item 3's `WalletService` pagination shape:
  `{items, page, limit, total, totalPages}`).
- FR-57.3: **Filters compose.** All filters (FR-57.2) can be combined in a
  single request (e.g. tag + stock-status + price-range together), with a
  live result count — this is also what §5.58's bulk-operation
  confirmation step relies on to show an accurate "N items will change"
  count for a filtered selection.
- FR-57.4: **Storefront tag exposure is a seller opt-in, off by default.**
  If a seller wants tags to double as a public storefront filter (extending
  the existing raw-SQL `StorefrontService.search()` the same way its
  `collectionId` `EXISTS` clause already works), that is a separate,
  explicit per-tag or per-store setting — tags are private/dashboard-only
  until a seller turns this on, since public exposure has different
  index/performance and content-moderation implications than a private
  organizational tool.

### 5.58 Bulk Product Operations (new, v0.34 — Professional Seller Readiness
item 2)
- FR-58.1: **Multi-select on the (now filterable, per §5.57) product
  list.** Select-all, select-page, and individual checkboxes, mirroring
  the admin moderation queue's existing selection-state pattern
  (`apps/web/app/(admin)/admin/moderation/page.tsx`) as the UI template.
- FR-58.2: **Bulk actions.** Price update (fixed amount or percentage,
  applied to every variant of every selected product), stock update,
  category/collection assign, publish/unpublish, archive/delete, tag
  assign (§5.57). Implementation reuses the existing single-item
  `ProductsService`/`ProductVariantsService` endpoints via a client-side
  fan-out (the admin moderation queue's own precedent — no new
  bulk-specific backend endpoint per action), so every bulk write passes
  through the exact same moderation gate, plan-limit check, and audit
  trail a manual single-item edit already does. Per-item failures are
  reported individually (a bulk action is not all-or-nothing at the
  network layer — each item's own endpoint call succeeds or fails on its
  own merits, and the UI reports which).
- FR-58.3: **Closes a pre-existing moderation gap, for both single-item
  and bulk edits.** `ProductsService.update()` today never re-checks
  moderation on a `status` (publish) or price change — this was true
  before this amendment and is not a bulk-operations-specific bug, but
  bulk operations multiply its exposure (mass-publish, mass-price-change).
  This FR adds a moderation re-check (reusing
  `decideModerationStatus()`/the existing keyword/restricted-category
  logic, not a new engine) to the shared update path both single-item and
  bulk edits go through — closing the gap once, for both.
- FR-58.4: **Confirmation step.** Before any bulk action executes, the UI
  shows the exact count and a short preview (e.g. first 5 affected product
  titles) of what will change, and requires an explicit confirm — no bulk
  action fires from a single click with no confirmation, matching the
  admin moderation queue's existing reason-before-reject discipline for
  destructive actions.
- FR-58.5: **Plan limits still apply.** A bulk publish/duplicate/move
  operation that would push a store over `catalog.product_limit` is
  rejected per-item (with a clear count of how many succeeded vs. were
  blocked by the limit), never silently over-limit.

### 5.59 Bulk Order Operations, Tracking Entry & Advanced Search (new,
v0.34 — Professional Seller Readiness item 3)
- FR-59.1: **`Order.orderNumber`, new schema.** A per-store sequential,
  human-readable identifier (e.g. `#1042`), backfilled for all existing
  orders by `placedAt` order per store, unique per `(storeId,
  orderNumber)`. Orders are addressed by UUID only today — this is a
  prerequisite for FR-59.4's CSV upload, where a seller needs something
  they can actually read and type, not a raw UUID.
- FR-59.2: **Bulk order actions.** Multi-select on the orders list →
  bulk mark-as-paid, bulk status change, bulk fulfill. Each selected order
  is individually routed through the existing `OrdersService.markAsPaid()`
  / tracking / fulfillment methods — never a bare `updateMany` — because
  those methods are the sole place commission accrual
  (`LedgerService.accrueCommission`), customer stats
  (`CustomersService.recordCompletedOrder`), and the Financial Truth
  Invariant's `order.placed` event all fire; a bulk action that bypassed
  them would silently break P&L, commission, and analytics for every order
  in the batch.
- FR-59.3: **Three tracking-entry paths, all three, same underlying
  write.** (a) CSV upload mapping `orderNumber → courier, trackingId`,
  parsed via the existing `csv.util.ts`/`import-jobs.service.ts`
  machinery (modeled on the ad-spend-import bulk-upsert shape, the
  simplest existing analog), each row calling the existing
  `uploadTracking()` per order-item; (b) inline quick-entry directly in
  the orders list — type, tab, next row, no page reloads, same
  `uploadTracking()` call per row on blur/tab; (c) the existing per-order
  detail entry, unchanged. Because an order can have multiple items, a CSV
  row or quick-entry row applies its courier/tracking to every
  not-yet-shipped item on that order — a seller who needs different
  couriers per item on one order still uses path (c).
- FR-59.4: **Advanced order search/filters.** Date **and time** range
  (not date-only), status, payment state (from `Payment.status`),
  verification state (from `OrderVerification.status`), courier, customer,
  amount range — combinable, each returning a live result count. None of
  this exists today (`?status=`, `?bucket=`, `?tag=` only, no date
  filtering, no pagination on the list endpoint) — pagination added at the
  same time, same shape as FR-57.2.
- FR-59.5: **First formal order-status transition map.** Adding
  `refunded`/`partially_refunded` (§5.60) safely requires this module to
  introduce the first centralized allowed-transitions structure for
  `Order.status` — today transitions are ad hoc per-method preconditions
  (`markAsPaid` only proceeds from `pending`, `editOrder`'s
  `EDITABLE_STATUSES`, etc.), which was sufficient while every transition
  was linear/one-directional. This map is what FR-59.2's bulk status
  change validates against, and what §5.60 extends.

### 5.60 Returns & Refunds Workflow (new, v0.34 — Professional Seller
Readiness item 4, launch-critical; promotes and completes the
`return_requests` table already reserved in `docs/database-schema.md`'s
v1.1-ahead section, formerly deferred FR-22.3)
- FR-60.1: **`ReturnRequest`, new schema.** `id, storeId, orderId,
  buyerReason, status (requested/approved/rejected/completed),
  requestedAt, resolvedAt, resolvedBy (nullable FK, admin or seller
  actor), refundAmount (Decimal, may be less than order total — partial
  refunds), refundedItems (which order items/quantities are covered),
  sellerNote, adminOverride (bool)` — the exact shape
  `database-schema.md` already reserved, extended with the partial-refund
  fields the founder's spec adds.
- FR-60.2: **Buyer-initiated return request.** A new action on the
  existing public order-status page, modeled directly on FR-14.1's review-
  submission Server Action (same reasons: avoids the per-tenant-subdomain
  CORS problem, keeps the mutation server-to-server) and the same
  Financial Truth Invariant gate reviews already use — only a confirmed
  (actually paid) order can have a return requested against it.
- FR-60.3: **Seller approve/reject with reason.** Extends FR-59.5's new
  transition map: `requested → approved` or `requested → rejected`, seller-
  actioned, reason required on reject (same discipline as the admin
  moderation queue's reject-reason requirement).
- FR-60.4: **Refund recorded via compensating ledger entry — the
  Financial Truth Invariant's reversal path.** On `approved →
  completed`, a new `refund_adjustment` `LedgerEntry` (an enum value that
  has existed in the schema since v1.0 but was never wired into
  `WalletService`'s `DEBIT_TYPES`/`CREDIT_TYPES` sign-convention sets —
  this FR closes that gap) is posted through `WalletService.
  postLedgerEntry()` (never a raw `LedgerEntry.create`, to keep the
  `WalletBalance` running-total cache correct), sized to reverse the
  commission portion of the refunded amount, mirroring
  `LedgerService.waiveCommission()`'s existing negative-entry-against-a-
  specific-`orderId` pattern. A compensating decrement is also applied to
  `Customer.ordersCount`/`totalSpent` (no reversal counterpart exists on
  `CustomersService` today — this FR adds one). `Order.status` moves to
  `refunded` (full) or `partially_refunded` (FR-60.1's `refundAmount` <
  order total), both **excluded** from `PnLService`'s and
  `UnitEconomicsService`'s existing `CONFIRMED_OR_BEYOND`-style gates, so
  a refunded order stops counting as revenue in P&L, unit-economics, and
  analytics (§5.61) at the same instant the ledger reversal lands — one
  signal, applied uniformly, per §3.12.
- FR-60.5: **Admin override.** An admin can approve/reject/complete a
  return request regardless of the seller's own decision (or lack of one),
  audit-logged with before/after values, same discipline as every other
  admin override in this SRS (e.g. FR-54.4).
- FR-60.6: **Status visible to buyer.** The public order-status page (and
  its shared `computeOrderTimeline()` function, extended with a new
  `returned`/`refunded` timeline stage rather than a second parallel
  status source) reflects the return's current state.

### 5.61 Analytics Depth (new, v0.34 — Professional Seller Readiness item
5, seller-facing; slotted after §5.60 since return rate needs return data
to exist)
- FR-61.1: **Top products by revenue/units.** New `OrderItem.groupBy`
  aggregation (`by: ["productId"], _sum: {unitPrice, quantity}` joined to
  product title) — the same idiom Module 17's existing top-sellers-by-
  commission query already uses, applied to a new dimension. No new
  schema.
- FR-61.2: **Sales over time, charted (day/week/month).** New time-
  bucketed aggregation on `Order.placedAt`/`totalAmount` — genuinely new
  query code; neither Module 17's admin analytics nor Module 31's P&L
  engine has any bucketing logic today (P&L returns one aggregate total
  per requested range, not a series).
- FR-61.3: **Repeat-customer rate.** Derived directly from the existing
  `Customer.ordersCount`/`totalSpent` columns (`count(ordersCount >= 2) /
  count(*)`, store-scoped) — no new schema, Module 33 already maintains
  these live.
- FR-61.4: **Return rate, overall and per product.** `count(ReturnRequest
  in ["approved","completed"]) / count(Order)`, overall and grouped by
  the returned order's items' `productId` — depends on §5.60 existing.
- FR-61.5: **Average order value, best sales days/times.** AOV = average
  `totalAmount` over confirmed-or-beyond orders in a period; best
  days/times = the same time-bucketing as FR-61.2, bucketed by day-of-week
  / hour-of-day instead of calendar period.
- FR-61.6: **Charts, not spreadsheets — Simplicity Invariant (§3.13).** A
  new charting library is introduced (none exists in `apps/web` today —
  both existing "analytics" surfaces are plain HTML tables); the seller-
  facing analytics page renders charts for FR-61.1/61.2/61.5 and simple
  stat tiles for FR-61.3/61.4, not raw tables.
- FR-61.7: **Financial Truth Invariant applies uniformly here too.** Every
  query in this section applies the same `status: {not: "pending"}` (or
  P&L's stricter `CONFIRMED_OR_BEYOND`) filter already binding elsewhere —
  a new analytics surface is not a place that invariant quietly stops
  applying.

### 5.62 Seller Notifications (new, v0.34 — Professional Seller Readiness
item 7; slotted after §5.61 since the daily sales summary reuses its
queries)
- FR-62.1: **Transactional emails, all four genuinely new.** New-order
  alert (immediate, to the seller — order emails today only ever go to
  the buyer), daily sales summary (built on §5.61's new time-bucketed
  queries), low-stock alert (Module 28's `isLowStock` computation exists
  today for dashboard display only — this wires it to an email trigger on
  the relevant stock-quantity change), payment/verification events
  (extends the existing `sendDormantStoreWarning`/
  `sendWalletLowBalanceWarning` account-health-email pattern in
  `email.service.ts` to order-payment/verification events specifically).
- FR-62.2: **Admin-composed platform newsletter.** Informational only
  (updates, tips, announcements), sent from the admin terminal, 2-3/week
  cadence expected but not rate-limited by the system beyond the existing
  admin-action rate limits. Modeled on Module 34's background-job-send +
  unsubscribe-token infrastructure, but sent from the **platform's own**
  SMTP identity, not a seller's connected mailbox — a new code path, not a
  reuse of Module 36's admin inbox (which is 1:1 personal reply only, no
  broadcast capability, despite the adjacent naming).
- FR-62.3: **Per-seller opt-out.** New `SellerNotificationPreference`-
  style fields (or a small dedicated table) — no seller-side notification-
  preference model exists today; `Customer.unsubscribedAt` is the closest
  analog and belongs to a different audience (Module 34's customer
  campaigns). Newsletter opt-out is independent per seller and does not
  affect transactional emails (FR-62.1), which are not opt-outable (they
  concern the seller's own store operations).
- FR-62.4: **Templates editable via Settings where sensible.** Extends the
  Settings Registry's existing `valueType: "string"` capability to hold
  email-template bodies for the newsletter and, where practical, the
  transactional templates — this is a new use of an existing mechanism,
  not a proven template-specific pattern in this codebase yet (every
  current email body, e.g. `email.service.ts`, `invoice-template.ts`, is a
  hardcoded template-literal function).

### 5.63 One-Click Full Export, Pro Gate (new, v0.34 — Professional Seller
Readiness item 8)
- FR-63.1: **No new export engine.** Module 24's `data-export.service.ts`
  already bundles products + orders + customers + inventory into one
  on-demand export with Drive-upload-or-email-fallback delivery — exactly
  what this item asks for. This FR is exposure/gating only.
- FR-63.2: **Pro-tier plan gate.** `requestOnDemandExport()` today enforces
  only a time-based cooldown (`data_export.on_demand_min_interval_hours`,
  resolved with no plan context at all). This FR injects
  `SubscriptionsService.getPlanContext(sellerId)` and adds a new Settings
  Registry key (`allowedScopes: ["global", "plan"]`, mirroring
  `email_campaigns.monthly_send_limit`'s seed shape) gating the endpoint
  to Pro tier and above, checked before the existing cooldown check. A
  sub-Pro seller gets a clear upgrade prompt, not a degraded export.

### 5.64 Invoice/Receipt Customization, limited (new, v0.34 — Professional
Seller Readiness item 9)
- FR-64.1: **New `Store` fields.** `taxNumber` (NTN or equivalent),
  `invoiceFooterText`, `invoiceTermsText` — all optional, seller-editable
  via the existing store settings screen pattern. Confirmed absent from
  schema today (no tax/NTN, footer, or terms field exists anywhere).
- FR-64.2: **`Seller.businessName` wired into the invoice template.** The
  field already exists on `Seller` but is currently unused by
  `invoice-template.ts` — this FR renders it (seller-controlled business
  name, distinct from the store's own display name) alongside the new
  FR-64.1 fields when present.
- FR-64.3: **Logo unchanged.** `Store.logoMediaId` already renders on
  invoices today (Module 15.5) — no new mechanism needed, confirmed by
  research.
- FR-64.4: **UZEYN branding stays mandatory and non-removable, every plan
  tier.** None of FR-64.1-64.3's seller-controlled fields can hide,
  replace, or crowd out the platform's own invoice branding — this is a
  hard constraint on the template renderer itself, not a per-plan toggle.
  Sellers control their own details only, never the platform's.

### 5.65 Advanced Store SEO Control (new, v0.34 — Professional Seller
Readiness item 10; plan-gated where sensible)
- FR-65.1: **Extends the existing SEO fallback cascade, not a second
  resolver.** `resolveSeoFallback()` is already this SRS's binding "one
  set of SEO data, no parallel copy" mechanism (FR-16.6) — every new field
  below is added to its cascade, at `Product`, `Collection`, and new
  store-level defaults on `Store`, not a competing lookup path.
- FR-65.2: **New per-item fields:** canonical URL override, robots
  directives (index/noindex, follow/nofollow — per product/collection, not
  just the store-wide `robots.ts` default that exists today), OG/social-
  share image override (new field, referencing the existing `MediaAsset`
  pipeline) + OG title/description override (independent of
  `seoTitle`/`seoDescription`, which already exist and remain the plain-
  meta-tag source), structured-data toggle (on/off per item — the
  JSON-LD block already exists per FR-16.6, this makes emitting it
  optional), sitemap-inclusion toggle (per product/collection — `sitemap.
  ts` already exists and is dynamic; this adds a per-item include/exclude
  a seller can set).
- FR-65.3: **Custom URL slugs.** `Collection.slug` already exists and is
  already seller-set at creation (confirmed by research) — this FR adds
  an update path if the current API lacks one. `Product.slug` is genuinely
  new: a nullable, unique-per-store column, additive only — v1.0's
  `/storefront/products/[productId]` UUID route is **not** replaced or
  redirected; a slug is a canonical-URL/SEO enhancement layered on top,
  not a routing migration. Scope deliberately bounded here — a full
  slug-based-primary-route migration is out of scope for this FR.
- FR-65.4: **Sanitized custom head-tag field, store-scoped.** A raw HTML
  field for arbitrary `<head>` injection (e.g. a third-party verification
  meta tag), sanitized to an explicit allowlist —
  `meta`, `link`, and `script[type="application/ld+json"]` only, every
  other tag and every inline event handler stripped, using a new
  sanitization dependency (no HTML-sanitization utility exists anywhere in
  this codebase today; `ContentPage.bodyHtml`, the nearest precedent,
  renders admin-authored HTML completely unsanitized, an acceptable trust
  boundary for admin-only input and not an acceptable one for seller
  input that reaches a buyer's browser). Scoped to the **store** level,
  not per-product, to keep both the sanitization surface and the settings
  UI bounded — a seller who needs page-specific structured data uses
  FR-65.2's per-item structured-data toggle instead.
- FR-65.5: **Plan-gated where sensible.** The basic per-item meta title/
  description (already existing, unchanged) stays available to every
  tier; canonical URL, robots directives, OG override, structured-data
  toggle, sitemap control, custom slugs, and the custom head-tag field are
  gated Growth+ via the same Settings-Registry plan-gating pattern used
  throughout this SRS (FR-7.1's template), consistent with this batch's
  overall "Growth/Pro sellers are the paying, professional audience"
  premise.

### 5.66 Buyer Experience Batch (new, v0.39 — founder-approved after Parts A/B's subscription-only decision; Modules 81-88)
Eight buyer-facing improvements, each reusing an existing mechanism where
one exists (Module 24's Drive storage, Module 27's Orders Command Center,
Module 55's notification hooks) rather than inventing a parallel one.
Explicitly NOT building, per the founder's directive: frequently-bought-
together, SMS order confirmation (no SMS channel exists, §5.6j FR-6.53),
AI store design, or a customizable/build-your-own plan (§5.6j).

- FR-66.1 (Module 81): **Optional buyer accounts.** Guest checkout stays
  the default path, unchanged. A buyer may optionally create an account
  (signup/login, separate identity space from `User`/seller auth) for
  order history, saved details, and faster reorder — never a requirement
  to complete a purchase.
- FR-66.2 (Module 82): **Product reviews with media.** Extends §5.14's
  review model with up to 3 photos + 1 video per review (capped size,
  e.g. 12MB), stored via the seller's connected Google Drive (Module 24's
  existing storage path, not a new object-storage integration) with a
  generated video thumbnail. The existing moderation queue (§5.27)
  extends to cover review media, not a second queue.
- FR-66.3 (Module 83): **Live chat widget.** On-site buyer-seller chat,
  a distinct surface from the existing WhatsApp button (§5.41) — real-
  time-feeling (poll or a lightweight push mechanism, not necessarily a
  new WebSocket infrastructure investment), with a "seller is away"
  fallback state. Plan-gated (§5.6j's feature-gate ladder, FR-7.23).
- FR-66.4 (Module 84): **Shipping cost calculator**, visible on product
  and cart pages, not only at checkout — reuses whatever shipping-rate
  computation checkout already performs, surfaced earlier in the buyer
  journey.
- FR-66.5 (Module 85): **Wishlist / save for later**, plan-gated the same
  way as the live chat widget (FR-66.3).
- FR-66.6 (Module 86): **Stock countdown** — a low-stock urgency
  indicator on product pages, reading the existing inventory count
  (§5.39), no new tracked field.
- FR-66.7 (Module 87): **Image zoom + product video with thumbnail** on
  the product detail page.
- FR-66.8 (Module 88): **Order tracking page polish, plus a
  missing-tracking alert.** Tracking-ID upload responsibility is
  unchanged and stays split exactly as already built: a supplier-
  fulfilled item's tracking ID is uploaded only by the supplier
  (`SupplierOrdersService`); a self-fulfilled item's only by the seller
  (`OrdersService`). New: if an order has been confirmed/paid for more
  than a Settings-configurable window (`orders.missing_tracking_alert_hours`,
  default 24) with no tracking uploaded on any of its items, the
  responsible party (seller or supplier, per item) is notified via their
  existing notification channel (§5.10/§5.41), and the order surfaces as
  a flagged/overdue state in the Orders Command Center (§5.38) — re-
  checked on a schedule, the alert persists until tracking is uploaded or
  the order is otherwise resolved (cancelled/refunded). The buyer-facing
  tracking page keeps a clean status timeline with UZEYN branding,
  unchanged in mechanism.

### 5.67 Deals & Bundles (new, v0.42 — founder-approved after a live
walkthrough of the built system; Module 91)
A seller-created promotion grouping several of their own products/variants
under one storefront listing at a uniform percentage discount (e.g. "Steal
Deal — 20% off all 5"). Deliberately reuses existing, already-hardened
mechanisms rather than building a parallel commerce path: the checkout
pipeline (§5.9's cart/checkout flow) and the same atomic stock-decrement
guard used everywhere else stock is reserved (Module 46's oversell-
protection logic, §14.39a). Per-item (non-uniform) discounts within a
single deal — e.g. 30% off item A but 10% off item B in the same deal —
are explicitly out of scope for this build and are logged as a documented
v1.1/roadmap enhancement; the uniform-percentage model is what the
founder-approved data model covers for launch.

- FR-67.1 (Module 91): **Deal data model.** A new store-scoped `Deal`
  (id, storeId, title, slug, description, thumbnailMediaId,
  `discountPercent` — one uniform percentage off for the whole deal,
  status: draft/active/archived, optional `startsAt`/`endsAt`) and
  `DealItem` (id, dealId, productId, variantId, sortOrder; unique on
  `[dealId, variantId]`) join table, mirroring `DiscountCode`'s existing
  store-scoped-uniqueness shape (§5.7) rather than inventing a new
  pattern. The discount is **live-computed** against each variant's
  current price at purchase time — never a frozen/snapshotted price — so
  a seller's later price edit on a deal product is reflected immediately,
  consistent with how the rest of the catalog prices are read.
- FR-67.2 (Module 91): **Buy-now purchase flow.** A new
  `POST /storefront/deals/:dealId/buy-now` endpoint pre-populates a cart
  with every `DealItem` in the deal at its live discounted price, then
  hands off into the existing checkout flow (§5.9) unchanged — no
  parallel order-creation or payment-verification code path. Per-item
  stock is checked through the same atomic guard as any other order line
  (Module 46); if any single item in the deal is out of stock, the whole
  deal purchase is blocked rather than silently partial-fulfilling it.
  `Order` gains an optional nullable `dealId` FK, the same pattern as the
  existing `discountCodeId` link (§5.7), so a completed order can be
  traced back to the deal that produced it.
- FR-67.3 (Module 91): **Storefront surfaces.** A buyer-facing deal
  listing page (active deals for the store) and a deal detail page
  showing the bundled items, the uniform discount, and a single buy-now
  action — both reusing existing storefront rendering/theme conventions
  (§5.4) rather than a one-off template.
- FR-67.4 (Module 91): **Seller dashboard management.** A Deals
  management view (under the existing Products hub) for creating,
  editing, and archiving deals and their line items, plus a filter chip
  on the product list ("in an active deal") so a seller can see at a
  glance which of their products are currently bundled.
- FR-67.5 (Module 91): **Analytics.** A deal-performance card on the
  seller Analytics page (§5.54) — units sold and revenue attributable to
  `Order.dealId`, reusing the existing analytics query/chart
  infrastructure rather than a bespoke reporting path.

### 5.68 Admin-Configurable, Lockable Brand Color Tokens (new, v0.43 — founder
batch item A6; Module 92)
Directly motivated by a real incident: during A2's brand-palette rollout, the
platform's `--color-ink` token was mistakenly set to the same hex as
`--color-accent` — body text and the one-restrained-accent-only interactive
color became indistinguishable, a regression the founder caught by eye and
that was only fixed by hand-editing `globals.css` again. This module gives
admin a supported way to change the platform's core brand colors **without a
deploy**, and — the part that directly prevents a repeat of the incident — a
way to **lock** a token once its value is right, so it can't be silently
changed again by a future edit. Deliberately reuses the existing Settings
Registry (§3.8) rather than building a parallel config system: these are
Settings Registry keys like any other, just a new `color` value type and one
new safety mechanism (locking) layered onto the existing resolve/write path
every other tunable already goes through.

- FR-68.1 (Module 92): **Scope — the 13 core neutral/accent tokens, light
  mode only.** Registered as thirteen new global-scope-only
  `SettingsDefinition` rows under the `design.color.*` key prefix (canvas,
  surface, surface_raised, border, border_strong, ink, ink_muted, ink_faint,
  accent, accent_hover, accent_active, accent_subtle, on_accent), each
  mapping 1:1 to the CSS custom property of the same purpose in
  `globals.css`'s `@theme` block. **Explicitly excluded, same as A2's own
  scope note:** semantic/status colors (success/warning/danger/info) and the
  per-seller cosmetic dashboard-accent presets (emerald/amber/rose) —
  functional signals and a separate seller-facing feature, not brand chrome.
  Dark-mode tokens are out of scope for this pass too — dark mode has no UI
  toggle yet (§CSS comment, "not wired to a manual toggle"), so there is no
  live surface for an admin override to matter on yet; extending this
  mechanism to the dark-mode block is a natural follow-up once dark mode
  itself ships, not before.
- FR-68.2 (Module 92): **New `color` Settings Registry value type.** Extends
  the existing `SettingsValueType` enum (boolean/number/string/json) with
  `color`; `SettingsService`'s value validation rejects anything that isn't
  a 6-digit `#rrggbb` hex string for a `color`-typed key, the same
  fail-before-it-reaches-the-database discipline §3.8 already applies to a
  numeric setting's min/max. Every `design.color.*` definition is seeded
  `requiresConfirmation: true` (FR-8.16) — changing a platform-wide brand
  color is exactly the "high-impact key" category that mechanism exists for.
- FR-68.3 (Module 92): **Locking (new Settings Registry capability, not
  color-specific).** A `locked` boolean on `SettingsValue` (not the
  definition — a per-scope-override property, defaulting `false`).
  `SettingsService.setValue()` rejects a write to a locked row outright
  (409) regardless of which key it is — a genuinely general Settings
  Registry safety mechanism, exposed via UI for `design.color.*` keys only
  in this pass, exactly as A2's own hardcoded-defaults-now/admin-UI-later
  split was scoped. Locking a token that has no override yet pins its
  current effective value as an explicit global override at the moment
  it's locked (so "locked" always means "this exact value, unconditionally,
  until unlocked" — never an ambiguous "locked at some undefined value").
  Unlocking is the more consequential of the two actions (it removes a
  safety rail) and requires the same admin-confirm-dialog step as any other
  FR-8.16 high-impact change; locking itself is one click. Both actions are
  audit-logged (`settings.lock`/`settings.unlock`, before/after `locked`
  state) — same `admin_audit_logs` mechanism, not a parallel log.
- FR-68.4 (Module 92): **Runtime application — no deploy required.** A new
  public, unauthenticated `GET /design-tokens` endpoint (parallel precedent:
  `StorefrontDealsController`'s public, unauthenticated shape) returns only
  the `design.color.*` keys that currently have an active global override
  (resolved value differs from the seeded default) as a flat
  `{ cssVarName: hex }` map — the common case (no admin override set) is an
  empty response, zero extra payload, zero visual change, reusing
  `SettingsService.resolve()`'s existing Redis cache rather than a new
  caching layer. The root layout (`app/layout.tsx`, a Server Component,
  wrapping every route — marketing, storefront, dashboard, admin, and the
  A1 login pages alike) fetches this once per render and, only when the
  response is non-empty, inlines a `<style>` tag overriding the affected
  `:root` custom properties — first paint already reflects the override,
  no client-side flash-then-repaint. A failed or slow fetch degrades to
  "render nothing extra" (the platform's static default colors), never a
  broken or blank page — the same non-blocking-degradation discipline
  §3.11 requires of Platform Event Log writes, applied here to a fetch
  instead of a write.
- FR-68.5 (Module 92): **Admin UI — preview, override, lock.** A new
  `/admin/design-tokens` screen (Platform nav group, alongside Settings
  Registry/Audit log/External API clients) listing all thirteen tokens as a
  swatch grid: current effective value, a hex input, a live client-side
  preview panel (a sample heading/body-text/button/badge that recolors
  instantly as the admin edits a candidate value — before anything is
  saved, so a mistake is caught before it ships, not after), and a
  Lock/Unlock control per token. Saving a value reuses the existing
  Settings Registry write endpoint and its FR-8.16 confirm-dialog flow
  unchanged — this screen is a curated, purpose-built view over the same
  mechanism every other settings key already goes through, not a
  parallel write path.

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Storefront pages should target sub-2s first contentful paint via CDN + edge caching of static assets |
| Scalability | Architecture (modular monolith + row-level tenancy + statelessness principle, §3.1) must support scaling to a multi-VPS deployment without an application rewrite — verified module-by-module in §3.6 |
| Security | See §6.5 (expanded below) |
| Availability | Automated daily DB backups + point-in-time recovery, plus a MinIO data-directory backup, stored **off the primary VPS**, with a documented and periodically-tested restore runbook |
| Maintainability | CI/CD pipeline, versioned + backward-compatible migrations, feature flags, a same-VPS staging environment mirroring production, rollback runbook |
| Usability | Non-technical sellers must be able to fully customize a store without support tickets; dashboards must be usable on mobile |
| Internationalization | No hard-coded UI strings or currency/date formatting outside a translation-key/locale layer, from v1.0 (§3.9) — RTL/Urdu later is content work, not a rewrite |
| **Buyer-facing polish** | The storefront, PDF receipts/invoices (FR-19.2), the order-status page, and transactional emails are held to the **same premium visual bar as the marketing site** (§5.0, §13) — "luxury feel" extends to every surface a *buyer* sees |
| Cost efficiency | Self-host-first by default (§9); every recurring third-party dependency justified against a self-hosted/build-in-house alternative; **every feature added since v0.4, including both v0.6 SaaS hooks, is plain Postgres tables + application code + a small API surface — none of it adds infrastructure cost**, reconfirmed in this revision |
| **Client/mobile-app readiness (new)** | The API (`apps/api`) is the single source of truth for every business rule; `apps/web` is a client of it, not a place logic can hide. No app work ships in v1.0 — this NFR only guarantees that Phase 4 mobile apps (§10) are a new client, not an API/business-logic rewrite (§2.5) |

### 6.5 Security & Compliance (expanded)
- **Multi-tenant isolation:** enforced at both the application layer (mandatory
  scoping middleware) and the database layer (Postgres RLS as a backstop), with an
  automated cross-tenant-access test suite as a release gate (§3.2). This covers
  every tenant table added through v0.6, with no exceptions.
- **Permission boundaries:** a supplier's session can only ever query orders/
  listings for stores it holds an active `StoreSupplierLink` to; a seller can never
  see another seller's supplier relationships or ledger. A Product Feed API token
  (FR-24.9) is scoped identically — one seller, never platform-wide.
- **Payment security:** uzeyn.com never stores raw card data — checkout uses the
  gateway's hosted fields/tokenization (PCI-DSS SAQ-A scope). All inbound
  payment-gateway and supplier webhooks are **signature-verified**; an unsigned or
  invalid-signature webhook is rejected before it can touch the ledger.
- **External-API signing (new in v0.6):** the Template Install/License API (FR-24.6)
  and the Product Feed API (FR-24.9/24.10) both require signed/authenticated
  requests — an HMAC or public-key signature scheme verified before any entitlement
  is granted or any product data is returned. Neither hook accepts an unauthenticated
  or unsigned call under any circumstance.
- **Admin access control:** MFA is **mandatory** for every admin account;
  admin-terminal login is a separate, more scrutinized flow from seller/supplier
  login, and every admin action is captured in the immutable audit log.
- **Rate limiting:** applied specifically to authentication endpoints, listing-
  submission endpoints, payout-request endpoints, the Product Feed API, the
  Template Install/License API, and public storefront/API endpoints generally.
- **Secrets management:** payment-gateway keys, supplier API credentials, Google
  Drive OAuth secrets, and the signing secrets for both external-SaaS hooks are
  stored in an encrypted secrets store, with per-environment separation.
- **Google Drive token handling (schema gap closed in v0.7, FR-9.1):** a seller's
  Drive **refresh token is encrypted at rest** (app-level AES-256-GCM, key from
  env, never logged) in `google_drive_connections`; the **access token is never
  persisted to Postgres** — it lives only in Redis for an active import job's
  duration. No API response ever returns either token value. Revocation is
  seller-initiated and audit-trailed like a Product Feed API token revoke
  (FR-24.10).
- **PII handling:** buyer PII is excluded from application logs by default; access
  to raw PII in the database is limited to the roles that functionally need it.
  The buyer order-status link uses a signed, unguessable token. The same rule
  applies to `platform_events.metadata` (§3.11/FR-26.4): IDs only, never an
  email, name, phone number, or address.
- **Dependency hygiene:** automated dependency vulnerability scanning runs in CI.
- **Content/legal risk:** listing moderation exists specifically to reduce
  marketplace liability for counterfeit or prohibited goods, linked directly to
  the payout freeze (FR-6.10).

---

## 7. External Interface Requirements

### 7.1 User-Facing Applications
- **uzeyn.com public site** — marketing/signup, premium visual bar.
- **Storefront** — public, per-tenant, template-rendered site, including
  discovery/merchandising (§5.16), the buyer order-status lookup (FR-5.4), and
  review submission (§5.14).
- **Seller Dashboard** — authenticated app for store owners, including customers,
  reviews moderation, discovery/merchandising settings, manual orders, CSV
  import/export, tax settings, the onboarding wizard, and the Marketing entry
  point (FR-24.8).
- **Supplier Portal** — authenticated app for suppliers.
- **Admin Terminal** — authenticated, restricted app for platform staff,
  MFA-mandatory, including the payout approval queue, content-page editor, and the
  external-API client registry (FR-8.14).

### 7.2 Third-Party & External-API Integrations
Payment gateway (Safepay at launch; PayFast PK/direct JazzCash-Easypaisa in Phase
1.x; Stripe via foreign entity in Phase 4; a gated future COD path) · Supplier APIs
(Printify, then CJ Dropshipping, adapter interface for future suppliers, plus the
Markaz research item) · Google Drive API · Transactional email provider · DNS/domain
verification · (Phase 2+) SMS/WhatsApp Business API · **Template Store SaaS**
(inbound: Template Install/License API) · **Social Media SaaS** (outbound SSO
handoff; outbound-authenticated: Product Feed API). Object storage (MinIO) and CDN
(Cloudflare free tier) are self-hosted/free-tier, not paid third-party dependencies.

---

## 8. High-Level Data Model (core entities)

`User, Seller, Store, Theme/Template, StoreThemeSettings, Product, ProductVariant,
Category, StoreShippingSettings, StoreTaxSettings, DiscountCode, Supplier,
SupplierAdapterRegistry, SupplierListing, StoreSupplierLink, Order, OrderItem,
TrackingUpdate, Payment, LedgerEntry, Payout, SellerPayoutAccount, Plan,
Subscription, MediaAsset, Domain, ContentPage, ContentPageRevision,
SettingsDefinition, SettingsValue, AdminUser, AdminAuditLog,
AdminImpersonationSession, OrderFlag, Announcement, Customer, ProductReview, Cart,
Collection, CollectionProduct, StoreNavigationMenu, OrderNote, OrderTimelineEvent,
ImportJob, SellerOnboardingProgress` (all v1.0), **plus, new in v0.6:**
`TemplateEntitlement, ExternalApiClient, SellerApiToken` (v1.0 — both SaaS hooks
ship with v1.0, since they are cheap API surfaces, not full products),
`UserSecurityEvent` (v1.0, new — FR-25.3's audit trail for password reset and
other account-security events, deliberately separate from `AdminAuditLog`, which
is scoped to platform-admin control-plane actions, not general account security),
and, documented ahead for v1.1 — `ReturnRequest, StoreContentPage,
StoreContentPageRevision, SupportTicket, SupportTicketMessage, ReferralLink,
ReferralConversion, NewsletterSubscriber`. **New in v0.7:**
`SellerSignupWaitlist` (FR-25.5), `PlatformPromoCode` (FR-7.9),
`PlatformBrandAsset, PlatformBrandAssetRevision` (FR-12.3),
`GoogleDriveConnection` (FR-9.1, closes a schema gap found while planning
Module 2 — the token store FR-9.1 always assumed but never had a table) — all
v1.0. The `Announcement` entity gains `channel`/`target_type`/`target_id` fields
(FR-8.15) rather than a new table. **New in v0.8:** `PlatformEvent` (§3.11,
FR-26.x) — v1.0, recording starts immediately, no dashboard reads from it yet.

Every tenant-scoped table among the above carries `store_id` and is protected by
RLS (§3.2) — no exceptions for new tables. `LedgerEntry` is append-only. Full
column-level schema, including the Currency Strategy, is in
`docs/database-schema.md`.

---

## 9. Build vs. Buy Decisions

**Self-host-first principle (binding):** the default choice is to self-host on the
platform's own VPS. A recurring paid third-party service is justified only where
self-hosting is genuinely infeasible — specifically payment processing (PCI/legal
liability) and email deliverability. Every row states which side of that line it
falls on and why.

| Component | Decision | Reasoning |
|---|---|---|
| Payment processing | **Buy** (Safepay, then additional gateways) | PCI compliance and fraud liability make in-house processing a non-starter; commission/hold/reserve/payout logic stays custom on top |
| Payout disbursement | **Build** (manual adapter first, API adapter later) | Mirrors the Payment Adapter reasoning — no third-party payout-automation SaaS is justified before v1.0 proves real payout volume |
| Object storage | **Build (self-hosted MinIO on the VPS)** | Self-host-first principle — MinIO is free and S3-API-compatible; a later migration to R2/S3 is a config change |
| Store builder / theme engine | **Build** | Core product differentiator — cannot be a wrapper around a third-party tool |
| Drag-and-drop customizer | **Build**, deliberately scoped small at first | Core IP; a full visual page builder is a multi-year problem — Phase 1 ships a bounded token set (FR-1.2) |
| Coded-theme escape hatch | **Build (lightweight)** | Template override mechanism, reuses the same rendering pipeline |
| AI image/content generation | **Buy (API-based)** initially | Use existing model APIs rather than training/hosting models |
| Analytics | **Build (lightweight)** | Avoid per-event SaaS pricing that scales badly with store count |
| Transactional email | **Buy (managed service, free tier initially)** | Deliverability is a specialized problem genuinely infeasible to self-host well — the one clear exception alongside payments |
| Search | **Build on Postgres first** | Defer a dedicated search engine until catalog scale requires it |
| Identity/Auth | **Build (lightweight library, not per-MAU SaaS)** | Keeps unit economics sane at marketplace-scale buyer counts; satisfies the SSO hook |
| Admin control plane / config management | **Build (generic Settings Registry)** | Costs nothing extra to run; the single highest-leverage decision for a solo-founder-operated platform |
| PDF generation (receipts/invoices) | **Build (self-hosted)** | A self-hosted PDF renderer costs nothing beyond compute already on the VPS; a paid invoicing SaaS is not justified for one templated PDF (FR-19.2) |
| CSV import/export processing | **Build** | Runs as a background job on existing BullMQ infrastructure — the Shopify-compatible core-field mapping (FR-18.1) is a maintained code artifact, not a licensed tool |
| Template Store / Social Media SaaS integration hooks | **Build (small API surface only)** | uzeyn.com never builds either external product — it builds and owns a small, versioned, authenticated API on its own side (§5.24), which is the cheapest possible way to benefit from both without taking on their scope |

---

## 10. Phased Roadmap (solo-founder pacing)

Each phase is broken into small, independently shippable increments; no module
starts until the previous module's Acceptance Checklist (§14) is verified. See
`docs/mvp-v1-cutlist.md` for the exact v1.0 boundary.

- **Phase 0 (current):** SRS finalized, architecture decisions locked, tech stack
  chosen, database schema designed.
- **Phase 1 — v1.0 MVP:** the platform's own site; store builder with premium
  templates + built-in free-template guarantee + Template Store showcase; storefront
  discovery & merchandising (collections, search, navigation, announcement bar,
  coming-soon mode, SEO structured data, WhatsApp button, social links, FAQ
  accordion); Customers/CRM; product reviews; cart persistence (email-first) +
  abandoned-cart flagging; ONE supplier integration (Printify) with full
  transparency; **Direct Seller Collection checkout (v0.15 — bank transfer/
  JazzCash/Easypaisa/COD, no payment gateway)**; shipping + tax settings;
  discount codes; manual orders + mark-as-paid as the universal payment-
  confirmation path (§5.6c); order notes/tags/timeline + editing; CSV
  import/export (core fields); one branded PDF invoice; seller onboarding
  wizard; **invoice-based commission ledger (default 1%) + monthly seller
  invoicing + grace-period auto-suspension (v0.15, replaces hold/reserve/
  payout for v1.0)**; the discounted First Month paid entry (no free
  tier, v0.33) + inverse commission laddering + yearly billing +
  launch-campaign pricing + **Supplier Premium Plan (v0.15)**;
  Business Guard-Rails; **the Trust & Safety System (v0.15 — versioned
  Seller Agreement, rule-based T&S engine, enforcement ladder)**; the admin
  Control Plane (including the external-API client registry); the Template
  Install/License API and the Product Feed API (both hooks, uzeyn.com's
  side only); legal/content pages.
- **Phase 1.1:** CJ Dropshipping adapter, self-serve supplier registration + full
  multi-store dashboard, listing moderation queue, optional buyer accounts,
  abandoned-cart recovery emails, returns/refunds workflow, per-store content pages
  + blog, support/ticket system, referral program, low-stock alerts + newsletter
  capture, **the manual-order payment-link flow** (FR-22.8), **CSV metafields/
  complex option combinations** (FR-22.9).
- **Phase 2 (or later, on reactivation trigger — §5.6d):** Platform-Collected
  Payments mode — Safepay-first gateway integration, per-transaction hold +
  hold-graduation logic, rolling reserve, payout request → admin approval →
  disbursement (manual, then API-based) — the entire dormant §5.6/§5.6a/§5.6b
  specification, built exactly as already written, no redesign required.
- **Phase 2:** Tiered plan proration, coded-theme escape hatch, dispute workflow,
  SMS/WhatsApp notifications, second payment gateway, gated per-seller COD,
  shipping zones/weight-based rates, advanced discounts (auto-apply, BOGO,
  scheduled sales).
- **Phase 3:** Advanced theme customizer (animation presets, AI-assisted design),
  deeper analytics, **admin sub-roles (reaffirmed here, not pulled forward
  into any earlier phase)**. Seller staff accounts, previously listed here
  too, were **superseded by v0.32/§5.52** — pulled forward into v1.0 as a
  plan-tier differentiator at the founder's explicit direction.
- **Phase 4:** Multi-VPS scale-out, international payment gateways, mobile apps
  (consuming the existing API per the mobile-readiness NFR, §6), **region-sharded
  deployments** (per-region DB/stack + a global admin aggregation view — §3.6
  architecture note only, not yet a committed build), **RTL/Urdu storefront
  support** (content work only, per §3.9), **Markaz supplier-adapter evaluation**
  (pending API verification).

---

## 11. Payment Gateway Research Summary

**v0.15 note:** this research predates the Direct Seller Collection pivot
(§5.6c) and now describes the **dormant Platform-Collected Payments mode**
(§5.6d) exclusively — none of it is built for v1.0 launch, which needs no
payment gateway at all. Retained verbatim as the exact research base for that
mode's eventual reactivation.

| Option | Verdict for Phase 1 |
|---|---|
| **Safepay** | **Chosen as the Platform-Collected mode's sole payment method** (dormant in v1.0, §5.6d). YC-backed, modern API, explicitly startup/SME-friendly onboarding, no setup fees, supports individual/sole-proprietor accounts (with stricter limits), unifies cards + mobile wallets + Raast under one integration. |
| **Cash on Delivery** | **Unconditionally available in v1.0** under Direct Seller Collection (FR-6.14) — the commission-inversion problem that deferred it under the old model doesn't apply once the platform never holds any sale's funds in the first place. The *dormant* mode's gated, balance-checked version (§5.6a) remains specified for its own eventual reactivation. |
| **PayFast PK** | Deferred to Phase 1.x. Reputable and PCI-DSS compliant, but onboarding is described as "enterprise-paced" with heavier documentation/notarization requirements — not the fastest path to a solo founder's first live payment. |
| **Direct JazzCash / Easypaisa merchant APIs** | Deferred to Phase 1.x/2. Requires a direct merchant agreement with the telco/bank (registered company, settlement account), lower-level integration — better economics at volume, not the fastest Phase 1 path. |
| **Stripe (via foreign entity)** | Deferred to Phase 4. Stripe does not onboard Pakistani entities directly; would require a foreign entity — relevant only once the platform serves international buyers. |

---

## 12. Risk Register (ranked)

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Solo founder + AI capacity vs. Shopify-class scope** — over-scoping stalls or burns out the build | Hard MVP cut-list (`docs/mvp-v1-cutlist.md`), phase-gated roadmap (§10) with module-level checklist gating (§14), no feature enters v1.0 without another leaving it |
| 2 | **Payment gateway access as an individual/new entity blocks launch — resolved differently than planned (v0.15):** Direct Seller Collection (§5.6c) removes this risk entirely rather than mitigating it — v1.0 needs no payment gateway at all, since the platform never holds buyer funds. Safepay onboarding research (§5.6a/§11) is retained for the dormant Platform-Collected mode's eventual reactivation | N/A — risk removed by the payment-model pivot, not mitigated |
| 3 | **Cross-tenant data leakage** (row-level tenancy bug exposes seller A's data to seller B) | Mandatory scoping middleware + Postgres RLS backstop + release-gating cross-tenant test suite (§3.2, §6.5, §14) |
| 4 | **Ledger/commission bugs cause silent financial loss or seller distrust** | Append-only ledger unchanged by the v0.15 pivot (FR-6.4/FR-6.16), no destructive balance edits; the dormant mode's gateway-settlement reconciliation (FR-6.6) has no v1.0 equivalent since there's no gateway to reconcile against — correctness instead rests on FR-6.19's anti-underreporting monitors and the admin's own manual invoice-payment verification (FR-6.17) |
| 5 | **Single VPS is a single point of failure** | Off-box automated backups + tested restore runbook from day 1 (§6, Availability row) |
| 6 | **Superseded by Risk 21 (v0.15):** hold-bypass fraud is a Platform-Collected-mode risk (dormant, §5.6d) — its mitigation (FR-6.2, FR-6.3, FR-6.9, FR-6.13) is unchanged and retained for that mode's eventual reactivation, but it is not a v1.0 risk since v1.0 never holds seller funds to bypass a hold on | Mitigation retained for §5.6d's reactivation; not applicable to v1.0 — see Risk 21 for v1.0's actual top financial-integrity risk |
| 7 | **Supplier API fragility/change** (Printify/CJ API changes or rate limits break live stores) | Adapter interface isolates blast radius to one adapter; cached last-known catalog degrades gracefully instead of breaking (§3.5, FR-4.3); admin adapter registry (FR-4.9) allows disabling a broken adapter instantly |
| 8 | **Regulatory/legal exposure** (counterfeit goods, buyer data protection, Pakistani e-commerce/tax rules) | Listing moderation queue (FR-8.13) linked to the Trust & Safety enforcement ladder (§5.29/FR-29.4) — the dormant mode's payout-freeze linkage (FR-6.10) is retained for its reactivation; legal consultation on SECP/PECA/data-protection obligations tracked as an explicit open item (§13); legal content drafts in `docs/legal/` — now including the versioned Seller Agreement's facilitation-workspace/indemnification language (FR-29.1/FR-29.2) — flagged for human review |
| 9 | **"AI/premium 3D template" scope creep** stalls Phase 1 chasing a generative-design problem that isn't solved | Phase 1 templates are hand-built to a high visual bar (FR-1.1); animation presets and AI tooling deferred to Phase 3 (FR-1.7) |
| 10 | **Over-building the theme engine/customizer** (a multi-year problem for a small team) | Phase 1 customizer is deliberately scoped to a bounded token set (FR-1.2); expand only after MVP validates demand |
| 11 | **A bad admin config value breaks the platform** (e.g. commission set to 105%, or the wrong seller's store wrongly suspended for a paid invoice) | `settings_definitions` enforces a validation rule per key (range/type) rejected before it reaches the database; every change is audit-logged with before/after values (FR-8.9) |
| 12 | **Superseded by Risk 22 (v0.15):** manual disbursement is a Platform-Collected-mode risk (dormant, §5.6d) — its mitigation (FR-6.11, FR-6.12) is unchanged and retained for that mode's eventual reactivation, but v1.0 disburses nothing (the platform never holds seller funds) | Mitigation retained for §5.6d's reactivation; not applicable to v1.0 — see Risk 22 for v1.0's actual manual-process risk |
| 13 | **Self-hosted MinIO is a new single point of failure for media**, now living on the same VPS as everything else | Same off-box backup discipline as the database (Risk 5) extends to the MinIO data directory; the Cloudflare CDN cache in front of it means a brief MinIO hiccup doesn't immediately take already-cached images offline |
| 14 | **Discount code abuse** (bulk-generated codes used to reduce effective commission, or a leaked code used far beyond its intended reach) | Usage limits and expiry are enforced server-side at checkout (FR-5.5, never client-side); commission is calculated on the post-discount amount (FR-6.1), so a discount reduces seller revenue and platform commission proportionally |
| 15 | **CSV import/export scope, resolved (v0.6):** a shallow "Shopify-compatible" importer risks being compatible in name only | Bounded to core fields (title, description, price, variants/options, images, inventory) with unmapped fields listed explicitly per upload (FR-18.1); metafields/complex option combos are an explicit v1.1 fast-follow (FR-22.9), not a silent gap |
| 16 | **Manual/draft orders payment-link integration surface, resolved (v0.6):** a second checkout entry point reconciling with commission/ledger logic | Bounded to mark-as-paid only for v1.0 (FR-17.1); the payment-link path is deferred to v1.1 (FR-22.8) |
| 17 | **Cart persistence timing, resolved (v0.6):** "when is a buyer's email captured" was an undecided UX question coupling with checkout design | Locked as an explicit decision: checkout is email-first, email captured before payment details (FR-15.1) — no longer discovered mid-build |
| 18 | **"Luxury" PDF invoices as an open-ended polish trap, resolved (v0.6):** unbounded design-iteration risk | Bounded to exactly one template meeting a "clean and professional" bar with a single founder sign-off (FR-19.2); further polish is an explicitly time-boxed backlog item, never a launch gate |
| 19 | **Template license/entitlement bypass (new in v0.6)** — a forged or replayed call to the Template Install API could grant a seller a premium template without a valid Template Store purchase, undercutting that product's monetization | Signed/authenticated requests (§6.5) verified before any entitlement is granted; every grant/revoke is audit-logged (FR-24.6) as a traceable, reversible action; the external-API client registry (FR-8.14) can disable the integration instantly if abuse is detected |
| 20 | **Product Feed API token leak or abuse (new in v0.6)** — a leaked seller token could expose product data beyond intended use, or be scraped at volume | Tokens are seller-scoped (never platform-wide), revocable at any time from the dashboard (FR-24.10), rate-limited like every other public API surface, and the feed is read-only and limited to fields already public on the storefront — no data exposure beyond what a buyer could already see |
| 21 | **Seller under-reporting/non-remittance of commission (new, v0.15 — Direct Seller Collection's central new risk, effectively replacing Risk 6):** since the platform never touches buyer money, it has no independent way to confirm a sale happened or that a marked-paid order was reported honestly — a seller could simply never mark an order paid, or falsely mark it cancelled, to avoid the commission invoice | Every storefront order is recorded regardless of later status (Financial Truth Invariant, §3.12); cancellation-rate and pending-forever-rate monitors (FR-6.19) feed Trust & Safety risk views (§5.29) for admin review; non-payment past a grace period auto-suspends the store (FR-6.18) — the platform's only enforcement lever without held funds; the versioned Seller Agreement (FR-29.1/FR-29.2) makes deliberate under-reporting an explicit, indemnified breach, not an ambiguous gray area |
| 22 | **Manual invoice-payment verification is a human-in-the-loop process (v0.15)** — admin fatigue or error confirming a seller's off-platform commission payment could delay a legitimate un-suspension or wrongly clear a non-payment | Invoice status changes are audit-logged (FR-8.9) and visible to the seller through the full lifecycle, same transparency discipline as the dormant mode's payout status flow (FR-6.12); a future phase can add automated bank-statement matching behind the same Payment Adapter interface (§3.5) with no change to the invoicing/suspension logic |
| 23 | **Order verification abuse (new, v0.29)** — a bad actor could hammer the OTP-send endpoint against arbitrary phone numbers/emails to run up a seller's own SMTP/WhatsApp usage (or a third party's inbox, as harassment), or brute-force a 6-digit OTP given enough attempts | Rate-limited resends (FR-37.5, one cooldown-gated send per order at a time), a hard per-OTP retry cap (default 5) that fails the attempt rather than allowing unlimited guesses, single-use + time-limited codes, and a daily per-sender-email cap (default 450, FR-37.3) bounding the worst case even if the cooldown is somehow raced — the same layered-limits posture already applied to every other OTP/token surface in this SRS (e.g. password reset, admin MFA) |
| 24 | **Misleading profit figures from incomplete or dishonest seller-entered cost data (new, v0.30)** — the P&L Engine (§5.42) trusts seller-entered product base costs and ad-spend; a seller who never enters a cost, enters it wrong, or under-reports ad spend gets an inflated net-profit figure with nothing to contradict it (the platform has no independent source for a seller's true product cost or ad spend, unlike revenue/commission which it computes itself) | Never silently treat a missing cost as zero — FR-42.2 requires every profit figure touching an un-costed variant to be visibly flagged incomplete, not quietly wrong; this is a seller-facing decision-support tool, not an attested financial statement, and is documented as such rather than treated as a data-integrity guarantee the platform can enforce |
| 25 | **Platform email deliverability (new, v0.31)** — the Built-in Email Verification Service (§5.43) sends from platform-controlled infrastructure with no SPF/DKIM/DMARC alignment or sender-reputation warming at v1.0 launch; a buyer's mail provider could silently spam-folder or reject platform-sent OTP emails, blocking legitimate order verification | Documented explicitly as a convenience default, never the sole verification path (FR-43.4) — WhatsApp OTP and seller-connected SMTP remain the recommended first-class channels; SPF/DKIM/DMARC setup and reputation warming are a pre-default-promotion prerequisite tracked as follow-up work, not solved by this amendment |
| 26 | **Shopify-migration bulk moderation bypass attempt (new, v0.31)** — a bad actor could try using the Shopify migration's bulk-upload path to slip banned-keyword/restricted-category products past moderation faster than one-by-one manual entry would allow | FR-44.3 reaffirms (not rebuilds) the existing Moderation Engine (§5.27) runs identically per imported row — no migration-specific bypass code path exists; §14.44 explicitly re-proves this against an imported row, not just a manually created one |
| 27 | **Cost-Savings Calculator going stale (new, v0.31)** — Shopify's own pricing/fees change over time; if the admin-editable comparison figures (FR-45.2) aren't periodically reviewed, the calculator could quietly understate/overstate real savings while still looking authoritative | Figures are Settings Registry data specifically so a correction is a data update, not a deploy (FR-45.2), and the "estimate" disclaimer (FR-45.3) sets buyer/seller expectations correctly even if a figure drifts — but this is a genuine ongoing-maintenance risk, not one the architecture alone can fully close; flagged here so it gets a periodic admin review cadence rather than being treated as solved |
| 28 | **Badge threshold flapping (new, v0.31)** — a store hovering exactly at a §5.46 badge threshold could rapidly gain/lose that badge across successive recomputes, looking unstable to buyers rather than genuinely earning/losing trust status | Accepted v1.0 limitation, documented rather than silently present: badges recompute on the same cadence as Store Health Score (§5.34), no faster; a future hysteresis band (e.g. require crossing by a margin, or holding for N consecutive recomputes, before flipping) is a roadmap note, not built in v1.0 |

---

## 13. Open Questions / Decisions Needed (remaining)

1. **Legal entity:** confirm timeline for registering a business entity — needed
   for Phase 1.x gateways (PayFast/direct JazzCash-Easypaisa), for enabling the
   gated COD feature at scale, and for hold-graduation identity verification
   (FR-6.3), even though Safepay alone can launch without it.
2. **Regulatory review:** SECP/PECA/data-protection obligations for a Pakistani
   e-commerce marketplace handling buyer PII and commission-based payments — needs
   a legal consult before Phase 1.1 (Risk 8); the `docs/legal/` drafts (FR-12.2)
   are a starting point for that consultation, not a substitute for it. **New in
   v0.6:** the Privacy Policy draft has been updated to disclose the two external-
   SaaS data flows (§5.24) — this still needs counsel review like everything else
   in `docs/legal/`.
3. **Branding assets & direction (resolved in part):** founder owns branding
   assets; the agreed visual direction for the platform's own site (FR-0.1) is
   **apple.com-level minimal premium polish combined with the horizonx.so motion
   aesthetic** — final assets are still needed before the Theme Engine's first
   templates and the platform's own site are designed.
4. **Hold graduation thresholds** — exact number of completed orders /
   verification criteria for FR-6.3 needs a founder decision once real transaction
   data exists to calibrate against.
5. **Rolling-reserve default trigger criteria** — FR-6.13 ships with a 0% default
   and admin-manual application; the specific risk signals that should
   *auto-apply* a reserve need calibration once real seller/order data exists.
6. **Markaz API viability** (§5.4, FR-4.10) — needs research before any adapter
   build commitment.
7. **Template Store / Social Media SaaS timelines and contracts (new in v0.6):**
   this SRS specifies uzeyn.com's side of both hooks (§5.24) independent of when
   either external product ships; the actual signing-secret exchange, API version
   support window, and any commercial terms between the two products (even though
   they share a founder) are the founder's decision, not specified here since
   they're the *other* product's concern by design (§2.6).
8. **Template Store revocation semantics (new in v0.6, explicitly not resolved
   here):** FR-24.6 states revocation is symmetric (an API call removes an
   entitlement), but *when* the Template Store should call it (e.g. on a refund
   window closing, on a subscription-style template lapsing, on a dispute) is that
   product's own business logic — uzeyn.com only needs the hook to exist, not an
   opinion on the Template Store's monetization model. Flagged explicitly per the
   founder's request rather than silently assumed.

---

## 14. Acceptance Checklists

**Binding process rule:** no module or phase begins implementation until the
previous module's checklist below is **100% verified and explicitly approved by
the founder**. These checklists are the definition of done for each module — not a
summary of what was built, but the exhaustive list of what must be true before the
next module starts. Each item is written to be testable, not aspirational.

### 14.0 Platform's Own Site
- [ ] Public site meets the premium visual bar (apple.com-level polish +
      horizonx.so motion, §13) — explicit founder sign-off against FR-0.1
      (Module 19, Phase 1 of 8 complete — see the sub-item immediately
      below; Phases 2-8, covering every actual page, are not yet built)
- [x] **Module 19 Phase 1 (design system foundation), v1.1 redo:** the
      first checkpoint (Plus Jakarta Sans, softer neutrals) was
      **founder-rejected on visual direction**. Corrected pass: display
      face swapped to **Geist** (with a `/design-system/type` page showing
      it against the one alternative considered, Instrument Sans, per the
      founder's instruction not to swap unilaterally); neutrals hardened to
      an ink-on-paper palette with real contrast jumps; type scale rebuilt
      with bigger clamps, tighter tracking, one uniform heading weight;
      marketing-surface spacing doubled; shadows softened toward "distance
      not drama." The shared UI kit (shadcn/ui-on-Radix base, existing
      components upgraded in place, 12 new primitives + toast system) and
      the "UZEYN" wordmark from the rejected pass carry forward unchanged.
      `/design-system` rebuilt to the corrected direction, plus a real proof
      page — the marketing homepage hero section (`apps/web/app/page.tsx`)
      — since a design system can't be judged from swatches alone. Proven
      via Playwright screenshots at 1440px desktop and 390px mobile, with
      `prefers-reduced-motion` emulation confirming the real, un-animated
      layout at every section
- [x] **UI/UX Design Phase, Part 1 of 8 (dashboard/admin tokens + component
      kit)** — founder-directed final pre-launch UI/UX mandate, superseding
      Module 19's original Phase 3-8 breakdown (auth/onboarding, dashboard
      core+remaining, buyer storefronts, admin terminal, final pass) with a
      narrower, explicitly-scoped one: **only** the seller dashboard and
      admin terminal (Module 25) get this pass; the storefront/marketing
      identity (Module 19 Phase 1-2) stays locked and untouched, and
      auth/onboarding screens are not yet re-scoped by this mandate. Part 1
      built: dashboard/admin-scoped design tokens (white canvas/`#fafafa`
      tonal cards, no card borders, restrained indigo accent `#5b5bf0` -
      distinct from the marketing site's blue, scoped via `body:has(.app-
      shell-surface)` so neither the token values nor any Radix-portaled
      overlay content leaks outside the dashboard/admin surfaces); a new
      `Gauge`/`GaugeCard` semicircle-KPI component (recharts, with a real
      "no data yet" empty state, not a misleading `$0` fill); a dashboard-
      scoped `DashCard` family (reusing the existing `Badge`/`Avatar`/
      `EmptyState` primitives as-is - already correct for this direction);
      `AvatarInitials` (real `Customer.name` when linked, buyer-email
      fallback otherwise); the seller sidebar rebuilt into the founder's
      locked four-group IA (Main menu/Growth/Operations/Admin, a hairline
      divider before Admin, one icon per item, plan name under Settings,
      a mobile hamburger-drawer replacing the desktop static sidebar below
      768px). Every nav item routes to a real, already-built screen -
      Payments and Reports (previously buried inside Settings) got real
      top-level nav entries, bridged via `/settings#payments`/`#reports`
      anchors pending their full extraction/redesign in a later phase
      (avoids moving 900+ lines of interdependent Settings-page state
      twice). New `/stores/:storeId/design-system` contract page (mirrors
      the marketing site's own `/design-system` pattern) shows the gauge in
      every fill state, the card, every status-pill color, and avatar
      initials, so every later phase is checked against one page. Verified
      against a real local Postgres/Redis/API/web stack (not a screenshot
      of a mock) via Playwright at 1440px desktop and 375px mobile,
      including a live mobile-drawer open + keyboard-focus pass that
      caught and fixed the portal-scoping bug above before it could recur
      across every future Dialog/DropdownMenu/Tooltip the later phases add
- [ ] Mobile-responsive across the three most common breakpoints
- [ ] Signup flow works end-to-end: create account → verify email → land in
      dashboard
- [ ] Password reset works end-to-end: request → emailed single-use token →
      complete reset → all prior sessions for that account are invalidated
      (FR-25.1–25.4)
- [ ] A reset token is rejected after its configured expiry and after first use
- [ ] Repeated reset requests for the same account/IP are rate-limited (FR-25.2)
- [ ] Every reset request and completion produces a `UserSecurityEvent` row
      (FR-25.3)
- [x] A seller-signup attempt from a country **not** on the Settings-Registry
      allowed-countries list shows the "launching in your region soon" message
      (not an error) and creates a `seller_signup_waitlist` row with the
      submitted email + country (FR-25.5) — built Module 16
- [x] Adding a country to the allowed-countries list via the Settings Registry
      (no deploy) immediately allows seller signup from that country on the very
      next request (FR-25.5) — built Module 16
- [x] A **buyer** can shop any storefront regardless of country — regional
      gating never applies to buyer-side access (FR-25.5). Holds by
      construction: the gate lives only in `AuthService.signup()`'s
      seller-role branch — there is no buyer account/signup flow to gate
      (guest checkout is v1.0's only buyer path, FR-22.1) — built Module 16
- [ ] **Events emitted (backfilled, v0.8):** a successful signup produces a
      `seller.signup` row in `platform_events`; creating a store produces a
      `store.created` row — both with the correct `actor_id`/`store_id`, no
      PII in `metadata` (§3.11/FR-26.5)
- [ ] Page load meets the sub-2s first-contentful-paint target (§6)
- [ ] Legal/content pages (ToS, Privacy, Refund, About, Contact) are linked,
      render correctly, and are served from admin-editable content (FR-12.1), not
      static files

### 14.1 Store Builder & Theme Engine
- [ ] All v1.0 templates selectable at store creation and each meets the premium
      visual bar (FR-1.1)
- [ ] Customizer persists and correctly renders: colors, fonts, logo/banner
      images, section show/hide/reorder (FR-1.2 v1.0 scope — explicitly, no
      animation controls)
- [ ] Live preview output matches published output exactly
- [ ] Storefront is mobile-responsive; dashboard is mobile-usable
- [ ] SEO meta fields save and render correctly in page `<head>`
- [ ] **SEO fallback chain renders correctly when fields are null** (v0.9,
      FR-1.5): a product/store with no `seo_title`/`seo_description` set
      renders its own name/description instead, and a product with neither
      falls back to the parent store's default
- [ ] **Sitemap URLs match the store's active domain** (v0.9, FR-1.5):
      `sitemap.xml` uses the verified custom domain when one exists, the free
      subdomain otherwise
- [ ] **Hidden store serves noindex with no sitemap** (v0.9, FR-1.5): a store
      in `coming_soon`/`password_protected` access mode serves a `noindex`
      `robots.txt` and returns no sitemap content
- [ ] **Events emitted (v0.9):** creating/updating a store's theme settings —
      no new event required by FR-26.x's lean taxonomy for this module beyond
      what Modules 1-3 already backfilled (theme customization is not a
      growth/unit-economics signal); noted here so the checklist explicitly
      confirms this was a deliberate scoping decision, not an oversight
- [ ] **Tenant isolation:** automated test proves seller A cannot read or write
      seller B's `store_theme_settings` via direct API manipulation
- [ ] Postgres RLS policy on `store_theme_settings` verified with a negative test
- [ ] Settings Registry key `theme.coded_mode_enabled` resolves correctly per plan
      and is off for every seller in v1.0
- [ ] Premium-templates showcase links out to the Template Store correctly, and
      its absence/unreachability never blocks selecting a built-in free template
      (FR-24.1, FR-24.2)
- [x] **Four built-in templates + "Start from blank" (v0.31 design phase,
      FR-1.1/FR-1.9):** Editorial/Studio/Market/Atelier are genuinely
      distinct hand-designed section-component sets (typography, spacing,
      color), selected by theme name via a shared registry so the
      customizer's live preview and the real storefront resolve identically
      by construction; "Start from blank" seeds every section hidden.
- [x] **Storefront branding mark (FR-1.10, tier mapping revised v0.33):**
      mandatory (shown, unremovable) on First Month/Starter/Growth; only Pro
      can hide it; downgrading off Pro reverts it to shown even though the
      stored preference is untouched — proven by e2e
      (`branding.e2e-spec.ts`), including cross-tenant isolation on the
      preference itself.
- [x] **THE ISOLATION RULE, proven three ways:** (1) structural — cart/
      checkout/order-status/wallet/verification components live entirely
      outside the templates directory; (2) static — `scripts/check-template-
      isolation.js` fails CI if any template file imports that functional
      code (verified to actually catch a deliberately-introduced violation
      before being removed); (3) runtime — a template-invariance e2e
      (`templates-isolation.e2e-spec.ts`) runs the full money path (mixed
      cart, discount, tax, mark-as-paid) once per template + blank and
      asserts order totals, ledger commission, wallet balance delta (a real
      per-order debit — `WalletService.getBalance()` derives balance from
      `LedgerEntry` rows), P&L figures, and the confirmed outcome are
      byte-identical across all five runs.

### 14.2 Seller Admin Dashboard
- [ ] Product CRUD, variants, and inventory tracking work correctly (FR-2.1)
- [ ] Order list filters by status and date correctly using the intended index
- [ ] Seller-initiated supplier invite creates a `store_supplier_links` row with
      the correct `invited_by` value and status (FR-2.6)
- [ ] Listing approve/reject updates `listing_reviews` and, on approve, creates
      the corresponding `products` row **and its one `product_variants` row**
      (FR-2.7 - completeness fix, found and closed during Module 9: a
      supplier-sourced product with no variant row was unpurchasable, since
      every cart/order line references a `variantId`; v1.0's supplier
      listings have no options, so exactly one variant per approved listing)
- [ ] Google Drive OAuth connect + import copies media into MinIO — imported
      assets still render after the source Drive file is deleted
- [ ] A seller can revoke their Google Drive connection from the dashboard;
      revocation deletes the stored refresh token and is captured as a
      `UserSecurityEvent` (FR-9.1, new in v0.7)
- [ ] No API response (including the seller's own dashboard/profile endpoints)
      ever includes a Drive access or refresh token value, and neither token
      value appears in application logs (FR-9.1, new in v0.7)
- [ ] The Drive access token is confirmed to live only in Redis, scoped to an
      active import job — a direct query against `google_drive_connections`
      never returns anything but the encrypted refresh token (FR-9.1, new in
      v0.7)
- [ ] Custom domain attach completes DNS verification + TLS issuance for a real
      test domain within the documented time window (FR-2.9)
- [ ] Seller analytics view (FR-2.4) shows correct orders/revenue/top-products for
      that store only — **tenant isolation test**
- [ ] Shipping settings (flat rate + free-shipping threshold, FR-2.10) save and
      are applied correctly at checkout for a self-fulfilled cart
- [ ] Discount code CRUD (FR-2.11) works; a code created for store A cannot be
      applied to a checkout on store B
- [ ] **Tenant isolation, release gate:** the full automated cross-tenant test
      suite passes for every dashboard API route (§3.2)
- [ ] **Events emitted (backfilled, v0.8):** creating a product produces a
      `product.created` row in `platform_events`; a successful Google Drive
      or direct upload produces a `media.imported` row — both with no PII in
      `metadata` (§3.11/FR-26.5)

### 14.3 Supplier Portal
- [ ] Supplier registration/verification workflow completes end-to-end (FR-3.1)
- [ ] **Permission boundary:** a supplier's session returns zero results for a
      store they do not hold an active `store_supplier_links` row for
- [x] Multi-store dashboard aggregates `order_items` across all linked stores
      correctly (FR-3.3) - proven in Module 9's test suite, once orders exist.
      **The API/data half only** — the supplier-facing UI that actually
      renders this view, gated by the Supplier Premium Plan (FR-7.10), is
      built in Module 20 (new v0.20); no supplier login/dashboard surface
      exists in `apps/web` yet
- [ ] Fulfillment checklist updates correctly and reflects live in the seller's
      dashboard (FR-3.4) - proven in Module 9's test suite
- [ ] Tracking ID upload triggers the buyer notification (FR-5.2) - proven in
      Module 9's test suite (both the seller-side and supplier-side upload path)

### 14.4 Dropshipping Supplier Integrations (Printify, v1.0)
- [ ] Printify adapter implements the full Supplier Adapter interface (§3.5)
- [ ] Shipping cost, estimated delivery time, and supported countries render
      correctly on the storefront product page (FR-4.6)
- [ ] Checkout blocks an order when any cart item's supplier listing doesn't
      support the buyer's shipping country (FR-4.7) - proven in Module 9's
      test suite, once checkout exists
- [ ] Price sync propagates to the storefront within the scheduled interval; a
      checkout attempted against a stale cached price is rejected/re-validated
      against the latest synced price (FR-4.8) - proven in Module 9's test
      suite (checkout always reads the live `supplier_listings.price`)
- [ ] **Oversell protection:** two simultaneous orders against the last unit of a
      shared supplier stock figure — only one succeeds (FR-4.5) - the
      mechanism itself was proven in isolation in Module 8; Module 9 proves
      it wired into a real concurrent checkout
- [ ] Supplier API outage is simulated: storefront serves the last-known cached
      catalog instead of erroring (FR-4.3)
- [ ] Admin can disable the Printify adapter from the adapter registry without a
      deploy; disabling stops new syncs but does not affect existing orders (FR-4.9)

### 14.5 Order & Fulfillment Management
- [ ] Unified order dashboard spans self- and supplier-fulfilled orders correctly
      (FR-5.1)
- [ ] Buyer email notifications fire correctly on confirmed/shipped/delivered
      (FR-5.2)
- [ ] Suspended-store buyer-facing behavior renders correctly; in-flight orders
      for a newly-suspended store remain fulfillable (FR-5.3)
- [ ] Buyer order-status lookup link works without an account, and the token
      cannot be guessed or enumerated (FR-5.4)
- [ ] Discount code validation: an expired code is rejected, a usage-limit-
      exceeded code is rejected, a valid code applies the correct discount (FR-5.5)
- [ ] Mixed-cart shipping calculation is correct (FR-5.6)
- [ ] **Financial Truth Invariant (§3.12, v0.10):** a submitted-but-unpaid
      order never appears in the order dashboard as a completed sale; it is
      only reachable as an internal pending/draft state until payment is
      verified

### 14.6 Payments, Commission, Ledger & Payout Engine — DORMANT in v1.0 (see §14.6c below for what v1.0 actually gates on)
**v0.15 pivot:** every item below describes the dormant Platform-Collected
Payments mode (§5.6d) and is **not built or gated in v1.0** — retained
verbatim as the exact acceptance checklist a future reactivation must satisfy,
so that work starts here rather than rediscovering these tests. v1.0's real
gate is §14.6c, below.
- [ ] Safepay checkout succeeds end-to-end in sandbox and in production
- [ ] Webhook signature verification rejects a forged/unsigned webhook (must fail
      closed)
- [ ] Commission (3% default, configurable) is deducted correctly on the
      post-discount, pre-gateway-fee amount (FR-6.1)
- [ ] **Ledger immutability:** an attempt to `UPDATE` or `DELETE` a
      `ledger_entries` row fails at the database grant level
- [ ] The 22-day hold: a `sale_credit` entry's `hold_release_at` is set correctly
      and the hold-release scheduled job promotes it to available at the right
      time, not before (FR-6.2)
- [ ] Daily reconciliation job flags a deliberately-introduced mismatch between
      the ledger and a mocked Safepay settlement report; a `manual`-type payment
      is correctly excluded from this reconciliation (FR-6.6)
- [ ] Payout request against available balance only (FR-6.7)
- [ ] Payout admin approval queue displays a correct risk summary for a
      constructed test seller (FR-6.9)
- [ ] A seller with an active prohibited-goods flag cannot have a payout approved
      (FR-6.10)
- [ ] Manual disbursement adapter: the admin batch screen shows payee/amount/IBAN
      correctly; marking a request Paid creates the correct `payout_debit` ledger
      entry and fires the seller notification (FR-6.11, FR-6.12)
- [ ] Rolling reserve: setting a test seller's reserve percentage above 0% causes
      the correct portion of their next `sale_credit` to be held as a separate
      `reserve_hold` entry, released via `reserve_release` after the configured
      period if undisputed (FR-6.13)
- [ ] Settings Registry keys resolve with correct scope precedence: commission
      rate, hold days, reserve percentage, payout freeze, COD gate (confirmed off
      for every seller in v1.0)
- [ ] Every monetary display shows the store's configured currency, never a
      hard-coded `"PKR"` string
- [ ] **Financial Truth Invariant (§3.12, v0.10):** an unpaid/unconfirmed/
      failed-payment order produces no `ledger_entries` row, no commission,
      and is excluded from every balance/payout-eligibility calculation —
      proven with a deliberately-constructed unpaid order, not assumed

### 14.6c Direct Seller Collection & Commission Invoicing (v1.0 — new, v0.15) — DORMANT as of v0.24, see §14.6e
**Every item below remains true of the code as built and tested in
Module 11 — nothing here regressed.** As of v0.24 this is no longer
v1.0's *active* mechanism (superseded by the wallet, §14.6e); the
scheduled invoice-generation/overdue-sweep jobs are simply unscheduled
going forward, per FR-6.28.
- [x] A store cannot go live without at least one configured payment method
      (bank/JazzCash/Easypaisa/COD) (FR-6.14) — enforced as a checkout-time
      gate (v1.0 has no separate store draft/publish state)
- [x] The buyer sees the seller's configured payment instructions after placing
      an order; COD is available with no ledger balance gate, unlike the
      dormant mode's version (FR-6.14)
- [x] Marking an order paid (`OrdersService.markAsPaid()`) is the only path to
      `confirmed`, exactly as Module 9 already proved — no regression
      introduced by this amendment (FR-6.15)
- [x] Marking an order paid accrues a `commission_accrued` ledger entry at the
      correct rate (default 1%, seller override via Settings Registry) on the
      correct post-discount subtotal (FR-6.16) — **per-category override is
      not applicable at this level** and was not built: commission accrues
      once per whole order, which can span multiple products/categories, so
      there is no single category to key a per-category rate on; only
      seller/plan/global scopes are used, disclosed in `billing.seed.ts`
- [x] A scheduled job generates one invoice per seller per billing period,
      correctly summing that period's `commission_accrued` entries and
      excluding entries outside the period (FR-6.17) — proven idempotent on
      re-run
- [x] An admin can mark an invoice `paid`; the action is captured in
      `admin_audit_logs` with before/after invoice status (FR-6.17, FR-8.9)
- [x] An invoice left unpaid past the configured grace period triggers
      automated store suspension (reusing the existing `suspended` store
      status); marking the invoice paid lifts the suspension automatically
      (FR-6.18) — **simplification disclosed:** the sweep/lift only ever
      touches stores it can prove it suspended (`active`→`suspended` on
      sweep, `suspended`→`active` on payment), so it never overwrites an
      independently admin-issued suspension/ban
- [x] **Financial Truth Invariant (§3.12, restated for this model):** an
      unpaid/pending order accrues no `commission_accrued` entry and appears
      in no invoice — proven with a deliberately-constructed pending order
- [x] Cancellation-rate and pending-forever-rate monitors correctly flag a
      seller crossing their configured thresholds and correctly do *not* flag
      one who stays under them (FR-6.19) — **built in Module 12** (see
      §14.29), which depended on Module 11 supplying the ledger/invoice/
      order data these monitors read
- [x] An admin can record a `commission_waived` entry against a specific
      invoice line without altering any other entry on that invoice
      (FR-6.20)
- [x] Every monetary display shows the store's configured currency, never a
      hard-coded `"PKR"` string

### 14.6e Prepaid Credits Wallet (v1.0 — built Module 20, floor-enforcement fix v0.25)
- [x] A store cannot be published (accept a real, checkout-completed order)
      without a configured payment method, a verified CNIC, **and** a
      wallet top-up meeting the configured minimum, all three (FR-6.21)
- [x] Signup, store setup, and the onboarding wizard require no wallet
      interaction at any step (FR-6.21)
- [x] Marking an order paid debits the wallet the correct commission
      amount immediately — no pending order ever produces a wallet debit
      (Financial Truth Invariant, §3.12) (FR-6.22)
- [x] A seller can request a top-up (preset or custom amount); the credit
      lands in the wallet only after an admin verifies it, and the
      verification action is captured in `admin_audit_logs` (FR-6.23,
      FR-8.9) — the Module 17 admin invoice-verification screen correctly
      repurposed to list/verify top-ups, not rebuilt from scratch
- [x] A plan fee, a Team leader's group total, and an extra-device-slot
      add-on all debit the wallet monthly-in-advance on the correct
      cadence and amount (FR-6.24, FR-7.2, FR-7.15/7.18, FR-25.7)
- [x] A wallet balance crossing below the low-balance threshold triggers a
      dashboard warning and email; staying below it past the configured
      grace period transitions the store to `orders_paused` — storefront
      still browsable, checkout blocked with a respectful notice — never
      the blanket `suspended` behavior (FR-6.25)
- [x] A verified top-up that restores the balance above the threshold
      lifts `orders_paused` instantly, with no admin action required
      (FR-6.25)
- [x] `orders_paused` never overwrites an independently admin-issued
      `suspended`/`banned` state (FR-6.25)
- [x] A wallet balance can go negative down to, but never past, the
      configured negative-float floor — a confirmed sale's commission
      debit never fails or rolls back the order (FR-6.26)
- [x] The seller dashboard shows a live Balance figure, a working top-up
      screen, and a complete transaction history rendered in plain
      language (never a raw ledger-entry-type string) (FR-6.27)
- [x] §5.6c's invoice-generation/overdue-sweep jobs are unscheduled (not
      deleted) and produce no new `seller_invoices` rows of any type going
      forward (FR-6.28)
- [x] A supplier's Premium-tier fee debits a separate supplier-scoped
      wallet, never the seller wallet of any store it's linked to
      (FR-7.10 supplement)
- [x] **Negative-float floor is an actively-enforced immediate pause, not
      just an unblocking backstop (fix, v0.25):** the moment a seller's
      balance crosses below the configured floor — checked right after a
      commission debit lands (`markAsPaid`, never blocking the debit
      itself) and again on every low-balance sweep pass — every one of
      their `active` stores transitions to `orders_paused` immediately,
      bypassing the warning/grace-days ladder entirely (that ladder still
      handles the gentler above-floor path unchanged). A verified top-up
      restores instantly via the same existing restore path — there is no
      separate "floor" restore threshold (FR-6.26)

### 14.6f Wallet Balance — Running Total & Reconciliation (built Module 47, v0.33 — FR-6.21 amended, new FR-6.29)
- [x] `WalletBalance.balance` (one row per seller) is updated atomically —
      via Prisma's `increment`/`decrement`, a single database-level
      `UPDATE`, never a read-then-write in application code — in the SAME
      transaction as every `LedgerEntry` insert, through the one function
      that does both (`WalletService.postLedgerEntry()`); every prior
      direct `ledgerEntry.create()` call site in the codebase (15 of them)
      was refactored to go through it, so no write path can bypass the
      cache update (FR-6.21 amended)
- [x] The ledger stays the append-only source of truth; `getBalance()` is
      now an O(1) read of the cache, never a re-aggregation — proven by
      `computeLedgerBalance()` (the old from-scratch recomputation,
      retained for reconciliation only) matching the cache exactly after a
      mix of credits and debits
- [x] The migration backfills `wallet_balances` from every existing
      seller's ledger sum, then hard-fails (rolls back) if even one
      backfilled row doesn't exactly match an independently recomputed
      ledger sum — the cached column is never considered "live" without
      this verification passing
- [x] A daily reconciliation sweep (`WalletReconciliationService`,
      settings-driven interval, default 24h) recomputes each seller's true
      ledger sum and compares it to the cached column; a mismatch is
      **never auto-corrected** — only recorded as an append-only
      `WalletReconciliationDrift` row and surfaced as a new admin
      notification-center line, for a human to review (new FR-6.29)
- [x] **The race fix, proven with real concurrency, not sequential
      calls:** two commission debits fired via `Promise.all` against two
      real HTTP `mark-as-paid` requests for the same seller both land
      exactly once each (no lost update under Postgres's atomic
      `UPDATE ... SET balance = balance + $delta`), and the negative-float
      floor check — reading the freshly-updated balance after each debit —
      correctly detects the case where neither debit alone crosses the
      floor but the two combined do (FR-6.21/FR-6.26)
- [x] The publish gate and the low-balance grace ladder are unaffected by
      the running-total swap — both still read correct values off the new
      cached balance (FR-6.21/FR-6.25)

### 14.7 Subscription Plans, Pricing & Billing (built Module 14; no-Free-Plan/First-Month rework v0.33 Module 44)
- [x] Plan CRUD from the admin UI creates/edits/retires a plan without a deploy
      (FR-8.2). Scoped narrowly to plan groups/tiers — the rest of FR-8.2's
      admin terminal (feature flags, commission/hold settings, etc.) is
      Module 17's job, per the build-plan's own module sequence
- [x] **v0.33:** First Month (the signup default, individual tierOrder 0)
      enforces its own plan-scoped limits correctly and carries its own
      (higher, 2%) plan-scoped commission-rate override — there is no
      Free Plan anywhere in the seeded data (FR-7.3)
- [x] A higher-tier plan's commission rate correctly overrides a lower
      tier's via Settings Registry precedence (FR-7.4) — proven between
      First Month's 2% and Starter's own explicit override
- [x] **v0.33 (Module 45):** `billing.commission_rate_percent`'s hard 2%
      ceiling rejects a write above it at every allowed scope (global,
      plan, seller) — proven directly against `SettingsService`'s
      generic min/max validation, not a new mechanism (FR-7.4)
- [x] A plan change applied mid-cycle takes effect at the next billing
      cycle, not immediately (FR-7.5). **v0.33:** every seller now has a
      real billing cycle from signup (First Month), so even the FIRST
      self-service plan-change request defers to the next cycle — the
      old "no cycle yet, applies immediately" edge case no longer occurs
      via ordinary signup (it remains reachable for a sponsored team
      member changing their own plan, since sponsorship still carries no
      cycle, FR-7.18)
- [x] Yearly billing calculates the discounted price correctly (FR-7.6) — a
      derived `yearlyPrice` field, never a second stored price. **v0.33:**
      every individual tier's launch data uses a 16.67% yearly discount
      (= 10 months' price for 12), consistent across First Month/Starter/
      Growth/Pro
- [x] A launch-campaign setting with an expiry or a counter condition stops
      applying correctly once its condition is met (FR-7.7)
- [x] Plan-scoped Settings Registry entries (product limit, template tier,
      coded-theme access) enforce correctly for a seller on that plan
- [x] **v0.33:** billing-cycle mechanics are correct for a full period —
      there is no Free Plan; every seller's cycle starts real and paid
      from signup (First Month)
- [x] **Plan-fee collection (FR-7.2, revised v0.24, revised again v0.33
      Module 44):** a seller on a paid plan is debited the plan fee from
      their prepaid wallet monthly-in-advance (§5.6e/FR-6.24), not via a
      `seller_invoices` row; insufficient balance now **pauses orders**
      (`orders_paused`) through the exact same
      `WalletGraceLadderService.pauseActiveStores()` path the wallet
      low-balance grace ladder already uses — never a downgrade to any
      other plan, since there is no Free Plan to fall back to. The
      `plan_subscription`/`group_sponsorship` `seller_invoices` schema
      from Module 14 stays dormant (FR-6.28)
- [x] An admin can grant any plan directly to a specific seller, bypassing
      checkout; the grant is captured in `admin_audit_logs` with the
      seller's before/after plan (FR-7.8)
- [x] A platform-level subscription promo code redeems correctly against
      subscription billing, respects its redemption limit/expiry, and cannot be
      applied at a seller's storefront checkout (proving it's distinct from
      store-level `discount_codes`, FR-7.9). **Disclosed limitation:** v1.0 has
      no live seller-side plan-subscription-fee billing flow to actually
      discount yet (Direct Seller Collection only mechanizes commission owed,
      FR-6.16) — the redemption mechanism itself (limits, expiry, targeting,
      one-per-seller) is fully real and tested; applying the discount to a
      real invoice amount is deferred until that billing flow exists
- [x] A free-tier supplier connected to two+ stores functions correctly per
      store but cannot reach the aggregated multi-store dashboard; upgrading
      to the paid supplier plan unlocks it with no other behavior change
      (FR-7.10). **Disclosed limitation:** only the plan DATA (Free/Premium
      Supplier tiers) is built — the aggregated multi-store dashboard this
      would gate has never been built by any module through v0.19 (no
      supplier-facing portal exists at all), and `SettingsContext` has no
      `supplierId` field yet, so there is no live gate-point to test.
      `Subscription` also only supports sellers (`seller_id`), not suppliers,
      for the same reason — a real supplier plan assignment is deferred to
      whichever future module actually builds the supplier portal
- [x] **Plan groups/tiers as data (new v0.19):** an admin can create a new
      plan group, add/reorder/retire tiers within a group, and every
      existing plan-gating mechanism (feature flags, commission laddering,
      developer perks, dashboard-personalization gating) correctly resolves
      against the new (group, tier) with no code change (FR-7.17)
- [x] The public pricing page and in-dashboard upgrade prompts render tier
      names/prices/feature lists entirely from plan-editor data — adding or
      reordering a tier changes what's displayed with no deploy (FR-7.17)
- [x] **Cross-checks (confirmed, no gap found):**
      developer perks (`theme.coded_mode_enabled`, FR-7.16) bind to the
      correct tier in the new group/tier addressing scheme; dashboard-
      personalization plan-gating (FR-28.4, an open item carried from
      Module 10 — no real seller→plan assignment existed until Module 14)
      is finally enforced, not just documented; the next-cycle upgrade/
      downgrade rule (FR-7.5) and launch-campaign pricing (FR-7.7) both
      apply correctly per-tier under the new structure

### 14.8 Platform Admin Terminal — Control Plane
- [ ] Every FR-8.x item has a passing test: feature flags, plan editor,
      commission/hold/reserve settings, seller/supplier lifecycle, template
      management, maintenance mode, risk/fraud controls, audit log, analytics
- [ ] A Settings Registry write is visible to a module's very next read within one
      cache-invalidation cycle (timed test)
- [ ] An out-of-range value (e.g. commission = 105%) is rejected by
      `settings_definitions` validation before reaching the database
- [ ] Admin MFA is mandatory — creating or using an admin account without MFA
      enrollment fails (FR-8.12)
- [x] Impersonation requires a reason before a session opens; every action during
      the session is tagged with `impersonation_session_id` in the audit log;
      ending the session is itself logged (FR-8.4) — built Module 17
- [x] **Impersonation transparency (new, v0.23):** a persistent "support mode"
      banner is present for the entire duration of an impersonation session
      (FR-8.4) — built Module 17
- [x] **Impersonation transparency:** starting a session emits a `platform_event`
      (FR-8.4/§3.11) — built Module 17
- [x] **Impersonation transparency:** the impersonated seller's own Security
      card shows a support-access history line (when, duration) — never the
      admin's identity (FR-8.4) — built Module 17
- [x] **Impersonation transparency:** a high-risk write attempted during an
      impersonation session — mark-as-paid, a payment-instruction change, or
      a payout/invoice action — is rejected, while an ordinary settings write
      still succeeds (FR-8.4) — built Module 17. **Disclosed scope note,
      closed by Module 25:** at the time this was written, "payout/invoice
      action" had no seller-facing endpoint yet to apply
      `@BlockDuringImpersonation()` to. Module 25's completeness audit found
      four that had since shipped without it — `POST
      sellers/me/wallet/topup-requests`, `POST sellers/me/subscription/
      change`, `POST sellers/me/subscription/redeem-promo`, and `POST
      sellers/me/growth-programs/withdrawals` — all four now carry the same
      decorator, proven by an e2e test asserting each returns 403 under an
      impersonation token.
- [ ] **Audit log immutability:** an attempt to `UPDATE` or `DELETE` an
      `admin_audit_logs` row fails at the database grant level (FR-8.9)
- [x] Enabling maintenance mode shows the maintenance page to buyers/sellers while
      an allowlisted admin IP still reaches the admin terminal (FR-8.7) — built
      Module 17. `/health` is excluded from the gate (infra liveness probe,
      not a buyer/seller/admin surface)
- [x] Content pages are editable from the admin terminal and versioned (FR-12.1)
      — built Module 17
- [x] Platform brand assets (logo, favicon, hero images) are editable from the
      admin terminal and versioned the same way as content pages (FR-12.3) —
      built Module 17
- [x] A seller on the entry tier with a marketplace template entitlement still
      sees only the base template tier otherwise — confirming FR-7.1/FR-8.6
      plan-tier gating and FR-24.5 entitlement gating remain independently
      correct after FR-12.3 (no regression introduced by brand-asset
      management). Holds by construction: `ContentPagesModule`/
      `BrandAssetsService` touch no theme-tier or entitlement code path at
      all
- [x] A banner/popup/in-app-notification message targeted at "plan X" is visible
      only to sellers on plan X, one targeted at a specific seller is visible
      only to that seller, and one targeted "all" is visible platform-wide
      (FR-8.15) — built Module 17
- [x] A scheduled message (banner/popup/in-app notification) becomes visible at
      its start time and stops at its end time without a deploy (FR-8.15,
      extends FR-8.7's existing scheduling) — built Module 17
- [x] Enabling maintenance mode still applies globally regardless of any
      per-plan/per-seller message targeting in flight (FR-8.7 vs FR-8.15
      precedence). Holds by construction: `MaintenanceModeMiddleware` runs in
      front of every route, including the messaging endpoints themselves
- [x] The external-API client registry lists the Template Store and Social Media
      SaaS clients; disabling one immediately rejects further calls from it
      without affecting the other (FR-8.14) — built + tested Module 18
- [x] **Financial Truth Invariant (§3.12, v0.10):** the real-time analytics
      dashboard (FR-8.10) and unit-economics dashboard (FR-23.4) both exclude
      a deliberately-constructed unpaid order from every count/total they
      display — FR-8.10 built + tested Module 17; FR-23.4 already proven
      Module 14
- [x] **Listing Moderation Engine admin page (FR-27.6, v0.11):** a bare
      functional page lists the moderation queue (Module 6), lets an admin/
      REVIEWER open a queued product's details, and approve/reject it with
      notes — a REVIEWER account sees only this page in the admin terminal,
      confirming §14.25's negative-access guarantee holds at the UI layer
      too, not only at the API layer — built Module 17, calling Module 6's
      already `@AllowReviewer()`-guarded endpoints verbatim, so the negative-
      access guarantee holds by construction (no separate auth path exists
      for the new page to bypass)
- [x] **Admin Completion, Module 25 (P0), founder-directed completeness
      audit closing the gap this whole section's own checklist items
      never covered — a home overview, global search, and a unified
      per-seller view):**
  - [x] Every pending-queue count on the admin HOME page (`GET
        admin/overview`) jump-links to its own queue page in one click —
        wallet top-ups, Verified Store applications/re-review, product
        moderation, T&S payment-review + all five monitor flag types, and
        (as of Module 25 P1) the three growth-program queues and the
        careers queue too — every jump-link on the HOME page now resolves
        to a real, built page
  - [x] Global search (`GET admin/search?q=`) finds a seller, store,
        order, and supplier each by a partial substring of its name/
        email/ID — proven by one e2e test per entity type, including a
        `id::text ILIKE` partial-UUID match (Prisma's typed query API
        can't filter a `@db.Uuid` column by substring at all; this
        required raw `$queryRaw` + `Prisma.sql`, this codebase's
        pre-existing pattern from `StorefrontService`'s ranked search)
  - [x] The seller-360 page (`GET admin/sellers/:id/overview`) renders
        every section the founder's audit named for one seller in one
        response: profile, stores (with live health score + verified
        status), wallet balance + recent ledger, invoices, T&S flags
        (filtered from the existing monitor services, not recomputed),
        devices/sessions, growth-program participation, and a merged
        audit-log + platform-event timeline — proven by an e2e test
        asserting every section is present and correctly scoped to that
        one seller
  - [x] Every Settings Registry key is now editable end-to-end through
        the admin UI (`/admin/settings`), not just listable: a new `GET
        admin/settings/resolve` endpoint exposes the same PRECEDENCE
        order `SettingsService.resolve()` uses as a full chain (every
        allowed scope's own override, or its absence, plus who last
        changed it and when), so the UI never guesses which scope is
        winning. The write form is type-aware (boolean/number/string/
        json, with the definition's own `min`/`max` enforced client-side
        before the request even fires, mirroring
        `SettingsService.validateValue()`'s server-side rules) and shows
        a confirm-with-old-vs-new-value step for any key under
        `billing.*`, containing "commission", or under
        `platform.maintenance*` — proven by an e2e test setting a
        seller-scoped override on `billing.commission_rate_percent` and
        asserting the resolve endpoint reports the correct winning scope,
        effective value, and the acting admin's own email as
        last-changed-by
  - [x] A new admin "adjust wallet" action (`POST
        admin/wallet-topups/sellers/:sellerId/adjust`) credits or debits
        a seller's wallet with a mandatory reason, rejects a zero amount
        or a missing reason (400), and is audit-logged with the reason
        attached to the audit entry (two new `LedgerEntryType` values,
        `admin_manual_credit`/`admin_manual_debit`, migration
        `20260726090000_module25_admin_completion`) — proven by an e2e
        test covering both directions and both rejection cases, plus an
        `admin_audit_logs` row assertion
  - [x] **Module 25 P1 (frontend for the eight previously API-only
        surfaces):** growth-programs applications/content-submissions/
        withdrawals queues (`/admin/growth-programs/*`), careers
        (`/admin/careers` — postings + the full applicant pipeline, CV/
        contact details never on a public endpoint), the real commission-
        invoices list (`/admin/commission-invoices`, correctly split from
        `/admin/invoices`'s own wallet-top-ups screen — see below),
        supplier adapters (`/admin/supplier-adapters` — register/enable/
        disable/reconfigure without a deploy), an audit-log viewer
        (`/admin/audit-log`, read-only — the table is insert-only by DB
        grant), admin-granted-plan + platform promo codes (added to
        `/admin/plans`), category creation (`/admin/categories`), and the
        T&S self-referral monitor panel (added to the existing
        `/admin/trust-safety` page). Every one of these reuses an
        already-built, already-tested backend endpoint — the two genuine
        gaps that had NO e2e coverage anywhere before this phase (the
        Creator content-submission verify/reject queue and category
        creation) are now covered, plus new coverage for the
        supplier-adapter registry and the audit-log list endpoint.
        Suspend/terminate on an already-approved growth-program
        participant, and a fraud clawback, are wired on the seller-360
        page instead of the applications queue (that queue's
        `listQueue()` only ever returns `pending` rows, so a non-pending
        participant is only reachable per-seller).
  - [x] **Module 25 P1 (system status page):** `GET admin/system-status`
        (genuinely new instrumentation) reports database/Redis/object-
        storage reachability and every one of the 12 BullMQ background
        queues' job counts (waiting/active/delayed/failed) via
        `getJobCounts()` against each queue's own name — proven by an
        e2e test asserting all three infra checks and at least 10 queues
        report numeric counts. Email delivery failures and backups are
        disclosed stub lines, not faked data: `EmailService` has no real
        provider integrated yet in this environment (console-log
        fallback only), and the founder explicitly authorized a
        "backups: not yet configured" line until the OPS Security
        Hardening pass lands.
  - [x] **Module 25 P1 (admin notification center):** a new
        `AdminUser.lastSeenNotificationsAt` column (migration
        `20260726150000_module25_p1_notification_center`) plus `GET
        admin/notifications` diffing every row-based admin queue
        (wallet top-ups, Verified Store applications, moderation,
        growth-program applications/content/withdrawals, career
        applicants) created since that timestamp, and `POST
        admin/notifications/mark-seen` to clear it — proven by an e2e
        test showing a pending row created before the admin's first
        visit counts as new, `mark-seen` zeroes the count, and a
        genuinely new row afterward shows up again. Deliberately scoped
        to row-based queues only — the T&S monitor views on the HOME
        overview are live-computed aggregates with no per-row "created
        since X" concept, so they stay overview-only counts.
  - [x] **Module 25 P2 (bulk actions + the `/admin/invoices` split):**
        checkbox multi-select + "approve/reject selected" on the
        moderation queue, and "verify/reject selected" on the wallet
        top-ups queue — both reuse the existing per-item endpoint via
        `Promise.all` rather than a new bulk backend endpoint (each
        action was already idempotent and already audit-logged
        individually, so batching client-side adds no new failure mode).
        `/admin/invoices` was already correctly the wallet-top-ups screen
        (Module 20 repurposed that route; the nav already labeled it
        "Wallet top-ups") — the actual fix was adding the missing
        `/admin/commission-invoices` screen for `AdminInvoicesController`
        (mark-paid, waive-commission), which had a working backend but no
        frontend at all before this phase.
- [ ] **Confirmation-required destructive/money-moving actions (FR-8.16,
      v0.40 — UI feature inventory audit fix):** a single shared confirm
      component/hook is used by every flagged action (wallet adjust,
      clawback, mark-paid, waive commission, complete refund, seller
      lifecycle change including ban, moderation force-remove, plan
      retire, external-API secret regenerate, email-account unlink,
      message delete, supplier-adapter toggle, and every bulk-action
      variant) — proven by each calling the same `useConfirm()` hook, not
      a page-local reimplementation. Send Newsletter requires the admin to
      type an exact confirmation word before the Send button enables.
      `SettingsDefinition.requiresConfirmation` (new column) replaces the
      prior hardcoded `billing./commission/platform.maintenance` frontend
      string-match — proven by an e2e test that a definition seeded
      `requiresConfirmation: false` skips the confirm step, and one seeded
      `true` requires it, from both the standalone Settings Registry
      editor AND Seller-360's own settings-override mini-editor (closing
      the inconsistency where the mini-editor previously bypassed this
      check entirely).

### 14.9 Media Management
- [ ] Google Drive import copies files into MinIO; the storefront still serves
      those images after simulating Drive being unavailable (FR-9.1, FR-9.2)
- [ ] Cloudflare CDN correctly caches and serves MinIO-backed assets
- [ ] **Events emitted (backfilled, v0.8):** see §14.2's `media.imported` item
      — restated here since this is media's own checklist section
      (§3.11/FR-26.5)

### 14.10 Notifications
- [ ] Order/payout/listing email notifications fire correctly and are not
      blocked by a queue backlog under simulated load (FR-10.1)

### 14.11 Custom Domain
- [ ] Domain attach → DNS verification → TLS issuance completes for a real test
      domain within the documented time window (FR-11.2)
- [ ] The `domains.domain_name` unique index correctly resolves the tenant on
      every request, with no ambiguity for two similarly-named domains (FR-11.1)
- [ ] **Events emitted (backfilled, v0.8):** attaching a domain produces a
      `domain.attached` row in `platform_events`; a successful verification
      produces a `domain.verified` row — both with no PII in `metadata`
      (§3.11/FR-26.5)
- [x] The domain-upsell affiliate block renders the current Settings
      Registry URL/partner name and is completely absent from the page when
      the enabled flag is off (FR-11.3, new v0.18)

### 14.12 Security & Compliance (cross-cutting, applies to every module above)
- [x] The full automated cross-tenant test suite passes as a release gate
      (§3.2, Module 21) — CI's `e2e-tests` job (`.github/workflows/ci.yml`)
      runs the whole suite (274 tests) against real Postgres/Redis on every
      push, blocking on any failure
- [x] Rate limiting verified on auth endpoints, listing-submission endpoints,
      payout-request endpoints, the Product Feed API, the Template Install/
      License API, and public storefront/API endpoints (Module 21 audit) —
      signup/password-reset already used `RateLimitService`; **login (seller
      and admin) was the one real gap found and closed**, same dual-key
      (per-account + per-IP) pattern, new Settings Registry key
      `auth.login_rate_limit_per_hour`; listing-submission, the Product Feed
      API, and the Template Install/License API each already had their own
      Settings-Registry-configurable limits from their own modules;
      storefront/public API endpoints are covered by the global
      `ThrottlerGuard` (100 req/60s/IP); payout-request endpoints don't exist
      in v1.0 - payouts are dormant per §5.6b, confirmed via a full
      controller-route grep, not assumed
- [x] **Rate-limit re-audit, Phase B pre-launch (SRS/founder audit,
      ~15 modules shipped since the Module 21 audit above).** A full
      controller inventory across Modules 22-47 against `RateLimitService.
      enforcePerHour()` coverage found 11 new gaps, all closed with the same
      dual-key-where-applicable pattern and a Settings-Registry-tunable
      limit: `POST /storefront/checkout` (highest severity - public,
      unauthenticated, creates a real order; `orders.
      checkout_rate_limit_per_hour`), `POST /storefront/cart` (`orders.
      cart_create_rate_limit_per_hour`), `POST /storefront/unlock`
      (password-gate brute force; `storefront.
      unlock_rate_limit_per_hour`), `POST /storefront/gift-cards/purchase`
      (`gift_cards.purchase_rate_limit_per_hour`), `POST /auth/mfa/verify`
      and `POST /admin/auth/mfa/verify` (a 6-digit TOTP code is a genuinely
      guessable space; shared key `auth.mfa_verify_rate_limit_per_hour`),
      `POST /stores/:storeId/campaigns` (bounds burst/cadence, distinct from
      the existing monthly-volume quota; `email_campaigns.
      create_rate_limit_per_hour`), `POST /admin/email/accounts/:id/
      test-connection` and `POST /admin/email/reply` (real outbound
      IMAP/SMTP/email actions with no prior cap; `admin_email.
      test_connection_rate_limit_per_hour` / `admin_email.
      reply_rate_limit_per_hour`), `POST /storefront/order-status/:token/
      reviews` (`reviews.submission_rate_limit_per_hour`), and
      `POST /careers/:jobPostingId/apply` (`careers.
      apply_rate_limit_per_hour`). Staff login (Module 35) was re-confirmed
      already correctly rate-limited. Order-verification OTP resend/attempt-
      caps (Module 26) and on-demand data-export cooldowns (Module 24) were
      re-confirmed as already-adequate equivalent mechanisms, not
      `enforcePerHour`-based but functionally the same. Three low-severity
      findings were deliberately left as-is with reasoning recorded: email-
      verification tokens (256-bit, brute force infeasible), the cross-SaaS
      eligibility endpoint (HMAC-signed, not truly public), and a seller's
      own order-verification resend (requires seller auth, low abuse
      ceiling). New e2e suite `phaseb-item1-rate-limits.e2e-spec.ts` proves
      each new limit fires a real 429 once exceeded.
- [x] Secrets (gateway keys, supplier API credentials, Drive OAuth secrets, and
      both external-SaaS signing secrets) are confirmed stored in an encrypted
      secrets store, never in a committed env file (Module 21) — `.env`/
      `.env.test` gitignored throughout this engagement (verified via `git
      status` never showing them tracked); `docs/launch-runbook.md`'s
      Secrets section is the deployment doc for the real production secrets
      store
- [x] PII redaction verified in application logs (Module 21) —
      `PiiRedactionInterceptor` logs method/path/status/duration only, never
      body/query/headers; `pii-redaction.interceptor.spec.ts` asserts no
      email/password/token/cookie value ever appears in the logged string
- [x] A dependency-vulnerability scan runs in CI and blocks a
      deliberately-introduced known-vulnerable dependency (Module 21) — CI's
      `dependency-audit` job runs `pnpm audit --audit-level=critical`
      (blocking, currently 0 findings) plus a `--audit-level=high`
      informational report, and
      `scripts/verify-dependency-audit-blocks-vulnerable-package.sh` proves
      the scanning mechanism itself works by pinning a real known-vulnerable
      package (`minimist@0.0.8`) in a throwaway fixture and asserting the
      audit catches it
- [x] **RLS defense-in-depth tests, Phase B pre-launch (founder audit).**
      Tenant isolation ultimately rests on `TenantPrismaService.run()`
      (`apps/api/src/prisma/tenant-prisma.service.ts`) — the ONE place in the
      codebase that builds SQL by string concatenation (`SET LOCAL app.
      current_seller_id = '...'`, required because Postgres's wire protocol
      cannot parameterize `SET LOCAL`), guarded by a syntactic UUID regex
      check before interpolation. This was already correct, but had no
      dedicated test proving it — a future refactor could have silently
      weakened or removed the guard with nothing going red. New unit suite
      `tenant-prisma.service.spec.ts` (16 tests) proves: a SQL-fragment
      string, a valid UUID immediately followed by a SQL fragment, an empty
      string, whitespace-only, `null`, `undefined`, a Cyrillic-homoglyph
      string shaped like a UUID, an oversized string (valid-UUID prefix +
      10,000 trailing characters), malformed hyphenation, a bare numeric id,
      an embedded quote, a trailing newline, and a leading space are ALL
      rejected — and, critically, that `$transaction()` is never even
      called for any of them (the rejection happens before the raw SQL is
      ever built, not merely as a query that happens to fail). Two positive
      controls (lowercase and uppercase valid UUIDs) confirm the guard
      doesn't over-reject and that the exact expected value reaches
      `$executeRawUnsafe()`.
- [x] **Key rotation + breach runbook, Phase B pre-launch (founder audit).**
      All five encrypted-at-rest domains (CNIC, Google Drive refresh
      tokens, external-API client secrets, seller SMTP credentials, admin
      email credentials) turned out to already share one AES-256-GCM
      implementation under five independent keys — a new generic
      `scripts/rotate-encryption-key.ts` utility (decrypt-with-old,
      re-encrypt-with-new, one atomic operation per row, `--dry-run`
      support, non-zero exit on any row failure) covers all five rather
      than five near-duplicate scripts, proven correct by 9 round-trip
      unit tests. `docs/launch-runbook.md` gained a dedicated "Encryption
      Key Rotation + Breach Response" section: routine rotation
      (dry-run → backup → rotate → restart → verify → destroy the old
      key) and full breach response (maintenance mode via the existing
      FR-8.7 mechanism, platform-wide session force-logout via Redis
      `FLUSHALL`, key rotation, downstream plaintext-exposure rotation per
      domain, `JWT_ACCESS_SECRET` rotation if warranted, an audit-log
      review, and a writeup step).

### 14.13 Customers (CRM)
- [x] A checkout — storefront or manual (FR-17.1) — auto-creates or matches a
      `customers` row by email, updating order count and total spent correctly
      (FR-13.1)
- [x] Customer list/detail view in the seller dashboard shows correct order
      history
- [x] **Tenant isolation:** the same buyer email at two different stores produces
      two separate `customers` rows; seller A's customer list never includes
      seller B's customers, even for an identical email (FR-13.3)

### 14.14 Product Reviews & Ratings
- [x] A buyer can submit a review via the order-status link without an account
- [x] A review linked to a real order for that product/store is flagged
      `verified_purchase`; one submitted without an order reference is not
- [x] A review does not affect the product's displayed average rating until a
      seller approves it (FR-14.3)
- [x] Average rating/review count update correctly when a review's status
      changes approved ↔ hidden
- [x] **Tenant isolation:** a seller cannot moderate another store's reviews

### 14.15 Cart Persistence & Abandoned Carts
- [ ] Checkout captures email as the first field/step, before payment details
      (FR-15.1, locked UX decision) — a cart row is created only once that step
      completes, never before
- [ ] The abandoned-cart scheduled job correctly flags a cart inactive beyond the
      configured window, and does not flag one still in progress
- [ ] **Tenant isolation:** a cart is only ever visible to its own store's
      dashboard

### 14.16 Storefront Discovery & Merchandising
- [ ] A collection renders its assigned products correctly on the storefront
      (FR-16.1)
- [ ] Search returns relevant results using Postgres full-text search; price/
      category/collection filters narrow results correctly (FR-16.2)
- [ ] Navigation editor changes (header/footer, including free-text and
      social-links footer blocks, FR-16.3) reflect live on the storefront with no
      deploy
- [ ] Announcement bar and coming-soon/password mode toggle correctly (FR-16.4,
      FR-16.5)
- [ ] Structured data validates against schema.org's `Product` type; `sitemap.xml`
      and `robots.txt` generate correctly per store (FR-16.6)
- [ ] WhatsApp button appears only when enabled and links to the configured
      number (FR-16.7)
- [ ] Social media icons (FR-16.8) render only for the platforms a seller has
      configured, linking to the correct URLs
- [ ] FAQ accordion (FR-16.9) expands/collapses correctly and renders seller-
      entered Q&A pairs in order
- [ ] **Tenant isolation:** collections, navigation menus, and discovery settings
      for store A never leak into store B's storefront rendering

### 14.17 Manual/Draft Orders & Order Management Enhancements
- [ ] A manual order created from the dashboard produces correct order/order-item
      rows identical in shape to a storefront-originated order (FR-17.1)
- [ ] "Mark as paid directly" — the **only** v1.0 payment path for manual orders —
      produces a `manual`-type payment row and correct ledger entries; no
      payment-link generation UI exists in v1.0 (confirms FR-17.1's bounded scope)
- [ ] Order notes are never exposed on any buyer-facing surface (FR-17.2)
- [ ] Order tags filter the dashboard order list correctly (FR-17.3)
- [ ] Every status change, note, and edit appends a timeline event, including
      before/after values for an edit (FR-17.4)
- [ ] An edit to a `shipped` order is rejected; an edit to a `pending`/`confirmed`
      order that changes the total produces a compensating ledger entry, never a
      rewrite of the original entry (FR-17.5)
- [ ] An order edit that changes item quantities correctly adjusts
      `product_variants.stock_quantity` in both directions (FR-17.5)

### 14.18 Data Portability (CSV Import/Export)
- [x] A Shopify-format product-export CSV imports successfully for the core-field
      mapping (title, description, price, variants/options, images, inventory —
      FR-18.1); the import screen explicitly lists fields it did **not** map for
      that upload
- [x] A CSV containing metafields or complex nested option combinations imports
      its mapped fields correctly and does not silently drop or corrupt the
      unmapped ones — they are visibly listed as unmapped, not lost without a trace
- [x] Import runs as a background job and does not block the dashboard; a bad row
      is logged with a clear error and does not fail the entire import (FR-18.2)
- [x] Product and order CSV export produce files a seller can re-import elsewhere
      (round-trip tested) (FR-18.3)
- [x] **Tenant isolation:** an export for store A never includes store B's data

### 14.19 Receipts, Invoices & Tax
- [x] A PDF invoice generates correctly (currency, tax line correct) and attaches
      to the order-confirmation email and the order-status page (FR-19.1). **Note
      (v0.21):** no store-logo-upload capability exists anywhere in the platform as
      of Module 15, so the "branded" header is the store name in a designed
      typographic mark, not an uploaded image — see FR-19.1's revised text.
      **Known hardening item, flagged not fixed (v0.28, surfaced during
      Module 24's security review):** `Order.invoicePdfUrl` uses the same
      plain, permanent, unsigned public MinIO URL pattern that Module 24's
      export bundles were found to wrongly reuse for genuinely
      PII-sensitive files. An invoice is lower-sensitivity than a full
      customer export (one buyer's own order, not a seller's whole
      customer/order list) — not nothing, but not the same severity — so
      this is deliberately **not** fixed as a side effect of Module 24 (no
      scope creep on an unrelated, already-shipped, already-tested
      FR-19.1 path). Revisit alongside the OPS Security Hardening pass or
      a future module: the same private-prefix + authenticated-download
      pattern built for Module 24 would apply directly.
- [ ] **Exactly one invoice template exists in v1.0** (true — built, tenant- and
      tax-mode-tested), but it **still needs the single, explicit founder sign-off**
      against the "clean and professional" bar (FR-19.2) before this line can be
      checked — not something the build itself can self-certify.
- [x] Tax is computed correctly for both tax-inclusive and tax-exclusive store
      settings and itemized correctly on the invoice (FR-19.3)

### 14.20 Seller Onboarding Wizard (built Module 16)
- [x] Progress state persists correctly across sessions (FR-20.1) - backed by
      `stores.onboarding_theme_ack_at`/`onboarding_domain_ack_at`/
      `onboarding_completed_at`, not client-side state
- [x] Completing all four steps marks onboarding complete and the wizard no
      longer interrupts the dashboard. **Sticky by design:** once
      `onboardingCompletedAt` is set it is never recomputed or cleared - a
      later change (e.g. deleting the only product) can never resurrect the
      wizard for a seller who already finished it
- [x] The theme and domain steps each have both a derived path (a real
      customizer save; an attached custom domain) and an explicit-
      acknowledgment path ("keep this theme" / "use the free subdomain") -
      keeping the default is a valid, deliberate choice with no other
      action to detect it by

### 14.21 Business Guard-Rails & Platform Economics (built Module 14; reworked v0.33 Module 44 — no Free Plan)
- [x] A store's product creation is rejected once its plan's product-count
      limit is reached — not merely warned (FR-23.1); proven against
      First Month's own plan-scoped override, since a global-scope test
      value is now shadowed by it (Settings Registry precedence: plan
      beats global). Storage quota metering also built
      (`media_assets.size_bytes` + `catalog.storage_quota_bytes`)
- [x] The dormant-store job correctly progresses a test store through warning →
      suspend → archive at the configured thresholds, and not before them (FR-23.2).
      Each threshold is measured from the *previous* stage's own trigger
      (`dormant_warning_sent_at` anchors suspend; `updated_at`, bumped
      automatically the moment this job suspends a store, anchors archive) —
      no third timestamp column needed beyond the two build-plan.md already
      reserved on `stores` for this feature. Plan-agnostic — applies to
      any store regardless of tier
- [x] A paid-plan-only feature is verifiably inaccessible on First Month
      (the signup default, v0.33 — no override there) regardless of
      account age — no "trial expired" code path exists to accidentally
      leave open (FR-23.3)
- [x] The unit-economics dashboard reports a single total active-store
      count and total commission earned (v0.33 — the free-vs-paid split
      is retired, not replaced with a per-tier breakdown, a disclosed
      scope decision), and the break-even view reflects the admin-entered
      cost figure against computed revenue (FR-23.4). **Disclosed scope
      decision:** built as data only (`UnitEconomicsService`/
      `GET /admin/unit-economics`) — no dashboard UI. FR-8.10 (the
      real-time analytics dashboard this extends) isn't built until
      Module 17 per the module sequence's own "Zero dashboard work in
      this revision" note; there is nothing yet for a "unit-economics
      dashboard" to be a tab within
- [x] **v0.33 (Module 44):** `FreeStoreLimitService` and the per-identity
      Free-store velocity limit it enforced (FR-23.5, formerly checked
      here) are retired outright — there is no Free Plan left to guard a
      velocity limit around. A second store for the same verified
      identity is no longer blocked by this mechanism (proven in
      `trust-safety.e2e-spec.ts`'s name-consistency test, which used to
      need a settings override to create a second store and no longer
      does)
- [x] **Financial Truth Invariant (§3.12, v0.10):** the total commission
      figure in FR-23.4's unit-economics data is unaffected by a
      deliberately-constructed unpaid order — holds by construction,
      since `UnitEconomicsService` only sums `ledger_entries` (which
      FR-6.16 never writes for an unpaid order), the same rule already
      proven for `ledger_entries` itself in Module 11's own suite

### 14.22 External-SaaS Integration Hooks
- [x] A store's theme-selection UI functions fully (built-in free templates
      selectable, store creation unaffected) with the Template Store's showcase
      link deliberately made unreachable — proving no hard dependency (FR-24.1,
      FR-24.2). `template_store.showcase_url` defaults to empty, so the
      showcase panel is hidden entirely (never a broken link) until a real
      Template Store exists and an admin configures it
- [x] A signed, valid Template Install/License API call correctly creates a
      `themes` entry (if new) and a `template_entitlements` row scoped to the
      calling seller only
- [x] An unsigned or invalidly-signed call to the Template Install/License API is
      rejected before any entitlement is granted (FR-24.6, security release gate)
- [x] A revoke call correctly removes a seller's entitlement without affecting
      any other seller's entitlement to the same theme, or the `themes` catalog
      entry itself (FR-24.6)
- [x] A seller on the entry tier who receives a marketplace template
      entitlement can use that one template despite their plan's tier
      otherwise excluding premium templates — the two gating checks
      (entitlement, plan tier) are verified independently (FR-24.5). **Closes a real, disclosed gap**: `themes`'s
      `tier` column had zero plan-based enforcement since Module 4 (its own
      doc comment: "no gating enforced yet — Module 11/14's job"); the new
      `theme.premium_tier_enabled` key (default `false`, same "off for every
      seller in v1.0" precedent as `theme.coded_mode_enabled`) makes this a
      real, independently-testable gate rather than a no-op
- [x] The "Marketing" dashboard section correctly hands off to the Social Media
      SaaS via SSO with no second login prompt (FR-24.8). The handoff token is
      a short-lived JWT signed with the same `JWT_ACCESS_SECRET` every seller
      access token already uses (reusing §3.2a's hook, not a second scheme);
      `social_media_saas.marketing_handoff_base_url` defaults to empty, so the
      dashboard shows a documented "not configured yet" message rather than a
      broken handoff until the real product exists
- [x] The Product Feed API returns only the calling seller's own products, never
      another seller's — **tenant isolation test**, same rigor as every other
      tenant-scoped endpoint (FR-24.11)
- [x] A seller can see and revoke a connected Social Media SaaS token from the
      dashboard; a revoked token is rejected on its very next use (FR-24.10)
- [x] Both external-API clients are individually toggleable from the admin
      registry without affecting each other or any other module (FR-8.14)
- [x] An SSO handoff and a signed API call from either SaaS both carry a
      verifiable referral-attribution signal, recorded in `admin_audit_logs` as a
      system actor (FR-24.13). **Flagged interpretation**: recorded once per
      SSO handoff and once per Template Install grant/revoke (the same
      checkpoints FR-24.6 already logs) — not once per Product Feed API call,
      which would be per-request noise inconsistent with this SRS's own
      `platform_events` lean-taxonomy discipline (§3.11); the token/signature
      mechanism itself is what proves origination on every read
- [x] The cross-SaaS discount-eligibility endpoint answers correctly for a
      seller whose plan grants eligibility vs. one whose doesn't, returns
      only the eligibility boolean (never discount terms), and is rejected
      when called unsigned (FR-24.14)

### 14.23 Platform Event Log (cross-cutting, applies to every module from here on)
- [ ] Every lifecycle event listed for a given module (FR-26.5 and each later
      module's own list) produces exactly one `platform_events` row with the
      correct `event_type`/`actor_type`/`actor_id`/`store_id`/`entity_type`/
      `entity_id` (FR-26.1)
- [ ] `metadata` on a sampled event from every module contains no PII — IDs
      only (FR-26.4)
- [ ] A simulated event-write failure (e.g. a deliberately broken DB call)
      does not fail or roll back the user-facing action that triggered it
      (FR-26.3)
- [ ] `UPDATE`/`DELETE` on `platform_events` fails at the database grant
      level, same as `admin_audit_logs` (§3.11)
- [ ] `platform_events.retention_days` resolves correctly through the
      Settings Registry (no archival job exists yet to consume it — this
      only proves the tunable itself works)
- [ ] **Financial Truth Invariant (§3.12, v0.10):** `order.placed` is emitted
      only once payment is verified (or a manual order is marked paid) —
      never on cart/checkout submission; a deliberately-constructed unpaid
      order produces no `order.placed` row at all

### 14.24 Seller Account Security (new, v0.10; built Module 13)
- [x] A seller can enroll in TOTP 2FA using the same enroll/verify flow proven
      on admin accounts (FR-25.6); an invalid code is rejected. Built as
      **two** paths: the login-time pre-auth flow (`/auth/mfa/enroll`,
      `/auth/mfa/verify`, used when enforcement already requires a code) and
      a voluntary authenticated flow (`/sellers/me/mfa/enroll`,
      `/sellers/me/mfa/verify`) for a seller opting in under the default
      `optional` mode — the FR's "seller's own choice" language has no
      meaning without the second path, since the pre-auth flow alone never
      triggers when enforcement is `optional` and the seller isn't yet
      enrolled
- [x] `auth.seller_mfa_enforcement` resolves correctly per scope (global/plan
      only, per the FR's literal text — no seller-scope override for this
      key): `optional` never blocks login without 2FA; `required_always`
      blocks login itself without a valid code. **Disclosed limitation:**
      `required_for_payout_actions` has no real gate-point in v1.0 — Direct
      Seller Collection has no payout-request or payout-account-change
      endpoint yet (payouts are dormant), so this enforcement value is
      accepted and stored but does not currently gate anything
- [x] A seller's dashboard lists every active session/device with correct
      device label/IP/last-active data, and revoking one immediately ends
      that session (its next authenticated request fails) without affecting
      the seller's other active sessions (FR-25.7)
- [x] `auth.max_concurrent_devices` resolves with correct scope precedence
      (`seller` > `plan` > `global`, per §3.8); a login attempt beyond the
      resolved limit is rejected with a clear reason, not silently evicting
      an existing session
- [x] A seller-scoped override of `auth.max_concurrent_devices` (simulating a
      purchased extra-device-slot add-on) raises that one seller's limit
      without affecting any other seller on the same plan. The matching
      `auth.extra_device_slot_price` (global only) is a stored mechanism
      only — no checkout/billing flow reads it yet; the monetization
      decision is deferred to launch, per the FR
- [x] FR-25.1-25.4 (password reset) were already built in Module 1 — not
      touched this module. FR-25.5 (regional launch gating) belongs to
      Module 16 (Seller Onboarding Wizard) — not touched this module.

### 14.25 Listing Moderation Engine (new, v0.10 — launch-blocking legal safety)
- [ ] A product whose title/description contains a configured banned keyword
      is rejected at submission with a clear reason (FR-27.1)
- [ ] A product containing a configured restricted keyword is created but
      enters the moderation queue and is not publicly visible until approved
      (FR-27.1)
- [ ] A product in a configured restricted category enters the moderation
      queue regardless of its keywords passing every other check (FR-27.2)
- [ ] A new (non-trusted) seller's first N products enter the moderation
      queue regardless of keyword/category checks; the (N+1)th product,
      after N approvals, does not (FR-27.3)
- [ ] A seller marked `is_trusted` bypasses probation and the keyword/
      category queue entirely; their listing is still recorded correctly
      (FR-27.4)
- [ ] A product with `moderation_status = pending` never appears in the
      public storefront (Module 4) or Discovery search/collections
      (Module 5) — **tenant-agnostic public-visibility test**, not just a
      seller-dashboard check (FR-27.5)
- [ ] A REVIEWER admin account can approve/reject a queued product with
      notes, and cannot reach any other admin surface (commission/plans,
      payouts, seller/supplier lifecycle, settings, the audit log itself) —
      tested as a negative-access case, not just a positive capability check
      (FR-27.6, §4)
- [ ] Every moderation decision (queued reason, approve, reject) is captured
      in `admin_audit_logs` with the correct reviewer/admin actor (FR-27.6)
- [ ] **(new, v0.13) A banned supplier-sourced listing is blocked at the
      moment of seller approval** - the seller's approve action itself
      fails with a clear reason, no product is created (FR-27.8)
- [ ] **(new, v0.13) A restricted-keyword/category supplier-sourced
      listing is approved by the seller but stays invisible on every
      public storefront surface until platform approval** - proving the
      seller's approval and the platform's moderation approval are two
      independent gates, not one (FR-27.8)

### 14.26 Seller Dashboard UI (new, v0.12)
- [x] **Beginner walkthrough review:** each core task (add a product with
      images, set a shipping rate, create a discount code, view/pay/track an
      order, invite a supplier) exercised end-to-end against the real API
      (Playwright + curl) and confirms: the screen's purpose is clear at a
      glance; advanced options sit behind an expander, not cluttering the
      default view; save/cancel and list/detail placement match every other
      screen; and every empty state explains itself and offers the next
      action (FR-28.1/28.2)
- [x] Product/media, shipping/tax/discount-code, and order-management
      screens are all present and functional against the real API — no
      screen still links to a "coming soon" placeholder (FR-28.1)
- [x] Tenant isolation holds at the UI layer too: verified directly — a
      second seller's browser session, pointed at the first seller's store
      URL, receives the same 404 the API already returns and renders the
      screen's normal empty state, never the other seller's data (FR-28.1)
- [x] A shared list/detail/form component pattern is reused across every
      screen this module builds, not a bespoke layout per screen (FR-28.3)
- [ ] An entry-tier seller sees only the built-in dashboard theme/wallpaper
      set; a higher-plan seller sees the correct additional options gated by
      Settings Registry precedence, not hard-coded per plan (FR-28.4) —
      **not yet gated.** The theme picker itself is built and every preset
      is stored/applied correctly, but no `Seller`-to-`Plan` relation exists
      in the schema yet (Module 11 hasn't given sellers a real plan
      assignment), so every seller currently sees the full preset set.
      Revisit once Module 11 ships.

### 14.29 Trust & Safety System (new, v0.15) — Module 12
- [x] Signup fails closed (acceptance prompt only, no dashboard access)
      until the current Seller Agreement version is accepted; a version
      bump correctly forces re-acceptance for existing sellers (FR-29.1) —
      **scope note:** the re-acceptance gate (`SellerAgreementGuard`) is
      wired onto `SellersController` (the seller-profile gateway a
      dashboard shell checks first), not retrofitted onto every seller-
      scoped controller in the app — a deliberate, disclosed narrowing
      given the size/regression-risk of a blanket rewire against how
      rarely this fires (only after an admin publishes a new version)
- [x] Every acceptance records the correct timestamp and IP (FR-29.1)
- [x] Signup-velocity, cancellation-rate, pending-forever-rate, and
      bypass-attempt thresholds each correctly flag a deliberately
      constructed over-threshold case and do *not* flag an under-threshold
      one (FR-29.3)
- [x] A repeated banned/restricted-keyword submission pattern from the same
      seller is detected as a bypass-attempt signal distinct from a single
      blocked listing (FR-29.3) — **gap fixed alongside this:** a banned-
      keyword block previously wrote nothing persistent at all; now emits
      one `platform_events` row via the existing `EventsService.emit()`
      mechanism (no new table)
- [x] Every T&S enforcement action (warning/restriction/suspension/ban) is
      captured in `admin_audit_logs` with actor, target, and reason (FR-29.4,
      FR-8.9)
- [x] No T&S flag auto-escalates a seller's lifecycle state without an
      explicit admin action — proven by constructing a flag-worthy condition
      and confirming the seller's account is unaffected until an admin acts
      (FR-29.4)

### 14.30 Seller Identity & Commission-Fraud Defense (new, v0.16) — Module 12
- [x] A malformed CNIC (wrong length, bad checksum) is rejected at entry
      with a clear error, before it is ever stored (FR-30.1) — **disclosed
      simplification:** NADRA has no public check-digit algorithm, so
      "checksum" is a Luhn check (a standard, defensible input-validation
      measure), not a claim of replicating NADRA's internal algorithm
- [x] A CNIC already attached to any seller — active, suspended, or banned —
      cannot be reused to activate a second seller account (FR-30.1)
- [x] The stored CNIC is encrypted at rest; no log line, error message, or
      API response ever contains the plaintext value; the seller's own view
      shows only a masked (last-4) form (FR-30.1)
- [x] The CNIC input itself explains, in plain language, why it's required
      (fraud prevention + payout compliance), that it's encrypted at rest,
      never shown to anyone in full, never shared, and that only the last 4
      digits are ever displayed — plus what completing it unlocks (checkout)
      (FR-30.1, pre-launch audit finding — trust-messaging psychology fix,
      Module 12's dashboard settings screen)
- [x] Saving a payment instrument without both the declared account title
      and the explicit "registered in my own name" checkbox is rejected
      (FR-30.2)
- [x] A declared account title that clearly matches the seller's name
      (allowing for reasonable transliteration variance) saves without a
      flag; a clearly mismatched title lands the instrument in the review
      queue without blocking the seller from continuing to use the
      dashboard otherwise (FR-30.2)
- [x] A second seller attempting to save a bank/JazzCash/Easypaisa number
      already claimed by another seller account is hard-rejected (FR-30.3)
- [x] The `TitleVerificationAdapter` interface has exactly one v1.0
      implementation (manual-review-only); swapping in a stub second
      implementation requires no change to FR-30.2's review-queue logic
      (FR-30.4)
- [x] A deliberately constructed high-score-input combination resolves to
      `block`; a clean combination resolves to `auto-approve`; a partial
      combination resolves to `manual review` — all three outcomes are
      reachable and no fourth outcome exists (FR-30.5) — **disclosed
      simplification:** the block case proven combines unverified email +
      missing CNIC + a mismatched title (not literally "reused account
      fingerprint," which is a hard save-time block per FR-30.3 and can
      never coexist on one seller's own row to begin with);
      `RiskScoreService`'s reuse-history input is a documented placeholder
      (always `false` in v1.0) pending a future audit-log-backed signal
- [x] Every automated risk-score computation is captured in
      `platform_events` with IDs only, no PII, in `metadata`; every
      human decision acting on a flagged score is captured in
      `admin_audit_logs` (FR-30.5)
- [x] A device fingerprint or IP match alone (with every other input clean)
      never resolves to `block` by itself (FR-30.5)
- [x] A seller suspended for non-payment (FR-6.18) who attempts
      re-registration with the same CNIC, a previously-used payment
      fingerprint, or a matching device/IP cluster is flagged and blocked
      pending review, not silently allowed to activate (FR-30.6)

### 14.31 Teams & Community Sponsorship (new, v0.17; built Module 14)
- [x] The invite-acceptance screen's content is verified against FR-7.12's
      exact disclosure requirement before build sign-off: it must state,
      before acceptance is possible, that the leader will see read-only
      analytics only, never store access, never editing, never customer PII
      (FR-7.12)
- [x] A `team_members` row cannot reach `status = 'active'` while
      `consent_accepted_at` is null — attempted directly against the API,
      not just blocked by the UI (FR-7.12)
- [x] **Leave-team flow:** a member leaves from their own settings at any
      time; the sponsored plan downgrades to Starter (v0.33 — the entry
      paid tier, since there is no more Free Plan) at the current period's
      end, never immediately and never as an account/store suspension or
      deletion (FR-7.13). **Disclosed decision:** since billing for a
      sponsored member flows entirely through the leader's group invoice
      (never the member's own subscription cycle, `current_period_end`
      stays null while sponsored), there is no cycle to defer to — the
      downgrade applies at the same "no cycle to wait for" moment FR-7.5's
      own edge case already establishes, not literally "the current
      period's end" (which doesn't exist for a sponsored member), and
      starts a real Starter billing cycle immediately
- [x] A seller already actively sponsored by one team cannot be added as an
      active member of a second team without leaving the first — the
      partial unique index on `team_members(seller_id) WHERE status =
      'active'` is exercised directly, not just relied on as a comment
      (FR-7.11). Its violation is caught and returned as a clean 409, not a
      raw 500
- [x] **Negative tests — leader sees analytics only:** a leader's session,
      given a member's storeId, is rejected (same shape of denial as a
      cross-tenant access attempt, §14.2) when it attempts to read that
      store's products, orders, or customers, or attempts any write
      (create/update/delete) against that store — every one of these must
      fail, not just the ones a reviewer happened to think of (FR-7.14)
- [x] The leader's team dashboard's per-member analytics summary matches
      the same numbers that member's own dashboard-home screen shows for
      itself, proving it's a read reuse of the same computation, not a
      second, potentially-inconsistent metric engine (FR-7.14). **Disclosed
      gap surfaced and fixed as a prerequisite:** no such reusable sales/
      order-count/growth-trend computation existed before this module —
      Module 10 built the CRUD screens but never a dashboard-home analytics
      summary. Built once, here (`TeamsService`'s private
      `computeSalesSummary`), and used identically for every member, so a
      bug would show identically across all of them rather than being a
      second, inconsistent metric engine — the same discipline the
      checklist item asks for, even though the "existing screen" it
      describes reusing didn't actually exist yet
- [x] **Group invoice math (revised v0.19, FR-7.18):** a team with N active
      sponsored members produces a group invoice line-item total of exactly
      `N × the leader's Team tier's seat price` — every seat bills at the
      same, tier-determined price regardless of what plan a member might
      otherwise have chosen individually; adding or removing an active
      member before the billing period closes changes N correctly; the
      leader's own separate commission invoice amount is completely
      unaffected by team size (FR-7.15/FR-7.18)
- [x] Non-payment of the group sponsorship invoice past the grace period
      downgrades sponsored members to Starter (v0.33 — graceful, per
      FR-7.13, never a Free Plan) but suspends neither a member's store nor
      the leader's own store; non-payment of the leader's own commission
      invoice suspends only the leader's own store (FR-7.15)

### 14.32 Storefront Buyer Purchase Flow & Store Branding (new, v0.22) — Module 15.5
- [x] A buyer can add a product/variant to their cart from the product page,
      view/edit the cart, and complete checkout entirely from the storefront
      UI — no step requires the seller dashboard or a direct API call (FR-32.1)
- [x] Checkout is genuinely email-first: no shipping/payment field is shown
      or accepted before email is captured, and the cart row is not created
      server-side until that point (FR-15.1, re-verified at the UI layer) —
      "add to cart" is purely a client-side `localStorage` cart
      (`lib/local-cart.ts`) until the email step calls `POST /storefront/cart`
- [x] The checkout page's shipping/tax/discount totals match
      `computeOrderTotals`'s own numbers exactly — the UI never recomputes
      or approximates (FR-32.1). The order-confirmation page reuses the
      existing `fetchStorefrontOrderStatus()` fetch (keyed by the order's
      `statusLookupToken`) rather than a second totals calculation, so there
      is no second code path that could drift from `computeOrderTotals`
- [x] The payment-instructions step frames payment as "pay the seller
      directly, they confirm receipt" — never wording that implies the
      platform holds, processes, or guarantees the payment (FR-32.1, §3.12)
- [x] The order-confirmation page links to the correct order's own
      order-status page (FR-32.2)
- [x] **Financial Truth Invariant, buyer-visible surfaces:** the
      confirmation page and every other buyer-facing screen this module
      touches shows a `pending` order as awaiting payment — never "paid,"
      "confirmed," or any success-styled treatment before the seller
      actually marks it paid (FR-32.3, §3.12)
- [x] **Tenant isolation:** the storefront purchase flow for store A's
      hostname never reads or writes store B's cart/product/pricing data —
      unchanged from Module 9's own cart/checkout tenant-isolation
      guarantees, which this module's UI calls into as-is
- [x] A seller can upload, replace, and remove a store logo from store
      settings; it appears on the storefront header and the PDF invoice
      header. Transactional emails do **not** render it: `EmailService`
      (Module 1) is a deliberately plain-text-only placeholder with no HTML
      template surface to place an image into yet — this is the "wherever
      each surface can practically render an image" boundary FR-32.5's own
      wording anticipates, not a silently-skipped surface. Real HTML email
      wiring is deferred to when a real email provider is integrated
      (FR-32.5)
- [x] With no logo set, both surfaces show the exact typographic-mark
      fallback built in Module 15 — never a broken image, a blank space, or
      a build-time error (FR-32.5)

### 14.33 Growth & Partner Programs (new, v0.26 — FR-33.1 built standalone ahead of Module 22; Phase A - the shared referral engine, Ambassador/Student Referral/Creators - built and e2e-tested; Phase B - Careers - built and e2e-tested. Module 22 complete.)
- [x] A referral code present at signup is captured and written once onto
      the new seller's or supplier's `Subscription.referralSource`; signup
      with no code, or a malformed one, leaves the field null and never
      blocks signup (FR-33.1). **Scope note:** this only captures and
      shape-validates the code — no program table exists yet to resolve it
      against (Module 22), so "resolved" for now means "persisted
      verbatim once validated as a plausible slug," not "confirmed to
      belong to a real approved participant."
- [x] No program has a self-serve join path — every applicant must pass
      program eligibility, then apply, then await admin approval/rejection
      (with notes, audit-logged); an admin can suspend/terminate an
      approved participant's access, rewards, or account at any time,
      audit-logged (FR-33.2)
- [x] Two applications from different programs/links for the same
      referred seller cannot both attribute — the second is rejected or
      simply attributes nothing, proven at the data-model level (a unique
      constraint), not just by application logic (FR-33.3) — verified by
      an e2e test that directly attempts a second `ReferralAttribution`
      row for the same referred seller and asserts a real Postgres unique-
      constraint violation, not merely an application-layer check
- [x] Referral commission is calculated only against a referred seller's
      paid plan-subscription amount; a referred seller's storefront GMV,
      sales, and wallet top-ups never factor into any program's commission
      calculation (FR-33.4) — verified by an e2e test asserting zero
      `program_commission_credit` entries after a wallet top-up and after
      a GMV-driven `commission_accrued` entry, and a correct, rate-matching
      credit only after the referred seller's own plan-fee debit
- [x] **Ambassador (FR-33.5):** an applicant without an eligible paid plan
      cannot apply; an approved ambassador's referral link correctly
      attributes a new seller; 8% commission (Settings Registry value)
      correctly accrues only on that seller's plan-subscription payments,
      only for the first 6 months (Settings Registry value), and stops
      permanently thereafter (window locked in per-attribution); 12+
      referred paid subscriptions in a calendar month correctly grants the
      configured free-plan/refund reward (implemented as a wallet credit
      of the ambassador's own current plan price); certificate tier
      thresholds/names are admin-editable Settings Registry data, not
      hard-coded, and the correct tier unlocks at the correct lifetime
      referred-paid-plan count
- [x] **Student Referral (FR-33.6):** 5% commission (Settings Registry
      value), renewals limited to the first 3 months (Settings Registry
      value), correctly stops after
- [x] **Creators (FR-33.7):** same 5%/3-month referral terms as Student
      Referral; a view-based reward is **never** paid from a raw view-count
      alone — it requires a submitted content link, **manual** admin
      verification against posting guidelines, and respects the configured
      monthly per-creator cap even when reported views would justify more
- [x] **Careers (FR-33.8):** only `open` job postings are publicly listed;
      a candidate can apply with a CV upload within the configured size/
      type limit (an oversized/wrong-type file is rejected with a clear
      error, never silently truncated or accepted); an admin sees the
      application pipeline with status tracking; no endpoint exposes
      applicant contact details or CVs publicly — verified by an e2e test
      including an explicit wrong-file-type rejection and a direct
      assertion that the public listing response never contains applicant
      name/email
- [x] Every program's earnings post as the correct new ledger entry type
      (`program_commission_credit`/`program_reward_credit`/
      `program_clawback_debit`) on the existing wallet (FR-33.9)
- [x] A withdrawal request below the configured PKR threshold is rejected
      before reaching the approval queue; an approved request follows the
      reactivated manual disbursement adapter and the participant sees the
      correct `requested → approved → processing → paid`/`rejected` status
      at every step (FR-33.9, FR-6.11/6.12) — verified by a full e2e
      negative-space suite: threshold not met, an unapproved (still-
      pending) applicant, a suspended participant, a double-request on the
      same outstanding balance, and an admin rejection correctly restoring
      the requestable balance (nothing is ever debited before `paid`)
- [x] A constructed self-referral (matching CNIC/payment account/device
      fingerprint/IP cluster) is flagged by the T&S engine and surfaced on
      the admin risk view — never auto-penalized (FR-33.10, FR-29.4)
- [x] A confirmed fraud finding can claw back **already-withdrawn**
      earnings, correctly taking the participant's wallet balance negative
      with a visible recovery path (FR-33.10) — verified by an e2e test:
      a fully-paid withdrawal followed by a clawback exceeding the
      remaining (zero) balance correctly goes negative, and the natural
      recovery path (no further withdrawal until new earnings offset it)
      is exercised directly
- [x] Each program has its own admin application queue, and the withdrawal
      queue, content-verification queue, and per-program report all render
      correct, program-scoped data (FR-33.11)
- [x] Program terms (eligibility, commission windows, clawback, suspension,
      no-guarantee-of-approval) exist as a `docs/legal/*.md` draft (FR-33.12)
      — `docs/legal/growth-partner-programs-terms.md` (Ambassador/Student
      Referral/Creator; Careers' own terms are Phase B)

### 14.34 Store Health Score (new, v0.27) — built and e2e-tested (Module 23)
- [x] The composite score is a weighted sum of all seven inputs
      (fulfillment timing, cancellation rate, pending-forever rate,
      dispute/refund signals, profile completeness, account age,
      moderation/risk history), each weight a live Settings Registry value
      — changing a weight changes the next computed score without a
      deploy (FR-34.1). `StoreHealthScoreService.computeForStore()`
      normalizes by the *actual* sum of the (editable) weights rather than
      assuming they total exactly 100 — a deliberate robustness choice so
      an admin tweaking one weight without rebalancing the rest can never
      push the score out of its 0-100 bound. Proven by an e2e test that
      zeroes `storehealth.weight_fulfillment` on a store with a poorly-
      scoring fulfillment input and asserts the recomputed score rises.
- [x] Profile completeness correctly requires the new `Store.policyText`
      field to be non-empty alongside logo/payment-method/CNIC — a store
      missing any one of the four scores lower on this input specifically,
      not the whole score to zero (FR-34.1). `Store.policyText` is
      seller-editable from the store Settings page ("Store policy" card).
      Proven by an e2e test asserting the completeness fraction moves from
      0 to exactly 0.25 (1 of 4) the moment `policyText` alone is set.
- [x] The scheduled recompute job (`StoreHealthSweepScheduler` +
      `store-health-sweep` BullMQ queue, worker-registered) is idempotent
      (safe to re-run) and writes one `StoreHealthScoreHistory` row per
      run; the seller dashboard (`/stores/:id/health`) renders a trend
      from that history, not just the latest value (FR-34.2)
- [x] The dashboard breakdown correctly names the specific input(s)
      dragging the score down with a plain-language suggestion — never
      raw weights/math shown to the seller (FR-34.3)

### 14.35 Verified Store Program (new, v0.27) — built and e2e-tested (Module 23)
- [x] The eligibility portal (`GET /stores/:id/verification/eligibility`,
      `VerificationEligibilityService.check()`) correctly evaluates all
      five default criteria live and shows a per-criterion pass/fail —
      changing any one Settings Registry threshold (health score minimum,
      tenure months, sales volume) changes what the portal reports
      without a deploy (FR-35.1)
- [x] Attaching a *different* custom domain resets the "6+ months
      continuous" clock (verified against the new domain's own
      `verifiedAt`), proven by an actual domain-swap test, not just
      code-read (FR-35.1)
- [x] The verification fee debits the seller's wallet as a
      `verification_fee_debit` ledger entry **at application time**, before
      any admin decision exists (FR-35.2) — proven by asserting the ledger
      entry exists immediately after `apply()`, with the application's
      `decidedAt` still null.
- [x] **The eligibility gate cannot be bypassed via direct API call** — an
      application submitted for a seller who fails any criterion is
      rejected server-side (400, zero `VerifiedStoreApplication` rows
      created) even if a client-side portal check is skipped entirely
      (FR-35.1/35.2, cross-cutting with §14.12's API-boundary discipline).
      The same `VerificationEligibilityService.check()` backs both the
      read-only portal and `apply()`'s enforcement gate — one function, so
      the two can never drift apart.
- [x] An application that passes every automated criterion can still be
      **rejected** by the admin reviewer (proving approval is never
      automatic even when eligible) — rejection correctly issues a
      `verification_fee_refund_credit` for the full fee (FR-35.2/35.3),
      per the Settings-controlled `verification.refund_on_reject` policy
      (default: true)
- [x] The badge renders on the storefront header and at checkout for a
      `verified` store (`Store.verifiedStatus`, surfaced as `verified` on
      `GET /storefront/store`, `cache: "no-store"` on the web app's
      fetch — rendered once in `SiteHeader`, reused by both the storefront
      header and the checkout page), and disappears immediately once
      status changes — no stale/cached badge state (FR-35.4)
- [x] A Store Health Score drop below the configured threshold, and a T&S
      enforcement action landing on the seller, **each independently**
      auto-flag a verified store for re-review and suspend the badge
      pending that review — neither auto-revokes without a human
      confirming (FR-35.5). `VerificationReReviewService.runSweep()`
      (scheduled) checks both conditions independently; proven by two
      separate e2e tests, one isolating the health-score trigger with a
      healthy T&S status, the other isolating the T&S trigger with a
      healthy score.
- [x] An admin can revoke verified status directly at any time, with
      notes, audit-logged (FR-35.5) — `RevokeNotesDto` requires a non-
      empty reason; `AdminVerificationController`'s
      `POST stores/:id/revoke`, guarded by `AdminAuthGuard` only (money-
      adjacent, same discipline as every other control-plane money action
      in this SRS).
- [x] With annual re-verification enabled (Settings Registry toggle,
      default: on), a verified store's status correctly expires at 12
      months and must re-pass the full live eligibility + admin-audit
      path — never a rubber-stamp renewal (FR-35.6). Proven by an e2e
      test: expire a verified store via the sweep, then submit a fresh
      application through the normal `apply()` path and confirm it lands
      in `pending_review` (not auto-verified), with the
      `verification.reverification_fee_pkr` default (0 — "no new fee")
      correctly applied instead of the original application fee.

### 14.36 Seller Data Export to Personal Cloud Storage (new, v0.27) — built and e2e-tested (Module 24)
- [x] An export is generated automatically on subscription renewal and
      correctly contains the trailing-period products/orders/customers
      CSVs plus one summary PDF (FR-36.1/36.2). Triggered from
      `PlanFeeDebitService.runMonthlyDebitSweep()`'s successful-renewal
      branch via a `renewedSellerIds` return value consumed at the
      worker-orchestration layer (`worker.main.ts`), not a direct service
      injection — `BillingModule` importing `DataExportModule` directly
      would create a real module cycle
      (`BillingModule -> DataExportModule -> MediaModule -> AuthModule ->
      GrowthProgramsModule -> BillingModule`). Proven by an e2e test that
      renews a subscription and asserts the resulting
      `SellerDataExport` row's three CSVs and one PDF all contain exactly
      the trailing-period rows, scoped across **all** of the seller's
      stores (the trigger is per-seller — `Subscription.sellerId` is
      `@unique` — not per-store).
- [x] An on-demand export request beyond the configured rate limit
      (`data_export.on_demand_min_interval_hours`, a Settings Registry
      value) is rejected, not silently queued or double-generated
      (FR-36.1). Enforced directly against `SellerDataExport`'s own
      `createdAt` timestamps (a rolling "time since last request" check)
      rather than the existing fixed-clock-hour `RateLimitService`, which
      is architecturally a different kind of limiter. Proven by an e2e
      test requesting a second on-demand export inside the window and
      asserting a 400 with no new row created.
- [x] With Drive connected **and upload-scoped**, the export uploads into
      a dedicated app-created folder (`GoogleDriveConnection.exportFolderId`,
      created via the newly-added `IDriveClient.createFolder`/`uploadFile`
      methods under the widened `drive.file` OAuth scope); with Drive
      **not** connected, or connected under the old `drive.readonly`-only
      scope (pre-dating this module), the seller instead receives an email
      linking to the dashboard's Data export card, login required (FR-36.3,
      revised v0.28 — see below). Proven by two e2e tests: one asserting a
      Drive-connected, upload-scoped seller's files land in Drive (verified
      via the fake `IDriveClient`'s recorded calls) with
      `deliveryMethod: "drive"`; one asserting a connection made before the
      upload scope existed (`drive.readonly` only, the real shape of every
      `GoogleDriveConnection` row created before this module) correctly
      falls back to email rather than attempting an upload it structurally
      cannot perform.
- [x] **v0.28 security fix, founder-flagged before proceeding to the Admin
      Terminal Completeness Audit:** the original build stored export
      bundles (products/orders/customers CSVs, summary PDF — all
      customer-PII-bearing) as plain, permanent, unsigned public MinIO
      URLs — the same pattern every other file link in the app uses, but
      wrong specifically *here* because these files carry PII, unlike a
      product image. Fixed by: (a) storing every export file under a
      `private-exports/` object-storage prefix, never returned as a public
      URL anywhere; (b) the `SellerDataExport` columns renamed
      `*CsvUrl`/`summaryPdfUrl` → `*CsvKey`/`summaryPdfKey` to make the
      "internal key, not a URL" invariant visible in the schema itself
      (migration `20260725100000_module24_security_private_exports`); (c)
      a new ownership-checked, authenticated endpoint,
      `GET sellers/me/data-export/:exportId/download/:file`
      (`JwtAuthGuard` + a same-seller check — a different seller's ID gets
      404, not the file), streaming bytes via a new
      `ObjectStorageService.getObject()`, as the *only* read path; (d) the
      list/history endpoint (`GET sellers/me/data-export`) now returns
      `hasProductsCsv`/`hasOrdersCsv`/`hasCustomersCsv`/`hasSummaryPdf`
      booleans instead of any key/URL field; (e) the email fallback links
      to the dashboard's Data export card (login required), never a raw
      object link. Proven by e2e tests: the list response's serialized
      JSON contains neither the `private-exports` prefix nor anything
      matching a URL; the download endpoint returns 401 with no token and
      404 for a different seller's token, 200 for the owner; the email
      spy asserts the link contains `/login` and never `private-exports`.
      **Disclosed limitation, not silently glossed over:** these tests
      prove the *application* never emits a fetchable raw link — they
      cannot prove a raw HTTP GET straight at the underlying MinIO object
      is rejected, since that depends on the production bucket's policy
      (deny anonymous reads on `private-exports/`), which this repo's test
      double (`s3rver`) does not model realistically and no test against
      it could honestly claim to verify. Required as a real deploy-time
      step, added to `docs/launch-runbook.md`. Google Drive delivery is
      entirely unaffected by this fix (that's the seller's own Drive
      storage, not this platform's).
- [x] A forced export-generation failure is logged and does **not** block,
      delay, or fail the subscription renewal itself (FR-36.4).
      `DataExportService.processExport()` wraps its entire body (record
      lookup included) in try/catch, recording `status: "failed"` +
      `failureReason` on the row and never throwing — even the
      failure-recording write itself is wrapped in a no-op `.catch()`, so
      a doubly-broken export (e.g. a since-deleted row) still cannot
      propagate an exception to its caller. Proven by an e2e test that
      forces `processExport()` against a nonexistent export ID and asserts
      the call resolves (not rejects), then asserts
      `triggerRenewalExport()` for the same seller also resolves cleanly.

### 14.37 Order Verification Channel Adapter (v0.29, built - Module 26)
- [x] A store with `orders.verification_channel` set to `none` behaves
      identically to today — no verification step, no schema-visible
      change to that store's order flow (FR-37.1).
- [x] For a store with `email_otp`/`whatsapp_otp` selected: an order stays
      out of every sale count/total until the correct OTP is submitted,
      proven by an e2e test asserting no `platform_events` `order.placed`
      row exists pre-verification and exactly one exists post-verification
      (FR-37.7, extends §3.12's existing test precedent — never a second,
      looser "confirmed" definition). Admin real-time analytics/seller
      order totals both key off `Order.status`, unchanged by this module,
      so they inherit the same exclusion with no separate test needed.
- [x] An expired OTP, a wrong OTP beyond the retry cap, and a resend
      inside the cooldown window are each rejected with a distinct, clear
      response — never silently accepted or silently queued (FR-37.5).
- [x] SMTP credentials are encrypted at rest under
      `SMTP_CREDENTIAL_ENCRYPTION_KEY` and never appear in any API
      response or log line, proven the same way as the existing Drive-
      token/CNIC tests (serialize the connection object, assert the raw
      credential string is absent).
- [x] A sender email at its daily cap is skipped by the rotation logic in
      favor of another connected, uncapped sender; with all connected
      senders capped, the send attempt is rejected with a clear error, not
      silently dropped (FR-37.3).
- [x] The WhatsApp OTP channel generates a correct, seller-template-
      interpolated `wa.me` deep link and does not attempt to send anything
      itself (FR-37.2) — `WhatsAppOtpAdapter` makes no network/HTTP call at
      all (verified by direct code review and its own unit test, which has
      no network dependency to mock), only the link/token pair is returned.
- [x] The Prepaid Confirmation channel's "mark deposit received" action
      is available only to the store's own seller account (never a buyer-
      facing or public endpoint, and rejected cross-tenant) and writes the
      same `OrderTimelineEvent` audit-trail precedent as `markAsPaid()`
      (FR-37.4).

### 14.38 Orders Command Center (built, Module 27, v0.30)
- [x] The bucketed-count endpoint's totals sum to the store's total order
      count with zero orders double-counted or dropped across buckets
      (FR-38.1) — proven by an e2e test seeding one order in each bucket
      state and asserting both the per-bucket counts and their sum.
- [x] Each bucket's count matches the count returned by filtering the
      existing order-list endpoint on the equivalent status — i.e. the
      aggregation is provably a derived read, never a second source of
      truth that could drift from the list it summarizes (FR-38.1).
- [x] Tracking upload remains role-correctly gated after this module ships
      — a supplier still cannot upload tracking for another supplier's (or
      a self-fulfilled) item, and a seller's own upload endpoint is
      unchanged (FR-38.4) — proven by the existing Module 8/9 role-
      isolation e2e test(s) still passing unmodified.
- [x] The public order-status page and the seller's order-detail view
      render an identical timeline for the same order — same completed
      stages, same timestamps — proven by an e2e test hitting both
      surfaces for one order and diffing the timeline data (FR-38.5).
- [x] A `pending`/`awaiting-verification`/`prepaid-received` order is
      visible on the Command Center but contributes zero to any confirmed-
      sale count anywhere on the platform (FR-38.6) — proven by the same
      style of before/after `platform_events`/order-total assertion
      §14.37 already established, applied to this new read surface.

### 14.39 Inventory Management (built, Module 28, v0.31)
- [x] A manual stock adjustment writes exactly one adjustment-log row
      (user, timestamp, before/after quantity, reason) and that row is
      never editable or deletable via any endpoint (FR-39.4) — proven by
      an e2e test attempting to modify/delete a log row and asserting
      rejection (404, no such route exists at all).
- [x] A bulk CSV stock edit updates only `stockQuantity`, never any other
      product/variant field, and reuses the existing import job/error-
      reporting shape (FR-39.3) rather than a new, parallel import path —
      proven by diffing untouched fields (e.g. `price`) before/after.
- [x] ~~Checkout's existing oversell-protection decrement behavior is
      provably unchanged after this module...~~ **Superseded, v0.33
      (Module 46):** this bullet's premise was wrong — the v0.33 deep
      audit found checkout's atomic decrement was wired only to
      supplier-fulfilled items, never to a self-fulfilled
      `ProductVariant.stockQuantity`, a real oversell bug. See the
      corrected FR-39.5 and the new checklist bullet under §14.39a below.
- [x] The low-stock threshold is Settings-Registry-driven per store
      (FR-39.2), proven by an e2e test changing the threshold and
      asserting a variant crosses in/out of the flagged set accordingly.
- [x] The new inventory CSV export artifact follows the exact same
      private, ownership-checked download path as every other Data Export
      artifact (FR-39.6, reaffirms FR-36.5) — no new, less-guarded read
      path introduced for this one file type.

### 14.39a Self-Fulfilled Stock Protection (built, Module 46, v0.33 — FR-39.5 corrected)
- [x] Checkout applies the same atomic conditional-decrement pattern
      already used for supplier items (`updateMany` gated on
      `stockQuantity >= quantity`, FR-4.5) to a self-fulfilled
      `ProductVariant.stockQuantity` too, closing the real oversell gap
      the v0.33 audit found — proven by an e2e test where two concurrent
      checkouts against the last unit of a self-fulfilled item leave only
      one order confirmed and the loser's decrement never applied.
- [x] The new `trackInventory` opt-out (default `true`) genuinely
      disables the check/decrement for a variant marked untracked/
      unlimited-stock — proven by an e2e test placing an order against a
      `trackInventory: false` variant with `stockQuantity` far below the
      ordered quantity and asserting it still succeeds with stock
      unchanged.
- [x] A mixed cart (self-fulfilled + supplier items, one oversold) is
      atomic across both fulfillment paths — a failure on either side
      releases both an already-successful supplier reservation and any
      already-successful self-fulfilled reservation, leaving every
      variant's stock exactly as it was before checkout was attempted.

### 14.40 Delivery-Time Badges (built, Module 29, v0.31 build order)
- [x] A supplier-sourced product's card and detail page both render the
      badge with the exact `estimatedDeliveryMinDays`/`MaxDays`/
      `supportedCountries` values currently on its `SupplierListing` row
      (FR-40.1) — proven by e2e tests asserting `supplierShipping` is
      populated on the storefront list/detail/search/collection-detail
      read paths alike (the latter two had never surfaced it before this
      module — a real gap this module closed, not a pre-existing behavior).
- [x] A self-fulfilled product (no supplier listing) renders no badge at
      all, on both surfaces (FR-40.2) — proven by an e2e test asserting
      `supplierShipping: null` on every one of the four read paths.
- [x] A supplier listing with a missing delivery-estimate field or an
      empty `supportedCountries` array suppresses only that line, not the
      whole card (FR-40.3) — `resolveDeliveryBadge()` (apps/web) independently
      renders the delivery-window line and the countries line.

### 14.41 WhatsApp Semi-Automation (built, Module 30, v0.31 build order)
- [x] Each of the three generated deep links (order confirmation, shipping
      update, abandoned-cart recovery) resolves to a correct `wa.me` URL —
      digits-only buyer number, correctly URL-encoded, seller-editable
      template text interpolated with the right order/tracking/cart
      details for that trigger (FR-41.1/41.3) — proven by an e2e test per
      trigger asserting the decoded link content.
- [x] `Cart.buyerWhatsapp`, when provided at cart creation, round-trips
      correctly into the abandoned-cart list's recovery-link generation; a
      cart with none provided is still listed but has no recovery action
      (FR-41.2) — proven end-to-end via `POST /storefront/cart` through to
      the abandoned-cart list's `hasWhatsapp` flag and a 400 on that cart's
      recovery-link endpoint.
- [x] No message is ever sent by the platform itself — every one of the
      three triggers only ever returns a link for the seller to open and
      send manually, proven the same way §14.37 proved the WhatsApp OTP
      channel never makes an outbound network call itself (FR-41.1).

### 14.42 Automated Profit & Loss Engine (built, Module 31, v0.30)
- [x] Per-order net profit is arithmetically correct across a mixed cart
      (self-fulfilled + supplier-fulfilled items), a partial discount, and
      a non-zero tax rate — proven by an e2e test with a hand-computed
      expected profit figure compared against the engine's output
      (FR-42.2), including a dedicated regression test proving the
      discount is never subtracted twice (see FR-42.2's build-time
      correction note).
- [x] Per-period net profit correctly sums only orders actually placed
      within the period and only ad-spend entries whose period overlaps
      it — proven by an e2e test with orders/ad-spend entries straddling a
      period boundary (FR-42.3).
- [x] A `pending`/unconfirmed order contributes exactly zero to any
      revenue, commission, or profit figure (FR-42.4) — same before/after
      assertion style as §14.37/§14.38, proven both for the single-order
      lookup (400) and period aggregation (zeros).
- [x] A variant with no base cost entered causes its order's profit figure
      to render as visibly incomplete/flagged, never a number that quietly
      excludes that cost as if it were zero (FR-42.1/42.2).
- [x] RLS denies cross-tenant access to another seller's cost/profit data
      at the database level, independent of the app layer (FR-42.5) — same
      proof style as every other tenant-isolation test in this SRS.

### 14.43 Built-in Email Verification Service (new, v0.31, not yet built)
- [ ] A seller under quota can send a platform-email OTP successfully;
      the same seller at quota gets the "quota reached" message, never a
      silent failure or an unbounded send (FR-43.3) — proven by an e2e
      test driving the counter to its limit.
- [ ] The monthly counter resets at the billing-period boundary, proven
      by an e2e test asserting a send succeeds again after a simulated
      period rollover (FR-43.3).
- [ ] No caller references the concrete `EmailServiceProvider`
      implementation directly — grepped/reviewed to confirm every call
      site goes through the interface, proving the extraction seam is
      real, not aspirational (FR-43.2).
- [ ] WhatsApp OTP and seller-SMTP remain fully functional and equally
      selectable regardless of platform-email quota state (FR-43.4) —
      proven by an e2e test exercising all three channels independently.

### 14.44 One-Click Shopify Migration (new, v0.31, not yet built)
- [ ] A Shopify-format products/variants/images CSV, a customers CSV,
      and an orders CSV each round-trip through the guided flow into
      correct platform records, proven by an e2e test with a small fixed
      fixture file per entity (FR-44.1/44.2).
- [ ] A column present in the Shopify export but not auto-mapped is
      surfaced in the mapping step, never silently dropped (FR-44.2).
- [ ] A product row containing a banned keyword is blocked by the
      existing Moderation Engine exactly as a manual submission would be
      — proven by re-running §14.27's moderation e2e assertion style
      against an imported row (FR-44.3).
- [ ] Imported orders never appear in the Orders Command Center's
      action-needed buckets and never contribute to commission-owed
      totals — proven by a before/after `platform_events`/commission
      assertion, same style as §14.37/§14.38 (FR-44.5).

### 14.45 Cost-Savings Calculator (new, v0.31, not yet built)
- [ ] Calculator output matches a hand-computed expected value for a set
      of known inputs (FR-45.1).
- [ ] Every comparison figure used in the computation is read from
      Settings Registry, not a hard-coded constant — proven by changing
      a setting value and asserting the output changes accordingly
      (FR-45.2).
- [ ] The "estimated" disclaimer is present in every render of the
      output (FR-45.3).

### 14.46 Seller Trust & Achievement Badge Engine (new, v0.31, not yet built)
- [ ] A badge appears the moment a store's underlying metric crosses its
      Settings-driven threshold, and disappears the moment it drops back
      below — proven by an e2e test mutating the underlying data and
      re-evaluating (FR-46.2/46.3).
- [ ] No endpoint allows a seller to directly set/claim a badge — proven
      by attempting a direct write and asserting rejection (FR-46.3).
- [ ] Changing a badge's Settings-Registry threshold changes eligibility
      without a code change (FR-46.1).
- [ ] §5.47's private dashboard badges and this section's public
      storefront badges are proven to share one evaluation code path
      (not two parallel implementations that could drift) — same
      shared-predicate-by-construction discipline as §14.38's bucket/
      list-filter proof (FR-46.5).

### 14.47 Emotional & Retention Layer (new, v0.31 — FR-47.2/47.3 milestone-celebrations slice built as part of the UI/UX Design Phase's Dashboard Home addendum; FR-47.1 celebratory-onboarding reframe, FR-47.4 achievement badges, and FR-47.5 personalization tie-in remain not yet built)
- [x] A milestone celebrates exactly once per store per threshold, even
      across multiple subsequent qualifying orders — proven by an e2e
      test placing several orders past a threshold and asserting a
      single celebration event (FR-47.3). `MilestoneEvent`'s
      `@@unique([storeId, metric, threshold])` constraint is what
      guarantees this under concurrency, not just the application-layer
      "crossed a threshold" check.
- [x] Only `confirmed`+ orders count toward any milestone threshold — a
      pending/cancelled order contributes zero, same Financial Truth
      Invariant proof style as §14.37/§14.38/§14.42 (FR-47.2).
- [ ] Private dashboard achievement badges never appear on any public
      storefront-facing endpoint or page (FR-47.4).

### 14.48 Community & Belonging (new, v0.31, not yet built)
- [ ] A submitted success story is never visible on the public Featured
      Sellers surface until an admin approves it — proven by an e2e test
      checking the public endpoint before and after approval (FR-48.1/
      48.2).
- [ ] A store never appears on the Featured Sellers surface without its
      own submission or an explicit opt-in flag, even if it holds every
      public badge — proven by an e2e test asserting a high-badge,
      non-opted-in store is absent (FR-48.3).
- [ ] No field beyond store name and already-public storefront content
      is present in the Featured Sellers API response — proven by a
      response-shape assertion (FR-48.4).

### 14.49 Gift Cards (built, Module 32, v0.32)
- [x] A `pending_payment`/unpaid gift-card purchase is unusable for
      redemption (checkout rejects the code with 400) until the seller
      explicitly confirms payment — proven by an e2e test attempting
      redemption before and after `confirm-paid` (FR-49.3).
- [x] A partial redemption reduces the card's `remainingBalance` by
      exactly the redeemed amount, verified directly against the DB row
      after each of two separate orders — the balance is always
      reconcilable against `initialValue - sum(GiftCardRedemption.amount)`
      by construction, since both are written in the same transaction
      (FR-49.4/49.6).
- [x] A redemption is capped at whichever is smaller of the order total
      or the card's remaining balance — proven by an e2e test where the
      second of two orders exceeds the remaining balance and only the
      remainder is applied, then a third checkout against the now-`depleted`
      code is rejected with 400 (FR-49.6).
- [x] A gift-card-covered order still requires an explicit seller
      `mark-as-paid` confirmation before commission accrues, and
      commission accrues on the order's full `totalAmount` (unreduced by
      `giftCardAmount`) — proven by an e2e test asserting the
      `commission_accrued` ledger entry amount (FR-49.5).
- [x] RLS denies cross-tenant access to another store's gift cards at the
      database level (a cross-tenant `GET`/`confirm-paid` 404s, and a
      code from store A can never redeem against store B's checkout) —
      proven by an e2e test, same proof style as every other
      tenant-isolation test in this SRS (FR-49.7).

### 14.50 Customer Segments (built, Module 33, v0.32)
- [x] A segment's member list matches a hand-computed expected set for a
      fixture of customers with known order counts/spend/last-order
      dates (FR-50.1/50.2).
- [x] Adding a new qualifying order changes segment membership on the
      next view without any explicit recompute step — proven by mutating
      underlying `Customer` data and re-querying the segment (FR-50.4).
- [x] The location filter correctly derives from each customer's most
      recent order's shipping address (FR-50.3).
- [x] RLS denies cross-tenant access to another store's segments/
      customers (FR-50.5).

### 14.51 Email Campaigns (built, Module 34, v0.32)
- [x] A seller at their plan's monthly send quota is blocked from
      sending, never partially sent — proven by an e2e test driving the
      counter to its limit (FR-51.2).
- [x] An unsubscribed customer is excluded from a campaign send even
      when they match the target segment's filter criteria — proven by
      unsubscribing a matching customer and asserting they receive
      nothing on the next send (FR-51.3).
- [x] The unsubscribe link in a sent campaign email actually unsubscribes
      that customer for future sends to that store (FR-51.3).
- [x] The deliverability note renders on every view of the campaign
      composer (FR-51.4).
- [x] A campaign send is dispatched as a background job, not
      synchronously in the request/response cycle (FR-51.6).

### 14.52 Staff Accounts, plan-tier (built, Module 35, v0.32)
- [x] A staff session scoped to e.g. `orders` cannot access a
      `billing`/`wallet`/`plan` route, proven by an e2e test asserting a
      403 on an out-of-scope route with a valid staff JWT (FR-52.2/52.3).
- [x] A seller at their plan's staff-account limit is blocked from
      creating another staff account, with the same
      "plan's limit has been reached" message style as
      `catalog.product_limit` (FR-52.5).
- [x] Every write a staff session performs is recorded to the Platform
      Event Log tagged with its `staffAccountId` (FR-52.4).
- [x] A seller with no plan-scoped override has zero staff-account
      capacity by default (FR-52.6, v0.33 — First Month/Starter carry none;
      Growth gets 3, Pro gets 10).
- [x] A staff session scoped to `design` can reach the theme customizer
      but is blocked (403) from an `orders`/`catalog`/`customers` route,
      and conversely a session scoped to e.g. `orders` is blocked from
      the customizer (FR-52.2).

### 14.53 Admin Email Section (built, Module 36, v0.32)
- [x] Linked SMTP+IMAP credentials are stored encrypted at rest and never
      appear in plaintext in any API response or log (FR-53.2).
- [x] The unified inbox correctly merges messages from two or more linked
      accounts into one list (FR-53.3).
- [x] A reply sent from the unified inbox uses the originating account's
      own SMTP credentials, not a shared/default sender (FR-53.3).
- [x] Every link/unlink action is recorded in `AdminAuditLog` with
      before/after values (FR-53.5).

### 14.54 Advanced Granular Admin Control (built, Module 37, v0.32)
- [x] A seller flagged `catalog.listing_blocked` cannot create a new
      product (403/400, existing products unaffected), proven by an e2e
      test asserting the flag blocks creation but not existing listing
      visibility (FR-54.1).
- [x] An admin can move an `approved` product straight to `admin_removed`
      and it immediately disappears from storefront visibility — proven
      by a before/after storefront-query assertion (FR-54.2).
- [x] A supplier-listed product can be blocked/approved from the admin
      terminal via the existing moderation queue mechanism, with no new
      queue introduced (FR-54.3).
- [x] An admin-overridden seller-scope Settings Registry value takes
      precedence over the plan/global default for that one seller only —
      proven by asserting a second seller on the same plan is unaffected
      (FR-54.4, exercising §3.8's seller > plan precedence at the UI
      layer via a Seller-360-scoped convenience section - the underlying
      write path itself was already proven end-to-end by an existing
      Module 25 e2e test).
- [x] All four controls above produce an `AdminAuditLog` row with
      before/after values (FR-54.5).

### 14.55 Multi-Store Per Seller (built, Module 49, v0.34)
- [x] A seller at their plan's store-count limit cannot create another
      store (clear upgrade-prompt response, not a silent failure);
      raising the plan lifts the limit immediately (FR-56.1).
- [x] A seller who owns two stores cannot see or mutate the other store's
      data from either store's dashboard view — proven by an explicit
      cross-store e2e assertion, not just relying on the pre-existing RLS
      guarantee (FR-56.2).
- [x] The store switcher correctly lists and switches between all of a
      seller's stores, sourced from the existing `GET /stores` endpoint
      (FR-56.3).

### 14.56 Product Organization at Scale (built, Module 50, v0.34)
- [x] Products can be tagged with free-form seller-defined tags, tags
      persist and are removable, and the tag filter on the product list
      returns exactly the tagged products (FR-57.1).
- [x] SKU/title search, stock-status, price-range, category, and
      moderation-state filters each work independently and in combination,
      with pagination, on the product list (FR-57.2/57.3).
- [x] Tags are dashboard-private by default (FR-57.4's first clause) - no
      storefront-facing tag filter exists at all in this module, so there
      is nothing to opt into yet. FR-57.4's storefront opt-in itself is
      deferred, not built - it was additional scope this amendment added
      beyond the founder's original ask ("product tags, plus dashboard
      search/filter"), and the dashboard-only feature fully satisfies that
      ask on its own. Revisit if a seller-facing need for public tag
      browsing surfaces later.

### 14.57 Bulk Product Operations (built, Module 51, v0.34)
- [x] A bulk price update (fixed and percentage), stock update,
      category/collection assign, publish/unpublish, archive/delete, and
      tag assign each apply correctly to every selected product and no
      unselected one (FR-58.1/58.2) — each reuses the existing single-item
      endpoint via a client-side fan-out (`Promise.allSettled`), the same
      precedent the admin moderation queue's bulk approve/reject already
      established; per-item failures (e.g. deleting a product that still
      has variants) are reported without blocking the rest of the batch.
- [x] A publish (draft → active), or an edit that leaves an already-active
      listing active, still triggers the same moderation re-check a
      single-item edit now also triggers, self-fulfilled products only —
      proven by 4 new e2e tests: a keyword-violating publish is blocked
      exactly like creation would be; a restricted-keyword edit on an
      already-active listing queues it without blocking the edit; an
      unrelated edit to an admin-approved product never silently
      un-flags it; a supplier-sourced product's edits are correctly
      exempt (FR-58.3).
- [x] The confirmation step shows the exact affected-row count (plus a
      preview of up to 5 titles) before any bulk action executes, and no
      bulk action fires without an explicit Confirm click (FR-58.4).
- [x] Plan-limit interaction (FR-58.5) — confirmed vacuous by construction,
      not by a new enforcement mechanism: none of the seven bulk actions
      built here (publish/unpublish/archive/delete/price/stock/category/
      collection-assign/tag-assign) creates a new product, so
      `catalog.product_limit` (which gates product *creation* only, per
      Module 14) has no enforcement point among them — there is nothing
      to bypass. The founder's original spec did not include bulk
      "duplicate" or "move to another store," which would be the actions
      that could actually interact with the limit; noted here as scope
      that was never built, not a gap silently left open.

### 14.58 Bulk Order Operations, Tracking Entry & Advanced Search (built,
Module 52, v0.34)
- [x] Every order has a unique, human-readable `orderNumber`, assigned
      atomically from a new per-store `Store.nextOrderNumber` counter at
      creation time (a plain `UPDATE ... increment`, serialized by
      Postgres's own row lock — no application-level locking needed, same
      reasoning as Module 46's atomic stock decrement); existing orders
      were backfilled in `placedAt` order per store by the migration, with
      the per-store counter seeded to one past each store's highest
      backfilled number — proven by a dedicated e2e test asserting two
      independent stores each start their own sequence at 1 (FR-59.1).
- [x] Bulk mark-as-paid and bulk fulfill route through the pre-existing
      `POST .../mark-as-paid` and `POST .../items/:itemId/deliver`
      endpoints unchanged — no new bulk-specific backend route for either,
      so the exact same commission-accrual/customer-stats/event-emission
      code path already covered by orders.e2e-spec.ts/module27's tests
      runs per order, true by construction rather than by a new
      comparison test. Bulk status-change is a genuinely new capability
      (cancelled/disputed/completed have no prior writer) — its new
      single-order building block, `OrdersService.changeStatus()`, is
      what FR-59.5's transition map gates. All three bulk actions are a
      client-side fan-out over the selected orders (same precedent as
      Module 51's bulk product actions), never a bare `updateMany`
      (FR-59.2).
- [x] All three tracking-entry paths share one write core
      (`writeTrackingForItem()`): the existing per-item detail endpoint
      (c, unchanged), a new order-level endpoint that applies one
      courier/tracking pair to every not-yet-shipped item on the order
      used by both inline quick-entry (b) and the CSV import worker (a,
      resolving each row's human-readable `OrderNumber` to the matching
      order) — proven by a dedicated e2e test exercising the CSV path
      end-to-end (valid row applies tracking + bumps the order to
      `shipped`; an unmatched `OrderNumber` is reported as a row error,
      not a failed import) plus a quick-entry test asserting the identical
      write shape (FR-59.3).
- [x] Advanced search combines date+time range, status, payment state,
      verification state, courier, customer, and amount-range filters, all
      AND-combinable, plus pagination in the same `{items,page,limit,
      total,totalPages}` envelope as FR-57.2 — proven by e2e tests
      combining minAmount+customer and asserting the exact matching
      order, plus a no-cross-page-overlap pagination test (FR-59.4).
- [x] The new order-status transition map (`order-status-transitions.
      util.ts`) is the first centralized structure for `Order.status`;
      `changeStatus()` rejects any transition not in it (e.g.
      `pending → disputed`) with 400 and leaves the order unchanged —
      proven by a dedicated e2e test. Deliberately excludes `confirmed`/
      `shipped`/`delivered` as *targets* (those stay reachable only via
      `markAsPaid()`/the tracking paths/`markItemDelivered()`, which keep
      `OrderItem.fulfillmentStatus` in sync — a plain status flip would
      desynchronize it) (FR-59.5).

### 14.59 Returns & Refunds Workflow (built, Module 53, v0.34)
- [x] A buyer can submit a return request from the order-status page only
      for a confirmed (actually paid) order, never a pending one — gated
      by `REFUND_ELIGIBLE_ORDER_STATUSES` (order-status-transitions.util.ts),
      the same status set PnLService's CONFIRMED_OR_BEYOND already uses;
      proven by an e2e test asserting 400 for a still-pending order and
      201 for a confirmed one (FR-60.2).
- [x] A seller can approve or reject a return request; reject requires a
      reason — proven by an e2e test asserting 400 with no `sellerNote`
      and 200 once one is supplied (FR-60.3).
- [x] Completing an approved return posts a `refund_adjustment` ledger
      entry through `WalletService.postLedgerEntry()` (via
      `LedgerService.reverseCommissionForRefund()`), correctly reverses
      the commission portion, correctly decrements `Customer.ordersCount`/
      `totalSpent`, and moves `Order.status` to `refunded` or
      `partially_refunded` — proven by an e2e test asserting the order no
      longer counts as revenue in P&L (`getOrderProfit()` now 400,
      "not confirmed+") and that platform GMV/commission-earned both drop
      by the reversed amount in `UnitEconomicsService.computeRealTimeAnalytics()`
      immediately after completion, closing the loop the Financial Truth
      Invariant requires (FR-60.1/60.4).
- [x] A partial refund's `refundAmount` correctly differs from the full
      order total and the order lands in `partially_refunded`, not
      `refunded`; a second partial-refund round on the same order is
      supported (tracked via the running sum of prior `completed`
      ReturnRequest.refundAmount for that order) and can bring it to fully
      `refunded`; a refund exceeding what's still refundable is rejected
      with 400 (FR-60.4).
- [x] An admin can approve/reject/complete a return regardless of the
      seller's own action, audit-logged with before/after values —
      proven by an e2e test asserting two `AdminAuditLog` rows
      (`returns.admin_decide`/`returns.admin_complete`) with the correct
      before/after status (FR-60.5).
- [x] The buyer-facing order-status timeline reflects the return's current
      state — `computeOrderTimeline()` appends a `refunded` stage
      ("Refunded"/"Partially refunded") on top of the happy-path stages
      already reached, and the order-status page shows the return
      request's own status (or the submission form) via the new
      `canRequestReturn`/`returnRequests` fields (FR-60.6).

### 14.60 Analytics Depth, seller-facing (v0.34, BUILT as Module 54)
- [x] Top products by revenue and by units, sales-over-time (day/week/
      month), average order value, and best sales days/times all compute
      correctly against a known seeded order set (FR-61.1/61.2/61.5).
- [x] Repeat-customer rate and return rate (overall and per product)
      compute correctly, including a store with zero returns (0%, not a
      divide-by-zero error) (FR-61.3/61.4). Return rate's denominator
      deliberately includes orders later refunded (not just still-
      confirmed ones) — a completed return moves `Order.status` out of
      `CONFIRMED_OR_BEYOND`, and a return can't be allowed to shrink its
      own denominator (see `analytics.service.ts`'s
      `RETURN_ELIGIBLE_STATUSES`, a build-time refinement beyond the FR's
      literal `count(Order)` text).
- [x] Every analytics figure excludes pending/unconfirmed orders — proven
      by an e2e test seeding a pending order and asserting it does not
      appear in any metric (FR-61.7).
- [x] The seller-facing analytics page renders charts, not raw tables, for
      the time-series and top-products metrics (FR-61.6) — recharts, the
      first charting library added to `apps/web`.

### 14.61 Seller Notifications (v0.34, BUILT as Module 55)
- [x] A new order triggers an immediate seller email; a daily sales
      summary, a low-stock alert, and a payment/verification-event email
      each fire correctly under their respective trigger conditions
      (FR-62.1). The payment/verification-event trigger is deliberately
      scoped narrow: only an order-verification's terminal `"failed"`
      status (max-OTP-attempts exhausted) fires it — the one clean,
      unambiguous "this order needs your attention" hook in
      `OrderVerificationService.verifyOtp()`; the SRS text above names the
      category but not an exact trigger, so this is a build-time scoping
      decision, not a literal FR-62.1 requirement. The low-stock alert is
      debounced by `ProductVariant.lowStockAlertSentAt` — exactly one email
      per dip below threshold, cleared on restock — proven by a dedicated
      e2e test (decrement-decrement-restock-decrement sequence).
- [x] An admin can compose and send a newsletter to all non-opted-out
      sellers from the admin terminal; an opted-out seller does not
      receive it (FR-62.2/62.3). Opt-out is re-checked live at send time,
      never cached from creation time — same discipline Module 34's
      `processCampaign()` established for customer segments.
- [x] Newsletter opt-out does not suppress transactional emails
      (FR-62.3) — `Seller.newsletterOptOut` is read only by
      `PlatformNewsletterService.processNewsletter()`; none of the four
      FR-62.1 transactional sends check it.
- Build-time scope note on FR-62.4: only the newsletter's subject/body are
  Settings-Registry-editable-in-spirit (stored per-newsletter, composed
  fresh each time via the admin terminal); the four transactional
  templates in `email.service.ts` remain hardcoded template-literal
  functions this pass, consistent with every other transactional email in
  the codebase today. Extending Settings Registry to hold arbitrary email
  template bodies is deferred, not silently dropped.

### 14.62 One-Click Full Export, Pro Gate (v0.34, BUILT as Module 56)
- [x] A sub-Pro seller's export request returns a clear upgrade prompt,
      not a partial or degraded export; a Pro seller's request proceeds
      exactly as Module 24's existing export already works, subject to
      the existing cooldown (FR-63.2). Implemented as a new
      `data_export.on_demand_enabled` boolean Settings Registry key
      (`allowedScopes: ["global", "plan"]`, same seed shape as
      `staff.max_accounts`) - false by default, overridden true only on
      the Pro plan (individual, tierOrder 3); checked in
      `DataExportService.requestOnDemandExport()` before the pre-existing
      cooldown check, so a sub-Pro seller always sees the upgrade prompt
      rather than a cooldown message that would misleadingly imply
      they'd succeed on retry. The subscription-renewal export trigger
      (`triggerRenewalExport()`) is a different code path and is not
      gated by this check.

### 14.63 Invoice/Receipt Customization, limited (v0.34, BUILT as Module 57)
- [x] A seller's tax/NTN number, invoice footer text, invoice terms text,
      and business name each render on generated invoices when set, and
      are absent (not blank placeholders) when unset (FR-64.1/64.2).
      Proven at the unit level (`invoice-template.spec.ts`, mirroring the
      logo-fallback tests already there) and at the e2e level (the three
      new `Store` fields round-trip through the existing
      `PATCH /stores/:storeId` settings pattern, and a real checkout with
      them set still produces a valid downloadable PDF).
- [x] UZEYN's own invoice branding is present and unmodified on every
      generated invoice regardless of which of the above fields a seller
      has set, at every plan tier (FR-64.4). No branding existed on
      invoices before this module (confirmed by research reading
      `invoice-template.ts` - a build-time gap this FR closes, not a
      pre-existing mechanism this FR merely extends); a fixed
      `<div class="platform-footer">Generated on uzeyn.com</div>` line was
      added, rendered unconditionally outside any seller-controlled
      branch and with no Settings Registry gate of any kind - never a
      per-plan toggle, matching the FR's explicit "hard constraint on the
      template renderer itself" text.

### 14.64 Advanced Store SEO Control (Module 58, v0.34, built)
- [x] Canonical URL, robots directives, OG override, structured-data
      toggle, and sitemap-inclusion each correctly override the existing
      fallback chain's default when set on a product or collection, and
      correctly fall through to the existing default when unset
      (FR-65.1/65.2). `resolveAdvancedSeo()` (`seo-fallback.util.ts`)
      resolves each field independently against the store-level default
      row (`Store.seoRobotsIndexDefault`/`seoRobotsFollowDefault`/
      `seoStructuredDataDefault`/`seoSitemapIncludedDefault`); `ogTitle`/
      `ogDescription` fall back to the already-resolved basic
      `seoTitle`/`seoDescription`, never a third independent value.
      Proven per-field (not all-or-nothing) by
      `module58-advanced-seo-control.e2e-spec.ts`'s cascade tests, which
      override a single field and assert every other field still
      inherits the store default.
- [x] A seller-set `Product.slug` is unique per store and does not break
      or replace the existing UUID-based storefront route (FR-65.3). A DB
      unique constraint (`uniq_product_store_slug` on
      `(store_id, slug)`) is the source of truth, not a pre-check race;
      `ProductsService.update()` catches Prisma's `P2002` and rethrows a
      `ConflictException`. `slug` is additive-only on the public product
      response — the existing UUID-based `GET /storefront/products/:id`
      route is unchanged.
- [x] The custom head-tag field strips any tag or attribute outside the
      `meta`/`link`/`script[type="application/ld+json"]` allowlist —
      proven by an e2e/unit test asserting a `<script src=...>` or
      `onerror=` injection attempt is stripped, not merely escaped
      (FR-65.4). `sanitizeHeadTags()` (`head-tag-sanitizer.util.ts`, 10
      unit tests) is the pure allowlist function; a dedicated e2e test
      proves the real wiring — a script-src/`onerror` payload PATCHed to
      `Store.customHeadTags` is sanitized before it ever reaches the
      database row (not stored-then-filtered-on-read) and stays
      sanitized through the public `GET /storefront/store` read.
- [x] The advanced SEO fields are inaccessible below Growth tier, with a
      clear upgrade prompt, while the pre-existing basic meta title/
      description remain available to every tier (FR-65.5). A
      `seo.advanced_fields_enabled` Settings Registry key (`false`
      globally, `true` plan-scoped override on Growth+individual tiers,
      `growthAndProPlans` in `seo-advanced.seed.ts`) is checked in
      `StoresService`/`ProductsService`/`CollectionsService.update()`
      only when the request DTO actually touches a gated field —
      `seoTitle`/`seoDescription` are excluded from every gate array and
      remain settable on any tier.

### 14.65 Final Locked Revenue Model — Commission + Wallet Active, Combined Entry-Flow Payment, Gateway Connect (v0.35's Subscription-Only design CANCELLED by founder directive and fully reverted; corrected v0.36)
- [x] Confirmed: the v0.35 "0% commission, hidden wallet" design (former
      checklist below) was built (Module 59, commits `cc22357`/`801b86b`)
      then fully reverted (`git revert`, commits `94ab726`/`1a16b87`),
      verified byte-identical to the pre-Module-59 tree via
      `git diff --stat` (empty output). Commission and wallet were never
      live in production at 0%/hidden.
- [ ] Global and every plan-scoped `billing.commission_rate_percent` stay
      at their original nonzero values (Basic/Starter 2%, Growth 1.5%,
      Pro 1%, 2% hard cap unchanged); `LedgerService.accrueCommission()`
      posts a real nonzero `commission_accrued` entry on every confirmed
      sale (FR-6.30).
- [ ] Every seller-facing surface (order detail, P&L page, wallet page,
      returns page, pricing page, homepage FAQ) continues to show its
      commission rate/amount; no page anywhere claims "0% commission"
      (FR-6.31, FR-7.21).
- [x] At signup, the combined total (`firstCyclePrice +
      billing.minimum_signup_wallet_topup`, default top-up Rs 699) is
      displayed as **one** amount with a breakdown line, and the seller
      submits **one** proof-of-payment for it — never two separate
      payment steps (FR-6.33). Module 59: extends the existing
      `WalletTopUpRequest`/`AdminWalletController` verify/reject
      mechanism (Module 20) via a new nullable `WalletTopUpRequest
      .planFeePortion` field, rather than a second claim system.
      `amount` keeps its pre-existing meaning (top-up portion only);
      `planFeePortion` carries the plan-fee portion.
      `WalletService.getSignupPaymentPreview()`/
      `requestCombinedSignupPayment()` compute the breakdown and enforce
      a one-time submission guard (blocked while an earlier combined
      request is pending/verified; a rejected one may be resubmitted).
      New `SellerWalletController` endpoints
      `GET`/`POST /sellers/me/wallet/signup-payment`; new "Get started"
      card + pending-verification alert on the seller wallet page.
      **SUPERSEDED v0.39 (§5.6j, FR-6.50/Module 73):** the combined
      top-up-plus-plan-fee model is retired; these endpoints are renamed
      `GET`/`POST /sellers/me/wallet/plan-fee-payment` (plan-fee only,
      `amount` always 0), and the seller wallet page is retired in favor
      of a Billing page. See §14.67.
- [x] Verifying a combined signup claim, in one transaction, both posts a
      `wallet_topup` ledger entry for the top-up portion and
      activates/advances `Subscription.currentPeriodEnd` for the plan-fee
      portion; rejecting credits neither (FR-6.33).
      `WalletService.verifyTopUp()` extended: when `planFeePortion` is
      set, `currentPeriodEnd` is **activated** (computed fresh from
      verification time via `addInterval(new Date(), interval)`) rather
      than **advanced** (never stacked on the free placeholder period
      `assignBasicPlanAtSignup` already granted at signup) — this avoids
      double-crediting a seller with two periods stacked together and
      correctly compensates for admin-processing delay. Never posts a
      `wallet_plan_fee_debit` for the plan-fee portion, since that money
      never entered the wallet. Referral commission (FR-33.4) now
      accrues from two call sites — documented in
      `program-commission.service.ts`'s updated docstring — the existing
      `PlanFeeDebitService.debitDuePlanFees()` renewal branch, and a new
      `AdminWalletController.verify()` combined-signup-payment branch
      (kept as an orchestration-layer call to avoid a circular DI
      dependency with `WalletService`). Proven by
      `module59-combined-entry-flow-payment.e2e-spec.ts` (5 cases):
      preview/submit/one-time-guard, verify credits only the top-up
      portion with zero `wallet_plan_fee_debit` entries and activates
      `currentPeriodEnd` within a `[before, after]` time window, referral
      commission accrual on the plan-fee portion, and reject-then-
      resubmit.
- [x] Subsequent billing-cycle plan fees continue to debit from wallet
      balance via `PlanFeeDebitService`, sharing the existing grace
      ladder and `orders_paused`/restore mechanics with commission debits
      — no separate claim-based renewal path was introduced (FR-6.34).
      Unaffected by Module 59/60 — `PlanFeeDebitService.debitDuePlanFees()`
      remains the sole renewal-debit path; Module 61 only changed what
      amount it computes (`cyclePriceFor()`, below), not the mechanism.
      **SUPERSEDED v0.39 (§5.6j, FR-6.50/Module 73):** wallet
      auto-debit renewal is retired. Every renewal now goes through the
      same admin-verify flow as the first cycle;
      `debitDuePlanFees()` performs only overdue detection (grace-day
      pause), never a debit. See §14.67.
- [x] Publishing a store gates on payment method + verified CNIC only.
      **SUPERSEDED v0.39 (§5.6j, FR-6.50/Module 73):** the third original
      condition (wallet balance above the configured minimum, FR-6.35)
      is DROPPED, not just relaxed — wallet is hidden from sellers, so
      there is nothing left to check a balance against. This flips the
      historical FR-6.35 claim below it (which asserted the condition was
      "never dropped") — that assertion was accurate through v0.36-v0.38
      and is superseded, not wrong at the time it was written. See §14.67.
- [x] Grace ladder, orders-paused-on-insufficient-balance, negative-float
      floor, running-balance column, and daily reconciliation (Module 47)
      re-verified correct against the four-tier plan structure's three
      price fields and three billing-cycle multipliers (FR-6.35a,
      FR-7.20). Module 60 is an audit/test module — no new production
      mechanics; it proves the existing grace-ladder/pause/restore/
      reconciliation code correctly computes against Module 61's three
      price fields (`price`/`firstCyclePrice`/`campaignPrice`) and three
      billing-cycle multipliers (monthly 1x, six-month 5.5x, yearly
      10x). Proven by
      `module60-wallet-commission-four-tier-reverification.e2e-spec.ts`
      (7 cases): monthly renewal debits exactly `price`; six-month
      renewal debits `price × sixMonthMultiplier` and advances 6 months;
      yearly renewal debits `price × yearlyMultiplier` and advances 12
      months; renewal during an active campaign debits `campaignPrice`
      not `price`; insufficient balance for a large six-month/yearly fee
      still pauses stores via the unchanged grace ladder; running-balance
      cache still matches `computeLedgerBalance()` after a six-month
      debit; a seller can self-select `six_month` via
      `POST /sellers/me/subscription/change` with `billingInterval`
      written immediately while the tier itself still defers via
      `pendingPlanId` (FR-7.5).
- [x] Four permanent tiers (Basic/Starter/Growth/Pro) each carry
      `regularPrice`/`price`/`firstCyclePrice`, with Basic's
      `campaignPrice`/`campaignActive` toggle proven to switch the
      displayed active price without touching `price` itself (FR-7.20).
      Module 61: the old "First Month" tier-level auto-transition-to-
      Starter concept is **retired**; renamed to **Basic**, a PERMANENT
      tier (no more `pendingPlanId` queued at signup —
      `assignFirstMonthAtSignup` renamed to `assignBasicPlanAtSignup`).
      New `Plan.firstCyclePrice`/`campaignPrice`/`campaignActive` fields.
      `resolveActivePlanPrice(plan)` (`plan-pricing.util.ts`) =
      `campaignPrice` while `campaignActive`, else `price` — read
      **identically** by both the pricing-page display path
      (`plans.service.ts`) and the actual billing path
      (`plan-fee-debit.service.ts`), a deliberate consistency choice so
      a campaign price shown to a shopper is exactly what gets billed.
      Admin plan editor (`admin/plans/page.tsx`) gained First-cycle
      price/Campaign price columns and an activate/deactivate toggle
      button.
- [x] A new subscription's very first billing cycle bills at
      `firstCyclePrice` (monthly cycle only) and every subsequent cycle
      at `price`/`campaignPrice`, on the **same** tier — no forced
      transition to a different tier (FR-7.20). Proven by the rewritten
      `module44-first-month-pricing.e2e-spec.ts` ("Basic never
      auto-transitions to Starter at cycle end" — `applyDueCycleChanges()`
      has nothing queued to apply, `result.applied` is `0`, and
      `currentPeriodEnd` is untouched) and by
      `plans-pricing.e2e-spec.ts`'s renamed Basic-tier assertions
      (`firstCyclePrice` set and less than `price`).
- [x] Six-month and yearly prices are computed as 5.5× and 10× the active
      monthly price via the Settings-Registry-held multipliers, not
      stored as separate per-cycle rows, and both are selectable on the
      pricing page and the admin plan editor (FR-7.20). New
      `PlanBillingInterval.six_month` enum value and
      `Subscription.billingInterval` field (default `monthly`) drive
      which multiplier a renewal applies and which span
      `currentPeriodEnd` advances by.
      `computeCyclePrice(activeMonthlyPrice, interval, multipliers)`
      (`plan-pricing.util.ts`) replaces the old
      `yearlyDiscountPercent`-based `computeYearlyPrice()`; new global
      Settings keys `billing.six_month_price_multiplier` (5.5) and
      `billing.yearly_price_multiplier` (10) replace FR-7.6's old
      admin-configurable-percent framing (the old
      `yearlyDiscountPercent` column/DTO field is left unread — a
      disclosed scope decision, not removed, to avoid a larger
      destructive migration). `requestPlanChange(sellerId, newPlanId,
      billingInterval?)` writes `billingInterval` **immediately** (it
      only affects the next renewal's multiplier/interval-advance),
      unlike the tier itself which still defers via `pendingPlanId` per
      FR-7.5's mid-cycle rule. New Settings keys
      `marketing.pricing_benefit_1/2/3` and
      `marketing.pricing_shopify_comparison` drive FR-7.21's headline
      benefit block/Shopify comparison on the rebuilt pricing page
      (`GET /plans/pricing-copy`) — never hard-coded in the frontend.
      Proven by `plans-pricing.e2e-spec.ts`'s new "Six-month/yearly
      billing, fixed multipliers" block (fixed-multiplier computation,
      and an active campaign price flowing through to `sixMonthPrice`).
- [x] `StorePaymentGatewayConnection` credentials are AES-256-GCM
      encrypted at rest and never appear in any API response — proven by
      a test asserting a connection-fetch/list response never contains
      the raw or encrypted secret field, across all four providers
      (FR-6.36, Module 62). `payment-gateway-credential-crypto.util.ts`
      (its own `PAYMENT_GATEWAY_CREDENTIAL_ENCRYPTION_KEY`, rotates
      independently of every other `*_ENCRYPTION_KEY`); `SAFE_SELECT`
      explicitly excludes `apiKeyEncrypted`/`apiSecretEncrypted` on every
      query, the same allowlist discipline `SellerVerificationEmail`'s
      SMTP password already uses.
- [x] Raast is offered first in both the seller connect flow and the
      checkout provider list when multiple gateways are connected
      (FR-6.36/6.37, Module 62). `priorityOrder` is derived from the
      provider at connect time (`raast: 0, easypaisa: 1, jazzcash: 2,
      bank: 3`), never a seller-facing reorder control; both the
      seller-facing connections list and the buyer-facing checkout
      provider list sort by it — proven by an e2e test that connects all
      four out of order and asserts the returned order is
      `[raast, easypaisa, jazzcash, bank]` regardless.
- [x] A buyer paying through a seller's connected Raast/Easypaisa/
      JazzCash/bank gateway results in `verifyPayment()` being called
      before confirmation, and a successful verification confirms the
      order through the **same** `markAsPaid()` core the OTP/manual paths
      use — not a second confirmation path (FR-6.37/6.38, Module 62).
      `PaymentGatewayService.verifyAndConfirm()` is the buyer-facing
      entry point (`POST /storefront/gateway-payment/:token/verify`,
      the same unguessable `statusLookupToken` every other buyer-facing
      order action resolves first); on a verified match it calls
      `OrdersService.markAsPaid(store.sellerId, storeId, orderId)`
      directly — proven by an e2e test asserting the resulting order row
      and its `commission_accrued` ledger entry are identical to what the
      manual/OTP paths already produce. A `SellerPaymentGatewayAdapter`
      interface (`provider` + `verifyPayment()`) mirrors
      `VerificationChannelAdapter`'s exact shape; one implementation per
      provider, registered into a `Map`, never branched on by type. All
      four adapters are real, structurally complete implementations
      calling each provider's documented server-to-server API — **not
      live-tested against a real Raast/Easypaisa/JazzCash/bank sandbox**,
      the same disclosed limitation already carried by the Printify/
      Safepay/COD adapters; e2e tests inject fakes via `overrideProvider`
      (the same technique `google-drive.e2e-spec.ts` already established
      for `DRIVE_CLIENT`) rather than exercising the real classes.
- [x] Manual mark-as-paid still works unchanged for a seller with no
      gateway connected (FR-6.38, Module 62) — proven by an e2e test
      placing an order for a seller with zero gateway connections and
      confirming it through the pre-existing
      `POST /stores/:storeId/orders/:orderId/mark-as-paid` endpoint.
- [x] A seller-facing "Payment gateway" screen lets a seller pick a
      provider, enter write-only credentials, test the connection, and
      toggle it active/inactive (FR-6.39, Module 62) — a new card on the
      existing store Settings page, alongside the existing Payment
      Instructions card; owner-only always, blocked outright during
      impersonation, the same money-adjacent discipline as the Payment
      Instructions screen it sits beside.

### 14.66 Subscription Business Readiness (re-amended v0.41 for the
subscription-only model — see §5.6k; supersedes this checklist's original
v0.38 wording item-for-item, same FR/module numbers)
- [x] MRR, active subscriptions per tier, 7/30-day upcoming renewals,
      expired-not-renewed count, churn rate, ARPS, an LTV estimate,
      first-cycle-to-full conversion rate, and expected revenue this
      month all render correctly on the admin analytics surface, computed
      live against `Subscription`/`Plan`/plan-fee `LedgerEntry` data
      (FR-6.40, Module 63).
- [x] A store paused for plan-fee non-payment gets `terminalPausedAt` set
      and starts a real 14-day countdown; warning emails fire at day 0/7/13
      restating exactly what will be deleted; the scheduled deletion job
      deletes only the founder-specified data set (products, orders,
      store-specific settings, that store's analytics) and never touches
      the seller account, billing history, or audit/event records
      (FR-6.41, Module 64).
- [x] A verified renewal payment landing concurrently with the deletion
      job running always wins — proven by an e2e test that verifies
      payment mid-job and asserts the store's data survives intact
      (FR-6.41, Module 64).
- [x] Pre-expiry reminders fire at 7/3/1 days before `currentPeriodEnd`,
      an expiry-day email fires the day it passes, and win-back emails
      fire at 3/7/14 days into the terminal-pause window — every template
      admin-editable, none gated by an opt-out (transactional, same
      category as every other triggered lifecycle email) (FR-6.42,
      Module 65).
- [x] Downgrading below the new tier's `stores.max_per_seller` requires
      the seller to choose which stores to keep (oldest wins by default
      if unchosen); every unchosen store gets `overLimitPausedAt` set and
      a 30-day pause window, then remains `orders_paused` indefinitely
      with no forced deletion — confirmed never touched by FR-6.41's
      deletion job, which only acts on `terminalPausedAt` (FR-6.43,
      Module 66).
- [x] A 6-hourly sweep and every real checkout-time `verifyPayment()`
      call both feed the same per-provider health rollup on the admin
      System Status page; a provider dropping below the configured
      health threshold emails and dashboard-banners every seller
      connected to it, while checkout itself never blocks (Module 62's
      existing per-checkout fallback is unchanged) (FR-6.44, Module 67).
- [x] Per-plan support SLA hours are configurable via the Settings
      Registry, visibly stated on the seller dashboard and pricing page,
      and now enforced against a real ticket's computed deadline
      (FR-6.45, Module 68; see Module 90/FR-8.18).
- [x] The seller health funnel (signed up → store created → first product
      → published → first sale) renders correct drop-off counts at each
      stage and a stuck-seller list, computed live from existing data,
      with no new tracking table (FR-6.46, Module 69).
- [x] A monthly summary email sends to each seller (unconditional, same
      as the existing daily one - no seller notification opt-out exists
      for this category), and a downloadable UZEYN subscription invoice
      PDF (distinct from a buyer-facing order invoice) renders the
      seller's own plan-fee ledger entries for the period —
      commission-free, per FR-6.51 (FR-6.47, Module 70).
- [x] A signup matching an existing discount-recipient's phone or device
      cluster is denied the first-cycle discount and flagged for review
      at signup; a retroactive CNIC or payment-instrument match after the
      fact posts a one-time `wallet_plan_fee_debit` for the price
      difference and flags for review the same way (FR-6.48, Module 71).
- [x] A qualifying first-cycle cancellation posts a `refund_adjustment`
      wallet-ledger entry for the configured percentage of the actually-
      paid discounted price — a wallet credit, never an external gateway
      reversal, admin-actioned with a required reason and audit-logged
      (FR-6.49, Module 72).
- [x] A bulk moderation or wallet-topup admin action goes through a
      single dedicated transactional endpoint, not client-side
      `Promise.all` fan-out, and reports real per-item partial failure
      rather than an approximation — proven by an e2e test with a
      deliberately-failing item inside a larger batch (FR-8.17,
      Module 89).
- [x] A support ticket's SLA deadline is computed from its store's plan
      tier at creation, time-remaining is shown on both the seller and
      admin surfaces, and a ticket crossing 80% of its SLA window
      unresolved triggers the near-breach flag/email (FR-8.18, Module 90).

### 14.67 Subscription-Only Business Model — Commission Deactivated, Wallet Hidden (new, v0.39, §5.6j/§5.66)
- [x] The publish gate drops its wallet-balance condition entirely —
      payment method + verified CNIC are the only two conditions left
      (FR-6.50, Module 73). `WalletGraceLadderService.publish()` no
      longer resolves `billing.wallet_min_initial_topup` or calls
      `wallet.getBalance()` at all.
- [x] A seller's plan fee - first cycle AND every renewal after it - is
      paid through the same admin-verify flow, plan-fee-only (FR-6.50,
      Module 73). New `WalletService.getPlanFeePaymentPreview()`/
      `requestPlanFeePayment()` (renamed from Module 59's signup-only
      `getSignupPaymentPreview()`/`requestCombinedSignupPayment()`);
      `amount` is always 0, `planFeePortion` carries the whole amount
      due. Request guard blocks only a PENDING duplicate (a verified
      request never blocks the next cycle, unlike Module 59's
      signup-only guard).
- [x] A first-ever verified payment activates `currentPeriodEnd` fresh
      from verification time at the discounted `firstCyclePrice`; every
      payment after that advances (stacks onto) the existing
      `currentPeriodEnd` at the full active price for the subscription's
      billing-cycle multiplier (FR-6.50, Module 73). Distinguished via
      `hasEverPaidPlanFee()` - the existence of any OTHER verified
      plan-fee-portion request for the seller, excluding the one just
      verified.
- [x] `PlanFeeDebitService.debitDuePlanFees()` performs only overdue
      detection now, never a debit: a subscription overdue past
      `currentPeriodEnd + billing.plan_fee_grace_days` (new key, default
      3) with no verified renewal pauses via the unchanged
      `WalletGraceLadderService.pauseActiveStores()`; a verified payment
      restores instantly via the new, unconditional
      `restoreAfterPlanFeePayment()` (FR-6.50, Module 73).
- [x] The wallet-low-balance sweep scheduler is unscheduled from the
      worker cron (its service/scheduler/queue code is untouched and
      still directly callable/tested - "dormant, not deleted") - leaving
      it scheduled would pause every seller for a permanent 0 balance
      that was never real debt (FR-6.50, Module 73).
- [x] Referral commission (FR-33.4) accrues from exactly one call site -
      `AdminWalletController.verify()`'s plan-fee branch - for both first
      payments and renewals (FR-6.50, Module 73). `PlanFeeDebitService`
      no longer has a call site here.
- [x] The seller dashboard's wallet page is retired; a new Billing page
      (`/stores/:id/billing`) shows only the plan fee due and payment
      history - no balance, no top-up, no transaction ledger anywhere in
      the seller-facing UI (FR-6.50, Module 73).
      Proven by `module73-subscription-only-renewal.e2e-spec.ts` (7
      cases): first-payment activate-fresh, renewal advance-stacks,
      pending-only guard, campaign+six-month renewal pricing, referral
      commission on both first and renewal payments, grace-day sweep
      (no pause within grace, pause past it, instant restore on verify),
      and `restoreAfterPlanFeePayment()`'s unconditional behavior -
      superseding Module 59/60's retired e2e specs (deleted). The
      publish-gate assertion is proven by the rewritten
      `module47-wallet-balance-reconciliation.e2e-spec.ts`'s last case.
- [x] Commission is 0% on every tier and removed from every seller-facing
      surface; the engine itself stays intact/dormant (FR-6.51,
      Module 74). `plans.seed.ts` seeds `commissionPercent: 0` for all
      four individual tiers via the existing plan-scoped
      `billing.commission_rate_percent` mechanism (unchanged) -
      `LedgerService.accrueCommission()` itself is untouched, still runs
      on every confirmed order, just resolves 0% by default now
      (re-activatable per-tier or per-seller via the Settings admin UI
      with no deploy). Marketing copy corrected to match (pricing page
      benefit #2, homepage FAQ) - full positioning rebuild is Module 80.
- [x] Plans are renamed/repriced GO/RUN/RISE/FLY; first-cycle discount is
      a Settings-driven 50%-off-of-price computation, not a per-plan
      stored value (FR-7.22, Module 74). Data-only rename (same `Plan`
      rows, tierOrder unchanged): GO Rs 6,499/7,999, RUN Rs 14,999/18,999,
      RISE Rs 43,999/49,999, FLY Rs 73,999/79,999 (price/regularPrice).
      New global `billing.first_cycle_discount_percent` (default 50)
      replaces the retired per-tier `firstCyclePrice` column -
      `WalletService.getPlanFeePaymentPreview()`'s first-payment branch
      now computes `resolveActivePlanPrice(plan) * (1 -
      discountPercent/100)` (campaign-aware, via the new private
      `firstCyclePriceFor()`) instead of reading `plan.firstCyclePrice`;
      the column itself is left null/dormant, same treatment as the
      already-dormant `yearlyDiscountPercent`. `SubscriptionsService`'s
      two tier-name-bearing methods renamed brand-agnostic
      (`assignBasicPlanAtSignup` → `assignEntryTierAtSignup`,
      `scheduleDowngradeToStarterAtPeriodEnd` →
      `scheduleDowngradeToFallbackTierAtPeriodEnd`) so a future rename -
      this tier has now been renamed three times (First Month → Basic →
      GO) - never requires touching these call sites again. Proven by
      updates across ten pre-existing e2e specs that assumed the old
      names/nonzero default commission (module44, plans-pricing,
      module73, tenancy, trust-safety, module17-admin-control-plane,
      billing, module32-gift-cards, module47) - none deleted, each
      updated to inject an explicit test-owned commission-rate override
      (seller-scoped, highest precedence) where the test's actual point
      is the accrual MECHANISM, not any specific tier's real rate.
- [x] Feature-gate ladder (stores/staff/email quota/gift cards/customer
      segments/premium templates/D-Studio/team-leader eligibility) is
      correct across all four tiers (FR-7.23, Module 75). Store limits
      raised to GO 1/RUN 3/RISE 5/FLY 10 (`stores.max_per_seller`,
      `stores.seed.ts`; RUN and FLY were the two that changed, GO stays on
      the global default and RISE's number happened to already match).
      Email-campaign quota given its first-ever per-tier ladder (GO 799/
      RUN 2,499/RISE 10,000/FLY unlimited via a 1-billion sentinel -
      `email_campaigns.monthly_send_limit`, `campaigns.seed.ts`; previously
      every tier shared one global default of 500). Staff-account limits
      (RISE 3/FLY 10) were already correct from Module 35, verified
      unchanged. Two genuinely new plan-scoped gates added where none
      existed before - `gift_cards.enabled` and `customer_segments.enabled`
      (both boolean, off by default, on for RISE+FLY, gating
      `GiftCardsService.issue()`/`CustomerSegmentsService.create()`
      respectively; gift cards' buyer-purchase path and segments' read-only
      list/getOne/previewCount stay ungated). Closed the latent gap FR-7.23
      itself named: `teams.leader_eligible`/`theme.coded_mode_enabled`/
      `theme.premium_tier_enabled` were all defined since Modules 4/14/18
      but never plan-scoped to any tier (every seller silently resolved
      the `global` default of `false`) - now set `true` for RISE+FLY
      directly inside `seedPlansData()`'s existing per-tier loop (same
      idiom already used there for `billing.commission_rate_percent`, whose
      definition likewise lives in a different file). Proven by new
      `module75-feature-gate-ladder.e2e-spec.ts`, plus a full-suite sweep
      that found and fixed four pre-existing specs whose fixtures/
      assumptions the new gates broke: `module32-gift-cards` and
      `module33-customer-segments` (fresh GO-tier signups now need a
      seller-scoped `*.enabled` override to keep exercising the mechanism
      itself, not the new gate), `module34-email-campaigns` (segment
      creation needed the same override; its quota test's `global`-scoped
      override was silently shadowed by GO's new plan-scoped 799 and had
      to move to `seller` scope, highest precedence), and `tenancy`
      (its RISE-upgrade store-limit test asserted the old real number 2,
      now decoupled via a seller-scoped override so it tests the upgrade
      mechanism, not RISE's current business number).
- [x] Prepaid partial-advance (5%) verification channel exists and is
      plan-gated (free RUN+, GO gets only email/WhatsApp) (FR-6.52,
      Module 76). New `OrderVerificationChannel` enum value
      `prepaid_partial_advance` (migration
      `20260811100000_module76_prepaid_partial_advance`) with its own
      no-op `PrepaidPartialAdvanceAdapter` (mirrors `PrepaidConfirmationAdapter`'s
      shape - no OTP, no message to send). Its "verify" step is a real
      buyer-initiated gateway payment, not a code: two new buyer-facing
      routes on `PaymentGatewayService`/`BuyerPaymentGatewayController`
      (`GET/POST .../gateway-payment/:token/partial-advance[/verify]`)
      reuse the exact same `SellerPaymentGatewayAdapter` map Module 62
      already built (refactored the shared connection/decrypt/verify core
      into `chargeViaGateway()`), charging a new Settings-configurable
      `orders.prepaid_partial_advance_percent` (store/global, default 5)
      of the order total instead of the full amount. On a verified partial
      payment the `OrderVerification` row moves straight to `"verified"`
      (a direct write mirroring `OrderVerificationService.verifyOtp()`'s
      own update+timeline pattern - every status transition in this file
      is already written at its own call site) and `OrdersService.
      markAsPaid()` runs immediately after, the same "auto-confirms"
      wiring a full-amount gateway payment already had. Plan-gated via a
      new boolean `orders.prepaid_partial_advance_enabled` (off by
      default, on for RUN+ - tierOrder >= 1), set inside `seedPlansData()`'s
      per-tier loop next to the RISE+FLY gates Module 75 added there,
      enforced in `OrderVerificationService.updateSettingsForStore()`
      when a seller tries to select this channel. `assertChannelReady()`
      (Module 26's pre-checkout "store readiness" gate) extended with a
      direct Prisma check that a store configured for this channel has at
      least one active gateway connection, same failure mode Email OTP's
      missing-sender guard already covers - avoids a
      PaymentGatewayModule/OrderVerificationModule circular import since
      that check is a raw table read, not a service injection. Proven by
      new `module76-prepaid-partial-advance.e2e-spec.ts`, reusing Module
      62's fake-gateway-adapter e2e precedent (the real provider adapters
      call external APIs with no live sandbox to test against).
- [x] Email verification is free on every tier; WhatsApp is plan-gated
      (FR-6.53, Module 77). `email_otp` carries no plan gate at all
      (unchanged - was already free on every tier). New boolean
      `orders.whatsapp_verification_enabled` (off by default, on for
      RUN+, same tierOrder >= 1 boundary as Module 76's
      `orders.prepaid_partial_advance_enabled`, set right next to it
      inside `seedPlansData()`'s per-tier loop), enforced in
      `OrderVerificationService.updateSettingsForStore()` when a seller
      tries to select `whatsapp_otp`. The gate applies only at
      selection time - a store already using WhatsApp verification keeps
      working uninterrupted through a later downgrade, same precedent as
      every other feature gate in this ladder (Module 75). SMS
      verification does not exist as a channel and stays explicitly out
      of scope - not invented to satisfy this FR. Proven by new
      `module77-verification-channel-pricing.e2e-spec.ts`; fixed one
      pre-existing spec (`module26-order-verification`'s settings-endpoint
      round-trip test) that configured `whatsapp_otp` through the real
      PATCH endpoint on a fresh GO-tier signup - given a seller-scoped
      override (highest precedence) since its actual point is the
      settings round-trip, not the new gate. Every other whatsapp_otp
      reference across the suite (module26's OTP-mechanics tests,
      module27, module55) seeds the `OrderVerification`/`SettingsValue`
      row directly via Prisma, bypassing the gate entirely - unaffected.
- [x] Referral program renamed "Commerce Students Support", Rs 345/
      referral for up to 2 renewal cycles, admin-approval-gated (FR-33.5,
      Module 78). **FR-numbering note:** the v0.39 directive's "FR-33.5
      (Module 78)"/"FR-33.6 (Module 79)" labels collide with Module 22's
      ORIGINAL FR-33.5 (Ambassador) / FR-33.6 (Student Referral)
      assignment (§14.33 below) - this entry implements the program
      Module 78's own text names ("Commerce STUDENTS Support," matching
      Student Referral's identity), not the literal FR label, which
      would otherwise point at Ambassador. Module 79 correspondingly
      implements Ambassador repricing despite being labeled "FR-33.6."
      Flagging here rather than silently perpetuating a wrong
      cross-reference; the founder can renumber if desired.

      `student_referral` (internal enum value, unchanged - the rename is
      a display/marketing name via new global string
      `growth.student_referral_program_name`, default "Commerce Students
      Support") moves off the shared percent-of-plan-fee/time-window
      model it used to share with `creator` (`growth.
      student_creator_commission_percent`/`_window_months` - kept under
      their original key names but now Creator-only; Ambassador/Creator
      both unaffected, unchanged) onto a flat PKR amount
      (`growth.student_referral_flat_commission_pkr`, default 345) paid
      only on a RENEWAL of the referred seller's plan fee - never their
      first/initial payment - capped by COUNT
      (`growth.student_referral_max_renewal_payouts`, default 2) via a
      new `ReferralAttribution.renewalPayoutCount` field (migration
      `20260811120000_module78_referral_program_rename`), not by the
      existing time-based `commissionWindowEndsAt` (still real for
      ambassador/creator; student_referral gets a 100-year sentinel there
      so it's never the binding constraint). `ProgramCommissionService.
      accrueReferralCommissionIfApplicable()` gained an `isRenewal`
      parameter - already computed by its sole caller
      (`AdminWalletController.verify()`, from `WalletService.
      verifyTopUp()`'s own return value) - and a dedicated
      `accrueStudentReferralCommission()` branch that increments the
      count in the same transaction as the ledger post. Admin
      approval/application/suspension mechanics are the existing,
      unchanged gate (FR-33.2). Proven by new
      `module78-referral-program-rename.e2e-spec.ts` (initial payment
      never pays, each of 2 renewals pays flat, a 3rd renewal pays
      nothing, both numbers admin-configurable with no deploy);
      module22-growth-partner-programs's existing Ambassador-only
      commission test is unaffected (different program type, untouched
      code path) - verified by re-reading it, not just assuming.
- [x] Ambassador Program repriced to Rs 499/referred store/renewed month
      up to 3 months pro-rated, admin-approval-gated, with a
      Settings-configurable free-demo-account count for approved
      ambassadors (FR-33.6, Module 79). Two independent mechanics:

      **Commission repricing** - Ambassador moves off its old percent-of-
      plan-fee/6-month-window model (`growth.ambassador_commission_percent`/
      `_commission_window_months`, kept dormant not deleted, same
      treatment Module 78 gave Student Referral's old shared keys) onto a
      flat `growth.ambassador_flat_commission_per_month_pkr` (default
      499) per RENEWED month of the referred seller's plan fee - never
      their first/initial payment - up to
      `growth.ambassador_max_commission_months` (default 3) total months,
      pro-rated (a renewal payment covering more months than remain under
      the cap pays only for what remains). New
      `ReferralAttribution.commissionMonthsPaid` field (distinct from
      Module 78's `renewalPayoutCount`, which counts discrete renewal
      EVENTS for Student Referral - Ambassador's cap is in MONTHS, since
      one renewal payment can cover 1/6/12 months depending on the
      referred seller's own billing cycle). `ProgramCommissionService.
      accrueReferralCommissionIfApplicable()` gained a dedicated
      `accrueAmbassadorCommission()` branch; only "creator" still reaches
      the old shared percent-based path.

      **Free store slots (scoped per the founder's explicit design, not
      guessed)** - a genuinely separate benefit from referral commission:
      an approved Ambassador's OWN account gets a Settings-configurable
      count (`growth.ambassador_free_store_slots`, default 3) of their
      own stores exempt from plan-fee billing, granted at approval time
      (new `ProgramParticipant.freeStoreSlotsGranted`, same "issued only
      at approval" precedent as `referralCode`) and admin-editable
      afterward per ambassador (`PATCH admin/growth-programs/
      applications/:id/free-store-slots`). Reuses the EXISTING overdue-
      detection sweep (`PlanFeeDebitService.debitDuePlanFees()`) rather
      than a new billing path: an exempt seller's cycle silently advances
      by one billing interval each time the sweep finds it due (new
      `ProgramCommissionService.isExemptFromPlanFeeViaAmbassadorSlots()`,
      checking approved status + store count against the granted slots),
      exactly like a real verified renewal would - never paused. This
      keeps `currentPeriodEnd` close to "now," so if the exemption is
      later revoked (suspended/terminated, or the ambassador creates more
      stores than granted), the existing grace-day window behaves
      normally from then on - one grace period before pause, never an
      unfair immediate catch-up pause for however long they were exempt.
      Does NOT create new user accounts, bypass CNIC/verification, or
      touch referral commission mechanics - scoped exactly to the
      founder's own design when asked to clarify the otherwise-
      unspecified "free platform accounts" mechanism.

      Proven by new `module79-ambassador-repricing.e2e-spec.ts` (first
      payment pays nothing, a monthly renewal pays flat, a six-month
      renewal pro-rates down to the remaining cap, nothing accrues once
      the cap is used; slot grant-at-approval and admin override; the
      exemption itself - never paused within the granted count, cycle
      advances silently; revocation reverts at the next cycle, not an
      immediate catch-up pause). Fixed two pre-existing tests the
      commission-model change broke: module22-growth-partner-programs's
      ambassador-specific commission test (added an explicit first-
      payment-pays-nothing step, then asserted the new flat renewal
      amount) and module73-subscription-only-renewal's "accrues on both
      first payment AND every renewal" call-site-consolidation test
      (switched its example program from ambassador to the still-
      unchanged Creator program, which demonstrates the same invariant
      just as well).
- [x] Pricing page rebuilt with every feature grouped into readable
      sections and the "0% commission"/"your money never sits with us"
      positioning (FR-7.24, Module 80). New `FeatureCatalogCard`
      component (icon-in-box header + checkmarked feature list, sharing
      `FeatureCard`'s `bg-accent-subtle`/`text-accent` icon-box language
      without being visually identical - two different reading modes,
      skim vs. verify) rendering a new `FEATURE_CATALOG` array: six
      categories (Selling / Design / Marketing / Operations / Trust &
      Security / Support), 4-7 items each, covering every feature already
      shipped through Module 79 (badges, on-demand export, gateway
      connect, gift cards, customer segments, referral programs, WhatsApp
      verification, prepaid partial-advance, etc.) - copy only, reading
      from what already exists, no new backend. Inserted as an
      unconditional `<section>` on the pricing page (not gated behind the
      live-plans fetch, so it always renders even if `/plans` is slow or
      briefly unavailable) between the Supplier plans section and the
      FAQ. Also fixed a stale, factually-incorrect line left over from
      the pre-Module-73 commission-based model ("a commission rate that
      only goes down as you grow" - no longer true under the subscription-
      only model) to "0% commission on every sale, on every tier."
      `marketing.pricing_benefit_3`'s seeded default text (`plans.seed.ts`)
      corrected from "Your money never sits with us" to "Your money never
      sits with us - buyers pay you directly" to match FR-7.24's exact
      phrase (FR-7.21's existing pricing-psychology copy slot, reused
      rather than duplicated). Homepage (`app/page.tsx`) also updated:
      the supplier `FeatureCard` retitled "Local suppliers, zero stock"
      with copy naming Printify/own-supplier links and "sell without ever
      holding stock yourself," and the "Can I sell without holding any
      inventory?" FAQ answer reworded to the same "connect with local
      suppliers... sell without holding stock" phrasing - both realizing
      FR-7.24's local-dropshipping positioning requirement. Verified
      visually: Playwright screenshots of both `/pricing` (feature-catalog
      grid renders as designed, monochrome + single accent, no AI-default
      tells) and `/` (updated supplier card and FAQ answer both present)
      against a locally running dev server, confirming this wasn't just a
      typecheck/build pass but an actually-rendered page.

### 14.68 Buyer Experience Batch (new, v0.39, §5.66, not yet built)
- [ ] Guest checkout stays the default; an optional buyer account gives
      order history, saved details, and faster reorder (FR-66.1,
      Module 81).
- [ ] A review may include up to 3 photos + 1 video (capped size),
      Drive-stored with a generated video thumbnail, and review media
      flows through the existing moderation queue (FR-66.2, Module 82).
- [ ] A live chat widget, distinct from the WhatsApp button, shows a
      "seller is away" fallback and is plan-gated (FR-66.3, Module 83).
- [ ] A shipping cost calculator is visible on product and cart pages,
      not only checkout (FR-66.4, Module 84).
- [ ] Wishlist/save-for-later exists and is plan-gated the same way as
      the chat widget (FR-66.5, Module 85).
- [ ] A low-stock countdown indicator renders on product pages (FR-66.6,
      Module 86).
- [ ] Product images support zoom, and a product video with thumbnail
      renders on the product page (FR-66.7, Module 87).
- [ ] A missing-tracking alert fires when an order has been confirmed/
      paid for longer than the configured window with no tracking on any
      item, notifying the responsible party (seller or supplier, per
      item) and flagging the order as overdue in the Orders Command
      Center until resolved; tracking-upload responsibility itself stays
      exactly split as already built (FR-66.8, Module 88).

### 14.69 Deals & Bundles (new, v0.42, §5.67, not yet built)
- [ ] `Deal`/`DealItem` Prisma models exist, store-scoped, with a uniform
      `discountPercent` per deal and unique `[dealId, variantId]` on
      `DealItem` (FR-67.1, Module 91).
- [ ] Deal discounts are computed live against current variant price at
      purchase time, never snapshotted (FR-67.1, Module 91).
- [ ] `POST /storefront/deals/:dealId/buy-now` pre-populates a cart and
      hands off into the existing checkout pipeline — no parallel order-
      creation path — and blocks the whole purchase if any single item is
      out of stock, using the same atomic stock-decrement guard as
      Module 46 (FR-67.2, Module 91).
- [ ] `Order.dealId` is a nullable FK, same pattern as `discountCodeId`
      (FR-67.2, Module 91).
- [ ] Buyer-facing deal listing and detail pages render on the storefront
      (FR-67.3, Module 91).
- [ ] Seller dashboard has a Deals management view (create/edit/archive
      deals and items) and a "in an active deal" product-list filter chip
      (FR-67.4, Module 91).
- [ ] A deal-performance card (units sold, revenue) appears on the
      seller Analytics page (FR-67.5, Module 91).

---

*This is a living document — update it as decisions in §13 are resolved and as
each phase is scoped in detail. Companion deliverables: `docs/tech-stack.md`,
`docs/database-schema.md`, `docs/architecture.md`, `docs/mvp-v1-cutlist.md`,
`docs/legal/` (Terms of Service, Privacy Policy, Refund Policy drafts).*
