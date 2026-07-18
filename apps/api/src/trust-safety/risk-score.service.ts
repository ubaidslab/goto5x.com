import { Injectable, Logger } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { EventsService } from "../events/events.service";
import { SettingsService } from "../settings-registry/settings.service";
import { similarityScore } from "./string-similarity.util";

export type ActivationOutcome = "auto_approved" | "pending_review" | "blocked";

/**
 * SRS §5.30/FR-30.5 - rule-based, Settings-Registry-weighted risk score with
 * exactly three reachable outcomes. FR-30.6's re-registration check is a
 * hard override layered on top: a device-fingerprint/IP match against a
 * currently-suspended seller forces `blocked` regardless of the weighted
 * total (a distinct, narrower signal than the general score - see this
 * method's inline comment).
 *
 * Uses PrismaAdminService (BYPASSRLS) throughout, not TenantPrismaService -
 * this computation is a system-level trigger (signup, a scored input
 * changing), not a request made inside any single seller's own session, so
 * there is no `app.current_seller_id` to key RLS off of. Reading
 * store-scoped tables (stores, store_payment_instructions) via the
 * RLS-enforced runtime client here would silently return zero rows instead
 * of throwing - caught by an e2e test asserting the resulting score, not
 * assumed correct from the code alone.
 */
@Injectable()
export class RiskScoreService {
  private readonly logger = new Logger(RiskScoreService.name);

  constructor(
    private readonly prisma: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly events: EventsService,
  ) {}

  /** Called right after a fresh seller signup, with the device/IP evidence only available at that moment. */
  async computeAtSignup(sellerId: string, ip: string | undefined, deviceFingerprint: string | undefined): Promise<void> {
    await this.compute(sellerId, ip, deviceFingerprint);
  }

  /** Called whenever a later scored input changes (CNIC saved, payment-instrument name-consistency result) - re-derives from whatever signup evidence already exists for this seller. */
  async recompute(sellerId: string): Promise<void> {
    const seller = await this.prisma.seller.findUniqueOrThrow({ where: { id: sellerId }, select: { userId: true } });
    const lastSignupEvent = await this.prisma.userSecurityEvent.findFirst({
      where: { userId: seller.userId, eventType: "signup" },
      orderBy: { createdAt: "desc" },
    });
    await this.compute(sellerId, lastSignupEvent?.ipAddress ?? undefined, lastSignupEvent?.deviceFingerprint ?? undefined);
  }

