import { signedContribution } from "./wallet.service";

describe("signedContribution", () => {
  it("credits increase balance", () => {
    expect(signedContribution("wallet_topup_credit", 100)).toBe(100);
  });

  it("debits decrease balance", () => {
    expect(signedContribution("commission_accrued", 10)).toBe(-10);
  });

  it("commission_waived's already-negative amount adds back (a waiver increases balance)", () => {
    expect(signedContribution("commission_waived", -10)).toBe(10);
  });

  // Module 53 (SRS §5.60/FR-60.4) - refund_adjustment, reserved since v1.0,
  // wired in by this module with the exact same negative-entry-adds-back
  // convention commission_waived already uses.
  it("refund_adjustment's already-negative amount adds back (a refund's commission reversal credits the seller)", () => {
    expect(signedContribution("refund_adjustment", -25.5)).toBe(25.5);
  });

  it("dormant reserved entry types (not yet wired into either set) contribute nothing", () => {
    expect(signedContribution("sale_credit", 100)).toBe(0);
    expect(signedContribution("gateway_fee_debit", 100)).toBe(0);
  });
});
