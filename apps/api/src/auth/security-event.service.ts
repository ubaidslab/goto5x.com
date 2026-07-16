import { Injectable } from "@nestjs/common";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";

/**
 * SRS FR-25.3 - deliberately separate from AdminAuditLogService: this is a
 * per-user account-security trail (password reset, email verification),
 * relevant to every role, not a platform-admin control-plane action log.
 */
@Injectable()
export class SecurityEventService {
  constructor(private readonly prisma: PrismaRuntimeService) {}

  async record(userId: string, eventType: string, ipAddress?: string) {
    return this.prisma.userSecurityEvent.create({
      data: { userId, eventType, ipAddress: ipAddress ?? null },
    });
  }
}
