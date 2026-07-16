import { NotFoundException } from "@nestjs/common";
import { SettingsService } from "./settings.service";

/**
 * Unit tests for the precedence logic itself (SRS §3.8: seller > store > plan
 * > category > global), using in-memory fakes rather than a real DB/Redis -
 * the e2e suite (test/e2e/settings.e2e-spec.ts) covers the real cache +
 * validation-rejection behavior end to end.
 */
describe("SettingsService precedence", () => {
  function buildService(rows: Array<{ scopeType: string; scopeId: string | null; value: unknown }>) {
    const definition = {
      key: "billing.commission_rate",
      valueType: "number",
      allowedScopes: ["seller", "store", "plan", "category", "global"],
      defaultValue: 3,
      validation: { min: 0, max: 100 },
    };

    const prisma = {
      settingsDefinition: {
        findUnique: jest.fn().mockResolvedValue(definition),
      },
      settingsValue: {
        findFirst: jest.fn(({ where }: any) => {
          const { scopeType, scopeId } = where;
          const match = rows.find((r) => r.scopeType === scopeType && r.scopeId === scopeId);
          return Promise.resolve(match ? { value: match.value } : null);
        }),
      },
    };

    const store = new Map<string, string>();
    const redis = {
      get: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
      set: jest.fn((k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve("OK");
      }),
      del: jest.fn((k: string) => {
        store.delete(k);
        return Promise.resolve(1);
      }),
    };

    return new SettingsService(prisma as any, redis as any);
  }

  it("returns the seller-scoped value when a seller override exists, even if a plan override also exists", async () => {
    const service = buildService([
      { scopeType: "seller", scopeId: "seller-1", value: 1 },
      { scopeType: "plan", scopeId: "plan-1", value: 2 },
      { scopeType: "global", scopeId: null, value: 3 },
    ]);
    const result = await service.resolve("billing.commission_rate", {
      sellerId: "seller-1",
      planId: "plan-1",
    });
    expect(result).toBe(1);
  });

  it("falls back to store, then plan, then category, then global in that order", async () => {
    const withStore = buildService([
      { scopeType: "store", scopeId: "store-1", value: 10 },
      { scopeType: "plan", scopeId: "plan-1", value: 20 },
      { scopeType: "global", scopeId: null, value: 30 },
    ]);
    expect(
      await withStore.resolve("billing.commission_rate", { storeId: "store-1", planId: "plan-1" }),
    ).toBe(10);

    const withPlanOnly = buildService([
      { scopeType: "plan", scopeId: "plan-1", value: 20 },
      { scopeType: "global", scopeId: null, value: 30 },
    ]);
    expect(
      await withPlanOnly.resolve("billing.commission_rate", { storeId: "store-1", planId: "plan-1" }),
    ).toBe(20);

    const globalOnly = buildService([{ scopeType: "global", scopeId: null, value: 30 }]);
    expect(
      await globalOnly.resolve("billing.commission_rate", { storeId: "store-1", planId: "plan-1" }),
    ).toBe(30);
  });

  it("falls back to the definition's own defaultValue if no row exists at any applicable scope", async () => {
    const service = buildService([]);
    expect(await service.resolve("billing.commission_rate", {})).toBe(3);
  });

  it("skips a scope the context has no id for, rather than erroring", async () => {
    const service = buildService([{ scopeType: "global", scopeId: null, value: 30 }]);
    expect(await service.resolve("billing.commission_rate", {})).toBe(30);
  });

  it("rejects resolving an unknown key", async () => {
    const service = buildService([]);
    (service as any).prisma.settingsDefinition.findUnique.mockResolvedValueOnce(null);
    await expect(service.resolve("no.such.key", {})).rejects.toBeInstanceOf(NotFoundException);
  });
});
