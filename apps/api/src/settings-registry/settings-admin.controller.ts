import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAccessPayload } from "../common/types";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { AuditLogService } from "../admin/audit-log.service";
import { SettingsService } from "./settings.service";
import { UpsertSettingsValueDto } from "./dto/upsert-settings-value.dto";

/**
 * Bare, functional admin endpoints only - no design work (out of Module 1's
 * scope per docs/build-plan.md). The Settings Registry mechanism itself is
 * the deliverable here, not the UI polish around it.
 */
@Controller("admin/settings")
@UseGuards(AdminAuthGuard)
export class SettingsAdminController {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly settings: SettingsService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get("definitions")
  listDefinitions() {
    return this.prisma.settingsDefinition.findMany();
  }

  @Get("values/:key")
  async listValuesForKey(@Param("key") key: string) {
    return this.prisma.settingsValue.findMany({ where: { definitionKey: key } });
  }

  @Put("values")
  async upsertValue(@Body() dto: UpsertSettingsValueDto, @CurrentUser() user: JwtAccessPayload) {
    // findFirst, not findUnique - see settings.service.ts's getValue() for
    // why a compound-unique lookup with a null scopeId needs this.
    const before = await this.prisma.settingsValue.findFirst({
      where: {
        definitionKey: dto.key,
        scopeType: dto.scopeType,
        scopeId: dto.scopeId ?? null,
      },
    });

    const after = await this.settings.setValue(
      dto.key,
      dto.scopeType,
      dto.scopeId ?? null,
      dto.value,
      user.adminUserId!,
    );

    await this.auditLog.record({
      adminUserId: user.adminUserId,
      action: "settings.update",
      targetType: "settings_value",
      targetId: after.id,
      beforeValue: before?.value ?? null,
      afterValue: after.value,
    });

    return after;
  }
}
