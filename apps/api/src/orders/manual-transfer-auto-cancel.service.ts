import { Injectable, Logger } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { OrdersService } from "./orders.service";

/**
 * B3b (founder decision, 2026-10-11) - "unpaid advance orders auto-cancel
 * after a seller-set window (default 48 hours) through that same cancel +
 * stock-restore path." No gateway is live today (B3a/D86), so every
 * `advance` order reaching checkout today got there via Manual Transfer
 * specifically (CheckoutService's advance-model gate) - a timeout-based
 * backstop for a buyer who never transfers, or a seller who never checks,
 * stays correct even once a gateway-charged advance exists (a webhook-
 * confirmed charge would never sit `pending` long enough to hit this).
 *
 * Scans via `prismaAdmin` across every store (same "scan admin-wide, act
 * tenant-scoped per matching row" shape as MissingTrackingAlertService),
 * but the actual cancellation goes through OrdersService.changeStatus() -
 * the exact same guarded-update + restoreStockForOrder() path Founder
 * item 3 built and proved safe against double-cancellation, not a
 * reimplementation. `orders.advance_manual_transfer_timeout_hours` is a
 * `store`-scoped setting, so the cutoff is resolved per store, not once
 * globally.
 */
@Injectable()
export class ManualTransferAutoCancelService {
  private readonly logger = new Logger(ManualTransferAutoCancelService.name);

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly orders: OrdersService,
  ) {}

  async runSweep(now = new Date()): Promise<{ checked: number; cancelled: number }> {
    const candidates = await this.prismaAdmin.order.findMany({
      where: { paymentModel: "advance", status: "pending" },
      include: { store: { include: { seller: true } } },
    });

    const timeoutHoursByStore = new Map<string, number>();
    let cancelled = 0;
    for (const order of candidates) {
      let timeoutHours = timeoutHoursByStore.get(order.storeId);
      if (timeoutHours === undefined) {
        timeoutHours = await this.settings.resolve<number>("orders.advance_manual_transfer_timeout_hours", {
          storeId: order.storeId,
        });
        timeoutHoursByStore.set(order.storeId, timeoutHours);
      }
      const cutoff = new Date(now.getTime() - timeoutHours * 60 * 60 * 1000);
      if (order.placedAt > cutoff) continue;

      try {
        // Founder item 3's own actor-attribution function requires a real
        // User.id for the StockAdjustment audit row this writes; there's
        // no human actor for an automated sweep, so this attributes the
        // restore to the store's own owning seller - "this seller's own
        // configured timeout fired," a real, defensible identity rather
        // than a fabricated system-user row this schema has no slot for.
        await this.orders.changeStatus(order.store.sellerId, order.storeId, order.id, order.store.seller.userId, {
          status: "cancelled",
        });
        cancelled += 1;
      } catch (err) {
        this.logger.error(
          `Failed to auto-cancel stale unpaid advance order ${order.id} - will retry on the next sweep.`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    return { checked: candidates.length, cancelled };
  }
}
