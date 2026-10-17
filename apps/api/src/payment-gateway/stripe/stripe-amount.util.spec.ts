import { stripeAmountToDecimal } from "./stripe-amount.util";

describe("stripeAmountToDecimal", () => {
  it("divides a normal two-decimal currency amount by 100", () => {
    expect(stripeAmountToDecimal(150000, "pkr")).toBe(1500);
    expect(stripeAmountToDecimal(150000, "PKR")).toBe(1500);
    expect(stripeAmountToDecimal(999, "usd")).toBe(9.99);
  });

  it("does not divide a zero-decimal currency amount", () => {
    expect(stripeAmountToDecimal(1500, "jpy")).toBe(1500);
    expect(stripeAmountToDecimal(1500, "JPY")).toBe(1500);
    expect(stripeAmountToDecimal(42, "krw")).toBe(42);
  });
});
