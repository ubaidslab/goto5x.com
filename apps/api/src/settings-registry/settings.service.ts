import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { SettingsScopeType } from "@prisma/client";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { RedisService } from "../common/redis/redis.service";
import { PRECEDENCE, scopeIdFor, SettingsContext } from "./settings.types";

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

    await this.redis.set(ck, JSON.stringify(row.value), "EX", CACHE_TTL_SECONDS);
    return row.value;
  }

  /** Admin-only write path - see SettingsAdminController for the AdminAuthGuard gate. */
  async setValue(
    key: string,
    scopeType: SettingsScopeType,
    scopeId: string | null,
    value: unknown,
    updatedByAdminUserId: string,
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

    const row = existing
      ? await this.prisma.settingsValue.update({
          where: { id: existing.id },
          data: { value: value as any, updatedBy: updatedByAdminUserId },
        })
      : await this.prisma.settingsValue.create({
          data: {
            definitionKey: key,
            scopeType,
            scopeId,
            value: value as any,
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
