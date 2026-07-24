import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { StoreHealthScoreService } from "../store-health/store-health-score.service";

export interface EligibilityCriterion {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface EligibilityResult {
  criteria: EligibilityCriterion[];
  allPass: boolean;
}

function monthsBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
}

/**
 * SRS §5.35, FR-35.1. The SAME function backs both the seller-facing live
 * eligibility portal (read-only, informational) and `apply()`'s server-side
 * gate (§14.35's binding "cannot be bypassed via direct API call") - there
 * is only one place this logic is written, so a portal-only check that
 * silently drifts from the enforcement gate is structurally impossible.
 */
@Injectable()
export class VerificationEligibilityService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly storeHealth: StoreHealthScoreService,
  ) {}

  async check(storeId: string, now = new Date()): Promise<EligibilityResult> {
    const [minHealthScore, minTenureMonths, minConfirmedSales] = await Promise.all([
      this.settings.resolve<number>("verification.min_health_score"),
      this.settings.resolve<number>("verification.min_tenure_months"),
      this.settings.resolve<number>("verification.min_confirmed_sales"),
    ]);

    const store = await this.prismaAdmin.store.findUniqueOrThrow({
      where: { id: storeId },
      include: { seller: true },
    });

    // "The same custom domain" is simply the most recently attached Domain
    // row - attaching a different one creates a new row with its own fresh
    // verifiedAt, correctly resetting this clock with no extra field needed
    // (FR-35.1's own stated reasoning).
    const currentDomain = await this.prismaAdmin.domain.findFirst({
      where: { storeId },
      orderBy: { createdAt: "desc" },
    });
    const tenureMonths = currentDomain?.verificationStatus === "verified" && currentDomain.verifiedAt
      ? monthsBetween(currentDomain.verifiedAt, now)
      : 0;
    const tenurePass = tenureMonths >= minTenureMonths;

    const latestHealth = await this.storeHealth.latestForStore(storeId);
    const healthScore = latestHealth?.score ?? 0;
    const healthPass = healthScore >= minHealthScore;

    const cnicPass = Boolean(store.seller.cnicEncrypted);

    const flagsPass = store.seller.lifecycleStatus === "active";

    const confirmedSalesCount = await this.prismaAdmin.order.count({
      where: { storeId, status: { in: ["confirmed", "shipped", "delivered", "completed"] } },
    });
    const salesPass = confirmedSalesCount >= minConfirmedSales;

    const criteria: EligibilityCriterion[] = [
      {
        key: "tenure",
        label: "6+ months on the same custom domain",
        pass: tenurePass,
        detail: currentDomain
          ? `Verified for ${tenureMonths.toFixed(1)} of the required ${minTenureMonths} months on ${currentDomain.domainName}.`
          : "No verified custom domain attached yet.",
      },
      {
        key: "health_score",
        label: "Store Health Score",
        pass: healthPass,
        detail: `Current score: ${healthScore}. Required: ${minHealthScore}+.`,
      },
      {
        key: "cnic_verified",
        label: "CNIC verified",
        pass: cnicPass,
        detail: cnicPass ? "Your CNIC is on file." : "Complete CNIC verification in your account settings.",
      },
      {
        key: "no_unresolved_flags",
        label: "Zero unresolved Trust & Safety flags",
        pass: flagsPass,
        detail: flagsPass ? "No active Trust & Safety restriction." : "Your account currently has an active Trust & Safety restriction.",
      },
      {
        key: "min_confirmed_sales",
        label: "Minimum confirmed sales",
        pass: salesPass,
        detail: `${confirmedSalesCount} of the required ${minConfirmedSales} confirmed orders.`,
      },
    ];

    return { criteria, allPass: criteria.every((c) => c.pass) };
  }
}
