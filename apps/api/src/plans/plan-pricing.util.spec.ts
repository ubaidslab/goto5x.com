import { addInterval } from "./subscriptions.service";
import { addMonthsClamped, computeCyclePrice, computeMonthlyEquivalentPrice, computeYearlyPrice, monthsOfService } from "./plan-pricing.util";

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

/**
 * B2 (founder decision, 2026-10-10, D9/D10) - the LOCKED USD pricing
 * table, asserted exactly against the real multipliers
 * plans.seed.ts actually seeds (2.79/5.28/9), not hand-derived
 * constants duplicated here - if the seed's multipliers ever drift from
 * D10 again, this test's own inputs below (lifted straight from D10's
 * table) stay the independent check. FLY is deliberately excluded here -
 * D75d made it dormant for the MVP window, and the founder's own B2
 * answer named only GO/RUN/RISE for this test.
 */
describe("computeCyclePrice() - D9/D10's locked USD table (B2, 2026-10-10)", () => {
  const MULTIPLIERS = { quarterly: 2.79, sixMonth: 5.28, yearly: 9 };
  const LOCKED_TABLE: Record<string, { monthly: number; quarterly: number; sixMonth: number; yearly: number }> = {
    GO: { monthly: 24, quarterly: 67, sixMonth: 127, yearly: 216 },
    RUN: { monthly: 49, quarterly: 137, sixMonth: 259, yearly: 441 },
    RISE: { monthly: 119, quarterly: 332, sixMonth: 628, yearly: 1071 },
  };

  it.each(Object.entries(LOCKED_TABLE))("%s matches the locked table exactly on every cycle", (_tier, expected) => {
    expect(computeCyclePrice(expected.monthly, "monthly", MULTIPLIERS)).toBe(expected.monthly);
    expect(computeCyclePrice(expected.monthly, "quarterly", MULTIPLIERS)).toBe(expected.quarterly);
    expect(computeCyclePrice(expected.monthly, "six_month", MULTIPLIERS)).toBe(expected.sixMonth);
    expect(computeCyclePrice(expected.monthly, "yearly", MULTIPLIERS)).toBe(expected.yearly);
  });

  it("the Free plan is $0 on every cycle", () => {
    expect(computeCyclePrice(0, "monthly", MULTIPLIERS)).toBe(0);
    expect(computeCyclePrice(0, "quarterly", MULTIPLIERS)).toBe(0);
    expect(computeCyclePrice(0, "six_month", MULTIPLIERS)).toBe(0);
    expect(computeCyclePrice(0, "yearly", MULTIPLIERS)).toBe(0);
  });

  // D75d - FLY stays correctly priced even though it's dormant; the price
  // point itself "never changes" per the founder's own decision, this
  // just proves the math agrees.
  it("FLY's own locked total is still correct, dormant or not", () => {
    expect(computeCyclePrice(249, "monthly", MULTIPLIERS)).toBe(249);
    expect(computeCyclePrice(249, "quarterly", MULTIPLIERS)).toBe(695);
    expect(computeCyclePrice(249, "six_month", MULTIPLIERS)).toBe(1315);
    expect(computeCyclePrice(249, "yearly", MULTIPLIERS)).toBe(2241);
  });
});

describe("monthsOfService()/computeMonthlyEquivalentPrice() - per-month figures (B2, 2026-10-10)", () => {
  it("six_month counts as 6.5 months of service (6 calendar months + 15 bonus days), every other cycle is a whole number", () => {
    expect(monthsOfService("monthly")).toBe(1);
    expect(monthsOfService("quarterly")).toBe(3);
    expect(monthsOfService("six_month")).toBe(6.5);
    expect(monthsOfService("yearly")).toBe(12);
  });

  it("GO's per-month figures, unrounded (rounding is a display concern, never computed here)", () => {
    expect(computeMonthlyEquivalentPrice(67, "quarterly")).toBeCloseTo(22.3333, 4); // 67/3
    expect(computeMonthlyEquivalentPrice(127, "six_month")).toBeCloseTo(19.5385, 4); // 127/6.5
    expect(computeMonthlyEquivalentPrice(216, "yearly")).toBe(18); // 216/12
  });

  it("RISE's per-month figures", () => {
    expect(computeMonthlyEquivalentPrice(332, "quarterly")).toBeCloseTo(110.6667, 4); // 332/3
    expect(computeMonthlyEquivalentPrice(628, "six_month")).toBeCloseTo(96.6154, 4); // 628/6.5
    expect(computeMonthlyEquivalentPrice(1071, "yearly")).toBe(89.25); // 1071/12
  });
});

/**
 * B2 (founder decision, 2026-10-10) - addMonthsClamped()'s whole reason
 * to exist: JS Date's native setUTCMonth() ROLLS OVER past a short month
 * instead of clamping (Jan 31 + 1 month natively becomes Mar 3, silently
 * skipping February) - a real latent bug in the pre-B2 addInterval() this
 * replaces, which had zero test coverage for month-end dates before this.
 * Every expected date below was verified against Node's own Date engine,
 * not hand-computed.
 */
