import { MultiStoreDowngradeService } from "./multi-store-downgrade.service";

/**
 * SRS §5.93/FR-93.1 (D74, 2026-10-09) flattened every individual plan to
 * stores.max_per_seller = 1 for the MVP window, and the new
 * stores_one_active_per_seller partial unique index (B1,
 * 20261010090000_single_active_store_per_seller) makes "a seller with 2+
 * simultaneously active stores" a hard database impossibility for any code
 * path going forward - including a test seeding the precondition directly.
 * This service's own live-API trigger (an upgrade granting more active-store
 * slots) can therefore never fire again; module66-multistore-downgrade.e2e-
 * spec.ts's old API-driven setup (create N stores after an upgrade to a
 * higher tier) is gone for exactly that reason, replaced by this unit-level
 * suite (a fake PrismaAdminService, no real DB, so it isn't constrained by
 * the index either) proving the archival LOGIC itself - still required per
 * the founder's own B1 instruction ("existing extra stores are archived
 * through the MultiStoreDowngradeService mechanism, never deleted") for the
 * one remaining real caller: this migration's data-fix step pausing
 * grandfathered pre-cutover sellers who already held 2+ active stores.
 * reclaimOnUpgrade() keeps its e2e coverage (see that file) since its own
 * precondition - orders_paused stores - doesn't conflict with the index.
 */
