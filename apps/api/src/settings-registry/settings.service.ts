import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { SettingsScopeType } from "@prisma/client";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { RedisService } from "../common/redis/redis.service";
import { contextFromScope, PRECEDENCE, scopeIdFor, SettingsContext } from "./settings.types";

const CACHE_TTL_SECONDS = 60;

function cacheKey(key: string, scopeType: SettingsScopeType, scopeId?: string | null): string {
  return `settings:${key}:${scopeType}:${scopeId ?? "global"}`;
}

/**
 * SRS §3.8. Every module resolves tunable behavior through resolve() rather
 * than a hard-coded constant. Reads hit Redis first; a write invalidates the
 * exact cache key it affects, so the very next resolve() call anywhere sees
 * the new value with no restart and no deploy.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly redis: RedisService,
  ) {}

  async resolve<T = unknown>(key: string, context: SettingsContext = {}): Promise<T> {
    const definition = await this.prisma.settingsDefinition.findUnique({ where: { key } });
    if (!definition) {
      throw new NotFoundException(`Unknown settings key: ${key}`);
    }

    for (const scope of PRECEDENCE) {
      if (!definition.allowedScopes.includes(scope)) continue;

      const scopeId = scope === "global" ? null : scopeIdFor(scope, context) ?? undefined;
      if (scope !== "global" && scopeId === undefined) continue; // context doesn't apply to this scope

      const value = await this.getValue(key, scope, scopeId ?? null);
      if (value !== undefined) return value as T;
    }

    return definition.defaultValue as T;
  }

  private async getValue(
    key: string,
    scopeType: SettingsScopeType,
    scopeId: string | null,
  ): Promise<unknown | undefined> {
    const ck = cacheKey(key, scopeType, scopeId);
    const cached = await this.redis.get(ck);
    if (cached !== null) {
      return cached === "__MISS__" ? undefined : JSON.parse(cached);
    }

    // NOTE: Prisma's findUnique() on a compound unique key does not reliably
    // support a null member (scopeId is null exactly for global scope) -
    // Postgres unique constraints don't treat NULL as a comparable value for
    // equality, so Prisma rejects it rather than risk returning the wrong
    // row. findFirst() with an explicit WHERE works correctly here because
    // the (definitionKey, scopeType, scopeId) triple is still enforced
    // unique by the database even though Prisma's typed findUnique won't
    // query it directly - caught by e2e testing against a real Postgres
    // instance, not assumed to work from the schema alone.
    const row = await this.prisma.settingsValue.findFirst({
      where: { definitionKey: key, scopeType, scopeId },
    });

    if (!row) {
      // Cache the miss too, briefly, so a hot key with no seller/store
      // override doesn't hit Postgres on every single request.
      await this.redis.set(ck, "__MISS__", "EX", CACHE_TTL_SECONDS);
      return undefined;
    }

    // D-Studio close-out (founder-requested time-limited feature grants) -
    // an expired row is treated exactly as if it never existed, falling
    // through to the next-lower-precedence scope. Opportunistically
    // deleted here (not just skipped) so it doesn't linger forever and so
    // the admin-facing resolve-with-chain view stops showing it as an
    // override the moment it lapses - no separate sweep job needed for
    // correctness, this is the one and only read path.
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
      await this.prisma.settingsValue.delete({ where: { id: row.id } }).catch(() => {});
      await this.redis.set(ck, "__MISS__", "EX", CACHE_TTL_SECONDS);
      return undefined;
    }

    // A short cache TTL already bounds how stale a soon-to-expire value can
    // be served (CACHE_TTL_SECONDS, 60s) - no special-casing needed here.
    await this.redis.set(ck, JSON.stringify(row.value), "EX", CACHE_TTL_SECONDS);
    return row.value;
  }

  /**
   * Admin-only write path - see SettingsAdminController for the
   * AdminAuthGuard gate. `updatedByAdminUserId` is nullable (matching
   * `settings_values.updated_by`'s own nullability) so a system/gateway-
   * triggered grant - e.g. D-Studio Pack's auto-verify fast path,
   * FR-8.21 - can record "no human admin" the same way AuditLogService.
   * record() and TemplatePurchaseService.verify() already do, rather
   * than forcing every caller to invent a fake admin id.
   */
  async setValue(
    key: string,
    scopeType: SettingsScopeType,
    scopeId: string | null,
    value: unknown,
    updatedByAdminUserId: string | null,
    // D-Studio close-out - a time-limited grant. undefined leaves an
    // existing row's expiry untouched on update (so a plain re-save of
    // some other field never accidentally clears a grant's countdown);
    // pass null explicitly to make an override permanent again.
    expiresAt?: Date | null,
  ) {
    const definition = await this.prisma.settingsDefinition.findUnique({ where: { key } });
    if (!definition) {
      throw new NotFoundException(`Unknown settings key: ${key}`);
    }
    if (!definition.allowedScopes.includes(scopeType)) {
      throw new BadRequestException(`Key "${key}" does not support scope "${scopeType}".`);
    }
    this.validateValue(definition.valueType, definition.validation, value);

    // Same findFirst-based approach as getValue() above, for the same
    // nullable-scopeId reason - upsert() has the identical limitation as
    // findUnique() for a compound key with a null member.
    const existing = await this.prisma.settingsValue.findFirst({
      where: { definitionKey: key, scopeType, scopeId },
    });

    // Module 92 (SRS §5.68/FR-68.3) - a locked row rejects every plain
    // value write, regardless of key. Locking/unlocking itself goes through
    // setLocked() below, which never calls this method, so a locked row can
    // only ever be freed by an explicit, audited unlock action.
    if (existing?.locked) {
      throw new ConflictException(`"${key}" is locked - unlock it before changing its value.`);
    }

    const row = existing
      ? await this.prisma.settingsValue.update({
          where: { id: existing.id },
          data: { value: value as any, updatedBy: updatedByAdminUserId, ...(expiresAt !== undefined ? { expiresAt } : {}) },
        })
      : await this.prisma.settingsValue.create({
          data: {
            definitionKey: key,
            scopeType,
            scopeId,
            value: value as any,
            updatedBy: updatedByAdminUserId,
            expiresAt: expiresAt ?? null,
          },
        });

    await this.redis.del(cacheKey(key, scopeType, scopeId));
    return row;
  }

  /**
   * Module 92 (SRS §5.68/FR-68.3) - toggles a row's lock state. Deliberately
   * bypasses setValue()'s own lock-guard (this IS the lock-guard's escape
   * hatch) and never touches the value on an unlock. Locking a key with no
   * existing override row yet pins the current resolved value as an
   * explicit global override at the moment it's locked, so "locked" always
   * means "this exact value, unconditionally" - never an ambiguous "locked
   * at some undefined value".
   */
  async setLocked(
    key: string,
    scopeType: SettingsScopeType,
    scopeId: string | null,
    locked: boolean,
    updatedByAdminUserId: string,
  ) {
    const definition = await this.prisma.settingsDefinition.findUnique({ where: { key } });
    if (!definition) {
      throw new NotFoundException(`Unknown settings key: ${key}`);
    }
    if (!definition.allowedScopes.includes(scopeType)) {
      throw new BadRequestException(`Key "${key}" does not support scope "${scopeType}".`);
    }

    const existing = await this.prisma.settingsValue.findFirst({
      where: { definitionKey: key, scopeType, scopeId },
    });

    const row = existing
      ? await this.prisma.settingsValue.update({
          where: { id: existing.id },
          data: { locked, updatedBy: updatedByAdminUserId },
        })
      : await this.prisma.settingsValue.create({
          data: {
            definitionKey: key,
            scopeType,
            scopeId,
            value: (await this.resolve(key, contextFromScope(scopeType, scopeId))) as any,
            locked,
            updatedBy: updatedByAdminUserId,
          },
        });

    await this.redis.del(cacheKey(key, scopeType, scopeId));
    return row;
  }

  private validateValue(valueType: string, validation: unknown, value: unknown): void {
    if (valueType === "number" && typeof value !== "number") {
      throw new BadRequestException(`Value for a "number" setting must be a number.`);
    }
    if (valueType === "boolean" && typeof value !== "boolean") {
      throw new BadRequestException(`Value for a "boolean" setting must be a boolean.`);
    }
    if (valueType === "string" && typeof value !== "string") {
      throw new BadRequestException(`Value for a "string" setting must be a string.`);
    }
    if (valueType === "color" && (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value))) {
      throw new BadRequestException(`Value for a "color" setting must be a 6-digit #rrggbb hex string.`);
    }

    const rules = validation as { min?: number; max?: number } | null | undefined;
    if (rules && typeof value === "number") {
      if (rules.min !== undefined && value < rules.min) {
        throw new BadRequestException(`Value ${value} is below the minimum ${rules.min}.`);
      }
      if (rules.max !== undefined && value > rules.max) {
        throw new BadRequestException(`Value ${value} is above the maximum ${rules.max}.`);
      }
    }
  }
}
