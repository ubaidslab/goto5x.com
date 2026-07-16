import { Injectable } from "@nestjs/common";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";

export interface AuditLogEntry {
  adminUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  beforeValue?: unknown;
  afterValue?: unknown;
}

/**
 * Insert-only by construction (the DB grant also revokes UPDATE/DELETE for
 * both app_runtime and app_admin - see prisma/migrations/*_rls_and_audit_grants
 * - so this service has no update/delete method to call even if someone
 * wanted one). `adminUserId` is null for system/automated actions (e.g. a
 * future Template Install API grant, SRS FR-24.6) rather than a human admin.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaRuntimeService) {}

  async record(entry: AuditLogEntry) {
    return this.prisma.adminAuditLog.create({
      data: {
        adminUserId: entry.adminUserId ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        beforeValue: (entry.beforeValue as any) ?? undefined,
        afterValue: (entry.afterValue as any) ?? undefined,
      },
    });
  }

  async listRecent(limit = 50) {
    return this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
