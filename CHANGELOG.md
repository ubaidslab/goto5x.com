# Changelog

All notable changes to goto5x.com, reconstructed retroactively from the module-
by-module build history in `docs/build-plan.md` and the SRS's own amendment
changelog (`docs/SRS.md`). Versions here track the SRS/build-plan version
number (not npm semver) — each entry is either a specification amendment
(docs only) or a shipped module (code + tests). Maintained on every future
change.

## Module 24 — Seller Data Export to Personal Cloud Storage

### Added
- `SellerDataExport` (FR-36.1-36.5) — a seller-scoped, cross-store data
  export job. Triggers: automatically on each successful subscription
  renewal (`PlanFeeDebitService.runMonthlyDebitSweep()` returns
  `renewedSellerIds`, consumed by the worker's orchestration layer, not a
  direct `BillingModule -> DataExportModule` import — that edge would
  create a real module cycle through `MediaModule -> AuthModule ->
  GrowthProgramsModule -> BillingModule`); or on-demand, rate-limited to
  once per `data_export.on_demand_min_interval_hours` (Settings Registry)
  via a rolling check against the export table's own timestamps.
- Bundle contents (FR-36.2): trailing-period products/orders/customers
  CSVs (reusing `toCsv`, FR-18.2's primitive, via fresh date-ranged
  queries — not a modification of the existing single-store
  `CsvExportService`) plus one summary PDF (reusing the Playwright
  renderer via a new `InvoicePdfService.renderToBuffer()` that returns a
  buffer without uploading, avoiding a redundant second render for the
  Drive-upload path).
- Delivery (FR-36.3): Google Drive when the seller has an active,
  upload-scoped connection (`IDriveClient.createFolder`/`uploadFile`,
  under a widened OAuth scope including `drive.file`), else an email
  fallback. Pre-existing connections made under the old `drive.readonly`-
  only scope correctly degrade to email rather than attempting an upload
  they cannot perform.
- Non-blocking guarantee (FR-36.4): `DataExportService.processExport()`
  never throws — a generation or delivery failure is caught, logged, and
  recorded on the row as `status: "failed"` with a `failureReason`,
  including the case where the export row itself can't be found; the
  subscription renewal that triggered it is provably unaffected.
- Seller-facing UI: a "Data export" card on the store Settings page
  (request-on-demand button + export history, with per-file download
  links per the security fix below).
- Migration `20260725090000_module24_seller_data_export`.

### Fixed (v0.28, security, same-day follow-up before this module's
checklist could be approved as final)
- Export bundles contain customer PII (buyer emails/names/order details)
  and had initially been stored as plain, permanent, unsigned public
  MinIO URLs — the pattern every other file link in this app uses, but
  wrong specifically here. Fixed: files now live under a `private-exports/`
  object-storage prefix, never returned as a public URL anywhere;
  `SellerDataExport`'s `*CsvUrl`/`summaryPdfUrl` columns renamed to
  `*CsvKey`/`summaryPdfKey` (migration
  `20260725100000_module24_security_private_exports`) to make "internal
  key, not a URL" visible in the schema; the sole read path is a new
  ownership-checked, authenticated endpoint,
  `GET sellers/me/data-export/:exportId/download/:file`, streaming bytes
  via a new `ObjectStorageService.getObject()`; the list/history endpoint
  now returns `hasProductsCsv`/`hasOrdersCsv`/`hasCustomersCsv`/
  `hasSummaryPdf` booleans instead of any key or URL; the email fallback
  links to the dashboard's Data export card (login required) instead of
  a raw file link. Google Drive delivery is unaffected (that's the
  seller's own Drive, not this platform's storage). **Flagged, not
  fixed:** `Order.invoicePdfUrl` shares the original plain-public-URL
  pattern — lower severity (one buyer's own order, not a seller's full
  customer/order list) and deliberately out of scope here; added to
  `docs/SRS.md` §14.19 as a known hardening item for a future pass.
  `docs/launch-runbook.md` gained a required deploy-time step: the MinIO
  bucket policy must not grant anonymous reads on `private-exports/`.

