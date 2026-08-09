import { sanitizeHeadTags } from "./head-tag-sanitizer.util";

/**
 * Module 58 (SRS §5.65, FR-65.4) - proves the store-scoped custom head-tag
 * field's allowlist is strict: only meta/link/script[type=application/
 * ld+json] survive, every other tag and every inline event handler is
 * stripped entirely (not merely escaped), and a script-src injection
 * attempt never survives regardless of the type attribute it's dressed up
 * with.
 */
describe("sanitizeHeadTags", () => {
  it("keeps a well-formed meta tag with an allowlisted attribute", () => {
    const out = sanitizeHeadTags('<meta name="google-site-verification" content="abc123">');
    expect(out).toContain("<meta");
    expect(out).toContain('name="google-site-verification"');
    expect(out).toContain('content="abc123"');
  });

  it("keeps a well-formed link tag with allowlisted attributes", () => {
    const out = sanitizeHeadTags('<link rel="alternate" href="https://example.com/feed.xml" type="application/rss+xml">');
    expect(out).toContain("<link");
    expect(out).toContain('href="https://example.com/feed.xml"');
  });

  it("keeps a script[type=application/ld+json] tag and its content", () => {
    const out = sanitizeHeadTags('<script type="application/ld+json">{"@context":"https://schema.org"}</script>');
    expect(out).toContain('<script type="application/ld+json">');
    expect(out).toContain('{"@context":"https://schema.org"}');
  });

  it("strips a <script src=...> injection attempt entirely - not merely escaped", () => {
    const out = sanitizeHeadTags('<script src="https://evil.example.com/xss.js"></script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("evil.example.com");
  });

  it("strips a script tag with no type attribute (defaults to executable JS)", () => {
    const out = sanitizeHeadTags('<script>alert(document.cookie)</script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(document.cookie)");
  });

  it("strips inline event-handler attributes (onerror) on a disallowed tag", () => {
    const out = sanitizeHeadTags('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain("<img");
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert(1)");
  });

  it("strips a disallowed tag entirely (iframe, style, div)", () => {
    const out = sanitizeHeadTags('<iframe src="https://evil.example.com"></iframe><style>body{display:none}</style><div>hi</div>');
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("<style");
    expect(out).not.toContain("<div");
    expect(out).not.toContain("evil.example.com");
  });

  it("strips a disallowed attribute (onload) from an otherwise-allowlisted link tag", () => {
    const out = sanitizeHeadTags('<link rel="stylesheet" href="https://evil.example.com/x.css" onload="alert(1)">');
    expect(out).toContain("<link");
    expect(out).not.toContain("onload");
    expect(out).not.toContain("alert(1)");
  });

  it("returns an empty string for entirely disallowed input", () => {
    const out = sanitizeHeadTags('<script src="evil.js"></script><iframe src="evil.html"></iframe>');
    expect(out).toBe("");
  });

  it("preserves multiple allowlisted tags together", () => {
    const out = sanitizeHeadTags(
      '<meta name="a" content="1"><link rel="canonical" href="https://example.com"><script type="application/ld+json">{"a":1}</script>',
    );
    expect(out).toContain("<meta");
    expect(out).toContain("<link");
    expect(out).toContain('<script type="application/ld+json">');
  });
});
