import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";

export interface SellerRateFlag {
  sellerId: string;
  totalOrders: number;
  matchingOrders: number;
  ratePercent: number;
}

export interface SignupVelocityFlag {
  ipAddress: string;
  signupCount: number;
}

export interface BypassAttemptFlag {
  sellerId: string;
  attemptCount: number;
}

/**
 * SRS §5.29 FR-29.3 / §5.6c FR-6.19 - read-side admin risk views, zero new
 * persistent "flags" infrastructure: every signal here is computed from
 * tables that already exist (`orders`, `stores`, `user_security_events`,
 * `platform_events`, `admin_audit_logs`) at read time. No method here
 * mutates anything or escalates a seller's lifecycle status - these are
 * views for a human to act on (FR-29.4), never a silent auto-penalty.
 */
@Injectable()
export class TrustSafetyMonitorsService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
  ) {}

  /** FR-6.19 - share of a seller's orders marked cancelled, over a rolling window. */
  async cancellationRateFlags(): Promise<SellerRateFlag[]> {
    const [windowDays, thresholdPercent, minSample] = await Promise.all([
      this.settings.resolve<number>("trust_safety.cancellation_rate_window_days"),
      this.settings.resolve<number>("trust_safety.cancellation_rate_threshold_percent"),
      this.settings.resolve<number>("trust_safety.monitor_min_sample_orders"),
    ]);
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const bySeller = await this.groupOrdersBySeller(since);
    return bySeller
      .map(({ sellerId, orders }) => {
        const totalOrders = orders.length;
        const matchingOrders = orders.filter((o) => o.status === "cancelled").length;
        return { sellerId, totalOrders, matchingOrders, ratePercent: totalOrders > 0 ? (matchingOrders / totalOrders) * 100 : 0 };
      })
      .filter((f) => f.totalOrders >= minSample && f.ratePercent > thresholdPercent);
  }

  /** FR-6.19 - share of orders sitting in `pending` past a configurable age without being marked paid or cancelled. */
  async pendingForeverRateFlags(): Promise<SellerRateFlag[]> {
    const [maxAgeDays, thresholdPercent, minSample] = await Promise.all([
      this.settings.resolve<number>("trust_safety.pending_forever_max_age_days"),
      this.settings.resolve<number>("trust_safety.pending_forever_rate_threshold_percent"),
      this.settings.resolve<number>("trust_safety.monitor_min_sample_orders"),
    ]);
    const maxAge = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    // A generous lookback window for the denominator (all orders, not just
    // recent ones) - "pending forever" is about orders that are OLD, not
    // about a short rolling window like the cancellation-rate monitor.
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const bySeller = await this.groupOrdersBySeller(since);
    return bySeller
      .map(({ sellerId, orders }) => {
        const totalOrders = orders.length;
        const matchingOrders = orders.filter((o) => o.status === "pending" && o.placedAt < maxAge).length;
        return { sellerId, totalOrders, matchingOrders, ratePercent: totalOrders > 0 ? (matchingOrders / totalOrders) * 100 : 0 };
      })
      .filter((f) => f.totalOrders >= minSample && f.ratePercent > thresholdPercent);
  }

  /**
   * FR-29.3 - extends FR-23.5's existing per-IP signup rate limiting: a
   * lower, Settings-Registry-tunable threshold flags for admin review
   * rather than only rejecting outright. Reuses the same `user_security_events`
   * "signup" rows FR-30.5 already writes - zero new infrastructure.
   */
  async signupVelocityFlags(): Promise<SignupVelocityFlag[]> {
    const [windowMinutes, threshold] = await Promise.all([
      this.settings.resolve<number>("trust_safety.signup_velocity_flag_window_minutes"),
      this.settings.resolve<number>("trust_safety.signup_velocity_flag_threshold"),
    ]);
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const events = await this.prismaAdmin.userSecurityEvent.findMany({
      where: { eventType: "signup", createdAt: { gte: since } },
      select: { ipAddress: true },
    });
    const counts = new Map<string, number>();
    for (const e of events) {
      if (!e.ipAddress) continue;
      counts.set(e.ipAddress, (counts.get(e.ipAddress) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > threshold)
      .map(([ipAddress, signupCount]) => ({ ipAddress, signupCount }));
  }

  /**
   * FR-29.3 - "repeated banned/restricted-keyword submissions from the same
   * seller in a short window is itself a signal distinct from any single
   * blocked listing." Reads two existing sources with no new write path:
   * `platform_events` "product.moderation.blocked" rows (a banned keyword
   * blocked a submission outright - ModerationService.evaluateNewProduct)
   * and `admin_audit_logs` "moderation.queued" rows (a restricted keyword/
   * category queued a submission - ModerationService.recordQueued).
   */
  async bypassAttemptFlags(): Promise<BypassAttemptFlag[]> {
    const [windowMinutes, threshold] = await Promise.all([
      this.settings.resolve<number>("trust_safety.bypass_attempt_window_minutes"),
      this.settings.resolve<number>("trust_safety.bypass_attempt_count_threshold"),
    ]);
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);

    const blockedEvents = await this.prismaAdmin.platformEvent.findMany({
      where: { eventType: "product.moderation.blocked", createdAt: { gte: since } },
      select: { actorId: true },
    });
    const queuedLogs = await this.prismaAdmin.adminAuditLog.findMany({
      where: { action: "moderation.queued", createdAt: { gte: since } },
      select: { targetId: true, afterValue: true },
    });

    const counts = new Map<string, number>();
    for (const e of blockedEvents) {
      if (!e.actorId) continue;
      counts.set(e.actorId, (counts.get(e.actorId) ?? 0) + 1);
    }
    if (queuedLogs.length > 0) {
      const productIds = queuedLogs.map((l) => l.targetId).filter((id): id is string => !!id);
      const products = await this.prismaAdmin.product.findMany({ where: { id: { in: productIds } }, select: { id: true, storeId: true } });
      const stores = await this.prismaAdmin.store.findMany({
        where: { id: { in: [...new Set(products.map((p) => p.storeId))] } },
        select: { id: true, sellerId: true },
      });
      const sellerByStore = new Map(stores.map((s) => [s.id, s.sellerId]));
      const storeByProduct = new Map(products.map((p) => [p.id, p.storeId]));
      for (const log of queuedLogs) {
        const reason = (log.afterValue as { reason?: string } | null)?.reason;
        if (reason !== "restricted_keyword" && reason !== "restricted_category") continue;
        const storeId = log.targetId ? storeByProduct.get(log.targetId) : undefined;
        const sellerId = storeId ? sellerByStore.get(storeId) : undefined;
        if (!sellerId) continue;
        counts.set(sellerId, (counts.get(sellerId) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .filter(([, count]) => count >= threshold)
      .map(([sellerId, attemptCount]) => ({ sellerId, attemptCount }));
  }

  private async groupOrdersBySeller(since: Date): Promise<{ sellerId: string; orders: { status: string; placedAt: Date }[] }[]> {
    const stores = await this.prismaAdmin.store.findMany({ select: { id: true, sellerId: true } });
    const sellerByStore = new Map(stores.map((s) => [s.id, s.sellerId]));

    const orders = await this.prismaAdmin.order.findMany({
      where: { placedAt: { gte: since } },
      select: { storeId: true, status: true, placedAt: true },
    });

    const bySeller = new Map<string, { status: string; placedAt: Date }[]>();
    for (const order of orders) {
      const sellerId = sellerByStore.get(order.storeId);
      if (!sellerId) continue;
      const list = bySeller.get(sellerId) ?? [];
      list.push({ status: order.status, placedAt: order.placedAt });
      bySeller.set(sellerId, list);
    }
    return [...bySeller.entries()].map(([sellerId, orders]) => ({ sellerId, orders }));
  }
}
