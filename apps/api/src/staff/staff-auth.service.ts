import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { SessionService } from "../auth/session.service";
import { hashToken } from "../auth/token.util";
import { JwtAccessPayload, StaffPermission, StaffScope } from "../common/types";
import { EmailService } from "../notifications/email.service";
import { EventsService } from "../events/events.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { CompleteStaffPasswordResetDto } from "./dto/complete-staff-password-reset.dto";
import { StaffLoginDto } from "./dto/staff-login.dto";

const BCRYPT_ROUNDS = 12;

/**
 * SRS §5.52/FR-52.3. A staff account logs in with its own credentials,
 * separate from the owner's - modeled on AdminAuthService's shape, minus
 * MFA (not required by FR-52.x). Issues a JWT carrying sellerId = the
 * OWNER's seller id (so every existing @CurrentSellerId()-based
 * controller/service and RLS resolve tenant scope correctly with zero
 * changes - same precedent as AdminImpersonationService.start()) plus
 * staffAccountId/scopePermissions, which is what StaffScopeGuard keys off
 * of.
 *
 * FR-52.10/52.12 (Module 97) - an expired or (when device-restricted) an
 * unrecognized-device login is rejected here, before any token is issued.
 *
 * D82 (`docs/auth-session-design.md`'s "Staff sub-account tokens" bullet)
 * - a staff login now creates a real `SessionService` session (keyed by
 * `staff.id`; `SessionService` is actor-agnostic, it already keys admin
 * sessions by the shared `User.id` and buyer/seller the same way, so a
 * `StaffAccount.id` - a separate table, no backing `User` row at all - is
 * just as valid an opaque key). This is what makes the account genuinely
 * revocable: `refresh()` below re-checks `status`/`expiresAt` fresh from
 * the DB on every call, so an owner's/admin's suspend/block/revoke takes
 * effect the moment the current access token's own (short, 15-minute) TTL
 * forces a refresh, not only at the next full re-login.
 */
