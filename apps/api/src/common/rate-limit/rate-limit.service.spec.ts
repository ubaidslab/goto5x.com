import { HttpException } from "@nestjs/common";
import { RateLimitService } from "./rate-limit.service";

function buildFakeRedis() {
  const store = new Map<string, number>();
  const ttls = new Map<string, number>();
  return {
    store,
    ttls,
    incr: jest.fn(async (key: string) => {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    }),
    expire: jest.fn(async (key: string, seconds: number) => {
      ttls.set(key, seconds);
      return 1;
    }),
  };
}

describe("RateLimitService", () => {
  describe("countInWindow", () => {
    it("starts at 1 on the first hit and sets the window's expiry exactly once", async () => {
      const redis = buildFakeRedis();
      const service = new RateLimitService(redis as never);

      expect(await service.countInWindow("fraud-ip:abc", 86400)).toBe(1);
      expect(await service.countInWindow("fraud-ip:abc", 86400)).toBe(2);
      expect(await service.countInWindow("fraud-ip:abc", 86400)).toBe(3);

      expect(redis.expire).toHaveBeenCalledTimes(1);
      expect(redis.expire).toHaveBeenCalledWith(expect.stringContaining("fraud-ip:abc"), 86400);
    });

    it("counts different keys independently", async () => {
      const redis = buildFakeRedis();
      const service = new RateLimitService(redis as never);

      expect(await service.countInWindow("fraud-ip:aaa", 3600)).toBe(1);
      expect(await service.countInWindow("fraud-ip:bbb", 3600)).toBe(1);
      expect(await service.countInWindow("fraud-ip:aaa", 3600)).toBe(2);
    });
  });

  describe("enforcePerHour", () => {
    it("allows requests at or under the limit", async () => {
      const redis = buildFakeRedis();
      const service = new RateLimitService(redis as never);

      await service.enforcePerHour("signup", 3);
      await service.enforcePerHour("signup", 3);
      await expect(service.enforcePerHour("signup", 3)).resolves.toBeUndefined();
    });

    it("throws HTTP 429 once the limit is exceeded", async () => {
      const redis = buildFakeRedis();
      const service = new RateLimitService(redis as never);

      await service.enforcePerHour("signup", 1);
      await expect(service.enforcePerHour("signup", 1)).rejects.toThrow(HttpException);
    });
  });
});
