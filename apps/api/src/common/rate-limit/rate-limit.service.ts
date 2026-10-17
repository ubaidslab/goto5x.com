import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";

/**
 * Fixed-window rate limiting backed by Redis (shared across app instances,
 * per the statelessness principle) - used for auth endpoints per SRS §6.5 and
 * for password-reset requests/completions per FR-25.2. The limit itself is
 * always a Settings Registry value passed in by the caller, never a
 * hard-coded constant here.
 */
@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  /** Throws HTTP 429 if `key` has been hit more than `limit` times in the current hour window. */
  async enforcePerHour(key: string, limit: number): Promise<void> {
    const count = await this.countInWindow(key, 3600);
    if (count > limit) {
      throw new HttpException("Too many requests, please try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /**
   * Same fixed-window counter as enforcePerHour(), without the throw - for
   * callers that just need the count (e.g. an informational fraud signal
   * that must never block the request). Expiry is set only on the window's
   * first hit, so it isn't pushed back on every increment.
   */
  async countInWindow(key: string, windowSeconds: number): Promise<number> {
    const windowKey = `ratelimit:${key}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    const count = await this.redis.incr(windowKey);
    if (count === 1) {
      await this.redis.expire(windowKey, windowSeconds);
    }
    return count;
  }
}
