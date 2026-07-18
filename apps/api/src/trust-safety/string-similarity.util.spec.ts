import { similarityScore } from "./string-similarity.util";

describe("similarityScore (SRS FR-30.2)", () => {
  it("scores an exact match as 1", () => {
    expect(similarityScore("Muhammad Ali", "Muhammad Ali")).toBe(1);
  });

  it("is case- and whitespace-tolerant", () => {
    expect(similarityScore("Muhammad  Ali", "muhammad ali")).toBeGreaterThanOrEqual(0.9);
  });

  it("scores a clearly different name low", () => {
    expect(similarityScore("Muhammad Ali", "Zainab Khan")).toBeLessThan(0.4);
  });

  it("tolerates minor spelling variance (a single-character difference)", () => {
    expect(similarityScore("Muhammad Ali", "Mohammad Ali")).toBeGreaterThanOrEqual(0.7);
  });
});
