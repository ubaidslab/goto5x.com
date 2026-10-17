import { BadRequestException, NotFoundException } from "@nestjs/common";
import Stripe from "stripe";
import { OrdersService } from "../../orders/orders.service";
import { PrismaAdminService } from "../../prisma/prisma-admin.service";
import { GatewayCredentialVaultService } from "../gateway-credential-vault.service";
import { StripeWebhookController } from "./stripe-webhook.controller";
import { WebhookEventDedupeService } from "./webhook-event-dedupe.service";

jest.mock("stripe", () => {
  const actual = {
    webhooks: { constructEvent: jest.fn() },
  };
  return { __esModule: true, default: actual, webhooks: actual.webhooks };
});

const constructEvent = (Stripe as unknown as { webhooks: { constructEvent: jest.Mock } }).webhooks.constructEvent;

function buildController(overrides: {
  connection?: unknown;
  order?: unknown;
  store?: { sellerId: string };
  dedupeClaims?: boolean;
  markAsPaid?: jest.Mock;
}) {
  const prismaAdmin = {
    storePaymentGatewayConnection: { findUnique: jest.fn().mockResolvedValue(overrides.connection ?? null) },
    order: { findUnique: jest.fn().mockResolvedValue(overrides.order ?? null) },
    store: { findUniqueOrThrow: jest.fn().mockResolvedValue(overrides.store ?? { sellerId: "seller-1" }) },
  } as unknown as PrismaAdminService;
  const vault = { decrypt: jest.fn().mockResolvedValue("whsec_decrypted") } as unknown as GatewayCredentialVaultService;
  const dedupe = { claim: jest.fn().mockResolvedValue(overrides.dedupeClaims ?? true) } as unknown as WebhookEventDedupeService;
  const orders = { markAsPaid: overrides.markAsPaid ?? jest.fn().mockResolvedValue(undefined) } as unknown as OrdersService;
  return { controller: new StripeWebhookController(prismaAdmin, vault, dedupe, orders), prismaAdmin, vault, dedupe, orders };
}

const FAKE_REQ = { rawBody: Buffer.from("{}") } as never;

describe("StripeWebhookController", () => {
  beforeEach(() => constructEvent.mockReset());

  it("rejects a request with no Stripe-Signature header", async () => {
    const { controller } = buildController({});
    await expect(controller.handle("store-1", FAKE_REQ, undefined)).rejects.toThrow(BadRequestException);
  });

  it("rejects when no Stripe connection/webhook secret is configured for this store", async () => {
    const { controller } = buildController({ connection: null });
    await expect(controller.handle("store-1", FAKE_REQ, "t=1,v1=abc")).rejects.toThrow(NotFoundException);
  });

  it("rejects when the signature fails to verify (never trusts the unverified body)", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });
    const { controller } = buildController({ connection: { webhookSecretEncrypted: "enc", dataKeyWrapped: "wrapped" } });
    await expect(controller.handle("store-1", FAKE_REQ, "t=1,v1=bad")).rejects.toThrow(BadRequestException);
  });

  it("confirms the order via markAsPaid with the real gateway/transaction-id attribution on a matching checkout.session.completed", async () => {
    constructEvent.mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "paid",
          client_reference_id: "order-1",
          payment_intent: "pi_123",
          amount_total: 150000,
          currency: "pkr",
        },
      },
    });
    const markAsPaid = jest.fn().mockResolvedValue(undefined);
    const { controller } = buildController({
      connection: { webhookSecretEncrypted: "enc", dataKeyWrapped: "wrapped" },
      order: { id: "order-1", storeId: "store-1", status: "pending", totalAmount: 1500, currency: "PKR" },
      store: { sellerId: "seller-1" },
      markAsPaid,
    });

    const result = await controller.handle("store-1", FAKE_REQ, "t=1,v1=abc");

    expect(result).toEqual({ received: true });
    expect(markAsPaid).toHaveBeenCalledWith(
      "seller-1",
      "store-1",
      "order-1",
      undefined,
      expect.objectContaining({ gateway: "stripe", gatewayTransactionId: "pi_123" }),
    );
  });

  it("does not call markAsPaid again for a duplicate/redelivered event ID", async () => {
    constructEvent.mockReturnValue({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });
    const markAsPaid = jest.fn();
    const { controller } = buildController({
      connection: { webhookSecretEncrypted: "enc", dataKeyWrapped: "wrapped" },
      dedupeClaims: false,
      markAsPaid,
    });

    const result = await controller.handle("store-1", FAKE_REQ, "t=1,v1=abc");

    expect(result).toEqual({ received: true });
    expect(markAsPaid).not.toHaveBeenCalled();
  });

  it("refuses to confirm (never calls markAsPaid) when the session amount doesn't match the order's own total", async () => {
    constructEvent.mockReturnValue({
      id: "evt_2",
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "paid",
          client_reference_id: "order-1",
          payment_intent: "pi_123",
          amount_total: 100, // 1.00, nowhere near the order's 1500
          currency: "pkr",
        },
      },
    });
    const markAsPaid = jest.fn();
    const { controller } = buildController({
      connection: { webhookSecretEncrypted: "enc", dataKeyWrapped: "wrapped" },
      order: { id: "order-1", storeId: "store-1", status: "pending", totalAmount: 1500, currency: "PKR" },
      markAsPaid,
    });

    await controller.handle("store-1", FAKE_REQ, "t=1,v1=abc");

    expect(markAsPaid).not.toHaveBeenCalled();
  });

  it("silently no-ops (never calls markAsPaid) when the order is no longer pending", async () => {
    constructEvent.mockReturnValue({
      id: "evt_3",
      type: "checkout.session.completed",
      data: { object: { payment_status: "paid", client_reference_id: "order-1", payment_intent: "pi_123", amount_total: 150000, currency: "pkr" } },
    });
    const markAsPaid = jest.fn();
    const { controller } = buildController({
      connection: { webhookSecretEncrypted: "enc", dataKeyWrapped: "wrapped" },
      order: { id: "order-1", storeId: "store-1", status: "confirmed", totalAmount: 1500, currency: "PKR" },
      markAsPaid,
    });

    const result = await controller.handle("store-1", FAKE_REQ, "t=1,v1=abc");

    expect(result).toEqual({ received: true });
    expect(markAsPaid).not.toHaveBeenCalled();
  });

  it("ignores event types other than checkout.session.completed", async () => {
    constructEvent.mockReturnValue({ id: "evt_4", type: "payment_intent.created", data: { object: {} } });
    const markAsPaid = jest.fn();
    const { controller } = buildController({ connection: { webhookSecretEncrypted: "enc", dataKeyWrapped: "wrapped" }, markAsPaid });

    const result = await controller.handle("store-1", FAKE_REQ, "t=1,v1=abc");

    expect(result).toEqual({ received: true });
    expect(markAsPaid).not.toHaveBeenCalled();
  });
});
