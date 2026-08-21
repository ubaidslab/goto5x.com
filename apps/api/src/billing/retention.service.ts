import { Injectable, Logger } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { AuditLogService } from "../admin/audit-log.service";
import { EmailService } from "../notifications/email.service";
import { SettingsService } from "../settings-registry/settings.service";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Every table storeId-scoped enough to belong to "this store's data" per
 * the founder's exact deletion scope (products/variants/media/inventory;
 * orders/order-items/customers; store-specific settings; that store's
 * analytics/P&L history) - in FK-safe delete order, following the same
 * `session_replication_role = replica` technique
 * scripts/simulate/teardown.ts already uses and proves out (this schema
 * has no ON DELETE CASCADE anywhere, by design - a hand-maintained order
 * or a temporary trigger-suspension are the only two ways to satisfy 30+
 * FKs in one pass; teardown.ts already chose the latter for exactly this
 * reason). Deliberately excludes platform_events (no FK to stores exists
 * on that table anyway - it's designed to reference now-gone entities),
 * milestone_events (Module 47/FR-47.3 revokes DELETE from app_runtime AND
 * app_admin at the DB level - it's explicitly append-only/immutable with
 * "the same discipline as PlatformEvent/AdminAuditLog" per its own
 * migration comment, so it belongs on the founder's never-delete
 * compliance/dispute-trail side even though it carries a store_id FK; left
 * dangling exactly like platform_events, which session_replication_role =
 * replica already tolerates since it disables FK-enforcing triggers too),
 * stock_adjustments (Module 26/28 revokes DELETE the same way - its own
 * migration comment calls it "seller-facing append-only history, same
 * immutability discipline as admin_audit_logs/user_security_events", i.e.
 * the codebase already classifies it as an audit trail, not disposable
 * analytics, so it stays on the never-delete side too), and every
 * seller-level/billing table (ledger_entries, wallet_topup_requests,
 * subscriptions, admin_audit_logs, staff_accounts - the last is
 * seller-scoped, not store-scoped, so it survives even though a casual
 * reading might expect otherwise).
 */
const STORE_SCOPED_DELETE_STATEMENTS = [
  `DELETE FROM tracking_updates WHERE order_item_id IN (SELECT id FROM order_items WHERE store_id = $1::uuid)`,
  `DELETE FROM ticket_messages WHERE store_id = $1::uuid`,
  `DELETE FROM support_tickets WHERE store_id = $1::uuid`,
  `DELETE FROM order_timeline_events WHERE store_id = $1::uuid`,
  `DELETE FROM order_notes WHERE store_id = $1::uuid`,
  `DELETE FROM payments WHERE store_id = $1::uuid`,
  `DELETE FROM gift_card_redemptions WHERE store_id = $1::uuid`,
  `DELETE FROM return_requests WHERE store_id = $1::uuid`,
  `DELETE FROM order_verifications WHERE store_id = $1::uuid`,
  `DELETE FROM order_items WHERE store_id = $1::uuid`,
  `DELETE FROM orders WHERE store_id = $1::uuid`,
  `DELETE FROM carts WHERE store_id = $1::uuid`,
  `DELETE FROM product_reviews WHERE store_id = $1::uuid`,
  `DELETE FROM collection_products WHERE store_id = $1::uuid`,
  `DELETE FROM collections WHERE store_id = $1::uuid`,
  `DELETE FROM listing_reviews WHERE store_id = $1::uuid`,
  `DELETE FROM store_supplier_links WHERE store_id = $1::uuid`,
  `DELETE FROM media_assets WHERE store_id = $1::uuid`,
  `DELETE FROM product_variants WHERE store_id = $1::uuid`,
  `DELETE FROM products WHERE store_id = $1::uuid`,
  `DELETE FROM customers WHERE store_id = $1::uuid`,
  `DELETE FROM customer_segments WHERE store_id = $1::uuid`,
  `DELETE FROM email_campaigns WHERE store_id = $1::uuid`,
  `DELETE FROM discount_codes WHERE store_id = $1::uuid`,
  `DELETE FROM gift_cards WHERE store_id = $1::uuid`,
  `DELETE FROM ad_spend_entries WHERE store_id = $1::uuid`,
  `DELETE FROM store_health_score_history WHERE store_id = $1::uuid`,
  `DELETE FROM verified_store_applications WHERE store_id = $1::uuid`,
  `DELETE FROM store_payment_gateway_connections WHERE store_id = $1::uuid`,
  `DELETE FROM store_payment_instructions WHERE store_id = $1::uuid`,
  `DELETE FROM store_shipping_settings WHERE store_id = $1::uuid`,
  `DELETE FROM store_tax_settings WHERE store_id = $1::uuid`,
  `DELETE FROM store_theme_settings WHERE store_id = $1::uuid`,
  `DELETE FROM store_navigation_menus WHERE store_id = $1::uuid`,
  `DELETE FROM domains WHERE store_id = $1::uuid`,
  `DELETE FROM import_jobs WHERE store_id = $1::uuid`,
  `DELETE FROM stores WHERE id = $1::uuid`,
];

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly email: EmailService,
    private readonly auditLog: AuditLogService,
  ) {}

  async runSweep(now = new Date()): Promise<{ warned: number; deleted: number }> {
    const warned = await this.sendWarnings(now);
    const deleted = await this.runDeletionSweep(now);
    return { warned, deleted };
  }

  /** FR-6.41 - three sticky-timestamp warning milestones (day 0/7/13), same "never re-send" discipline as dormantWarningSentAt. Never gated by the seller notification opt-out (see EmailService.sendDataRetentionWarningEmail's own doc comment). */
  private async sendWarnings(now: Date): Promise<number> {
    const retentionDays = await this.settings.resolve<number>("billing.data_retention_days");
    const milestones: { day: number; field: "retentionWarningDay0SentAt" | "retentionWarningDay7SentAt" | "retentionWarningDay13SentAt" }[] = [
      { day: 0, field: "retentionWarningDay0SentAt" },
      { day: 7, field: "retentionWarningDay7SentAt" },
      { day: Math.max(retentionDays - 1, 0), field: "retentionWarningDay13SentAt" },
    ];

    let sentCount = 0;
    const pausedStores = await this.prismaAdmin.store.findMany({
      where: { status: "orders_paused", terminalPausedAt: { not: null } },
      include: { seller: { include: { user: { select: { email: true } } } } },
    });

    for (const store of pausedStores) {
      const daysSincePaused = Math.floor((now.getTime() - store.terminalPausedAt!.getTime()) / DAY_MS);
      for (const milestone of milestones) {
        if (daysSincePaused < milestone.day) continue;
        if (store[milestone.field]) continue; // already sent this milestone
        const daysRemaining = Math.max(retentionDays - daysSincePaused, 0);
        await this.email.sendDataRetentionWarningEmail(store.seller.user.email, store.name, daysRemaining);
        await this.prismaAdmin.store.update({ where: { id: store.id }, data: { [milestone.field]: now } });
        sentCount += 1;
      }
    }
    return sentCount;
  }

  /**
   * FR-6.41 - race-safe: the transaction re-verifies terminalPausedAt is
   * still set and unchanged from what the outer query saw, as the very
   * first thing it does, before any delete runs. A verified renewal
   * payment (WalletGraceLadderService.restoreAfterPlanFeePayment(), which
   * clears terminalPausedAt) landing at any point up to that check cancels
   * the deletion for that store.
   */
  private async runDeletionSweep(now: Date): Promise<number> {
    const retentionDays = await this.settings.resolve<number>("billing.data_retention_days");
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);

    const candidates = await this.prismaAdmin.store.findMany({
      where: { status: "orders_paused", terminalPausedAt: { not: null, lte: cutoff } },
      select: { id: true, name: true, sellerId: true, terminalPausedAt: true },
    });

    let deleted = 0;
    for (const store of candidates) {
      const didDelete = await this.deleteStoreIfStillEligible(store.id, store.terminalPausedAt!);
      if (didDelete) {
        deleted += 1;
        await this.auditLog.record({
          adminUserId: null,
          action: "billing.store_retention_deleted",
          targetType: "store",
          targetId: store.id,
          beforeValue: { name: store.name, sellerId: store.sellerId, terminalPausedAt: store.terminalPausedAt },
          afterValue: null,
        });
      }
    }
    return deleted;
  }

  private async deleteStoreIfStillEligible(storeId: string, expectedTerminalPausedAt: Date): Promise<boolean> {
    try {
      return await this.prismaAdmin.$transaction(
        async (tx) => {
          const current = await tx.store.findUnique({ where: { id: storeId }, select: { status: true, terminalPausedAt: true } });
          if (!current || current.status !== "orders_paused" || !current.terminalPausedAt) return false;
          if (current.terminalPausedAt.getTime() !== expectedTerminalPausedAt.getTime()) return false;

          await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`);
          for (const statement of STORE_SCOPED_DELETE_STATEMENTS) {
            await tx.$executeRawUnsafe(statement, storeId);
          }
          return true;
        },
        { timeout: 30_000 },
      );
    } catch (err) {
      this.logger.error(`Failed to delete retention-expired store ${storeId} - left for the next sweep.`, err instanceof Error ? err.stack : String(err));
      return false;
    }
  }
}
