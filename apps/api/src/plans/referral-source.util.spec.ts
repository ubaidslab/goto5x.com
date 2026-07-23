import { resolveReferralSource } from "./referral-source.util";

describe("resolveReferralSource (SRS FR-33.1)", () => {
  it("returns a well-formed code unchanged", () => {
    expect(resolveReferralSource("amb_ali-01")).toBe("amb_ali-01");
  });

  it("returns null for undefined/empty input", () => {
    expect(resolveReferralSource(undefined)).toBeNull();
    expect(resolveReferralSource(null)).toBeNull();
    expect(resolveReferralSource("")).toBeNull();
  });

  it("returns null for a malformed code rather than throwing", () => {
    expect(resolveReferralSource("not a valid slug!!")).toBeNull();
  });

  it("returns null for a code over the length limit", () => {
    expect(resolveReferralSource("a".repeat(65))).toBeNull();
  });
});
