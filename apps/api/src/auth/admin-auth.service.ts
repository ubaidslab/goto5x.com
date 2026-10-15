import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { JwtAccessPayload } from "../common/types";
import { AuditLogService } from "../admin/audit-log.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { AdminLoginDto } from "./dto/admin-login.dto";
import { SecurityEventService } from "./security-event.service";
import { SessionService } from "./session.service";

const PRE_AUTH_TTL_MINUTES = 5;

// D82 - the strict default when ADMIN_JWT_REFRESH_TTL_DAYS is unset: a
// much shorter session lifetime than the seller default (JWT_REFRESH_TTL_
// DAYS, 30 in every env this project ships), forcing a full password+TOTP
// re-login far more often for the account type that holds BYPASSRLS
// access. Not itself configurable without the env var - this is the
// floor the env var overrides, not a magic number duplicated elsewhere.
const ADMIN_DEFAULT_REFRESH_TTL_DAYS = 1;

interface AdminPreAuthPayload {
  sub: string;
  adminUserId: string;
  type: "admin_pre_auth";
}

/** Shared with AdminAuthController so the refresh cookie's own maxAge never outlives the session it actually backs. */
export function resolveAdminRefreshTtlDays(config: ConfigService): number {
  return config.get<number>("ADMIN_JWT_REFRESH_TTL_DAYS") ?? ADMIN_DEFAULT_REFRESH_TTL_DAYS;
}

