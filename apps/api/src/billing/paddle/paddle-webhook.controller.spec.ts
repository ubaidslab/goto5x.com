import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Paddle } from "@paddle/paddle-node-sdk";
import { WebhookEventDedupeService } from "../../payment-gateway/webhooks/webhook-event-dedupe.service";
import { PaddleSubscriptionLifecycleService } from "./paddle-subscription-lifecycle.service";
import { PaddleWebhookController } from "./paddle-webhook.controller";

jest.mock("@paddle/paddle-node-sdk", () => {
  const unmarshal = jest.fn().mockRejectedValue(new Error("no mock configured for the scratch-client path"));
  return { __esModule: true, Paddle: jest.fn().mockImplementation(() => ({ webhooks: { unmarshal } })), __mockUnmarshal: unmarshal };
});
const scratchUnmarshal = (jest.requireMock("@paddle/paddle-node-sdk") as { __mockUnmarshal: jest.Mock }).__mockUnmarshal;

function buildController(overrides: {
  webhookSecret?: string | undefined;
  dedupeClaims?: boolean;
  paddle?: { webhooks: { unmarshal: jest.Mock } } | null;
}) {
  const webhookSecret = "webhookSecret" in overrides ? overrides.webhookSecret : "whsec_test";
  const config = { get: jest.fn().mockReturnValue(webhookSecret) } as unknown as ConfigService;
  const dedupe = { claim: jest.fn().mockResolvedValue(overrides.dedupeClaims ?? true) } as unknown as WebhookEventDedupeService;
  const confirmCharge = jest.fn().mockResolvedValue(undefined);
  const markCanceled = jest.fn().mockResolvedValue(undefined);
  const lifecycle = { confirmCharge, markCanceled } as unknown as PaddleSubscriptionLifecycleService;
  const paddle = overrides.paddle === undefined ? ({ webhooks: { unmarshal: jest.fn() } } as unknown as Paddle) : (overrides.paddle as unknown as Paddle | null);
  const controller = new PaddleWebhookController(dedupe, lifecycle, config, paddle);
  return { controller, config, dedupe, lifecycle, confirmCharge, markCanceled, paddle };
}

const FAKE_REQ = { rawBody: Buffer.from("{}") } as never;

describe("PaddleWebhookController", () => {
  beforeEach(() => scratchUnmarshal.mockClear());

  it("refuses when Paddle billing isn't configured (no webhook secret)", async () => {
    const { controller } = buildController({ webhookSecret: undefined });
    await expect(controller.handle(FAKE_REQ, "ts=1;h1=abc")).rejects.toThrow(BadRequestException);
  });

  it("refuses a request with no Paddle-Signature header", async () => {
    const { controller } = buildController({});
    await expect(controller.handle(FAKE_REQ, undefined)).rejects.toThrow(BadRequestException);
  });

  it("refuses a request with no raw body", async () => {
    const { controller } = buildController({});
    await expect(controller.handle({ rawBody: undefined } as never, "ts=1;h1=abc")).rejects.toThrow(BadRequestException);
  });

  it("never trusts an unverified payload - a signature the SDK rejects becomes a 400, not a processed event", async () => {
    const unmarshal = jest.fn().mockRejectedValue(new Error("[Paddle] Webhook signature verification failed"));
    const { controller, lifecycle } = buildController({ paddle: { webhooks: { unmarshal } } });
    await expect(controller.handle(FAKE_REQ, "ts=1;h1=forged")).rejects.toThrow(BadRequestException);
    expect(lifecycle.confirmCharge).not.toHaveBeenCalled();
  });

  it("falls back to a scratch Paddle client for signature verification when no client is configured (PADDLE_API_KEY unset) - verification still runs, never skipped", async () => {
    scratchUnmarshal.mockResolvedValue({ eventId: "evt_1", eventType: "subscription.canceled", data: { id: "sub_1" } });
    const { controller, markCanceled } = buildController({ paddle: null });

    const result = await controller.handle(FAKE_REQ, "ts=1;h1=abc");

    expect(scratchUnmarshal).toHaveBeenCalledWith("{}", "whsec_test", "ts=1;h1=abc");
    expect(result).toEqual({ received: true });
    expect(markCanceled).toHaveBeenCalledWith("sub_1");
  });

  it("skips processing (but still acknowledges) a redelivered/already-claimed event", async () => {
    const unmarshal = jest.fn().mockResolvedValue({ eventId: "evt_1", eventType: "transaction.completed", data: {} });
    const { controller, confirmCharge } = buildController({ paddle: { webhooks: { unmarshal } }, dedupeClaims: false });

    const result = await controller.handle(FAKE_REQ, "ts=1;h1=abc");

    expect(result).toEqual({ received: true });
    expect(confirmCharge).not.toHaveBeenCalled();
  });

  it("confirms the charge on transaction.completed when customData carries sellerId + the transaction has subscriptionId/customerId", async () => {
    const unmarshal = jest.fn().mockResolvedValue({
      eventId: "evt_1",
      eventType: "transaction.completed",
      data: { id: "txn_1", subscriptionId: "sub_1", customerId: "cus_1", customData: { sellerId: "seller-1" } },
    });
    const { controller, confirmCharge } = buildController({ paddle: { webhooks: { unmarshal } } });

    const result = await controller.handle(FAKE_REQ, "ts=1;h1=abc");

    expect(result).toEqual({ received: true });
    expect(confirmCharge).toHaveBeenCalledWith({
      sellerId: "seller-1",
      paddleSubscriptionId: "sub_1",
      paddleCustomerId: "cus_1",
      paddleTransactionId: "txn_1",
    });
  });

  it("skips transaction.completed (never calls confirmCharge) when customData is missing sellerId", async () => {
    const unmarshal = jest.fn().mockResolvedValue({
      eventId: "evt_1",
      eventType: "transaction.completed",
      data: { id: "txn_1", subscriptionId: "sub_1", customerId: "cus_1", customData: null },
    });
    const { controller, confirmCharge } = buildController({ paddle: { webhooks: { unmarshal } } });

    const result = await controller.handle(FAKE_REQ, "ts=1;h1=abc");

    expect(result).toEqual({ received: true });
    expect(confirmCharge).not.toHaveBeenCalled();
  });

  it("calls markCanceled on subscription.canceled", async () => {
    const unmarshal = jest.fn().mockResolvedValue({ eventId: "evt_1", eventType: "subscription.canceled", data: { id: "sub_1" } });
    const { controller, markCanceled } = buildController({ paddle: { webhooks: { unmarshal } } });

    await controller.handle(FAKE_REQ, "ts=1;h1=abc");

    expect(markCanceled).toHaveBeenCalledWith("sub_1");
  });

  it.each(["adjustment.updated", "subscription.past_due", "some.unknown.event"])(
    "takes no action but still acknowledges %s",
    async (eventType) => {
      const unmarshal = jest.fn().mockResolvedValue({ eventId: "evt_1", eventType, data: { id: "x", status: "approved" } });
      const { controller, confirmCharge, markCanceled } = buildController({ paddle: { webhooks: { unmarshal } } });

      const result = await controller.handle(FAKE_REQ, "ts=1;h1=abc");

      expect(result).toEqual({ received: true });
      expect(confirmCharge).not.toHaveBeenCalled();
      expect(markCanceled).not.toHaveBeenCalled();
    },
  );
});
