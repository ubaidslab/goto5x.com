import { Body, Controller, Get, NotFoundException, Param, Put, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAccessPayload } from "../common/types";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { AuditLogService } from "../admin/audit-log.service";
import { UpdateEmailTemplateDto } from "./dto/update-email-template.dto";

/**
 * SRS §5.6k/FR-6.42 (Module 65) - admin CRUD for the seven renewal-
 * reminder/win-back templates (email-templates.seed.ts seeds sensible
 * defaults; this is where an admin overrides them). Bare, functional only,
 * same discipline as SettingsAdminController - no design work.
 */
@Controller("admin/email-templates")
@UseGuards(AdminAuthGuard)
export class EmailTemplatesController {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get()
  list() {
    return this.prismaAdmin.emailTemplate.findMany({ orderBy: { key: "asc" } });
  }

  @Put(":key")
  async update(@Param("key") key: string, @Body() dto: UpdateEmailTemplateDto, @CurrentUser() user: JwtAccessPayload) {
    const before = await this.prismaAdmin.emailTemplate.findUnique({ where: { key } });
    if (!before) throw new NotFoundException(`No email template with key "${key}".`);

    const after = await this.prismaAdmin.emailTemplate.update({
      where: { key },
      data: { subject: dto.subject, body: dto.body },
    });

    await this.auditLog.record({
      adminUserId: user.adminUserId,
      action: "billing.email_template_updated",
      targetType: "email_template",
      // EmailTemplate's primary key is a human-readable string ("renewal_reminder_day7"),
      // not a UUID like every other audited entity - AdminAuditLog.targetId
      // is @db.Uuid, so the key goes in the before/after payload instead.
      targetId: null,
      beforeValue: { key, subject: before.subject, body: before.body },
      afterValue: { key, subject: after.subject, body: after.body },
    });

    return after;
  }
}