describe("MultiStoreDowngradeService", () => {
  type FakeStore = { id: string; name: string; sellerId: string; status: string; createdAt: Date; overLimitPausedAt: Date | null };

  function buildService(stores: FakeStore[], maxStoresByPlanId: Record<string, number>) {
    const resolve = jest.fn(async (key: string, ctx: { planId: string }) => {
      if (key !== "stores.max_per_seller") throw new Error(`unexpected settings key: ${key}`);
      return maxStoresByPlanId[ctx.planId];
    });
    const findMany = jest.fn(async (args: any) => {
      let rows = stores.filter((s) => s.sellerId === args.where.sellerId);
      if (args.where.status) rows = rows.filter((s) => s.status === args.where.status);
      if (args.where.overLimitPausedAt?.gte) rows = rows.filter((s) => s.overLimitPausedAt && s.overLimitPausedAt >= args.where.overLimitPausedAt.gte);
      rows = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      if (args.take != null) rows = rows.slice(0, args.take);
      return rows.map((s) => (args.select ? { id: s.id, name: s.name, createdAt: s.createdAt } : s));
    });
    const count = jest.fn(async (args: any) => stores.filter((s) => s.sellerId === args.where.sellerId && s.status === args.where.status).length);
    const update = jest.fn(async (args: any) => {
      const store = stores.find((s) => s.id === args.where.id)!;
      Object.assign(store, args.data);
      return store;
    });
    const prismaAdmin = { store: { findMany, count, update } };
    const settings = { resolve };
    const service = new MultiStoreDowngradeService(prismaAdmin as any, settings as any);
    return { service, findMany, count, update, resolve };
  }

  function store(id: string, sellerId: string, createdAtOffsetMs: number, overrides: Partial<FakeStore> = {}): FakeStore {
    return { id, name: `Store ${id}`, sellerId, status: "active", createdAt: new Date(1000 + createdAtOffsetMs), overLimitPausedAt: null, ...overrides };
  }

  describe("determineChoiceRequirement()", () => {
    it("returns null (no choice needed) when active stores already fit the new plan's limit", async () => {
      const stores = [store("s1", "seller-1", 0)];
      const { service } = buildService(stores, { "plan-go": 1 });
      const result = await service.determineChoiceRequirement("seller-1", "plan-go");
      expect(result).toBeNull();
    });

    it("returns the choice requirement, oldest-first, when active stores exceed the new plan's limit", async () => {
      const stores = [store("s3", "seller-1", 20), store("s1", "seller-1", 0), store("s2", "seller-1", 10)];
      const { service } = buildService(stores, { "plan-go": 1 });
      const result = await service.determineChoiceRequirement("seller-1", "plan-go");
      expect(result).not.toBeNull();
      expect(result!.maxStores).toBe(1);
      expect(result!.activeStores.map((s) => s.id)).toEqual(["s1", "s2", "s3"]); // oldest first
    });

    it("never sees another seller's stores", async () => {
      const stores = [store("mine", "seller-1", 0), store("theirs-1", "seller-2", 0), store("theirs-2", "seller-2", 10)];
      const { service } = buildService(stores, { "plan-go": 1 });
      const result = await service.determineChoiceRequirement("seller-1", "plan-go");
      expect(result).toBeNull(); // seller-1 has exactly 1 active store, at the limit
    });
  });

  describe("validateKeepStoreIds()", () => {
    it("rejects keeping more stores than the new plan allows", () => {
      const service = buildService([], {}).service;
      expect(() => service.validateKeepStoreIds([{ id: "s1" }, { id: "s2" }], 1, ["s1", "s2"])).toThrow(/at most 1/);
    });

    it("rejects a keepStoreId that isn't one of the seller's own active stores", () => {
      const service = buildService([], {}).service;
      expect(() => service.validateKeepStoreIds([{ id: "s1" }], 1, ["not-mine"])).toThrow(/not one of your currently active stores/);
    });

    it("accepts a valid selection within the limit", () => {
      const service = buildService([], {}).service;
      expect(() => service.validateKeepStoreIds([{ id: "s1" }, { id: "s2" }], 1, ["s2"])).not.toThrow();
    });
  });

  describe("applyDowngrade()", () => {
    it("is a no-op when active stores already fit - never touches a store that doesn't need pausing", async () => {
      const stores = [store("s1", "seller-1", 0)];
      const { service, update } = buildService(stores, { "plan-go": 1 });
      await service.applyDowngrade("seller-1", "plan-go", []);
      expect(update).not.toHaveBeenCalled();
    });

    it("with no seller choice, keeps the oldest store active and pauses every newer one (default behavior)", async () => {
      const stores = [store("newer2", "seller-1", 20), store("oldest", "seller-1", 0), store("newer1", "seller-1", 10)];
      const { service } = buildService(stores, { "plan-go": 1 });
      await service.applyDowngrade("seller-1", "plan-go", []);

      expect(stores.find((s) => s.id === "oldest")!.status).toBe("active");
      expect(stores.find((s) => s.id === "oldest")!.overLimitPausedAt).toBeNull();
      for (const id of ["newer1", "newer2"]) {
        expect(stores.find((s) => s.id === id)!.status).toBe("orders_paused");
        expect(stores.find((s) => s.id === id)!.overLimitPausedAt).not.toBeNull();
      }
    });

    it("with an explicit seller choice, keeps exactly the chosen store(s) active regardless of age", async () => {
      const stores = [store("oldest", "seller-1", 0), store("chosen", "seller-1", 10), store("newest", "seller-1", 20)];
      const { service } = buildService(stores, { "plan-go": 1 });
      await service.applyDowngrade("seller-1", "plan-go", ["chosen"]);

      expect(stores.find((s) => s.id === "chosen")!.status).toBe("active");
      expect(stores.find((s) => s.id === "oldest")!.status).toBe("orders_paused");
      expect(stores.find((s) => s.id === "newest")!.status).toBe("orders_paused");
    });

    it("never deletes a store - the paused rows still exist afterward, same row count", async () => {
      const stores = [store("s1", "seller-1", 0), store("s2", "seller-1", 10), store("s3", "seller-1", 20)];
      const { service } = buildService(stores, { "plan-go": 1 });
      await service.applyDowngrade("seller-1", "plan-go", []);
      expect(stores).toHaveLength(3); // nothing removed from the underlying collection
    });
  });
});