  private async compute(sellerId: string, ip: string | undefined, deviceFingerprint: string | undefined): Promise<void> {
    const seller = await this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      include: { user: { select: { emailVerifiedAt: true } } },
    });

    const [
      weightEmailUnverified,
      weightCnicMissing,
      weightNameMismatch,
      weightAccountReuse,
      weightDeviceIpFlag,
      weightBusinessNameSimilarity,
      thresholdManualReview,
      thresholdBlock,
    ] = await Promise.all([
      this.settings.resolve<number>("trust_safety.risk_weight_email_unverified"),
      this.settings.resolve<number>("trust_safety.risk_weight_cnic_missing_or_invalid"),
      this.settings.resolve<number>("trust_safety.risk_weight_name_mismatch"),
      this.settings.resolve<number>("trust_safety.risk_weight_account_reuse"),
      this.settings.resolve<number>("trust_safety.risk_weight_device_ip_flag"),
      this.settings.resolve<number>("trust_safety.risk_weight_business_name_similarity"),
      this.settings.resolve<number>("trust_safety.risk_threshold_manual_review"),
      this.settings.resolve<number>("trust_safety.risk_threshold_block"),
    ]);

    let score = 0;
    if (!seller.user.emailVerifiedAt) score += weightEmailUnverified;
    if (!seller.cnicHash) score += weightCnicMissing;

    const worstNameConsistency = await this.worstNameConsistencyStatus(sellerId);
    if (worstNameConsistency === "pending" || worstNameConsistency === "rejected") {
      score += weightNameMismatch;
    }

    const reuseFlagged = await this.hasFingerprintReuseHistory(sellerId);
    if (reuseFlagged) score += weightAccountReuse;

    const deviceIpFlagged = ip || deviceFingerprint ? await this.hasDeviceIpSignal(sellerId, ip, deviceFingerprint) : false;
    if (deviceIpFlagged) score += weightDeviceIpFlag;

    const businessNameSimilar = await this.hasSimilarBusinessName(sellerId);
    if (businessNameSimilar) score += weightBusinessNameSimilarity;

    // FR-30.6 - a hard override, distinct from the weighted score: re-
    // registration evidence (device fingerprint or IP matching a CURRENTLY
    // suspended seller) forces `blocked` outright, regardless of total.
    const suspendedClusterMatch = ip || deviceFingerprint ? await this.matchesSuspendedSellerCluster(sellerId, ip, deviceFingerprint) : false;

    let outcome: ActivationOutcome;
    if (suspendedClusterMatch) {
      outcome = "blocked";
    } else if (score >= thresholdBlock) {
      outcome = "blocked";
    } else if (score >= thresholdManualReview) {
      outcome = "pending_review";
    } else {
      outcome = "auto_approved";
    }

    await this.prisma.seller.update({
      where: { id: sellerId },
      data: { riskScore: score, activationStatus: outcome },
    });

    // SRS §3.11/FR-26.5, §5.30 FR-30.5 - IDs only, no PII in metadata.
    await this.events.emit({
      eventType: "seller.risk_score_computed",
      actorType: "system",
      entityType: "seller",
      entityId: sellerId,
      metadata: { outcome, suspendedClusterMatch },
    });
  }

  private async worstNameConsistencyStatus(sellerId: string): Promise<"not_required" | "pending" | "approved" | "rejected"> {
    const stores = await this.prisma.store.findMany({ where: { sellerId }, select: { id: true } });
    const instructions = await this.prisma.storePaymentInstructions.findMany({
      where: { storeId: { in: stores.map((s) => s.id) } },
      select: { nameConsistencyStatus: true },
    });
    if (instructions.some((i) => i.nameConsistencyStatus === "rejected")) return "rejected";
    if (instructions.some((i) => i.nameConsistencyStatus === "pending")) return "pending";
    if (instructions.some((i) => i.nameConsistencyStatus === "approved")) return "approved";
    return "not_required";
  }

  /**
   * Whether ANY of this seller's currently-saved payment fingerprints
   * previously failed a uniqueness check against another seller (FR-30.3
   * is already a hard block at save time, so this only ever reflects
   * historical review context, not a live database state to re-check).
   * v1.0 has no separate "reuse attempt log," so this always returns false
   * today - the hard block itself (FR-30.3) is the real enforcement; this
   * hook exists so a future audit-log-backed check can slot in without
   * changing computeScore's shape.
   */
  private async hasFingerprintReuseHistory(_sellerId: string): Promise<boolean> {
    return false;
  }

  private async hasDeviceIpSignal(sellerId: string, ip: string | undefined, deviceFingerprint: string | undefined): Promise<boolean> {
    if (!ip && !deviceFingerprint) return false;
    const seller = await this.prisma.seller.findUniqueOrThrow({ where: { id: sellerId }, select: { userId: true } });
    const match = await this.prisma.userSecurityEvent.findFirst({
      where: {
        eventType: "signup",
        userId: { not: seller.userId },
        OR: [
          ...(ip ? [{ ipAddress: ip }] : []),
          ...(deviceFingerprint ? [{ deviceFingerprint }] : []),
        ],
      },
    });
    return !!match;
  }

  private async hasSimilarBusinessName(sellerId: string): Promise<boolean> {
    const seller = await this.prisma.seller.findUniqueOrThrow({ where: { id: sellerId }, select: { businessName: true } });
    const others = await this.prisma.seller.findMany({
      where: { id: { not: sellerId } },
      select: { businessName: true },
      take: 500, // v1.0 scale guard - a full cross-compare, not a claim of scaling to millions of sellers
    });
    return others.some((o) => similarityScore(seller.businessName, o.businessName) >= 0.9);
  }

  private async matchesSuspendedSellerCluster(sellerId: string, ip: string | undefined, deviceFingerprint: string | undefined): Promise<boolean> {
    if (!ip && !deviceFingerprint) return false;
    const seller = await this.prisma.seller.findUniqueOrThrow({ where: { id: sellerId }, select: { userId: true } });
    const candidateEvents = await this.prisma.userSecurityEvent.findMany({
      where: {
        eventType: "signup",
        userId: { not: seller.userId },
        OR: [
          ...(ip ? [{ ipAddress: ip }] : []),
          ...(deviceFingerprint ? [{ deviceFingerprint }] : []),
        ],
      },
      select: { userId: true },
    });
    if (candidateEvents.length === 0) return false;

    const suspendedMatch = await this.prisma.seller.findFirst({
      where: { userId: { in: candidateEvents.map((e) => e.userId) }, lifecycleStatus: "suspended" },
    });
    return !!suspendedMatch;
  }
}
