import { resolveAdvancedSeo, resolveSeoFallback } from "./seo-fallback.util";

/**
 * SRS FR-1.5 (v0.9, §14.1's "SEO fallback chain renders correctly when
 * fields are null" checklist item) - the binding fallback rule verified in
 * isolation, independent of any database/HTTP layer.
 */
describe("resolveSeoFallback", () => {
  it("uses the entity's own seoTitle/seoDescription when both are set", () => {
    const result = resolveSeoFallback({
      seoTitle: "Custom Title",
      seoDescription: "Custom description.",
      fallbackName: "Widget",
      fallbackDescription: "A widget that does things.",
    });
    expect(result).toEqual({ title: "Custom Title", description: "Custom description." });
  });

  it("falls back to the entity's own name when seoTitle is null", () => {
    const result = resolveSeoFallback({
      seoTitle: null,
      seoDescription: "Custom description.",
      fallbackName: "Widget",
    });
    expect(result.title).toBe("Widget");
  });

  it("falls back to the entity's own (truncated) description when seoDescription is null", () => {
    const longDescription = "x".repeat(200);
    const result = resolveSeoFallback({
      seoTitle: "Custom Title",
      seoDescription: null,
      fallbackName: "Widget",
      fallbackDescription: longDescription,
    });
    expect(result.description).toHaveLength(160);
    expect(result.description!.endsWith("…")).toBe(true);
  });

  it("does not truncate a fallback description shorter than the limit", () => {
    const result = resolveSeoFallback({
      seoTitle: null,
      seoDescription: null,
      fallbackName: "Widget",
      fallbackDescription: "Short description.",
    });
    expect(result.description).toBe("Short description.");
  });

  it("falls back to the store-level default when the entity has neither its own seoDescription nor a fallbackDescription", () => {
    const result = resolveSeoFallback({
      seoTitle: null,
      seoDescription: null,
      fallbackName: "Widget",
      fallbackDescription: null,
      storeDefault: { seoDescription: "Store-wide default description." },
    });
    expect(result.description).toBe("Store-wide default description.");
  });

  it("renders a null description when nothing at all is set (store entity has no description field to fall back to)", () => {
    const result = resolveSeoFallback({
      seoTitle: null,
      seoDescription: null,
      fallbackName: "My Store",
    });
    expect(result).toEqual({ title: "My Store", description: null });
  });

  it("treats a whitespace-only seoTitle/seoDescription the same as null", () => {
    const result = resolveSeoFallback({
      seoTitle: "   ",
      seoDescription: "   ",
      fallbackName: "Widget",
      fallbackDescription: "Real description.",
    });
    expect(result).toEqual({ title: "Widget", description: "Real description." });
  });
});

/**
 * Module 58 (SRS §5.65, FR-65.1/65.2) - the advanced-SEO cascade extension:
 * an unset per-item boolean toggle inherits the store default; OG title/
 * description fall back to the already-resolved basic seo.title/
 * seo.description (never a third, independent fallback path).
 */
describe("resolveAdvancedSeo", () => {
  const storeDefault = { robotsIndex: true, robotsFollow: true, structuredDataEnabled: true, sitemapIncluded: true };
  const resolvedSeo = { title: "Resolved Title", description: "Resolved description." };

  it("uses the item's own values when all are explicitly set", () => {
    const result = resolveAdvancedSeo({
      canonicalUrl: "https://example.com/canonical",
      robotsIndex: false,
      robotsFollow: false,
      ogImageUrl: "https://example.com/og.jpg",
      ogTitle: "Custom OG Title",
      ogDescription: "Custom OG description.",
      structuredDataEnabled: false,
      sitemapIncluded: false,
      storeDefault,
      resolvedSeo,
    });
    expect(result).toEqual({
      canonicalUrl: "https://example.com/canonical",
      robotsIndex: false,
      robotsFollow: false,
      ogImageUrl: "https://example.com/og.jpg",
      ogTitle: "Custom OG Title",
      ogDescription: "Custom OG description.",
      structuredDataEnabled: false,
      sitemapIncluded: false,
    });
  });

  it("falls back every boolean toggle to the store default when unset (null)", () => {
    const result = resolveAdvancedSeo({
      robotsIndex: null,
      robotsFollow: null,
      structuredDataEnabled: null,
      sitemapIncluded: null,
      storeDefault: { robotsIndex: false, robotsFollow: false, structuredDataEnabled: false, sitemapIncluded: false },
      resolvedSeo,
    });
    expect(result.robotsIndex).toBe(false);
    expect(result.robotsFollow).toBe(false);
    expect(result.structuredDataEnabled).toBe(false);
    expect(result.sitemapIncluded).toBe(false);
  });

  it("falls back ogTitle/ogDescription to the already-resolved basic seo title/description when unset", () => {
    const result = resolveAdvancedSeo({
      ogTitle: null,
      ogDescription: null,
      storeDefault,
      resolvedSeo,
    });
    expect(result.ogTitle).toBe("Resolved Title");
    expect(result.ogDescription).toBe("Resolved description.");
  });

  it("renders null canonicalUrl/ogImageUrl when unset - no fallback concept for either", () => {
    const result = resolveAdvancedSeo({
      canonicalUrl: null,
      ogImageUrl: null,
      storeDefault,
      resolvedSeo,
    });
    expect(result.canonicalUrl).toBeNull();
    expect(result.ogImageUrl).toBeNull();
  });

  it("treats a whitespace-only canonicalUrl/ogTitle/ogDescription the same as unset", () => {
    const result = resolveAdvancedSeo({
      canonicalUrl: "   ",
      ogTitle: "   ",
      ogDescription: "   ",
      storeDefault,
      resolvedSeo,
    });
    expect(result.canonicalUrl).toBeNull();
    expect(result.ogTitle).toBe("Resolved Title");
    expect(result.ogDescription).toBe("Resolved description.");
  });
});
