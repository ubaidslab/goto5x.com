import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { AuditLogService } from "./audit-log.service";

@Controller("admin/audit-logs")
@UseGuards(AdminAuthGuard)
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  list(@Query("limit") limit?: string) {
    return this.auditLog.listRecent(limit ? parseInt(limit, 10) : undefined);
  }
}
