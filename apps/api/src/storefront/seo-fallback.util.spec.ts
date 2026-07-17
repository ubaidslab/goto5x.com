import { resolveSeoFallback } from "./seo-fallback.util";

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
