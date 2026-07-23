import { percentile, summarizeLatencies } from "./stats";

describe("percentile/summarizeLatencies (Module 21 simulation report math)", () => {
  it("computes p50/p95/p99 correctly for a known distribution", () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 95)).toBe(95);
    expect(percentile(sorted, 99)).toBe(99);
  });

  it("returns 0 for an empty sample rather than throwing", () => {
    expect(percentile([], 95)).toBe(0);
    expect(summarizeLatencies([])).toEqual({ count: 0, p50: 0, p95: 0, p99: 0, max: 0 });
  });

  it("summarizeLatencies sorts unsorted input before computing percentiles", () => {
    const summary = summarizeLatencies([50, 10, 30, 20, 40]);
    expect(summary.count).toBe(5);
    expect(summary.max).toBe(50);
    expect(summary.p50).toBe(30);
  });
});
