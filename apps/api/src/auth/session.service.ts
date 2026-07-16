import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { RedisService } from "../common/redis/redis.service";
import { hashToken } from "./token.util";

/**
 * Refresh sessions live in Redis, not in-process memory (SRS §3.2a
 * statelessness principle) - any app server behind a future load balancer can
 * validate any session. Sessions are indexed both by their own id (for
 * refresh/logout) and under a per-user set (so "invalidate all sessions for
 * this user" - required on password reset, FR-25.4 - is a single Redis
 * operation, not a scan).
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private sessionKey(sessionId: string) {
    return `session:${sessionId}`;
  }

  private userSessionsKey(userId: string) {
    return `user-sessions:${userId}`;
  }

  async createSession(userId: string): Promise<{ sessionId: string; refreshToken: string }> {
    const sessionId = randomUUID();
    const refreshToken = randomUUID() + randomUUID();
    const ttlSeconds = this.config.getOrThrow<number>("JWT_REFRESH_TTL_DAYS") * 24 * 60 * 60;

    await this.redis.set(
      this.sessionKey(sessionId),
      JSON.stringify({ userId, refreshTokenHash: hashToken(refreshToken) }),
      "EX",
      ttlSeconds,
    );
    await this.redis.sadd(this.userSessionsKey(userId), sessionId);
    await this.redis.expire(this.userSessionsKey(userId), ttlSeconds);

    return { sessionId, refreshToken };
  }

  async validateRefreshToken(sessionId: string, refreshToken: string): Promise<string | null> {
    const raw = await this.redis.get(this.sessionKey(sessionId));
    if (!raw) return null;
    const { userId, refreshTokenHash } = JSON.parse(raw) as { userId: string; refreshTokenHash: string };
    if (refreshTokenHash !== hashToken(refreshToken)) return null;
    return userId;
  }

  async destroySession(sessionId: string): Promise<void> {
    const raw = await this.redis.get(this.sessionKey(sessionId));
    if (raw) {
      const { userId } = JSON.parse(raw) as { userId: string };
      await this.redis.srem(this.userSessionsKey(userId), sessionId);
    }
    await this.redis.del(this.sessionKey(sessionId));
  }

  /** SRS FR-25.4: completing a password reset invalidates every existing session. */
  async destroyAllSessionsForUser(userId: string): Promise<void> {
    const sessionIds = await this.redis.smembers(this.userSessionsKey(userId));
    if (sessionIds.length > 0) {
      await this.redis.del(...sessionIds.map((id) => this.sessionKey(id)));
    }
    await this.redis.del(this.userSessionsKey(userId));
  }
}
