import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";

const RECLAIM_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SRS §5.6k/FR-6.43 (Module 66) - the multi-store downgrade rule. Uses
 * PrismaAdminService throughout (bypassing RLS) - same precedent as
 * RetentionService/WalletGraceLadderService: this is a platform-triggered
 * lifecycle mechanism acting across a seller's stores on a plan-change
 * event, not a request scoped to one tenant's own session.
 */
@Injectable()
export class MultiStoreDowngradeService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
  ) {}

  private resolveMaxStores(planId: string): Promise<number> {
    return this.settings.resolve<number>("stores.max_per_seller", { planId });
  }

  /**
   * Called from requestPlanChange() at REQUEST time (not at cycle-end
   * application) - FR-6.43 requires the confirmation step to happen "on
   * the downgrade flow," i.e. when the seller asks for the change, not
   * weeks later when they've forgotten. Returns null when no choice is
   * needed (the new tier's limit already covers every active store).
   */
  async determineChoiceRequirement(
    sellerId: string,
    newPlanId: string,
  ): Promise<{ maxStores: number; activeStores: { id: string; name: string; createdAt: Date }[] } | null> {
    const maxStores = await this.resolveMaxStores(newPlanId);
    const activeStores = await this.prismaAdmin.store.findMany({
      where: { sellerId, status: "active" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, createdAt: true },
    });
    if (activeStores.length <= maxStores) return null;
    return { maxStores, activeStores };
  }

  /** Validates a seller-supplied selection against determineChoiceRequirement()'s result before it's staged. */
  validateKeepStoreIds(activeStores: { id: string }[], maxStores: number, keepStoreIds: string[]): void {
    if (keepStoreIds.length > maxStores) {
      throw new BadRequestException(`You may keep at most ${maxStores} store(s) active on this plan.`);
    }
    const activeIds = new Set(activeStores.map((s) => s.id));
    for (const id of keepStoreIds) {
      if (!activeIds.has(id)) {
        throw new BadRequestException("One of the selected stores is not one of your currently active stores.");
      }
    }
  }

  /**
   * Applied at the moment the downgrade actually takes effect (immediately,
   * for the no-active-cycle edge case, or at cycle end via
   * applyDueCycleChanges()). Idempotent/safe to call even when no pause
   * turns out to be needed - re-resolves against CURRENT active stores
   * rather than trusting the request-time snapshot, since time has usually
   * passed. `keepStoreIds` empty = seller didn't choose - the founder's
   * specified default (oldest store, by createdAt, stays active) applies.
   * A previously-selected store that's no longer active by now (e.g.
   * deleted since) is simply absent from the pool - the founder's spec
   * doesn't describe backfilling that freed slot from an unchosen store,
   * so this doesn't invent that behavior (disclosed decision).
   */
  async applyDowngrade(sellerId: string, newPlanId: string, keepStoreIds: string[]): Promise<void> {
    const maxStores = await this.resolveMaxStores(newPlanId);
    const activeStores = await this.prismaAdmin.store.findMany({
      where: { sellerId, status: "active" },
      orderBy: { createdAt: "asc" },
    });
    if (activeStores.length <= maxStores) return;

    const keepIds = keepStoreIds.length > 0 ? new Set(keepStoreIds) : new Set(activeStores.slice(0, maxStores).map((s) => s.id));

    const now = new Date();
    for (const store of activeStores) {
      if (keepIds.has(store.id)) continue;
      await this.prismaAdmin.store.update({
        where: { id: store.id },
        data: { status: "orders_paused", overLimitPausedAt: now },
      });
    }
  }

  /**
   * Called on every actual plan-tier application (either direction) - a
   * downgrade to an even-lower tier is a harmless no-op here (freeSlots
   * never positive), and an upgrade reclaims overLimitPausedAt stores up
   * to the new limit, oldest-store-first, but ONLY within the 30-day
   * window FR-6.43 specifies ("upgrade back WITHIN 30 days"). A store
   * whose window has already elapsed stays orders_paused indefinitely -
   * never auto-deleted (FR-6.41 only ever acts on terminalPausedAt), but
   * also not silently reclaimed by a much-later upgrade, since the spec
   * frames 30 days as the reclaim window itself, not just a suggestion
   * (disclosed decision - the SRS text doesn't pin this exact edge case).
   */
  async reclaimOnUpgrade(sellerId: string, newPlanId: string): Promise<void> {
    const maxStores = await this.resolveMaxStores(newPlanId);
    const activeCount = await this.prismaAdmin.store.count({ where: { sellerId, status: "active" } });
    const freeSlots = maxStores - activeCount;
    if (freeSlots <= 0) return;

    const cutoff = new Date(Date.now() - RECLAIM_WINDOW_DAYS * DAY_MS);
    const reclaimable = await this.prismaAdmin.store.findMany({
      where: { sellerId, status: "orders_paused", overLimitPausedAt: { not: null, gte: cutoff } },
      orderBy: { createdAt: "asc" },
      take: freeSlots,
    });
    for (const store of reclaimable) {
      await this.prismaAdmin.store.update({ where: { id: store.id }, data: { status: "active", overLimitPausedAt: null } });
    }
  }
}
