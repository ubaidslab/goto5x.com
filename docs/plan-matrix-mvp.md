# MVP Plan Matrix (D78)

One row per gate the MVP plan-comparison table could show. **"Exists in
code"** is the current, shipped state, confirmed against
`plans.seed.ts`/`stores.seed.ts`/`staff.seed.ts`/etc. by the
2026-10-08 amendment's own gap report (re-verify any row before
publishing, in case it's shipped since). **"Shown on marketing"**
follows D78's rule: marketing describes only what exists in code
today — never the longer-term target in
`docs/pricing-and-programs.md` §7. FLY is excluded from this table —
it's dormant (D75d), not shown anywhere a buyer or prospective seller
can see it.

| Gate | Free | GO | RUN | RISE | Exists in code | Shown on marketing |
|---|---|---|---|---|---|---|
| Stores | 1 | 1 | 1 | 1 | Yes — server-enforced on every tier (D74, MVP-only override of the tiered 1/3/5/10) | Yes |
| Staff accounts | 0 | 0 | 2 | 3 | Yes (`staff.max_accounts`) | Yes |
| Product cap | 10 | 100 | 100 | 100 | Yes (`catalog.product_limit`) | Yes — at the real 100 figure, not D13's proposed 500 |
| Storage cap | 500MB (global default) | 500MB | 500MB | 500MB | Yes, but only as the one global default — no per-tier override exists | Yes, as one flat figure, not a per-tier table |
| Custom domain | No | Yes | Yes | Yes | Yes (`domains.custom_domain_enabled`) | Yes |
| D-Studio sections | 4, no-animation allow-list | 8 of 22 | 14 of 22 (RUN's `tierFloor` unlock) | 20 of 22 (RISE's `tierFloor` unlock) | Yes, but Free's "no animation" claim is itself a gap — two animation presets (`none`, `fade-up`) are available at `tierFloor 0`, not zero | Yes, but say "8/14/20 of 22 sections," never "all sections" on any paid tier below the true full set |
| Discount codes | Yes | Yes | Yes | Yes | Yes — fully ungated, no tier check exists anywhere | Yes, but say "every tier," not "GO and up" |
| Analytics | Full set | Full set | Full set | Full set | Yes — one analytics feature set for every tier; no "basic vs. advanced/funnel" split exists in code | Describe as one flat feature, never "basic analytics" on GO vs. a richer tier elsewhere — that distinction isn't real today |
| Email campaigns | 0/mo | Falls through to the 500/mo global default — **not yet capped at 0** | 799/mo | 2,499/mo | Partial — the GAP is specifically Free's missing zero-cap override | Describe Free as having **no** campaign sending only once the 0-cap override actually ships; until then, don't promise a Free/paid split that doesn't exist |
| Abandoned-cart emails | Runs today | Runs today | Runs today | Runs today | Yes, but ungated — every tier gets this already, it is not RUN-exclusive | Describe as a feature of every tier, not a RUN+ upsell |
| Prepaid payment model | No | No | Yes | Yes | Yes (`payments.prepaid_model_enabled`, tierOrder ≥1) | Yes |
| Gift cards | No | No | No | Yes | Yes, but gated at RISE+ today, not RUN (`gift_cards.enabled`, tierOrder ≥2) | Yes, at RISE, not RUN |
| Data export (on-demand) | No | No | No | No | Gated at the dormant FLY tier only (`data_export.on_demand_enabled`, tierOrder ≥3) — **not available on any currently-live MVP tier** | Don't promise it on any MVP tier; revisit once FLY reactivates or the gate is moved |
| Custom CSS | No | No | No | Yes | Yes (`theme.coded_mode_enabled`, tierOrder ≥2) | Yes |
| Advanced SEO | No | No | No | Yes | Yes (`seo.advanced_fields_enabled`, tierOrder ≥2) | Yes |
| Device-approval restriction | No | No | No | No | **Does not exist in code at all** — only a flat `auth.max_concurrent_devices` global default (3), no per-tier override, no approval *flow* | Don't promise this on any tier |
| API / webhooks | No | No | No | No | **Does not exist in code at all** — no generic seller-facing webhook/API model | Don't promise this on any tier |
| Priority support | No | No | No | No | **Does not exist** — one flat support SLA for every tier, no differentiation | Don't promise tiered support response times |
| Removable "Managed by UZEYN" loading mark | No | No | No | Yes (moved from FLY, D76d) | **Not yet** — code still checks FLY (`tierOrder === 3`); needs the M1 change noted in D76d before this row is true | Hold this claim until the M1 code change ships and is CI-confirmed; publishing it earlier would be a real gap between marketing and product |
| Invoice / cart / checkout UZEYN branding | Permanent | Permanent | Permanent | Permanent | Yes (§5.74 FR-74.4/74.5, shipped and CI-confirmed 2026-10-08) | Not a sellable feature either way — document as a platform invariant, not a comparison row |
| Fair-use order volume | No cap | No cap | No cap | No cap | Yes — no caps exist at launch by design; a 60-day internal alert window decides future bands | A footnote ("fair use applies"), not a numeric promise |

**Rows this table deliberately leaves out** (post-MVP per D63, already
covered in `docs/mvp-scope.md`): Vellum, seller-facing funnel
analytics, the Template Marketplace, Earn Your Plan / UZEYN Partners
benefits, device/IP fingerprinting.
