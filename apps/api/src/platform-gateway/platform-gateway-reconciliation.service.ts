import { Injectable, Logger } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { PlatformGatewayService } from "./platform-gateway.service";

/**
 * Financial-safety hardening (founder-directed, post-build audit) - the
 * weekly reconciliation job for Platform Merchant Connection. Re-polls
 * every recently auto-verified reference against the gateway's own
 * transaction-status API to confirm it is STILL confirmed (catches a
 * later reversal/chargeback, or a false-positive the original poll
 * couldn't have known about) - this is the poll-based equivalent of
 * reconciling against a settlement report, since none of the 4 adapters
 * expose a "list all transactions" call to compare against wholesale.
 *
 * Only the recent window is re-checked (not every reference ever
 * consumed) - an old, already-settled transaction re-polled forever would
 * be pure waste and eventually hammer the gateway's API for no benefit.
 * A reference that's already been flagged (any reason, still unresolved)
 * is skipped - no point re-flagging the same thing every week while an
 * admin hasn't reviewed it yet.
 */
@Injectable()
export class PlatformGatewayReconciliationService {
  private readonly logger = new Logger(PlatformGatewayReconciliationService.name);

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly platformGateway: PlatformGatewayService,
  ) {}

  async runSweep(windowDays = 30): Promise<{ checked: number }> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const recent = await this.prismaAdmin.platformGatewayConsumedReference.findMany({
      where: { consumedAt: { gte: since } },
    });

    let checked = 0;
    for (const consumed of recent) {
      const alreadyFlagged = await this.prismaAdmin.platformGatewayFlaggedVerification.findFirst({
        where: { orderRef: consumed.orderRef, resolved: false },
      });
      if (alreadyFlagged) continue;

      checked += 1;
      await this.platformGateway.reconciliationRecheck(consumed);
    }

    this.logger.log(`Platform gateway reconciliation sweep: re-checked ${checked} of ${recent.length} references from the last ${windowDays} day(s).`);
    return { checked };
  }
}