describe("addMonthsClamped() - month-end and leap-year edge cases (B2, 2026-10-10)", () => {
  it("Jan 31 + 1 month clamps to Feb 28 (non-leap), never rolls over to Mar 3", () => {
    const result = addMonthsClamped(new Date("2026-01-31T00:00:00.000Z"), 1);
    expect(result.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("Jan 31 + 1 month clamps to Feb 29 in a leap year", () => {
    const result = addMonthsClamped(new Date("2028-01-31T00:00:00.000Z"), 1);
    expect(result.toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("Aug 31 + 6 months clamps to Feb 28/29, the six_month cycle's own calendar step before its 15 bonus days", () => {
    expect(addMonthsClamped(new Date("2026-08-31T00:00:00.000Z"), 6).toISOString()).toBe("2027-02-28T00:00:00.000Z");
    expect(addMonthsClamped(new Date("2027-08-31T00:00:00.000Z"), 6).toISOString()).toBe("2028-02-29T00:00:00.000Z"); // 2028 is a leap year
  });

  it("Nov 30 + 3 months (quarterly) clamps to Feb 28/29", () => {
    expect(addMonthsClamped(new Date("2026-11-30T00:00:00.000Z"), 3).toISOString()).toBe("2027-02-28T00:00:00.000Z");
  });

  it("Feb 29 (leap day) + 12 months clamps to Feb 28 the following (non-leap) year", () => {
    const result = addMonthsClamped(new Date("2028-02-29T00:00:00.000Z"), 12);
    expect(result.toISOString()).toBe("2029-02-28T00:00:00.000Z");
  });

  it("a day that exists in every month (e.g. the 15th) never clamps, every cycle length", () => {
    const from = new Date("2026-02-15T00:00:00.000Z");
    expect(addMonthsClamped(from, 1).toISOString()).toBe("2026-03-15T00:00:00.000Z");
    expect(addMonthsClamped(from, 3).toISOString()).toBe("2026-05-15T00:00:00.000Z");
    expect(addMonthsClamped(from, 6).toISOString()).toBe("2026-08-15T00:00:00.000Z");
    expect(addMonthsClamped(from, 12).toISOString()).toBe("2027-02-15T00:00:00.000Z");
  });

  it("preserves time-of-day", () => {
    const result = addMonthsClamped(new Date("2026-01-15T14:30:45.000Z"), 1);
    expect(result.toISOString()).toBe("2026-02-15T14:30:45.000Z");
  });
});

/**
 * B2 (founder decision, 2026-10-10, D10) - the full renewal-date contract:
 * quarterly = +3 calendar months, six_month = +6 calendar months PLUS 15
 * bonus days (one continuous period, D10's own wording - never a separate
 * credit), yearly = +12 calendar months. These are the exact dates
 * WalletService.verifyTopUp()/PlanFeeDebitService write to
 * currentPeriodEnd - our database's own column is the sole source of
 * truth for when a cycle (bonus days included) actually ends.
 */
describe("addInterval() - the real renewal-date contract (B2, 2026-10-10, D10)", () => {
  it("quarterly advances exactly 3 calendar months", () => {
    expect(addInterval(new Date("2026-01-15T00:00:00.000Z"), "quarterly").toISOString()).toBe("2026-04-15T00:00:00.000Z");
  });

  it("six_month advances 6 calendar months PLUS 15 bonus days, in one step", () => {
    // Feb 15 + 6 months = Aug 15; + 15 days = Aug 30.
    expect(addInterval(new Date("2026-02-15T00:00:00.000Z"), "six_month").toISOString()).toBe("2026-08-30T00:00:00.000Z");
  });

  it("six_month's +15 days is applied AFTER the clamped month step, not before (Aug 31 start)", () => {
    // Aug 31 + 6 months clamps to Feb 28 (2027, non-leap); + 15 days = Mar 15.
    expect(addInterval(new Date("2026-08-31T00:00:00.000Z"), "six_month").toISOString()).toBe("2027-03-15T00:00:00.000Z");
    // Aug 31, 2027 + 6 months clamps to Feb 29, 2028 (leap); + 15 days = Mar 15, 2028 too.
    expect(addInterval(new Date("2027-08-31T00:00:00.000Z"), "six_month").toISOString()).toBe("2028-03-15T00:00:00.000Z");
  });

  it("yearly advances exactly 12 calendar months, clamping a leap day to Feb 28", () => {
    expect(addInterval(new Date("2026-06-01T00:00:00.000Z"), "yearly").toISOString()).toBe("2027-06-01T00:00:00.000Z");
    expect(addInterval(new Date("2028-02-29T00:00:00.000Z"), "yearly").toISOString()).toBe("2029-02-28T00:00:00.000Z");
  });

  it("monthly advances exactly 1 calendar month, clamped at month-end", () => {
    expect(addInterval(new Date("2026-01-31T00:00:00.000Z"), "monthly").toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("stacks correctly onto an existing currentPeriodEnd for a renewal, not just from `now` (the isRenewal branch WalletService.verifyTopUp() actually uses)", () => {
    const currentPeriodEnd = new Date("2026-05-20T00:00:00.000Z");
    expect(addInterval(currentPeriodEnd, "six_month").toISOString()).toBe("2026-12-05T00:00:00.000Z"); // +6mo = Nov 20, +15d = Dec 5
  });
});