/**
 * Separate, more scrutinized login flow from seller/supplier auth (SRS §6.5).
 * MFA is mandatory, not optional (FR-8.12): a fully-verified admin session
 * (mfaVerified: true in the JWT) is only issued after a valid TOTP code,
 * whether that's the admin's first-ever enrollment or a returning admin's
 * regular code entry.
 */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessions: SessionService,
    private readonly auditLog: AuditLogService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
    private readonly securityEvents: SecurityEventService,
  ) {}

  async login(dto: AdminLoginDto, ip: string): Promise<{ preAuthToken: string; mfaEnrolled: boolean }> {
    // Module 21 (§14.12 rate-limit audit) - same gap and same fix as
    // seller/supplier login (AuthService.login()): dual-keyed (account +
    // IP), checked before the bcrypt compare. Admin accounts have
    // BYPASSRLS access, so this is if anything the more sensitive of the
    // two login surfaces to close.
    const loginLimit = await this.settings.resolve<number>("auth.login_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`admin-login:${dto.email}`, loginLimit);
    await this.rateLimit.enforcePerHour(`admin-login-ip:${ip}`, loginLimit);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { adminUser: true },
    });

    if (!user?.adminUser || !user.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const preAuthToken = this.jwt.sign(
      { sub: user.id, adminUserId: user.adminUser.id, type: "admin_pre_auth" } satisfies AdminPreAuthPayload,
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: `${PRE_AUTH_TTL_MINUTES}m`,
      },
    );

    return { preAuthToken, mfaEnrolled: user.adminUser.mfaEnabled };
  }

  /** Called with a valid preAuthToken when the admin has no TOTP secret yet. */
  async beginMfaEnrollment(preAuthToken: string): Promise<{ secret: string; otpauthUrl: string }> {
    const payload = this.verifyPreAuthToken(preAuthToken);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });

    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaSecret: secret } });

    const otpauthUrl = authenticator.keyuri(
      user.email,
      this.config.getOrThrow<string>("ADMIN_MFA_ISSUER_NAME"),
      secret,
    );
    return { secret, otpauthUrl };
  }

  /** Verifies a TOTP code and, on success, issues a fully-verified admin session. */
  async verifyMfaAndIssueSession(
    preAuthToken: string,
    code: string,
    ip: string,
  ): Promise<{ accessToken: string; sessionId: string; refreshToken: string }> {
    const payload = this.verifyPreAuthToken(preAuthToken);

    // Phase B pre-launch audit finding - same fix as the seller MFA verify
    // flow (AuthService.verifyMfaAndIssueSession()): a 6-digit TOTP code is
    // a genuinely guessable space, and admin sessions have BYPASSRLS access,
    // so this is if anything the more sensitive of the two to close.
    const mfaVerifyLimit = await this.settings.resolve<number>("auth.mfa_verify_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`admin-mfa-verify:${payload.sub}`, mfaVerifyLimit);
    await this.rateLimit.enforcePerHour(`admin-mfa-verify-ip:${ip}`, mfaVerifyLimit);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      include: { adminUser: true },
    });

    if (!user.mfaSecret) {
      throw new BadRequestException("MFA has not been enrolled for this account yet.");
    }
    if (!authenticator.check(code, user.mfaSecret)) {
      throw new UnauthorizedException("Invalid MFA code.");
    }

    if (!user.adminUser!.mfaEnabled) {
      await this.prisma.adminUser.update({ where: { id: user.adminUser!.id }, data: { mfaEnabled: true } });
    }

    await this.auditLog.record({
      adminUserId: user.adminUser!.id,
      action: "admin.login",
      targetType: "admin_user",
      targetId: user.adminUser!.id,
    });

    const { sessionId, refreshToken } = await this.sessions.createSession(
      user.id,
      "Unknown device",
      ip,
      resolveAdminRefreshTtlDays(this.config),
    );
    const accessToken = this.jwt.sign(
      {
        sub: user.id,
        adminUserId: user.adminUser!.id,
        adminRole: user.adminUser!.role,
        mfaVerified: true,
      } satisfies JwtAccessPayload,
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: `${this.config.getOrThrow<number>("JWT_ACCESS_TTL_MINUTES")}m`,
      },
    );

    return { accessToken, sessionId, refreshToken };
  }

  /**
   * Founder walkthrough finding (pre-Milestone-A, Phase 0.5) - no admin
   * refresh path existed at all: the 15-minute access token
   * (JWT_ACCESS_TTL_MINUTES) had nothing behind it, so any admin session
   * older than that showed the backend's bare "Unauthorized" on the very
   * next request, on every one of the ~30 admin terminal pages. Mirrors
   * AuthService.refresh() exactly (refresh-token rotation via the same
   * generic, user-id-keyed SessionService - not seller/admin-specific) but
   * re-issues an ADMIN-shaped token: `mfaVerified: true` carries forward
   * from the original MFA verification (this never re-prompts for a TOTP
   * code, matching the seller-side refresh's equivalent trust boundary -
   * both treat "holds a valid, non-expired refresh token for this session"
   * as continuity of the already-verified login, not a fresh credential
   * check). Re-reads `adminUser` fresh (not from the old token's claims)
   * so a role change or de-provisioning between logins is picked up
   * immediately rather than persisting in a stale refreshed token.
   */
  async refresh(sessionId: string, refreshToken: string): Promise<{ accessToken: string; sessionId: string; refreshToken: string }> {
    const validation = await this.sessions.validateRefreshToken(sessionId, refreshToken);
    if (validation.status === "reused") {
      // D82 reuse detection - see AuthService.refresh()'s identical comment.
      // Doubly worth acting on here: an admin session is the highest-value
      // target in this codebase.
      await this.sessions.destroyAllSessionsForUser(validation.userId);
      await this.securityEvents.record(validation.userId, "refresh_token_reuse_detected");
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }
    if (validation.status === "invalid") {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }
    const userId = validation.userId;

    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { adminUser: true } });
    if (!user?.adminUser) {
      throw new UnauthorizedException("This account no longer has admin access.");
    }

    await this.sessions.touchSession(sessionId);
    // Destroy the old session (tombstoned, for the reuse check above) and issue a new one (refresh-token rotation).
    await this.sessions.rotateOutSession(sessionId);

    const { sessionId: newSessionId, refreshToken: newRefreshToken } = await this.sessions.createSession(
      user.id,
      "Unknown device",
      "unknown",
      resolveAdminRefreshTtlDays(this.config),
    );
    const accessToken = this.jwt.sign(
      {
        sub: user.id,
        adminUserId: user.adminUser.id,
        adminRole: user.adminUser.role,
        mfaVerified: true,
      } satisfies JwtAccessPayload,
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: `${this.config.getOrThrow<number>("JWT_ACCESS_TTL_MINUTES")}m`,
      },
    );

    return { accessToken, sessionId: newSessionId, refreshToken: newRefreshToken };
  }

  /** Mirrors AuthService.logout() exactly - same shared SessionService, same destroy-on-logout contract. */
  async logout(sessionId: string): Promise<void> {
    await this.sessions.destroySession(sessionId);
  }

  private verifyPreAuthToken(token: string): AdminPreAuthPayload {
    try {
      const payload = this.jwt.verify<AdminPreAuthPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
      if (payload.type !== "admin_pre_auth") throw new Error("wrong token type");
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired pre-auth token.");
    }
  }
}