@Injectable()
export class StaffAuthService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
    private readonly events: EventsService,
    private readonly email: EmailService,
    private readonly sessions: SessionService,
  ) {}

  private signAccessToken(staffId: string, sellerId: string, scopePermissions: Partial<Record<StaffScope, StaffPermission>>): string {
    return this.jwt.sign(
      { sub: staffId, sellerId, staffAccountId: staffId, scopePermissions } satisfies JwtAccessPayload,
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: `${this.config.getOrThrow<number>("JWT_ACCESS_TTL_MINUTES")}m`,
      },
    );
  }

  async login(dto: StaffLoginDto, ip: string): Promise<{ accessToken: string; sessionId: string; refreshToken: string }> {
    const loginLimit = await this.settings.resolve<number>("auth.login_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`staff-login:${dto.email}`, loginLimit);
    await this.rateLimit.enforcePerHour(`staff-login-ip:${ip}`, loginLimit);

    const staff = await this.prismaAdmin.staffAccount.findUnique({
      where: { email: dto.email },
      include: { scopePermissions: true },
    });
    if (!staff || staff.status !== "active" || !(await bcrypt.compare(dto.password, staff.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }
    // FR-52.10 - an expired account can't log in, same rejection as a
    // revoked one; the sweep scheduler will flip its status shortly, this
    // check just closes the gap between "past expiry" and "swept."
    if (staff.expiresAt && staff.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    if (staff.deviceRestrictionEnabled) {
      await this.enforceDeviceRestriction(staff.id, staff.sellerId, staff.name ?? staff.email, dto.deviceId);
    }

    const scopePermissions = Object.fromEntries(
      staff.scopePermissions.map((sp) => [sp.scope, sp.permission]),
    ) as Partial<Record<StaffScope, StaffPermission>>;

    const accessToken = this.signAccessToken(staff.id, staff.sellerId, scopePermissions);
    const { sessionId, refreshToken } = await this.sessions.createSession(staff.id, "Unknown device", ip);

    await this.events.emit({
      eventType: "staff_account.login",
      actorType: "staff",
      actorId: staff.id,
      entityType: "staff_account",
      entityId: staff.id,
      metadata: {},
    });
    return { accessToken, sessionId, refreshToken };
  }

  /**
   * D82 - mirrors AdminAuthService.refresh()'s own shape and reasoning
   * exactly: re-reads the staff account fresh from the DB rather than
   * trusting the original login's claims, so a suspend/block/revoke that
   * happened since login is picked up here rather than silently renewing
   * access regardless. `reused` uses EventsService, not
   * SecurityEventService - the latter's `userId` column has a real FK
   * against the `users` table, which a `StaffAccount.id` was never a row
   * in.
   */
  async refresh(sessionId: string, refreshToken: string): Promise<{ accessToken: string; sessionId: string; refreshToken: string }> {
    const validation = await this.sessions.validateRefreshToken(sessionId, refreshToken);
    if (validation.status === "reused") {
      await this.sessions.destroyAllSessionsForUser(validation.userId);
      await this.events.emit({
        eventType: "staff_account.refresh_token_reuse_detected",
        actorType: "staff",
        actorId: validation.userId,
        entityType: "staff_account",
        entityId: validation.userId,
        metadata: {},
      });
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }
    if (validation.status === "invalid") {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }

    const staff = await this.prismaAdmin.staffAccount.findUnique({
      where: { id: validation.userId },
      include: { scopePermissions: true },
    });
    if (!staff || staff.status !== "active" || (staff.expiresAt && staff.expiresAt.getTime() <= Date.now())) {
      throw new UnauthorizedException("This account no longer has active access.");
    }

    await this.sessions.touchSession(sessionId);
    await this.sessions.rotateOutSession(sessionId);

    const scopePermissions = Object.fromEntries(
      staff.scopePermissions.map((sp) => [sp.scope, sp.permission]),
    ) as Partial<Record<StaffScope, StaffPermission>>;
    const accessToken = this.signAccessToken(staff.id, staff.sellerId, scopePermissions);
    const { sessionId: newSessionId, refreshToken: newRefreshToken } = await this.sessions.createSession(staff.id);

    return { accessToken, sessionId: newSessionId, refreshToken: newRefreshToken };
  }

  /** Mirrors AuthService.logout()/AdminAuthService.logout() - same shared SessionService, same destroy-on-logout contract. */
  async logout(sessionId: string): Promise<void> {
    await this.sessions.destroySession(sessionId);
  }

  /**
   * FR-52.12 - "not IP-based": `deviceId` is a persisted client-side
   * token, not derived from the request's network address at all. An
   * unrecognized device (or no deviceId supplied while restriction is on)
   * is created as a new, unapproved row and blocks login outright - no
   * partial access - with an immediate email to the seller-owner.
   */
  private async enforceDeviceRestriction(
    staffAccountId: string,
    sellerId: string,
    staffName: string,
    deviceId: string | undefined,
  ): Promise<void> {
    if (!deviceId) {
      throw new ForbiddenException("This account requires sign-in from an approved device.");
    }

    const existing = await this.prismaAdmin.staffDevice.findUnique({
      where: { uniq_staff_device: { staffAccountId, deviceId } },
    });

    if (existing?.approved) {
      await this.prismaAdmin.staffDevice.update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } });
      return;
    }

    if (!existing) {
      await this.prismaAdmin.staffDevice.create({ data: { staffAccountId, deviceId } });
      await this.notifySellerOfNewDevice(sellerId, staffName);
    }
    throw new ForbiddenException("This device is pending the store owner's approval - ask them to approve it from Staff accounts.");
  }

  private async notifySellerOfNewDevice(sellerId: string, staffName: string): Promise<void> {
    const seller = await this.prismaAdmin.seller.findUnique({ where: { id: sellerId }, include: { user: true } });
    if (!seller) return;
    const loginUrl = `${this.config.getOrThrow<string>("APP_BASE_URL")}/login`;
    await this.email.sendNewStaffDeviceLoginEmail(seller.user.email, staffName, loginUrl);
  }

  /**
   * FR-52.15 (Module 101, founder batch B14) - the self-service half of
   * "reset-not-reveal": only the staff member holding the emailed token
   * ever sets the new password, structurally identical to auth.service.
   * ts's own completePasswordReset() (single-use token-hash clearing,
   * same rate-limit key).
   */
  async completePasswordReset(dto: CompleteStaffPasswordResetDto): Promise<void> {
    const tokenHash = hashToken(dto.token);
    const staff = await this.prismaAdmin.staffAccount.findFirst({ where: { passwordResetTokenHash: tokenHash } });

    if (!staff || !staff.passwordResetExpiresAt || staff.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException("This password reset link is invalid or has expired.");
    }

    const rateLimitPerHour = await this.settings.resolve<number>("auth.password_reset_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`staff-password-reset-complete:${staff.id}`, rateLimitPerHour);

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prismaAdmin.staffAccount.update({
      where: { id: staff.id },
      data: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null },
    });
  }
}
