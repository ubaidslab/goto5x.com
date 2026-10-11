import { isGatewayLive, PAYMENT_METHOD_REGISTRY } from "./gateway-registry";

/**
 * D95 (founder decision, 2026-10-10) - locked against the decision text
 * itself, not just "whatever the code happens to say" - same discipline
 * as plan-pricing.util.spec.ts's locked USD table (B2). If a future PR
 * promotes a provider, this test is meant to force a deliberate edit,
 * not silently keep passing.
 */
describe("PAYMENT_METHOD_REGISTRY - D95's locked tri-state table (2026-10-10)", () => {
  it("lists exactly D95's three live payment models", () => {
    const live = PAYMENT_METHOD_REGISTRY.filter((e) => e.status === "live").map((e) => e.key);
    expect(live.sort()).toEqual(["advance", "cod", "manual_mark_as_paid"]);
  });

  it("lists exactly D95's four verifying gateways - replacing D86's 'dormant' label, same rule", () => {
    const verifying = PAYMENT_METHOD_REGISTRY.filter((e) => e.status === "verifying").map((e) => e.key);
    expect(verifying.sort()).toEqual(["bank", "easypaisa", "jazzcash", "raast"]);
  });

  it("lists exactly D95's six soon gateways - no adapter exists yet for any of them (M3/1C, D90)", () => {
    const soon = PAYMENT_METHOD_REGISTRY.filter((e) => e.status === "soon").map((e) => e.key);
    expect(soon.sort()).toEqual(["airwallex", "ebanx", "razorpay", "simpaisa", "skypay_global", "stripe"]);
  });

  it("every gateway entry's key is a real PaymentGatewayProvider except the six not-yet-built 'soon' ones", () => {
    const realAdapterKeys = ["raast", "easypaisa", "jazzcash", "bank"];
    const gatewayEntries = PAYMENT_METHOD_REGISTRY.filter((e) => e.kind === "gateway");
    for (const entry of gatewayEntries) {
      if (realAdapterKeys.includes(entry.key)) {
        expect(entry.status).toBe("verifying");
      } else {
        expect(entry.status).toBe("soon");
      }
    }
  });
});

describe("isGatewayLive() - the real runtime gate (D95/B3, 2026-10-10)", () => {
  it("none of today's four legacy gateways are live - docs/gateway-verification/ has zero evidence files for any of them", () => {
    expect(isGatewayLive("raast")).toBe(false);
    expect(isGatewayLive("easypaisa")).toBe(false);
    expect(isGatewayLive("jazzcash")).toBe(false);
    expect(isGatewayLive("bank")).toBe(false);
  });
});
