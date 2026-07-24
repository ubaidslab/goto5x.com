import { Injectable } from "@nestjs/common";
import { AuditLogService } from "../admin/audit-log.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { StoreHealthScoreService } from "../store-health/store-health-score.service";

/**
 * SRS §5.35, FR-35.5/35.6 - the scheduled sweep. A health-score drop and a
 * T&S enforcement action are each checked independently (either alone is
 * sufficient to flag) - both are system-triggered, so `adminUserId: null`
 * on the audit-log entry (same "system/automated action" convention as
 * every other sweep-driven mutation in this SRS).
 */
@Injectable()
export class VerificationReReviewService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly auditLog: AuditLogService,
    private readonly storeHealth: StoreHealthScoreService,
  ) {}

  async runSweep(now = new Date()): Promise<{ flagged: number; expired: number }> {
    const minHealthScore = await this.settings.resolve<number>("verification.min_health_score");
    const annualReverificationEnabled = await this.settings.resolve<boolean>("verification.annual_reverification_enabled");

    const verifiedStores = await this.prismaAdmin.store.findMany({
      where: { verifiedStatus: "verified" },
      include: { seller: { select: { lifecycleStatus: true } } },
    });

    let flagged = 0;
    let expired = 0;

    for (const store of verifiedStores) {
      // Annual expiry takes priority over a drift flag - an expired store
      // needs a fresh application, not a re-review resolution.
      if (annualReverificationEnabled && store.verifiedExpiresAt && store.verifiedExpiresAt <= now) {
        await this.prismaAdmin.store.update({
          where: { id: store.id },
          data: { verifiedStatus: "expired" },
        });
        await this.auditLog.record({
          adminUserId: null,
          action: "verification.store.expire",
          targetType: "store",
          targetId: store.id,
          beforeValue: { verifiedStatus: "verified" },
          afterValue: { verifiedStatus: "expired", reason: "annual_reverification_due" },
        });
        expired += 1;
        continue;
      }

      const latestHealth = await this.storeHealth.latestForStore(store.id);
      const healthDropped = (latestHealth?.score ?? 100) < minHealthScore;
      const tsEnforcement = store.seller.lifecycleStatus !== "active";

      if (healthDropped || tsEnforcement) {
        const reason = [healthDropped ? "health_score_below_threshold" : null, tsEnforcement ? "trust_safety_enforcement" : null]
          .filter(Boolean)
          .join(",");
        await this.prismaAdmin.store.update({
          where: { id: store.id },
          data: { verifiedStatus: "pending_re_review", reReviewFlaggedAt: now, reReviewReason: reason },
        });
        await this.auditLog.record({
          adminUserId: null,
          action: "verification.store.auto_flag_re_review",
          targetType: "store",
          targetId: store.id,
          beforeValue: { verifiedStatus: "verified" },
          afterValue: { verifiedStatus: "pending_re_review", reason },
        });
        flagged += 1;
      }
    }

    return { flagged, expired };
  }
}
