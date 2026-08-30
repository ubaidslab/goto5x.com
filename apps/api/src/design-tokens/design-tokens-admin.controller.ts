import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { DESIGN_TOKENS } from "./design-tokens.constants";

/**
 * Module 92 (SRS §5.68/FR-68.5) - one convenience aggregate for the
 * /admin/design-tokens screen, so it doesn't need 13 separate
 * `/admin/settings/resolve` round-trips to render its swatch grid. Writes
 * still go through the generic `PUT /admin/settings/values` (and
 * `/values/lock`) endpoints unchanged - this controller is read-only.
 */
@Controller("admin/design-tokens")
@UseGuards(AdminAuthGuard)
export class DesignTokensAdminController {
  constructor(private readonly prisma: PrismaRuntimeService) {}

  @Get()
  async list() {
    return Promise.all(
      DESIGN_TOKENS.map(async (token) => {
        const row = await this.prisma.settingsValue.findFirst({
          where: { definitionKey: token.key, scopeType: "global", scopeId: null },
        });
        const isExpired = !!row?.expiresAt && row.expiresAt.getTime() <= Date.now();
        const hasOverride = !!row && !isExpired;

        return {
          key: token.key,
          cssVar: token.cssVar,
          label: token.label,
          description: token.description,
          defaultValue: token.defaultValue,
          effectiveValue: hasOverride ? (row!.value as string) : token.defaultValue,
          hasOverride,
          locked: hasOverride ? row!.locked : false,
        };
      }),
    );
  }
}
