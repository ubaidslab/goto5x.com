import { Controller, Get, Param, Put, Query, Body, UseGuards } from "@nestjs/common";
import { SettingsScopeType } from "@prisma/client";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAccessPayload } from "../common/types";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { AuditLogService } from "../admin/audit-log.service";
import { SettingsService } from "./settings.service";
import { PRECEDENCE, scopeIdFor, SettingsContext } from "./settings.types";
import { SetSettingsLockDto } from "./dto/set-settings-lock.dto";
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

  /**
   * Module 25 (Admin Completion) - the write-UI's "show current effective
   * value with the precedence chain visible" requirement. Walks the same
   * PRECEDENCE order `SettingsService.resolve()` uses, but returns every
   * scope's row (or its absence) instead of stopping at the first hit, so
   * the admin can see exactly which scope is winning and what every other
   * scope would contribute if the winner were removed.
   */
  @Get("resolve")
  async resolveWithChain(
    @Query("key") key: string,
    @Query("sellerId") sellerId?: string,
    @Query("storeId") storeId?: string,
    @Query("planId") planId?: string,
    @Query("supplierId") supplierId?: string,
    @Query("categoryId") categoryId?: string,
  ) {
    const definition = await this.prisma.settingsDefinition.findUniqueOrThrow({ where: { key } });
    const context: SettingsContext = { sellerId, storeId, planId, supplierId, categoryId };

    const chain: Array<{
      scope: SettingsScopeType;
      scopeId: string | null;
      hasOverride: boolean;
      value: unknown;
      updatedBy: string | null;
      updatedByEmail: string | null;
      updatedAt: Date | null;
      // D-Studio close-out (time-limited grants) - surfaced so an admin
      // viewing the precedence chain (e.g. Seller-360) can see a grant's
      // countdown, not just that an override exists. null for a permanent
      // override or a scope that doesn't support expiry.
      expiresAt: Date | null;
    }> = [];

    let winningScope: SettingsScopeType | "default" = "default";
    let effectiveValue: unknown = definition.defaultValue;
    let foundWinner = false;

    for (const scope of PRECEDENCE) {
      if (!definition.allowedScopes.includes(scope)) continue;
      const scopeId = scope === "global" ? null : (scopeIdFor(scope, context) ?? undefined);
      if (scope !== "global" && scopeId === undefined) continue;

      const row = await this.prisma.settingsValue.findFirst({
        where: { definitionKey: key, scopeType: scope, scopeId: scopeId ?? null },
      });

      let updatedByEmail: string | null = null;
      if (row?.updatedBy) {
        const admin = await this.prisma.adminUser.findUnique({ where: { id: row.updatedBy }, include: { user: true } });
        updatedByEmail = admin?.user.email ?? null;
      }

      const isExpired = !!row?.expiresAt && row.expiresAt.getTime() <= Date.now();

      chain.push({
        scope,
        scopeId: scopeId ?? null,
        hasOverride: !!row,
        value: row?.value ?? null,
        updatedBy: row?.updatedBy ?? null,
        updatedByEmail,
        updatedAt: row?.updatedAt ?? null,
        expiresAt: row?.expiresAt ?? null,
      });

      // An expired-but-not-yet-opportunistically-deleted row (see
      // SettingsService.getValue()) must not win here either - otherwise
      // this admin view would show a lapsed grant as still active a full
      // CACHE_TTL_SECONDS-and-then-some ahead of the next real resolve()
      // call cleaning it up.
      if (!foundWinner && row && !isExpired) {
        winningScope = scope;
        effectiveValue = row.value;
        foundWinner = true;
      }
    }

    return {
      key,
      valueType: definition.valueType,
      allowedScopes: definition.allowedScopes,
      defaultValue: definition.defaultValue,
      description: definition.description,
      requiresConfirmation: definition.requiresConfirmation,
      effectiveValue,
      winningScope,
      chain,
    };
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
      dto.expiresAt !== undefined ? (dto.expiresAt === null ? null : new Date(dto.expiresAt)) : undefined,
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

  /** Module 92 (SRS §5.68/FR-68.3). */
  @Put("values/lock")
  async setLock(@Body() dto: SetSettingsLockDto, @CurrentUser() user: JwtAccessPayload) {
    const before = await this.prisma.settingsValue.findFirst({
      where: { definitionKey: dto.key, scopeType: dto.scopeType, scopeId: dto.scopeId ?? null },
    });

    const after = await this.settings.setLocked(dto.key, dto.scopeType, dto.scopeId ?? null, dto.locked, user.adminUserId!);

    await this.auditLog.record({
      adminUserId: user.adminUserId,
      action: dto.locked ? "settings.lock" : "settings.unlock",
      targetType: "settings_value",
      targetId: after.id,
      beforeValue: { locked: before?.locked ?? false },
      afterValue: { locked: after.locked },
    });

    return after;
  }
}
