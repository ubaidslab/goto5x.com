/**
 * THROWAWAY - not a real test. Exists only to prove A1 (founder's
 * D89/D59 follow-up): deliberately fails one e2e shard so
 * e2e-tests-summary can be observed going red. Lives on the disposable
 * throwaway/ci-a1-proof branch only - never merged to main.
 */
describe("A1 proof - deliberate failure", () => {
  it("fails on purpose", () => {
    expect(1).toBe(2);
  });
});
