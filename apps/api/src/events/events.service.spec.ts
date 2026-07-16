import { EventsService } from "./events.service";

/**
 * SRS §3.11/FR-26.3 (binding): emission must never throw, regardless of
 * what goes wrong underneath - a broken event write must never fail or
 * roll back the user-facing action that triggered it.
 */
describe("EventsService", () => {
  it("writes a row with the given fields", async () => {
    const create = jest.fn().mockResolvedValue({ id: "evt-1" });
    const service = new EventsService({ platformEvent: { create } } as any);

    await service.emit({
      eventType: "store.created",
      actorType: "seller",
      actorId: "seller-1",
      storeId: "store-1",
      entityType: "store",
      entityId: "store-1",
      metadata: { plan: "free" },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        eventType: "store.created",
        actorType: "seller",
        actorId: "seller-1",
        storeId: "store-1",
        entityType: "store",
        entityId: "store-1",
        metadata: { plan: "free" },
      },
    });
  });

  it("defaults metadata to an empty object when omitted", async () => {
    const create = jest.fn().mockResolvedValue({ id: "evt-1" });
    const service = new EventsService({ platformEvent: { create } } as any);

    await service.emit({ eventType: "seller.signup" });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ metadata: {} }) }));
  });

  it("never throws when the underlying write fails (non-blocking, FR-26.3)", async () => {
    const create = jest.fn().mockRejectedValue(new Error("connection lost"));
    const service = new EventsService({ platformEvent: { create } } as any);

    await expect(service.emit({ eventType: "product.created" })).resolves.toBeUndefined();
  });
});
