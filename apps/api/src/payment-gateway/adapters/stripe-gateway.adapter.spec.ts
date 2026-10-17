import { ConfigService } from "@nestjs/config";
import { StripeGatewayAdapter } from "./stripe-gateway.adapter";
import { StripeCredentialSource } from "../stripe/stripe-credential-source.interface";

const sessionsRetrieve = jest.fn();
const eventsList = jest.fn();

jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    checkout: { sessions: { retrieve: sessionsRetrieve } },
    events: { list: eventsList },
  }));
});

function buildConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  return { get: (key: string) => overrides[key] } as unknown as ConfigService;
}

const FIXED_CREDENTIALS: StripeCredentialSource = {
  resolve: () => ({ apiKey: "rk_test_fake" }),
};

describe("StripeGatewayAdapter", () => {
  beforeEach(() => {
    sessionsRetrieve.mockReset();
    eventsList.mockReset();
  });

  it("has provider 'stripe'", () => {
    const adapter = new StripeGatewayAdapter(buildConfig(), FIXED_CREDENTIALS);
    expect(adapter.provider).toBe("stripe");
  });

  it("testMode calls events.list (an 'Events: Read' call, within the restricted key's granted scope) and reports verified on success", async () => {
    eventsList.mockResolvedValue({ data: [] });
    const adapter = new StripeGatewayAdapter(buildConfig(), FIXED_CREDENTIALS);
    const result = await adapter.verifyPayment({
      connection: { merchantId: null, apiKey: "rk_test_fake", apiSecret: null },
      orderId: "",
      amount: 0,
      currency: "",
      testMode: true,
    });
    expect(result).toEqual({ verified: true });
    expect(eventsList).toHaveBeenCalledWith({ limit: 1 }, undefined);
  });

  it("retrieves the Checkout Session by the buyer-submitted reference and reports verified when payment_status is 'paid'", async () => {
    sessionsRetrieve.mockResolvedValue({
      payment_status: "paid",
      payment_intent: "pi_123",
      amount_total: 150000,
      currency: "pkr",
    });
    const adapter = new StripeGatewayAdapter(buildConfig(), FIXED_CREDENTIALS);
    const result = await adapter.verifyPayment({
      connection: { merchantId: null, apiKey: "rk_test_fake", apiSecret: null },
      orderId: "order-1",
      amount: 1500,
      currency: "PKR",
      reference: "cs_test_abc",
    });
    expect(result).toEqual({ verified: true, providerReference: "pi_123", amount: 1500 });
    expect(sessionsRetrieve).toHaveBeenCalledWith("cs_test_abc", undefined, undefined);
  });

  it("reports not verified when the session's payment_status isn't 'paid'", async () => {
    sessionsRetrieve.mockResolvedValue({ payment_status: "unpaid", payment_intent: null, amount_total: 1500, currency: "pkr" });
    const adapter = new StripeGatewayAdapter(buildConfig(), FIXED_CREDENTIALS);
    const result = await adapter.verifyPayment({
      connection: { merchantId: null, apiKey: "rk_test_fake", apiSecret: null },
      orderId: "order-1",
      amount: 15,
      currency: "PKR",
      reference: "cs_test_abc",
    });
    expect(result.verified).toBe(false);
  });

  it("reports not verified (never throws) when Stripe returns an error for an unknown/invalid reference", async () => {
    sessionsRetrieve.mockRejectedValue(new Error("No such checkout session"));
    const adapter = new StripeGatewayAdapter(buildConfig(), FIXED_CREDENTIALS);
    const result = await adapter.verifyPayment({
      connection: { merchantId: null, apiKey: "rk_test_fake", apiSecret: null },
      orderId: "order-1",
      amount: 15,
      currency: "PKR",
      reference: "cs_does_not_exist",
    });
    expect(result).toEqual({ verified: false });
  });

  it("reports not verified without calling Stripe at all when no reference is given", async () => {
    const adapter = new StripeGatewayAdapter(buildConfig(), FIXED_CREDENTIALS);
    const result = await adapter.verifyPayment({
      connection: { merchantId: null, apiKey: "rk_test_fake", apiSecret: null },
      orderId: "order-1",
      amount: 15,
      currency: "PKR",
    });
    expect(result).toEqual({ verified: false });
    expect(sessionsRetrieve).not.toHaveBeenCalled();
  });

  it("passes the connected-account option through when the credential source returns one (the Connect-ready path)", async () => {
    eventsList.mockResolvedValue({ data: [] });
    const connectAware: StripeCredentialSource = {
      resolve: () => ({ apiKey: "sk_platform_fake", connectedAccountId: "acct_123" }),
    };
    const adapter = new StripeGatewayAdapter(buildConfig(), connectAware);
    await adapter.verifyPayment({
      connection: { merchantId: null, apiKey: "ignored", apiSecret: null },
      orderId: "",
      amount: 0,
      currency: "",
      testMode: true,
    });
    expect(eventsList).toHaveBeenCalledWith({ limit: 1 }, { stripeAccount: "acct_123" });
  });
});
