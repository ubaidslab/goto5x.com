# Storefront Themes v2 + D-Studio v2

## Status

**Spec, not yet built.** Phase 3 of `docs/prompts/2026-10-19-phases-1-5.md`
(§4 there, reproduced and reorganized here as the standalone technical
spec that prompt's own §0 task 3 asked for). Launch-blocking MVP scope,
not a post-launch enhancement (D152). Supersedes `docs/features/
storefront-and-themes.md`'s "Themes" section once it actually ships —
that file still describes today's v1 behavior; don't treat this
document as already live. Cross-references: D152-D157 (the six new
decisions this prompt introduced), D136 (No Return/advance-payment
copy in checkout), D138/D140 (branding-removal and final-brand
decisions this theme system must respect), D149 (buyer-trust checkout
design, now made concrete by §6 below).

## Goal

A seller signs up, picks a beautiful theme, sees their store already
looking finished, then changes anything they want (photos, text,
colors, fonts, sections, which products show) in one editor, on any
device, and publishes when ready. At least Shopify-level ease, with
premium quality that makes sellers proud to share their link.

## 1. What exists today (v1 — correct this section if the code has moved on)

- D-Studio v1: 22 section types, tier gating, drag reorder, layout
  variants, device preview, a 3-color Style tab, Custom CSS on RISE.
- One `StoreThemeSettings.settings` JSON per store. No draft vs.
  published split, and no version history.
- Built-in templates style only the homepage sections. Product, cart,
  and checkout pages are shared across all themes and unthemed.
- Known gaps: logo and fonts live only in the old `/customizer`, not
  D-Studio; the Newsletter section is a stub; no premium template
  designs have ever been built.

## 2. A theme is the whole store, not just the homepage

Each theme defines all of the following, all editable in D-Studio:

- **Global styles:** a full color palette token set (background,
  surface, text, muted, primary, primary-text, border, sale, badge),
  each with 3–4 curated presets per theme plus a custom option;
  a typography preset (6–8 curated, self-hosted pairings, with an
  Urdu-capable fallback when a seller writes Urdu); a radius scale;
  button style; spacing density; product card style; image aspect
  ratio.
- **Header:** logo (image or text), announcement bar, menu, search,
  cart icon, sticky on/off, and on mobile an optional app-like bottom
  tab bar (Home, Categories, Search, Wishlist, Bag).
- **Footer:** columns, social links, policies, newsletter. The
  "Powered by UZEYN" mark follows D138's tier rules (RISE removes the
  header/invoice branding; the small footer link stays on every tier
  regardless).
- **Page templates**, each built from reorderable sections: Home;
  Collection/catalog (filters, sort, grid density); Product (§5);
  Cart (drawer and page); Search; Blog list and post; custom pages
  (About, Size guide, Contact); 404; order confirmation and order
  status (styled, with locked mandatory content per §6).
- **Checkout appearance** (§6): styled from the theme, layout locked.

Rendering stays exactly as it is today: a runtime render from settings
JSON, never a code fork per store. Template isolation (no template
code reaching cart/checkout/payment logic) stays enforced in CI.
Checkout, cart, and order-status pages receive styling only through a
read-only resolved-theme-tokens object — never the template's own code.

## 3. D-Studio v2 editor

- A page switcher at the top (Home / Product / Collection / Cart /
  Blog / Pages / Checkout look / 404). The product page previews
  against a real product of the seller's, or a sample if they have
  none yet.
- Left rail: Sections (add/remove/reorder/duplicate/hide), Global
  styles, Header & footer, Media library, Custom CSS (RISE).
- Inspector: every text field, image, button label and link,
  product/collection picker, layout variant, animation preset (same
  tier rules as today), and a "Reset section to theme default" action.
- Click-to-select in the live preview: clicking an element selects its
  section/field in the inspector.
- Content authoring inside D-Studio itself:
  - Media library — upload, crop, focal point, alt text; reuses the
    existing `media` module, not a second pipeline.
  - A quick "Add product" drawer that calls the same product API as
    the main catalog UI — no second product form, no duplicate
    validation logic.
  - Collection picking.
  - Simple blog posts and pages (title, cover, rich text, publish) —
    build a minimal seller blog if none exists yet; the BlogHighlight
    section needs one to have anything to show.
  - Menus.
- Previews: mobile, tablet, and desktop, with mobile as the default.
  A "Preview on my phone" QR code/link: signed, expires in 24h,
  `noindex`, shows the draft (not the published version).
- Undo/redo (Ctrl/Cmd+Z and buttons) and debounced autosave of the
  draft, rate-limited server-side.
- Theme gallery: category filter; each theme shown with sample content
  on phone and desktop. "Try" opens it in D-Studio as a draft without
  touching the live store; "Apply" makes it the draft's base. Switching
  theme keeps all content — products, images, text, logo, menus, pages.
  Section content maps by type; anything that can't map goes into a
  "Not used by this theme" tray, never deleted (per the platform's
  standing no-silent-data-loss rule, §7 below).
