import { Injectable, Logger } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { EventsService } from "../events/events.service";
import { round2 } from "../orders/money.util";
import { WalletService } from "./wallet.service";

/**
 * Module 47 (new FR-6.29). Recomputes every seller's TRUE ledger balance
 * from scratch (WalletService.computeLedgerBalance() - the same
 * re-aggregation getBalance() itself used to do, before this module) and
 * compares it against the maintained WalletBalance cache. A mismatch is
 * NEVER auto-corrected here - the founder's explicit requirement is "flag
 * drift loudly, admin-visible, not silently correct it": a WalletReconciliationDrift
 * row is written (append-only, one per detected mismatch) and a
 * `wallet.reconciliation_drift_detected` platform event fires, but the
 * cached column itself is left exactly as it was until a human reviews and
 * fixes it.
 */
@Injectable()
export class WalletReconciliationService {
  private readonly logger = new Logger(WalletReconciliationService.name);

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly wallet: WalletService,
    private readonly events: EventsService,
  ) {}

  async runSweep(): Promise<{ checked: number; driftsDetected: number }> {
    const sellers = await this.prismaAdmin.seller.findMany({ select: { id: true } });

    let checked = 0;
    let driftsDetected = 0;

    for (const seller of sellers) {
      checked += 1;
      const [cachedBalance, ledgerBalance] = await Promise.all([
        this.wallet.getBalance(seller.id),
        this.wallet.computeLedgerBalance(seller.id),
      ]);

      const driftAmount = round2(cachedBalance - ledgerBalance);
      if (driftAmount === 0) continue;

      driftsDetected += 1;
      await this.prismaAdmin.walletReconciliationDrift.create({
        data: { sellerId: seller.id, cachedBalance, ledgerBalance, driftAmount },
      });
      this.logger.error(
        `Wallet balance drift detected for seller ${seller.id}: cached=${cachedBalance}, ledger=${ledgerBalance}, drift=${driftAmount}`,
      );
      await this.events.emit({
        eventType: "wallet.reconciliation_drift_detected",
        actorType: "system",
        entityType: "seller",
        entityId: seller.id,
        metadata: { cachedBalance, ledgerBalance, driftAmount },
      });
    }

    return { checked, driftsDetected };
  }
}
