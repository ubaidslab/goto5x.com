import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { RiskScoreService } from "./risk-score.service";
import { resolveActivePlanPrice } from "../plans/plan-pricing.util";
import { round2 } from "../orders/money.util";

type MatchedSignal = "phone" | "device_cluster" | "cnic" | "payment_instrument";

/**
 * SRS §5.6k/FR-6.48 (Module 71) - first-cycle discount abuse prevention.
 * Reuses existing T&S signals rather than duplicating them:
 * `RiskScoreService.hasDeviceIpSignal`/`matchesSuspendedSellerCluster` for
 * the device/IP cluster signal, `Seller.cnicHash`/`User.phone` directly.
 *
 * Three trigger points (see each method below); `SubscriptionAbuseFlag` is
 * the durable, append-only record FR-6.48 requires ("the flag is durable,
 * not one-time") - `firstCyclePriceFor` in WalletService checks for ANY
 * row for a seller before ever granting the discount, so once flagged, a
 * seller's discount is denied permanently, not just for the triggering
 * cycle.
 */
@Injectable()
export class SubscriptionAbuseService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly riskScore: RiskScoreService,
  ) {}

  /** Whether this seller's first-cycle discount has been permanently denied by a confirmed match. */
  async isDiscountDenied(sellerId: string): Promise<boolean> {
    const flag = await this.prismaAdmin.subscriptionAbuseFlag.findFirst({ where: { sellerId } });
    return flag !== null;
  }

  /**
   * Trigger 1 (at signup) - cnicHash isn't collected until activation
   * (FR-30.1), but phone and the device/IP cluster are. A match denies the
   * discount immediately and flags for review; no match provisionally
   * grants it. Nothing has been paid yet, so there is never a chargeback
   * at this trigger.
   */
  async checkAtSignup(sellerId: string, ip: string | undefined, deviceFingerprint: string | undefined): Promise<void> {
    const signals = await this.matchPhoneAndCluster(sellerId, ip, deviceFingerprint);
    if (signals.length > 0) await this.recordFlags(sellerId, signals);
  }

  /**
   * Trigger 2 (SellerIdentityService.setCnic, after it succeeds) - re-runs
   * the phone/device-cluster signals. cnicHash itself is not re-checked as
   * its own signal here: FR-30.1 already enforces a hard, DB-level unique
   * constraint on cnicHash (SellerIdentityService.setCnic throws
   * ConflictException on a duplicate before any row is ever saved), so by
   * the time this runs the just-saved hash is, by construction, already
   * unique - there is nothing left for a post-save comparison to find
   * (disclosed decision: kept the signal name in the type for fidelity to
   * the FR's literal signal list, but its check is a structural no-op
   * today, same reasoning trust-safety-monitors.service.ts already applies
   * elsewhere). A retroactive match here posts the one-time chargeback if
   * this is the seller's first-ever flag and they already used the
   * discount.
   */
  async checkOnCnicSet(sellerId: string): Promise<void> {
    const signals = await this.matchPhoneAndCluster(sellerId, undefined, undefined);
    if (signals.length > 0) await this.recordFlagsAndMaybeChargeback(sellerId, signals);
  }

  /**
   * Trigger 3 (payment-instructions save) - the payment-instrument hash
   * conflict path specifically, since FR-30.3 already hard-blocks a
   * literal duplicate save (PaymentInstrumentIdentityService.
   * translateFingerprintConflict) - a successful save's hash can never
   * match another seller's by definition, but the CONFLICT ITSELF (an
   * attempt to save an already-registered bank/JazzCash/Easypaisa number)
   * is exactly the "strongest repeat-identity signal" FR-6.48 describes.
   * Called from PaymentInstructionsService's catch block, before it
   * re-throws the same user-facing conflict error as before - this method
   * only adds the flag/chargeback side effect, never changes what the
   * seller sees.
   */
  async checkOnPaymentInstrumentConflict(sellerId: string): Promise<void> {
    await this.recordFlagsAndMaybeChargeback(sellerId, ["payment_instrument"]);
  }

  private async matchPhoneAndCluster(sellerId: string, ip: string | undefined, deviceFingerprint: string | undefined): Promise<MatchedSignal[]> {
    const signals: MatchedSignal[] = [];
    const seller = await this.prismaAdmin.seller.findUniqueOrThrow({ where: { id: sellerId }, include: { user: true } });

    if (seller.user.phone) {
      const phoneMatch = await this.prismaAdmin.user.findFirst({
        where: { phone: seller.user.phone, id: { not: seller.userId } },
      });
      if (phoneMatch) signals.push("phone");
    }

    const deviceIpFlagged = await this.riskScore.hasDeviceIpSignal(sellerId, ip, deviceFingerprint);
    const suspendedClusterMatch = await this.riskScore.matchesSuspendedSellerCluster(sellerId, ip, deviceFingerprint);
    if (deviceIpFlagged || suspendedClusterMatch) signals.push("device_cluster");

    return signals;
  }

  private async recordFlags(sellerId: string, signals: MatchedSignal[]): Promise<void> {
    for (const matchedSignal of signals) {
      await this.prismaAdmin.subscriptionAbuseFlag.create({ data: { sellerId, matchedSignal } });
    }
  }

  private async recordFlagsAndMaybeChargeback(sellerId: string, signals: MatchedSignal[]): Promise<void> {
    const wasAlreadyFlagged = await this.isDiscountDenied(sellerId);
    await this.recordFlags(sellerId, signals);
    // Only the FIRST-ever flag for a seller can trigger a chargeback - a
    // later, additional flag on an already-flagged seller adds to the
    // durable record (still useful review context) but must never double-
    // charge for the same original discount.
    if (!wasAlreadyFlagged) await this.chargebackIfAlreadyDiscounted(sellerId);
  }

  /** Posts a one-time wallet_plan_fee_debit for the discount amount if this seller already completed a discounted first-cycle payment. */
  private async chargebackIfAlreadyDiscounted(sellerId: string): Promise<void> {
    const discountedPayment = await this.prismaAdmin.walletTopUpRequest.findFirst({
      where: { ownerType: "seller", ownerId: sellerId, planFeePortion: { not: null }, status: "verified" },
      orderBy: { verifiedAt: "asc" },
    });
    if (!discountedPayment) return; // hasn't paid yet - the discount is simply never offered going forward

    const subscription = await this.prismaAdmin.subscription.findUniqueOrThrow({ where: { sellerId }, include: { plan: true } });
    const discountPercent = await this.settings.resolve<number>("billing.first_cycle_discount_percent");
    const fullPrice = resolveActivePlanPrice(subscription.plan);
    const discountAmount = round2(fullPrice * (discountPercent / 100));
    if (discountAmount <= 0) return;

    await this.prismaAdmin.ledgerEntry.create({
      data: { sellerId, type: "wallet_plan_fee_debit", amount: discountAmount, currency: discountedPayment.currency },
    });
  }
}
