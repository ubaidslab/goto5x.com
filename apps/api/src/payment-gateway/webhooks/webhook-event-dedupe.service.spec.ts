import { Prisma } from "@prisma/client";
import { PrismaAdminService } from "../../prisma/prisma-admin.service";
import { WebhookEventDedupeService } from "./webhook-event-dedupe.service";

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
}

describe("WebhookEventDedupeService", () => {
  it("claims a brand-new (provider, eventId) pair", async () => {
    const create = jest.fn().mockResolvedValue({ id: "row-1" });
    const prismaAdmin = { processedWebhookEvent: { create } } as unknown as PrismaAdminService;
    const service = new WebhookEventDedupeService(prismaAdmin);

    const claimed = await service.claim("stripe", "evt_123", "checkout.session.completed");

    expect(claimed).toBe(true);
    expect(create).toHaveBeenCalledWith({ data: { provider: "stripe", eventId: "evt_123", eventType: "checkout.session.completed" } });
  });

  it("returns false (does not throw) on a redelivered/duplicate event ID", async () => {
    const create = jest.fn().mockRejectedValue(uniqueConstraintError());
    const prismaAdmin = { processedWebhookEvent: { create } } as unknown as PrismaAdminService;
    const service = new WebhookEventDedupeService(prismaAdmin);

    const claimed = await service.claim("stripe", "evt_123", "checkout.session.completed");

    expect(claimed).toBe(false);
  });

  it("re-throws any error that isn't the unique-constraint violation", async () => {
    const create = jest.fn().mockRejectedValue(new Error("connection lost"));
    const prismaAdmin = { processedWebhookEvent: { create } } as unknown as PrismaAdminService;
    const service = new WebhookEventDedupeService(prismaAdmin);

    await expect(service.claim("stripe", "evt_123", "checkout.session.completed")).rejects.toThrow("connection lost");
  });

  it("treats the same event ID from two different providers as independent", async () => {
    const create = jest.fn().mockResolvedValueOnce({ id: "row-1" }).mockResolvedValueOnce({ id: "row-2" });
    const prismaAdmin = { processedWebhookEvent: { create } } as unknown as PrismaAdminService;
    const service = new WebhookEventDedupeService(prismaAdmin);

    expect(await service.claim("stripe", "evt_shared", "checkout.session.completed")).toBe(true);
    expect(await service.claim("paddle", "evt_shared", "subscription.created")).toBe(true);
  });
});
