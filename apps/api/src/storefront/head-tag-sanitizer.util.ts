import sanitizeHtml from "sanitize-html";

/**
 * SRS FR-65.4 (Module 58) - the store-scoped custom head-tag field is raw
 * HTML a seller pastes in (e.g. a third-party site-verification meta tag),
 * which ends up in a buyer's browser via the storefront's <head> - unlike
 * ContentPage.bodyHtml (admin-only input, rendered unsanitized), this is
 * seller input reaching a buyer, an unacceptable trust boundary to leave
 * raw. Allowlisted to exactly meta/link/script[type="application/ld+json"]
 * - every other tag and every inline event handler attribute is stripped,
 * not merely escaped.
 */
export function sanitizeHeadTags(rawHtml: string): string {
  return sanitizeHtml(rawHtml, {
    allowedTags: ["meta", "link", "script"],
    allowedAttributes: {
      meta: ["name", "property", "content", "charset"],
      link: ["rel", "href", "type", "sizes", "as", "crossorigin"],
      script: ["type"],
    },
    // Only application/ld+json scripts survive; any other <script> (or one
    // with no type at all, which defaults to executable JS) is dropped
    // entirely rather than stripped-to-empty-tag.
    exclusiveFilter: (frame) => frame.tag === "script" && frame.attribs.type !== "application/ld+json",
    // sanitize-html warns by default whenever `script` is allowlisted at
    // all, regardless of how it's constrained - the exclusiveFilter above
    // is exactly "accounting for this risk" the library's own warning text
    // asks for, so the built-in warning is redundant noise here, not a
    // signal to act on.
    allowVulnerableTags: true,
    disallowedTagsMode: "discard",
  }).trim();
}