- Guided start for new stores, wired into the existing onboarding
  wizard (FR-20.1): (1) the seller picks a category, (2) the matching
  theme is pre-applied with tasteful sample content, (3) a checklist
  shows: add logo, add 3 products, set delivery charge, connect
  payment, publish.
- Guardrails so a seller can't break the design: text length limits
  per field; image size/ratio guidance with auto-crop to focal point;
  a minimum-contrast warning on color picks (WCAG AA on text/
  background — warns, never blocks); at least one product-showing
  section required on Home.
- The editor itself is keyboard-usable; drag-reorder has up/down
  buttons as an alternative, not just drag handles.

## 4. Draft, publish, and version history

- Draft settings are separate from published settings. The live store
  only ever reads the published copy.
- The editor header shows "Unpublished changes" and a Publish button
  (store owner, or staff with a design permission). A "discard draft"
  option reverts to the published copy.
  - Version history: the last 20 published versions are kept (who,
  when), each previewable, each restorable to the draft (never
  directly overwriting the live published version without going
  through Publish again).
- Every publish is written to the audit log.
- Migration for existing stores: the current `settings` JSON becomes
  both the draft and the published v1 for every store, and whatever
  preview mechanism exists today keeps working through the cutover.

## 5. Product page (the single most important page)

Reference: the founder's fashion app mock (requested from the founder
per §7 below — ask if it hasn't arrived by the time this is built).
Mobile is the default target:

- Full-width swipeable image gallery with thumbnails, pinch/tap zoom,
  and video support.
