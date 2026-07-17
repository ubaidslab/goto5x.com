import { BannedKeywordError, decideModerationStatus } from "./moderation-decision.util";

const BASE = {
  title: "Nice Widget",
  description: "A perfectly ordinary widget.",
  categoryId: null,
  isTrusted: false,
  approvedProductCount: 100,
  probationCount: 10,
  bannedKeywords: [] as string[],
  restrictedKeywords: [] as string[],
  restrictedCategoryIds: [] as string[],
};

describe("decideModerationStatus (SRS §5.27/FR-27.1-27.4)", () => {
  it("returns not_required when no rule matches and the seller is past probation", () => {
    expect(decideModerationStatus(BASE)).toEqual({ status: "not_required" });
  });

  it("a trusted seller bypasses everything, even a banned keyword", () => {
    const result = decideModerationStatus({ ...BASE, isTrusted: true, bannedKeywords: ["widget"] });
    expect(result).toEqual({ status: "not_required" });
  });

  it("throws BannedKeywordError when the title/description contains a banned keyword (FR-27.1)", () => {
    expect(() => decideModerationStatus({ ...BASE, bannedKeywords: ["widget"] })).toThrow(BannedKeywordError);
  });

  it("banned-keyword matching is case-insensitive and checks both title and description", () => {
    expect(() => decideModerationStatus({ ...BASE, bannedKeywords: ["NICE"] })).toThrow(BannedKeywordError);
    expect(() =>
      decideModerationStatus({ ...BASE, description: "contains CONTRABAND term", bannedKeywords: ["contraband"] }),
    ).toThrow(BannedKeywordError);
  });

  it("queues for probation when the seller has fewer approved products than the threshold (FR-27.3)", () => {
    const result = decideModerationStatus({ ...BASE, approvedProductCount: 3, probationCount: 10 });
    expect(result).toEqual({ status: "pending", reason: "new_seller_probation" });
  });

  it("probation applies even when no keyword/category rule would otherwise flag the listing", () => {
    const result = decideModerationStatus({
      ...BASE,
      approvedProductCount: 0,
      probationCount: 10,
      restrictedKeywords: [],
      restrictedCategoryIds: [],
    });
    expect(result.status).toBe("pending");
    expect(result.reason).toBe("new_seller_probation");
  });

  it("queues for a restricted keyword once past probation (FR-27.1)", () => {
    const result = decideModerationStatus({ ...BASE, restrictedKeywords: ["widget"] });
    expect(result).toEqual({ status: "pending", reason: "restricted_keyword" });
  });

  it("queues for a restricted category once past probation (FR-27.2)", () => {
    const result = decideModerationStatus({
      ...BASE,
      categoryId: "cat-1",
      restrictedCategoryIds: ["cat-1", "cat-2"],
    });
    expect(result).toEqual({ status: "pending", reason: "restricted_category" });
  });

  it("a category not in the restricted list does not queue the listing", () => {
    const result = decideModerationStatus({
      ...BASE,
      categoryId: "cat-3",
      restrictedCategoryIds: ["cat-1", "cat-2"],
    });
    expect(result).toEqual({ status: "not_required" });
  });
});
