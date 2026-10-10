import { SubscriptionsService } from "./subscriptions.service";

/**
 * FR-6.69/FR-6.43 composition order in requestPlanChange(): the feature-loss
 * confirmation (Module 102) is checked first and is overridable; the
 * store-choice gate (Module 66/FR-6.43) is checked second and is mandatory.
 * module102-plan-downgrade-confirmation.e2e-spec.ts used to prove this
 * ordering end-to-end with a seller holding 2 real active stores (FLY's old
 * max of 10) - FR-93.1/B1 (20261010090000_single_active_store_per_seller)
 * made "a seller with 2+ active stores" a hard database impossibility, the
 * same reason module66-multistore-downgrade.e2e-spec.ts lost 3 of its own
 * tests to multi-store-downgrade.service.spec.ts. This is that same move
 * for requestPlanChange()'s own ORCHESTRATION logic (MultiStoreDowngradeService's
 * methods already have their own unit coverage there) - mock
 * determineChoiceRequirement()'s result directly instead of deriving it
 * from real store rows, so the ordering is provable without the index
 * getting in the way.
 */
describe("SubscriptionsService.requestPlanChange() - FR-6.69/FR-6.43 composition order", () => {
  const oldPlan = { id: "plan-fly", tierOrder: 3, planGroup: "individual", isActive: true };
  const newPlan = { id: "plan-go", tierOrder: 0, planGroup: "individual", isActive: true };

  function buildService(opts: { currentPeriodEnd: Date | null }) {
    const subscription = {
      sellerId: "seller-1",
      planId: oldPlan.id,
      currentPeriodEnd: opts.currentPeriodEnd,
      plan: oldPlan,
    };
    const findUnique = jest.fn(async (args: any) => (args.where.sellerId ? subscription : null));
    const update = jest.fn(async (args: any) => ({ ...subscription, ...args.data }));
    const prisma = {
      subscription: { findUnique, update },
      plan: { findUnique: jest.fn(async () => newPlan) },
      staffAccount: { count: jest.fn(async () => 0) },
    };
    // Every DOWNGRADE_FEATURE_GATES key resolves false for both the old and
    // new plan (no flip, no loss) except wishlist.enabled, which flips
    // true->false - exactly one loss, so requiresDowngradeConfirmation's
    // own payload stays simple and predictable.
    const resolve = jest.fn(async (key: string, ctx: { planId: string }) => {
      if (key === "staff.max_accounts") return 10;
      if (key === "wishlist.enabled") return ctx.planId === oldPlan.id;
      return false;
    });
    const settings = { resolve };
    const determineChoiceRequirement = jest.fn();
    const validateKeepStoreIds = jest.fn();
    const multiStoreDowngrade = {
      determineChoiceRequirement,
      validateKeepStoreIds,
      applyDowngrade: jest.fn(),
      reclaimOnUpgrade: jest.fn(),
    };
    const service = new SubscriptionsService(prisma as any, {} as any, multiStoreDowngrade as any, settings as any);
    return { service, prisma, settings, multiStoreDowngrade, subscription };
  }

  it("an unconfirmed downgrade with real losses returns requiresDowngradeConfirmation WITHOUT ever consulting the store-choice gate", async () => {
    const { service, multiStoreDowngrade } = buildService({ currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });

    const result: any = await service.requestPlanChange("seller-1", newPlan.id, undefined, undefined, false);

    expect(result.requiresDowngradeConfirmation).toBe(true);
    expect(result.losses).toEqual([{ label: "Wishlist / save-for-later", detail: "No longer included on this plan." }]);
    expect(multiStoreDowngrade.determineChoiceRequirement).not.toHaveBeenCalled();
  });

  it("once confirmed, falls through to the mandatory store-choice gate when one is needed", async () => {
    const { service, multiStoreDowngrade, prisma } = buildService({ currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    multiStoreDowngrade.determineChoiceRequirement.mockResolvedValue({
      maxStores: 1,
      activeStores: [
        { id: "s1", name: "Store 1", createdAt: new Date() },
        { id: "s2", name: "Store 2", createdAt: new Date() },
      ],
    });

    const result: any = await service.requestPlanChange("seller-1", newPlan.id, undefined, undefined, true);

    expect(result.requiresDowngradeConfirmation).toBeUndefined();
    expect(result.requiresStoreChoice).toBe(true);
    expect(result.maxStores).toBe(1);
    expect(result.activeStores).toHaveLength(2);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it("with both confirmed and a valid keepStoreIds, stages the pending change", async () => {
    const { service, multiStoreDowngrade, prisma } = buildService({ currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    multiStoreDowngrade.determineChoiceRequirement.mockResolvedValue({
      maxStores: 1,
      activeStores: [
        { id: "s1", name: "Store 1", createdAt: new Date() },
        { id: "s2", name: "Store 2", createdAt: new Date() },
      ],
    });

    const result: any = await service.requestPlanChange("seller-1", newPlan.id, undefined, ["s1"], true);

    expect(multiStoreDowngrade.validateKeepStoreIds).toHaveBeenCalledWith(expect.anything(), 1, ["s1"]);
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pendingPlanId: newPlan.id, pendingKeepStoreIds: ["s1"] }) }),
    );
    expect(result.pendingPlanId).toBe(newPlan.id);
  });
});
