import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { EventsService } from "../events/events.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { SettingsService } from "../settings-registry/settings.service";
import { JwtAccessPayload } from "../common/types";
import { AuditLogService } from "../admin/audit-log.service";

/**
 * SRS FR-8.4 + v0.23 impersonation-transparency amendment. Deliberately
 * NOT built on SessionService/refresh-token rotation (Module 1/13's
 * device-session mechanism) - impersonation is a short-lived, purpose-
 * built JWT whose own expiry IS the time-box, so there is nothing to
 * silently refresh forever. Re-entering impersonation after expiry means
 * starting a new session (reason required again), by design.
 */
@Injectable()
export class AdminImpersonationService {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly events: EventsService,
    private readonly auditLog: AuditLogService,
    private readonly settings: SettingsService,
  ) {}

  async start(adminUserId: string, sellerId: string, reason: string) {
    const seller = await this.prismaAdmin.seller.findUnique({ where: { id: sellerId }, include: { user: true } });
    if (!seller) throw new NotFoundException("Seller not found.");

    const ttlMinutes = await this.settings.resolve<number>("admin.impersonation_session_ttl_minutes");
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    const session = await this.prisma.impersonationSession.create({
      data: { adminUserId, sellerId, reason, expiresAt },
    });

    // SRS §3.11/v0.23 - impersonation transparency: emitted before the
    // token is even returned, so the event exists regardless of what the
    // admin does next.
    await this.events.emit({
      eventType: "admin.impersonation.started",
      actorType: "admin",
      actorId: adminUserId,
      entityType: "seller",
      entityId: sellerId,
    });
    await this.auditLog.record({
      adminUserId,
      action: "impersonation.start",
      targetType: "seller",
      targetId: sellerId,
      afterValue: { reason },
      impersonationSessionId: session.id,
    });

    const accessToken = this.jwt.sign(
      {
        sub: seller.user.id,
        sellerId,
        impersonatingAdminUserId: adminUserId,
        impersonationSessionId: session.id,
        mfaVerified: true,
      } satisfies JwtAccessPayload,
      { secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"), expiresIn: `${ttlMinutes}m` },
    );

    return { accessToken, expiresAt, impersonationSessionId: session.id };
  }

  /** Admin-initiated early end - "ending the session is itself logged" (FR-8.4). */
  async end(adminUserId: string, sessionId: string) {
    const session = await this.prisma.impersonationSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException("Impersonation session not found.");
    if (session.adminUserId !== adminUserId) {
      throw new ForbiddenException("You can only end your own impersonation sessions.");
    }
    await this.prisma.impersonationSession.update({ where: { id: sessionId }, data: { endedAt: new Date() } });
    await this.auditLog.record({
      adminUserId,
      action: "impersonation.end",
      targetType: "seller",
      targetId: session.sellerId,
      impersonationSessionId: sessionId,
    });
    return { ended: true };
  }

  /**
   * The impersonated seller's own Security-card read (v0.23) - when it
   * happened and for how long, never which admin. `endedAt ?? expiresAt`:
   * a session the admin never explicitly ended still stopped being valid
   * at its expiry, so that's its effective end for display purposes.
   */
  async historyForSeller(sellerId: string) {
    const sessions = await this.prisma.impersonationSession.findMany({
      where: { sellerId },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, endedAt: true, expiresAt: true },
    });
    return sessions.map((s) => {
      const effectiveEnd = s.endedAt ?? s.expiresAt;
      return {
        startedAt: s.startedAt,
        endedAt: effectiveEnd,
        durationMinutes: Math.round((effectiveEnd.getTime() - s.startedAt.getTime()) / 60_000),
      };
    });
  }

  /** FR-8.4 - read-only "view any store" access, no impersonation token involved. */
  async viewStore(storeId: string) {
    const store = await this.prismaAdmin.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException("Store not found.");
    return store;
  }
}
