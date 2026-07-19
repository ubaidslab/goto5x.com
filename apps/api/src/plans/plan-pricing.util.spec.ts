import { computeYearlyPrice } from "./plan-pricing.util";

describe("computeYearlyPrice (FR-7.6)", () => {
  it("applies the configured discount off twelve months at the monthly rate", () => {
    expect(computeYearlyPrice(1000, 20)).toBe(9600); // 1000*12=12000, 20% off = 9600
  });

  it("defaults to no discount when yearlyDiscountPercent is null/undefined", () => {
    expect(computeYearlyPrice(1000, null)).toBe(12000);
    expect(computeYearlyPrice(1000, undefined)).toBe(12000);
  });

  it("rounds to 2dp", () => {
    expect(computeYearlyPrice(999, 15)).toBe(10189.8); // 999*12=11988, 15% off = 10189.8
  });
});
