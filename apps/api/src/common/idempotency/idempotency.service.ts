import { Injectable } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";

type ClaimResult = { outcome: "claimed" } | { outcome: "replay"; value: unknown } | { outcome: "in_progress" };

/**
 * D116 item 1 (Stage 0 readiness) - a generic, reusable idempotency-key
 * store for client-retryable, money-moving mutations. Closes D114's
 * security P0 finding #3: no formal mechanism existed anywhere, only
 * ad-hoc, per-method dedup (a unique constraint here, a status-check guard
 * there). Backed by the same shared RedisService every other Redis-backed
 * service in this codebase already injects (RedisModule is @Global()) -
 * no new connection, no new module import for a consumer.
 *
 * (scope, key) -> one of three states: never seen (claim it), already
 * complete (replay the stored result, never re-run the side effect), or
 * still in flight from a genuinely concurrent duplicate (ask the caller to
 * retry shortly - never silently proceed as if this were a fresh attempt).
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly redis: RedisService) {}

  private redisKey(scope: string, key: string): string {
    return `idempotency:${scope}:${key}`;
  }

  async claim(scope: string, key: string, ttlSeconds: number): Promise<ClaimResult> {
    const redisKey = this.redisKey(scope, key);
    const claimed = await this.redis.set(redisKey, JSON.stringify({ status: "in_progress" }), "EX", ttlSeconds, "NX");
    if (claimed === "OK") return { outcome: "claimed" };

    const existingRaw = await this.redis.get(redisKey);
    const existing = existingRaw ? (JSON.parse(existingRaw) as { status: "in_progress" | "complete"; value?: unknown }) : null;
    if (existing?.status === "complete") {
      return { outcome: "replay", value: existing.value };
    }
    // Still in progress, or the key expired in the instant between the
    // failed claim above and this read - either way the safe answer is
    // "try again shortly", never a silent fresh claim on top of a possibly
    // still-running attempt.
    return { outcome: "in_progress" };
  }

  async complete(scope: string, key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.redisKey(scope, key), JSON.stringify({ status: "complete", value }), "EX", ttlSeconds);
  }

  /** A failed attempt must not permanently poison the key - release it so a retry gets a genuinely fresh attempt. */
  async release(scope: string, key: string): Promise<void> {
    await this.redis.del(this.redisKey(scope, key));
  }
}
