import { IdempotencyService } from "./idempotency.service";

/** D116 item 1 (Stage 0) - a generic idempotency-key store for client-retryable, money-moving mutations. */
describe("IdempotencyService (D116 item 1)", () => {
  function buildFakeRedis() {
    const store = new Map<string, string>();
    return {
      set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
        if (args.includes("NX") && store.has(key)) return null;
        store.set(key, value);
        return "OK";
      }),
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      del: jest.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    };
  }

  it("claims a (scope, key) pair that has never been seen before", async () => {
    const redis = buildFakeRedis();
    const service = new IdempotencyService(redis as any);

    const claim = await service.claim("Orders.checkout", "key-1", 3600);
    expect(claim).toEqual({ outcome: "claimed" });
  });

  it("the same key submitted twice replays the stored result instead of running the effect again", async () => {
    const redis = buildFakeRedis();
    const service = new IdempotencyService(redis as any);
    const effect = jest.fn(async () => ({ orderId: "order-1" }));

    const first = await service.claim("Orders.checkout", "key-1", 3600);
    expect(first.outcome).toBe("claimed");
    const result = await effect();
    await service.complete("Orders.checkout", "key-1", result, 3600);

    // A second submission of the exact same key - the effect must not run again.
    const second = await service.claim("Orders.checkout", "key-1", 3600);
    expect(second).toEqual({ outcome: "replay", value: { orderId: "order-1" } });
    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("reports in_progress for a genuinely concurrent duplicate that hasn't completed yet", async () => {
    const redis = buildFakeRedis();
    const service = new IdempotencyService(redis as any);

    await service.claim("Orders.checkout", "key-1", 3600);
    const concurrent = await service.claim("Orders.checkout", "key-1", 3600);
    expect(concurrent).toEqual({ outcome: "in_progress" });
  });

  it("release() lets a failed attempt be retried as a genuinely fresh claim", async () => {
    const redis = buildFakeRedis();
    const service = new IdempotencyService(redis as any);

    await service.claim("Orders.checkout", "key-1", 3600);
    await service.release("Orders.checkout", "key-1");

    const retry = await service.claim("Orders.checkout", "key-1", 3600);
    expect(retry).toEqual({ outcome: "claimed" });
  });

  it("scopes keys independently - the same client key on a different route never collides", async () => {
    const redis = buildFakeRedis();
    const service = new IdempotencyService(redis as any);

    await service.claim("Orders.checkout", "shared-key", 3600);
    await service.complete("Orders.checkout", "shared-key", { orderId: "order-1" }, 3600);

    const otherRoute = await service.claim("Wallet.requestTopUp", "shared-key", 3600);
    expect(otherRoute).toEqual({ outcome: "claimed" });
  });
});