## Module 23 — Store Health Score + Verified Store Program

### Added
- `StoreHealthScoreService` (FR-34.1-34.3) — a 0-100 composite score per
  store from seven Settings-Registry-weighted inputs (on-time fulfillment,
  cancellation rate, pending-forever rate, dispute/refund signals, profile
  completeness, account age (capped), moderation/risk history via §5.30's
  existing Risk Score Engine). Normalizes by the actual sum of the
  (editable) weights rather than assuming they total 100 — robust to an
  admin tweaking one weight without rebalancing the rest.
- `Store.policyText` (new field, FR-34.1's disclosed schema gap) —
  freeform, seller-editable from the store Settings page, shown on the
  storefront and counted toward profile completeness.
- `StoreHealthScoreHistory` (FR-34.2) — one row per scheduled recompute
  run (`StoreHealthSweepScheduler`, `store-health-sweep` BullMQ queue);
  the seller dashboard (`/stores/:id/health`) renders a trend and a
  plain-language breakdown of what's lowering the score, never raw
  weighted-sum math (FR-34.3, Simplicity Invariant §3.13).
- `VerifiedStoreApplication` + `Store.verifiedStatus`/`verifiedSince`/
  `verifiedExpiresAt`/`reReviewFlaggedAt`/`reReviewReason` (FR-35.1-35.6)
  — the Verified Store Program. A live eligibility portal
  (`GET /stores/:id/verification/eligibility`) evaluates 6+ months on the
  same verified custom domain, Store Health Score ≥ 80, CNIC verified,
  zero unresolved T&S flags, and a minimum confirmed-sales volume — all
  Settings-Registry-driven. The SAME check function gates `apply()`
  server-side, so the portal can never drift from the real enforcement
  gate (proven by an e2e test posting a failing application directly).
- New `LedgerEntryType` values `verification_fee_debit`/
  `verification_fee_refund_credit` — the application fee debits at apply
  time (before any admin decision), and a Settings-controlled policy
  (default: full refund) reverses it on rejection. The fee is explicitly a
  processing fee, never a purchase of the badge — an eligible applicant
  can still be rejected by the mandatory admin audit queue.
- The badge (`Store.verifiedStatus === "verified"`) is surfaced as
  `verified` on `GET /storefront/store` (`cache: "no-store"`) and rendered
  once in the shared `SiteHeader` component, which the checkout page also
  reuses — one code change satisfies both required render points
  (storefront header + checkout), with no propagation delay.
- `VerificationReReviewService` (FR-35.5/35.6, scheduled sweep) —
  independently checks every verified store for a Store Health Score drop
  below threshold OR a T&S enforcement action (`lifecycleStatus != active`),
  auto-flagging either trigger for re-review (badge suspended, no
  auto-revoke); separately expires annual re-verification (Settings
  toggle, default on) after 12 months, requiring a full fresh application
  through the same live eligibility + mandatory-audit path — never a
  rubber-stamp renewal.
- Admin queue (`AdminVerificationController`, `AdminAuthGuard`-only —
  money-adjacent, same discipline as every other control-plane money
  action): approve/reject applications (reject refunds the fee), resolve
  a flagged re-review (clear or confirm-revoke), and a standing direct
  revoke at any time (requires a reason, audit-logged).
- Migration `20260724120000_module23_store_health_verified_store`.
- `docs/legal/verified-store-program-terms.md` (draft, flagged for legal
  review) — the fee-is-processing-not-purchase framing, eligibility/
  revocation/re-verification terms.

## Module 22 Phase B — Careers (Module 22 complete)

### Added
- `JobPosting`/`JobApplication` (FR-33.8) — a minimal admin-editable
  content type reusing FR-12.1's "admin-managed, data not a deploy"
  discipline, without overloading the shared `ContentPage` table (a job
  posting needs its own status/pipeline shape).
- Public careers listing shows only `open` postings; a candidate applies
  with a CV upload through a dedicated size/type limit (5MB, PDF/Word
  only — a document limit, distinct from the media pipeline's 25MB image/
  clip limit), reusing the existing object-storage substrate.
- Application-pipeline stage labels (`received`/`reviewing`/
  `interviewing`/`rejected`/`hired`) are Settings-Registry-editable
  display text — the internal state machine stays fixed, only the
  outward label is admin data, mirroring FR-33.5's certificate-tier
  naming discipline.
- Applicant data (contact details, CV) never appears on any public
  endpoint — enforced structurally: only the `AdminAuthGuard`-protected
  controller ever queries `JobApplication`.
- Migration `20260723180000_module22_growth_partner_programs_phase_b_careers`.
- No referral, commission, or wallet code — fully independent of Phase A,
  as scoped.

## Module 22 Phase A — Growth & Partner Programs: shared referral engine

### Added
- The shared application/eligibility/approval shape (FR-33.2) for all
  three referral programs — no self-serve join; an admin may suspend or
  terminate any approved participant at any time.
- `ReferralAttribution`, unique per referred seller at the database level
  (FR-33.3) — the first valid attribution across any program wins,
  permanently; enforced by a real unique constraint, not application logic.
- Commission restricted to a referred seller's own paid plan-subscription
  amount only (FR-33.4) — wired into exactly one call site
  (`PlanFeeDebitService.debitDuePlanFees()`'s successful-debit branch), so
  it structurally can never accrue from wallet top-ups or a seller's own
  storefront GMV.
- Ambassador (FR-33.5): plan-eligibility gate, 8% commission for 6 months
  (Settings Registry, locked in per-attribution), monthly performance
  reward sweep, live certificate-tier lookup against admin-editable
  thresholds.
- Student Referral (FR-33.6) and Creators (FR-33.7): shared 5%/3-month
  referral terms; Creators add a manual content-verification queue — a
  reported view count is never itself a payout trigger.
- `PayoutRequest` — the Payout Request & Disbursement Engine (SRS §5.6b,
  dormant since the schema was first drafted), reactivated: requesting/
  approving never touches the ledger, only a transition to `paid` creates
  the real debit, so a rejection needs no reversal.
- Clawback (FR-33.10) reuses the wallet's existing negative-balance
  mechanism verbatim — can take a participant's balance negative even
  against an already-paid withdrawal.
- Self-referral fraud signal added to the existing Trust & Safety admin
  risk view (`GET /admin/trust-safety/monitors/self-referral`) — CNIC,
  payment-instrument, and signup device/IP overlap between a referrer and
  their referred seller.
- Per-program admin report (referrals, conversions, payouts, rejection
  rate), application/withdrawal/content-verification admin queues.
- Migration `20260723172749_module22_growth_partner_programs_phase_a`.
- Careers (FR-33.8, Phase B) not yet built — no self-referral/commission
  machinery, next.

## v0.27 — Store Health Score, Verified Store Program, Seller Data Export (spec only, build TBD)

### Added (specification)
- §5.34/§14.34 Store Health Score: a 0-100 composite score from seven
  Settings-Registry-weighted inputs (fulfillment timing, cancellation
  rate, pending-forever rate, dispute/refund signals, profile
  completeness, account age, moderation/risk history), scheduled
  recompute + history for trending, plain-language seller-dashboard
  breakdown. Adds one small schema gap closer: `Store.policyText`.
- §5.35/§14.35 Verified Store Program: live self-serve eligibility portal,
  a paid application (processing fee, never a purchase) into a mandatory
  admin audit queue, a buyer-facing storefront/checkout badge, and a
  revocable status with both automatic re-review triggers (health drop,
  T&S action) and a standing admin override.
- §5.36/§14.36 Seller Data Export to Personal Cloud Storage: a non-blocking
  export (CSV + summary PDF) to a seller's connected Google Drive on
  subscription renewal or on demand, with an email-download-link fallback.
  Explicitly not a substitute for the platform's own backup NFR.
- FR-22.10 (roadmap note, no build): a future seller mobile app, using the
  existing SSO + API-first architecture.
- Slotting: Store Health Score + Verified Store Program become Module 23
  (tightly coupled to each other); Data Export becomes Module 24
  (independent). Module 22 (Growth & Partner Programs) is unchanged.

## Module 21 — Hardening & Launch Readiness

### Added
- CI required-checks (`.github/workflows/ci.yml`): typecheck, unit, e2e
  (real Postgres/Redis), dependency-audit, web-build.
- Rate-limit audit against §14.12's endpoint list; the one real gap found
  (login, seller + admin) closed with the existing dual-key
  `RateLimitService` pattern.
- PII-redaction test for the existing logging interceptor.
- Dependency-vulnerability CI gate (`pnpm audit --audit-level=critical`) +
  a fixture-proof script; a real `multer` DoS CVE fixed via
  `pnpm.overrides`.
- Load/soak simulation CLI (`apps/api/scripts/simulate/`) — seed/run/
  report/teardown, driven entirely through the real API. Found and fixed
  three real bugs while smoke-testing it: new sellers' products stuck in
  the moderation probation queue (100% of simulated orders failed at any
  N), a missing Postgres grant blocking teardown's trigger-bypass, and a
  teardown delete against a non-existent column.
- `docs/launch-runbook.md` — the ordered, checkbox launch-day sequence.

## v0.26 — Growth & Partner Programs (spec only, build TBD) + FR-33.1 standalone

### Added
- §5.33/§14.33 Growth & Partner Programs: four gated (never self-serve)
  acquisition channels — Certified Ambassador, Student Referral, Creators,
  Careers — crediting the existing wallet/ledger and reactivating the
  dormant Payout Request & Disbursement Engine (§5.6b) for withdrawal.
- FR-33.1 shipped standalone ahead of the rest: `Subscription.referralSource`
  captured (shape-validated only) at signup, for both seller and supplier
  signup paths — this data is unbackfillable, so it couldn't wait for the
  full module.

## v0.25 — Wallet negative-float floor enforcement fix (post-Module-20)

### Fixed
- FR-6.26's negative-float floor was seeded but never enforced — a store
  could take orders indefinitely while its balance ran arbitrarily
  negative during the grace period. Fixed as an immediate, grace-bypassing
  pause, checked right after a commission debit lands and on every
  low-balance sweep pass.

## v0.24 — Prepaid Credits Wallet (Module 20 build)

### Added
- Seller wallet: ledger-backed balance extending Module 11's `LedgerEntry`
  table with new entry types (`wallet_topup_credit`, `wallet_plan_fee_debit`,
  `wallet_team_seat_fee_debit`, `wallet_device_slot_fee_debit`); Balance box,
  top-up screen (presets + custom amount), and full transaction history on
  the seller dashboard.
- Publish gate (FR-6.21): an explicit "Publish store" seller action —
  requires a configured payment method, a verified CNIC, and a minimum
  wallet top-up (Settings Registry, default Rs. 500) before a store can
  accept a real order.
- `TopUpAdapter` interface + `ManualBankTransferTopUpAdapter` (v1.0's one
  implementation) — a future gateway-based auto-top-up plugs in as a second
  adapter without touching wallet/ledger logic.
- Low-balance grace ladder (FR-6.25): dashboard + email warning below a
  configurable threshold, a configurable grace period, then a new
  `orders_paused` store state (storefront stays browsable, checkout blocked
  with a respectful notice) — distinct from admin-issued `suspended`. A
  verified top-up restores instantly, no admin action needed.
- Negative-float floor (FR-6.26): the wallet may go negative down to a
  configurable floor so a confirmed sale's commission debit never fails or
  rolls back mid-transaction.
- Plan-fee collection finally built (FR-7.2, revised): a paid plan's fee,
  a Team leader's per-seat group total, and the FR-25.7 extra-device-slot
  add-on all debit the seller wallet monthly-in-advance; insufficient
  balance downgrades to Free (never `orders_paused`/suspension).
- Supplier Premium Plan's full stack (FR-7.10): `Subscription`/
  `SettingsContext` gain real supplier support (`supplierId`, a new
  `supplier` Settings Registry scope); a dedicated supplier-scoped wallet
  (`SupplierWalletEntry`) collects the Premium-tier fee; the supplier-facing
  aggregated multi-store dashboard (`apps/web/app/(supplier)`) — previously
  API-only since Module 9 — finally has a UI, gated on the Premium plan via
  `suppliers.aggregated_dashboard_enabled`.
- Signup form gained a Seller/Supplier role toggle — supplier signup was
  API-reachable since Module 8 but never exposed in `apps/web`.

### Changed
- The Module 17 admin commission-invoice verification screen is repurposed,
  not rebuilt: `/admin/invoices` now lists and verifies wallet top-up
  requests (seller and supplier) instead of invoices.
- `StorefrontService.loadActiveStoreOrThrow` treats `orders_paused` like
  `active` for browsing; only `CheckoutService` blocks it.
- Supplier order aggregation (`SupplierOrdersService.listOwnOrderItems`,
  built Module 9) is now gated: a free-tier supplier linked to more than one
  store must filter to a single store; Premium unlocks the unified view.

### Deprecated (dormant, not deleted)
- §5.6c's monthly commission-invoice mechanism (Module 11): the generation/
  overdue-sweep jobs are unscheduled — the code is untouched and callable,
  preserved for a possible future enterprise/post-paid reactivation, exactly
  like §5.6/§5.6a/§5.6b before it.

## v0.23 — Impersonation transparency amendment (ahead of Module 17)

### Added
- FR-8.4 impersonation transparency: a persistent "support mode" banner for
  the session's duration; a `platform_event` on session start; a seller-
  visible support-access history line (when/duration, never which admin);
  high-risk writes (mark-as-paid, payment-instruction changes, payout/
  invoice actions) blocked outright while impersonating.

## v0.22 / Module 15.5 — Storefront Buyer Purchase Flow & Store Branding

### Added
- New §5.32: storefront product-page add-to-cart, cart page, email-first
  checkout flow, order-confirmation page linking to the buyer order-status
  page, store logo upload (wired into storefront header, invoice template,
  and emails). Launch-blocking — closes the gap that Module 9's checkout
  APIs had no buyer-facing UI at all.

## v0.21 / Module 15 — Customers, Reviews & Data Portability

### Added
- Customers CRM (FR-13.1-13.3): auto-created/matched at order placement,
  spend/order-count updated only at payment confirmation.
- Product Reviews & Ratings (FR-14.1-14.4): public submission via the
  order-status token, seller moderation, verified-purchase flag tied to a
  confirmed order.
- Self-hosted PDF invoices (FR-19.1-19.3): one v1.0 template, generated
  once at order placement via headless Chromium, cached on the order.
- CSV import/export (FR-18.1-18.3): core-field mapping with unmapped
  fields listed explicitly per upload.
- The buyer order-status page (FR-5.4), previously never built despite
  being a Module 11 prerequisite, built here (status, items, totals,
  payment instructions, invoice download, review form).

## v0.20 — Plan-fee collection + Supplier Premium Plan pinned (ahead of Module 15)

### Changed
- FR-7.2 revised: pinned the (then-)v1.0 plan-fee mechanism as a monthly
  `plan_subscription` invoice on the same manual-verification engine as
  commission invoicing — schema-ready since Module 14, generation job
  deferred to a later module. (Superseded by v0.24's wallet mechanism.)
- FR-7.10 supplemented: confirmed the Supplier Premium Plan's three pieces
  (plan data, aggregation API, the gate connecting them) and slotted the
  gate + supplier-facing dashboard UI into a new Module 20.

## v0.19 — Plan Architecture: groups & tiers (ahead of Module 14)

### Added
- FR-7.17: plans organized into named groups (Individual, Team, Supplier),
  each an ordered list of tiers, addressed by `(group, tier)` everywhere a
  plan gate resolves — replacing a flat plan-id assumption.
- FR-7.18: Team plan per-seat pricing — a team tier's own seat price, not
  each sponsored member's individually-chosen plan.

## Module 18 — External-SaaS Integration Hooks

### Added
- Template Install/License API + entitlements (signed, import-only).
- Product Feed API + seller API tokens (rate-limited, revocable).
- Cross-SaaS eligibility + Marketing SSO handoff.
- External API client registry (FR-8.14) — enable/disable a SaaS
  integration without a deploy.
- Customizer showcase + lock state, Marketing page, admin registry page.

## Module 17 — Admin Control Plane completion

### Added
- Content pages + brand assets (FR-12.1/12.3): versioned, revision history,
  public reads need no auth.
- In-app messaging (FR-8.15) + maintenance-mode kill-switch (FR-8.7) with
  an IP allowlist.
- Real-time GMV/analytics dashboard (FR-8.10), Financial Truth Invariant
  respected (excludes `pending` orders).
- Commission-invoice verification screen; moderation-queue admin UI
  (closing Module 6's slotted gap).
- Seller impersonation + view-any-store with full audit trail (FR-8.4),
  including the v0.23 transparency amendment.

## Module 16 — Seller Onboarding Wizard

### Added
- Regional launch gating (FR-25.5): country allowlist + waitlist capture.
- Onboarding progress tracking (FR-20.1): a guided post-signup checklist
  (theme, logo, first product, domain), sticky completion.
- Signup gained a country field.

## v0.16 — Seller Identity & Commission-Fraud Defense (ahead of Module 12)

### Added
- New §5.30: CNIC capture at activation, name-consistency checks against
  payment instruments, a rule-based risk-score engine, a Trust & Safety
  enforcement ladder (warn/restrict/suspend/ban) built on FR-8.4's lifecycle
  control, anti-underreporting monitors (cancellation-rate,
  pending-forever-rate) feeding admin risk views.

## Module 14 — Plans, Pricing & Guard-Rails

### Added
- Plan groups/tiers schema + editor, per-seat Team pricing, inverse
  commission laddering, yearly billing, launch-campaign pricing,
  admin-granted plans, platform subscription promo codes.
- Business Guard-Rails (§5.23, FR-23.1-23.5): product/storage limits,
  dormant-store lifecycle, one-Free-store-per-identity default, velocity
  limits.

## Module 13 — Seller Account Security

### Added
- TOTP 2FA reusing Module 1's admin-MFA machinery; enforcement mode
  (optional/required-for-payout/required-always) as a Settings Registry key.
- Session/device management: list, revoke, concurrent-device limit
  (seller-scoped override = the paid extra-device-slot add-on's mechanism —
  monetized in Module 20/v0.24).

## Module 12 — Trust & Safety System

### Added
- Seller Agreement acceptance (FR-29.1/29.2), CNIC at activation (FR-30.1),
  TitleVerificationAdapter (FR-30.4), risk-score engine (FR-30.5/30.6),
  the Trust & Safety enforcement ladder + admin endpoints (FR-29.4).
- FR-27.8: Listing Moderation Engine extended to supplier-sourced listings,
  closing a gap found during Module 8's own review.

## v0.15 — Direct Seller Collection pivot (major business-model amendment, ahead of Module 10)

### Changed
- Platform-collected payments (Safepay-first gateway, hold/reserve/payout
  engine, §5.6/§5.6a/§5.6b) marked **dormant** for v1.0, preserved for a
  future international/regulatory reactivation.
- New §5.6c: buyers pay sellers directly (bank/JazzCash/Easypaisa/COD, COD
  unconditional since the platform never holds money); the platform's
  revenue becomes a commission invoice the seller owes after the fact —
  default 1%, monthly-generated, manually admin-verified, grace-period-
  then-automated-suspension on non-payment. Anti-underreporting monitors
  (cancellation-rate, pending-forever-rate) feed Trust & Safety.

## Module 11 — Commission & Invoicing Engine

### Added
- `LedgerEntry`/`SellerInvoice` built under the v0.15 Direct Seller
  Collection model: `commission_accrued` on confirmed sale only (Financial
  Truth Invariant), monthly invoice generation, manual mark-paid, grace-
  period-triggered suspension, commission waiver.

## Module 10 — Seller Dashboard UI

### Added
- New module (v0.12 amendment) closing the gap that Modules 2/7/9 shipped
  API-only with no dashboard screens: products/media, shipping/tax/
  discounts, orders, supplier links, collections/navigation/customizer/
  settings restyled, dashboard personalization.
- New binding SIMPLICITY INVARIANT NFR (§3.13).

## Module 9 — Orders, Cart & Checkout

### Added
- Cart, checkout, manual orders (FR-17.1), order notes/tags/timeline/
  editing, oversell protection, country-block, live price re-validation.
- FR-5.3: a `suspended` store now resolves to a distinct buyer-facing 403,
  not a generic 404.

## Module 8 — Suppliers & Printify Adapter

### Added
- Supplier registration/listing submission, generic supplier-adapter
  interface, Printify adapter, admin adapter registry, store-supplier
  linking, listing review queue.

## v0.12 / Module 7 — Shipping, Tax & Discounts

### Added
- Self-fulfilled shipping settings, tax settings (inclusive/exclusive),
  basic discount codes.

## Module 6 — Listing Moderation Engine

### Added
- New §5.27 (v0.10 amendment): banned/restricted keyword lists,
  restricted-category rules, new-seller probation, trusted-seller
  auto-approve, moderation queue, a REVIEWER admin sub-role.

## Module 5 — Discovery & Merchandising

### Added
- Storefront search/collections/merchandising, moderation-status filtering
  wired in.

## v0.10 — Account Security, Financial Truth Invariant, Moderation Engine (ahead of Module 5)

### Added
- §3.12 Financial Truth Invariant (binding NFR): no pending/unconfirmed
  order counts as a sale anywhere, pinned before Orders/Payments were
  designed.
- §5.25 Seller Account Security foundation; §5.27 Listing Moderation Engine
  (see Module 6).

## Module 4 — Theme Engine & Storefront Rendering

### Added
- Storefront rendering, theme settings, SEO fallback chain (FR-1.5,
  v0.9 amendment), dynamic sitemap/robots.txt, coming-soon/password gate.

## v0.8 — Platform Event Log

### Added
- §3.11: append-only `platform_events` table, non-blocking emission,
  backfilled into Modules 1-3.

## Module 3 — Custom Domain & TLS

### Added
- Domain attach/verify, TLS provisioning, Traefik dynamic config.

## Module 2 — Catalog & Media

### Added
- Products/variants/categories, Google Drive media import (encrypted
  refresh token, v0.7 amendment gap-closure), media asset pipeline.

## Module 1 — Foundation

### Added
- Auth (signup/login/email verification/password reset), multi-tenancy +
  RLS, the Settings Registry (config-as-data, precedence pinned v0.7),
  admin audit log (insert-only immutability), health checks.

## v0.1 – v0.7 — Pre-build specification phase

### Added
- Initial SRS, database schema, architecture, tech stack, and MVP cutlist
  drafts; the Settings Registry pattern and full Admin Control Plane
  section (v0.3); the self-host-first principle, Acceptance Checklists
  (§14), and Payout & Disbursement Engine design (v0.4); 16 new v1.0
  commerce features scoped (v0.5); documentation regressions fixed and two
  external-SaaS integration hooks specified (v0.6); the Settings Registry
  precedence pinned and seven further additions approved ahead of Module 2
  (v0.7).