- New / Sale badges, computed from real data (a created-at window,
  compare-at price) — never hardcoded or manually toggled in a way
  that could go stale (per the platform's no-fake-trust-signals rule).
- Title, price, and a struck-through compare-at price with the percent
  saved.
- Variant pickers: size pills (an out-of-stock size shown disabled,
  not hidden), color swatches.
- A quantity stepper.
- A full-width "Add to Bag," sticky at the bottom on mobile, plus an
  optional "Buy now."
- A delivery/advance info box ("Delivery charge Rs X paid online now,
  rest on delivery") and a delivery estimate.
- A trust row showing only verifiably-true items (verified badge, COD
  on, return-policy link) — never an unbacked claim.
- A WhatsApp order button, when enabled.
- Description tabs: Details, Size guide, Delivery & returns.
- Reviews — the existing `reviews` module, real reviews only; the
  whole section is hidden when a product has none (never backfilled
  with placeholder reviews).
- Related products.
- Wishlist and share.

Every one of these sections is reorderable and toggleable in D-Studio.
Product JSON-LD and Open Graph tags carry over unchanged from today.

## 6. Checkout look and buyer trust (fulfills D149/D157)

Checkout is styled from the theme (logo, fonts, colors, button style).
The seller may add one short message line and choose which optional
trust notes show. The following are locked and always visible — the
seller cannot hide or restyle them into invisibility:

- An order summary with line items, delivery charge, and total.
- The advance breakdown: "Pay now online: Rs X (delivery charge)," 
  "Pay on delivery: Rs Y," and a one-line "Why?" explainer — "This
  store asks for the delivery charge in advance to stop fake orders.
  The rest you pay when your parcel arrives."
- The seller's store name and contact (WhatsApp/email); a verified
  badge only when the store is actually verified.
- Refund and cancellation terms for the advance payment, shown before
  payment, linking to the store's return, refund, and privacy
  policies.
- A small "Report this store" link.
- Payment through the store's own connected gateway only, with that
  gateway's name shown — never an unnamed or ambiguous payment step.

After payment: an order confirmation page and email (order number,
what was paid vs. what's due on delivery, delivery estimate, the
existing token-based order-status link, seller contact), and an order
status page with a clear timeline (Placed → Confirmed → Shipped →
Delivered) and a cancel option where the rules allow it.

Forms stay minimal: Pakistani phone format validated; address entry
supports city lists without forcing a rigid dropdown; checkout is
guest by default (account creation is optional, offered after the
order, never required before it).

**Every money amount shown is computed server-side and re-verified at
payment time. The client never sends a price the server trusts.**

## 7. The four premium themes: quality bar

- Distinct identities — each theme has its own type pairing, layout
  rhythm, product card, photography treatment, and motion. Not the
  same layout recolored four times.
  - **Fashion:** the founder's mock's direction — big imagery, rounded
    cards, category pills, a bottom tab bar, a dark full-width CTA.
  - **Beauty:** soft, editorial, ingredient/benefit sections.
  - **Tech:** crisp, spec-forward, a comparison table, a feature grid.
  - **Home & General:** warm, works for any catalog, handmade-friendly.
- Use this repo's own skills on every screen: `premium-design-taste`,
  `gsap-animations`, `ui-ux-pro-max`, `component-polish`,
  `accessibility-performance`, `webgl-3d-effects` (signature moments
  only — hero sections, at most one per page).
- Every state is designed, not just the happy path: empty store (0
  products), 1 product, 500 products, long titles, missing images,
  out of stock, sale, loading, error.
- Urdu and RTL text in seller-authored content must not break any
  layout.
- Sample content is realistic and license-safe (own-generated or
  properly licensed images, never hot-linked stock in product UI),
  stored once and reused, and preview-only — it can never become a
  purchasable product and never appears on a live store unless the
  seller explicitly converts it into their own product (the
  customer-first rule, §1.2 of the source prompt).
- Screenshot review before any theme is called done: every page at
  360, 390, 768, and 1440px, with both light and heavy sample content.
  Screenshots committed under `docs/themes/screenshots/<theme>/` so
  the founder can review without running anything locally.

## 8. Performance budgets (CI-enforced where possible)

Measured on a mid-range phone with throttled 4G, on Home and Product
with 50 products, for every theme:

- LCP < 2.5s, CLS < 0.1, INP < 200ms.
- Images: responsive sizes, AVIF/WebP, lazy below the fold, the first
  gallery image prioritized.
- Fonts: self-hosted, subset, `font-display: swap`, at most 2 font
  families per theme.
- Motion respects `prefers-reduced-motion`; no animation library loads
  on a page that doesn't animate.
- Lighthouse CI across the 4 themes: Performance ≥ 90 mobile,
  Accessibility ≥ 95.

## 9. Security for themes and D-Studio

This system is attacker-facing (a malicious seller, a malicious buyer,
or the founder's own friends probing it) — treat every input as
hostile:

- **Settings JSON:** validated server-side against a strict schema on
  every save and publish (unknown keys rejected); a size cap (e.g.
  512KB); section types are an allow-list per tier; free-form HTML is
  never stored.
- **Text and links:** rich text is a limited, sanitized subset (bold,
  italic, link, list, heading); links must be `https:`, `mailto:`,
  `tel:`, a WhatsApp URL, or relative — `javascript:`, `data:`, and
  `vbscript:` are rejected; external links carry
  `rel="noopener noreferrer"`.
- **Custom CSS (RISE):** parsed and sanitized server-side; scoped to
  the store root; no `@import`, no `url()` except the store's own
  media host, no `expression`/`behavior`/`-moz-binding`, no
  `position:fixed` overlays over checkout; a size cap. Checkout and
  order-status pages never load custom CSS at all — a deliberate
  anti-phishing, anti-overlay rule with no per-tier exception.
- **No custom JavaScript anywhere.** The storefront CSP stays strict.
- **Media uploads:** signed upload; MIME sniffed from bytes, never
  from the extension; an allow-list of jpg/png/webp/avif/gif/mp4; SVG
  is either rejected or sanitized and served strictly as an image;
  images are re-encoded with EXIF/GPS stripped and max dimensions/size
  enforced; a per-tier storage quota; served from the media origin
  with a fixed `Content-Type` and `X-Content-Type-Options: nosniff`.
- **No server-side fetch of seller-supplied URLs (SSRF).** If an
  image-by-URL import exists, it must go through an allow-listed,
  private-IP-blocking fetcher, or be removed outright.
- **Access control:** IDOR tests confirming seller A cannot read,
  save, publish, restore, or preview seller B's draft, versions,
  media, or preview link; staff permission checks on publish; preview
  links are signed, expiring, and draft-scoped.
- **Rate limits** on autosave, publish, upload, and Report-this-store.
- **XSS test suite:** the standard payload list goes into every text
  field, alt text, menu label, blog post, product title, and CSS
  value, asserted to render inert on storefront, preview, email, and
  admin.

## 10. Tests (all in CI)

End-to-end:

- Signup → guided start → pick theme → edit text/image/color/font →
  add a product from D-Studio → publish.
- A buyer then sees the change, adds to bag, checks out with the
  delivery-charge advance (sandbox/mock), and sees confirmation and
  order status.

Specific assertions:

- The draft is never visible on the live store.
- A version can be restored.
- A theme switch keeps all content.
- A plan-gated section is rejected server-side for a lower tier, not
  just hidden client-side.
- A downgrade hides over-cap products without deleting them.
- `/customizer` redirects, and its data has actually been migrated.

Coverage:

- Visual regression snapshots: 4 themes × key pages × 3 breakpoints.
- `axe` accessibility checks on every storefront page, per theme.
- The full §9 security test suite.

The Phase 3 report (per the source prompt's §1.1 format) includes the
screenshot folder path and the actual Lighthouse numbers — not a
claim that the budgets were met without the evidence attached.

## Build order (source prompt §6)

Phase 3 may run in parallel with Phase 2B, on its own branches, in this
order: (1) the theme schema, draft/publish, and version model; (2) the
editor shell and page switcher; (3) the product page; (4) checkout
look + trust flow; (5) the Fashion theme built to full quality and
sent for founder review *before* the other three are built, so the
quality bar is approved once rather than re-litigated four times;
(6) Beauty, Tech, Home & General; (7) `/customizer` retirement.

## Open, founder-owned inputs (ask once, don't block on them — source prompt §7)

- The fashion reference image, and `img/mark.svg`.
- Final display names for the 4 themes (working names above stand in
  until then; renaming is a data change, never a code change).
