import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { RedisService } from "../common/redis/redis.service";
import { hashToken } from "./token.util";

export interface SessionInfo {
  sessionId: string;
  deviceLabel: string;
  ipAddress: string;
  firstSeenAt: string;
  lastActiveAt: string;
}

interface SessionRecord {
  userId: string;
  refreshTokenHash: string;
  deviceLabel: string;
  ipAddress: string;
  firstSeenAt: string;
  lastActiveAt: string;
}

interface SessionTombstone {
  userId: string;
  refreshTokenHash: string;
}

export type RefreshValidationResult =
  | { status: "valid"; userId: string }
  /** D82 reuse detection - this exact (sessionId, refreshToken) pair was valid a moment ago and has already been rotated out; being presented again means it was copied/stolen before rotation consumed it. */
  | { status: "reused"; userId: string }
  | { status: "invalid" };

/**
 * Refresh sessions live in Redis, not in-process memory (SRS §3.2a
 * statelessness principle) - any app server behind a future load balancer can
 * validate any session. Sessions are indexed both by their own id (for
 * refresh/logout) and under a per-user set (so "invalidate all sessions for
 * this user" - required on password reset, FR-25.4 - is a single Redis
 * operation, not a scan).
 *
 * SRS §5.25/FR-25.7 (Module 13) - device label/IP/first-seen/last-active are
 * now stored alongside the refresh-token hash, so a seller's dashboard can
 * list and individually revoke sessions; `lastActiveAt` is touched on every
 * successful refresh-token use (the natural "still active" heartbeat this
 * session model already has, without adding a write to every single
 * authenticated request platform-wide).
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

  private tombstoneKey(sessionId: string) {
    return `session-tombstone:${sessionId}`;
  }

  /** Comfortably longer than any realistic refresh-retry/race window, short enough Redis doesn't accumulate these forever. */
  private static readonly TOMBSTONE_TTL_SECONDS = 24 * 60 * 60;

  async createSession(
    userId: string,
    deviceLabel = "Unknown device",
    ipAddress = "unknown",
  ): Promise<{ sessionId: string; refreshToken: string }> {
    const sessionId = randomUUID();
    const refreshToken = randomUUID() + randomUUID();
    const ttlSeconds = this.config.getOrThrow<number>("JWT_REFRESH_TTL_DAYS") * 24 * 60 * 60;
    const now = new Date().toISOString();

    const record: SessionRecord = {
      userId,
      refreshTokenHash: hashToken(refreshToken),
      deviceLabel,
      ipAddress,
      firstSeenAt: now,
      lastActiveAt: now,
    };
    await this.redis.set(this.sessionKey(sessionId), JSON.stringify(record), "EX", ttlSeconds);
    await this.redis.sadd(this.userSessionsKey(userId), sessionId);
    await this.redis.expire(this.userSessionsKey(userId), ttlSeconds);

    return { sessionId, refreshToken };
  }

  /** Used by refresh-token rotation to carry the same device identity forward onto the new session, rather than re-deriving it from a bare refresh request. */
  async getDeviceInfo(sessionId: string): Promise<{ deviceLabel: string; ipAddress: string } | null> {
    const raw = await this.redis.get(this.sessionKey(sessionId));
    if (!raw) return null;
    const record = JSON.parse(raw) as SessionRecord;
    return { deviceLabel: record.deviceLabel, ipAddress: record.ipAddress };
  }

  async countActiveSessions(userId: string): Promise<number> {
    const sessionIds = await this.redis.smembers(this.userSessionsKey(userId));
    return sessionIds.length;
  }

  async validateRefreshToken(sessionId: string, refreshToken: string): Promise<RefreshValidationResult> {
    const raw = await this.redis.get(this.sessionKey(sessionId));
    if (raw) {
      const record = JSON.parse(raw) as SessionRecord;
      if (record.refreshTokenHash === hashToken(refreshToken)) {
        return { status: "valid", userId: record.userId };
      }
      return { status: "invalid" };
    }
    // Not live - tell "never existed" apart from "existed, already rotated
    // out" (D82). A sessionId match with a non-matching token here is NOT
    // elevated to "reused" - that's indistinguishable from a random guess
    // against a dead id, not a meaningful theft signal.
    const tombstoneRaw = await this.redis.get(this.tombstoneKey(sessionId));
    if (tombstoneRaw) {
      const tombstone = JSON.parse(tombstoneRaw) as SessionTombstone;
      if (tombstone.refreshTokenHash === hashToken(refreshToken)) {
        return { status: "reused", userId: tombstone.userId };
      }
    }
    return { status: "invalid" };
  }

  /** Bumps `lastActiveAt` without extending the TTL - a stolen refresh token still expires on schedule. */
  async touchSession(sessionId: string): Promise<void> {
    const raw = await this.redis.get(this.sessionKey(sessionId));
    if (!raw) return;
    const record = JSON.parse(raw) as SessionRecord;
    const ttl = await this.redis.ttl(this.sessionKey(sessionId));
    record.lastActiveAt = new Date().toISOString();
    await this.redis.set(this.sessionKey(sessionId), JSON.stringify(record), "EX", ttl > 0 ? ttl : 1);
  }

  /** SRS FR-25.7 - the seller's own session/device list. */
  async listSessions(userId: string): Promise<SessionInfo[]> {
    const sessionIds = await this.redis.smembers(this.userSessionsKey(userId));
    const sessions: SessionInfo[] = [];
    for (const sessionId of sessionIds) {
      const raw = await this.redis.get(this.sessionKey(sessionId));
      if (!raw) continue;
      const record = JSON.parse(raw) as SessionRecord;
      sessions.push({
        sessionId,
        deviceLabel: record.deviceLabel,
        ipAddress: record.ipAddress,
        firstSeenAt: record.firstSeenAt,
        lastActiveAt: record.lastActiveAt,
      });
    }
    return sessions;
  }

  /** SRS FR-25.7 - revokes one session; returns false if it doesn't exist or doesn't belong to this user (never revokes someone else's session). */
  async revokeOwnSession(userId: string, sessionId: string): Promise<boolean> {
    const raw = await this.redis.get(this.sessionKey(sessionId));
    if (!raw) return false;
    const record = JSON.parse(raw) as SessionRecord;
    if (record.userId !== userId) return false;
    await this.destroySession(sessionId);
    return true;
  }

  async destroySession(sessionId: string): Promise<void> {
    const raw = await this.redis.get(this.sessionKey(sessionId));
    if (raw) {
      const { userId } = JSON.parse(raw) as SessionRecord;
      await this.redis.srem(this.userSessionsKey(userId), sessionId);
    }
    await this.redis.del(this.sessionKey(sessionId));
  }

  /**
   * D82 - refresh-token rotation's own destroy step, not a plain
   * destroySession(): leaves a short-TTL tombstone of exactly which
   * (userId, refreshTokenHash) this was, so a later attempt to reuse this
   * same now-dead token is told apart from one that never existed
   * (validateRefreshToken() above). Ordinary user-initiated logout/revoke
   * stays on plain destroySession() - there's no "this was valid a moment
   * ago" story to detect there.
   */
  async rotateOutSession(sessionId: string): Promise<void> {
    const raw = await this.redis.get(this.sessionKey(sessionId));
    if (raw) {
      const record = JSON.parse(raw) as SessionRecord;
      const tombstone: SessionTombstone = { userId: record.userId, refreshTokenHash: record.refreshTokenHash };
      await this.redis.set(this.tombstoneKey(sessionId), JSON.stringify(tombstone), "EX", SessionService.TOMBSTONE_TTL_SECONDS);
    }
    await this.destroySession(sessionId);
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
