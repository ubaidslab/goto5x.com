export interface ParsedMetaTag {
  kind: "meta";
  attrs: Record<string, string>;
}
export interface ParsedLinkTag {
  kind: "link";
  attrs: Record<string, string>;
}
export interface ParsedLdJsonScript {
  kind: "ldJson";
  json: string;
}
export type ParsedHeadTag = ParsedMetaTag | ParsedLinkTag | ParsedLdJsonScript;

const ATTR_PATTERN = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g;

function parseAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of attrString.matchAll(ATTR_PATTERN)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

/**
 * Module 58 (SRS §5.65, FR-65.4) - `customHeadTags` is already reduced to an
 * exact meta/link/script[type=application/ld+json] allowlist by
 * `sanitizeHeadTags()` server-side (`ObjectStorageService`'s own
 * "sanitize once, at the trust boundary" discipline - this parse is a
 * rendering convenience only, not a second security boundary). React 19's
 * built-in metadata hoisting moves literal <meta>/<link>/<script> elements
 * rendered anywhere in the tree into <head> automatically - this is why
 * StorefrontLayout renders the output of this function directly rather
 * than via `dangerouslySetInnerHTML` (which would NOT get hoisted, and App
 * Router layouts below the root cannot render a literal `<head>` element).
 */
export function parseHeadTags(html: string): ParsedHeadTag[] {
  const tags: ParsedHeadTag[] = [];
  const tagPattern = /<(meta|link|script)([^>]*?)(\/?)>(?:([\s\S]*?)<\/script>)?/g;
  for (const match of html.matchAll(tagPattern)) {
    const [, tagName, rawAttrs] = match;
    const attrs = parseAttrs(rawAttrs);
    if (tagName === "meta") {
      tags.push({ kind: "meta", attrs });
    } else if (tagName === "link") {
      tags.push({ kind: "link", attrs });
    } else if (tagName === "script" && attrs.type === "application/ld+json") {
      tags.push({ kind: "ldJson", json: match[4] ?? "" });
    }
  }
  return tags;
}
