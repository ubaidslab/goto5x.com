import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { round2 } from "../orders/money.util";
import { WalletService } from "./wallet.service";

/**
 * SRS §5.33 FR-33.4/FR-33.9 - lives in BillingModule (not GrowthProgramsModule)
 * specifically to avoid a circular module dependency: this service is
 * called from PlanFeeDebitService (BillingModule), and reads the new
 * `referral_attributions`/`program_participants` tables directly via
 * PrismaAdminService - a plain Prisma model read needs no cross-module DI,
 * so BillingModule never has to import GrowthProgramsModule (which itself
 * imports BillingModule, for WalletService, in the withdrawal flow).
 *
 * FR-33.4 (binding) - Module 73 (v0.38) collapsed this back to exactly ONE
 * call site: AdminWalletController.verify()'s plan-fee-payment branch,
 * for every real paid plan-fee amount (first cycle AND every renewal
 * after it - PlanFeeDebitService no longer debits anything, so it no
 * longer has a call site here either). Never called for team-seat/
 * device-slot debits or wallet top-ups - those are not "the referred
 * seller's own plan-subscription amount," so referral commission must
 * never accrue from them.
 */
@Injectable()
export class ProgramCommissionService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * `isRenewal` (Module 78, FR-33.5) - already computed by the sole caller
   * (AdminWalletController.verify(), from WalletService.verifyTopUp()'s own
   * return value) - distinguishes the referred seller's first/initial
   * plan-fee payment from a later renewal, which Student Referral's new
   * flat-per-renewal model needs and the old percent-of-every-payment
   * model (still used by Ambassador/Creator) never did.
   */
  async accrueReferralCommissionIfApplicable(
    referredSellerId: string,
    planFeeAmount: number,
    currency: string,
    isRenewal: boolean,
  ): Promise<void> {
    const attribution = await this.prismaAdmin.referralAttribution.findUnique({ where: { referredSellerId } });
    if (!attribution) return;
    if (attribution.commissionWindowEndsAt < new Date()) return; // window closed permanently for this attribution (ambassador/creator - FR-33.5/33.6 pre-Module-78 numbering)

    const participant = await this.prismaAdmin.programParticipant.findUniqueOrThrow({ where: { id: attribution.participantId } });
    if (participant.status !== "approved") return; // suspended/terminated participants never accrue NEW commission

    if (attribution.programType === "student_referral") {
      await this.accrueStudentReferralCommission(attribution.id, participant.sellerId, attribution.renewalPayoutCount, isRenewal, currency);
      return;
    }
    if (attribution.programType === "ambassador") {
      await this.accrueAmbassadorCommission(attribution.id, participant.sellerId, referredSellerId, attribution.commissionMonthsPaid, isRenewal, currency);
      return;
    }

    // Only "creator" ever reaches here now - Module 78/79 moved
    // student_referral/ambassador onto their own dedicated flat-rate
    // branches above.
    const ratePercent = await this.settings.resolve<number>("growth.student_creator_commission_percent");
    const amount = round2((planFeeAmount * ratePercent) / 100);
    if (amount <= 0) return;

    await this.prismaAdmin.$transaction((tx) =>
      this.wallet.postLedgerEntry(tx, { sellerId: participant.sellerId, type: "program_commission_credit", amount, currency }),
    );
  }

  /**
   * FR-33.5 (Module 78) - "Commerce Students Support": Rs 345 (Settings-
   * configurable) per renewal, up to 2 renewals (also configurable), never
   * the referred seller's first/initial payment. Increments
   * renewalPayoutCount in the same transaction as the ledger post so the
   * count and the money it gates always move together.
   */
  private async accrueStudentReferralCommission(
    attributionId: string,
    referringSellerId: string,
    renewalPayoutCountSoFar: number,
    isRenewal: boolean,
    currency: string,
  ): Promise<void> {
    if (!isRenewal) return;
    const maxPayouts = await this.settings.resolve<number>("growth.student_referral_max_renewal_payouts");
    if (renewalPayoutCountSoFar >= maxPayouts) return;

    const amount = await this.settings.resolve<number>("growth.student_referral_flat_commission_pkr");
    if (amount <= 0) return;

    await this.prismaAdmin.$transaction(async (tx) => {
      await this.wallet.postLedgerEntry(tx, { sellerId: referringSellerId, type: "program_commission_credit", amount, currency });
      await tx.referralAttribution.update({
        where: { id: attributionId },
        data: { renewalPayoutCount: { increment: 1 } },
      });
    });
  }

  /**
   * FR-33.6 pre-Module-78-numbering (Module 79) - "Ambassador Program
   * repricing": Rs 499 (Settings-configurable) per RENEWED MONTH of the
   * referred seller's plan fee, never their first/initial payment, up to
   * 3 total months (also configurable), pro-rated - a single renewal
   * payment can cover 1/6/12 months depending on the referred seller's
   * billing cycle, and only pays for however many of those months still
   * fit under the remaining cap.
   */
  private async accrueAmbassadorCommission(
    attributionId: string,
    referringSellerId: string,
    referredSellerId: string,
    commissionMonthsPaidSoFar: number,
    isRenewal: boolean,
    currency: string,
  ): Promise<void> {
    if (!isRenewal) return;
    const maxMonths = await this.settings.resolve<number>("growth.ambassador_max_commission_months");
    const monthsRemaining = maxMonths - commissionMonthsPaidSoFar;
    if (monthsRemaining <= 0) return;

    const subscription = await this.prismaAdmin.subscription.findUnique({ where: { sellerId: referredSellerId } });
    if (!subscription) return;
    const monthsThisPayment = monthsForBillingInterval(subscription.billingInterval);
    const monthsToPay = Math.min(monthsThisPayment, monthsRemaining);
    if (monthsToPay <= 0) return;

    const perMonth = await this.settings.resolve<number>("growth.ambassador_flat_commission_per_month_pkr");
    const amount = round2(perMonth * monthsToPay);
    if (amount <= 0) return;

    await this.prismaAdmin.$transaction(async (tx) => {
      await this.wallet.postLedgerEntry(tx, { sellerId: referringSellerId, type: "program_commission_credit", amount, currency });
      await tx.referralAttribution.update({
        where: { id: attributionId },
        data: { commissionMonthsPaid: { increment: monthsToPay } },
      });
    });
  }

  /**
   * Module 79 - whether this seller's plan fee is currently exempt via
   * their own approved Ambassador participant's granted free store slots
   * (never their referral commission - a completely separate mechanic).
   * Read by PlanFeeDebitService (same BillingModule, no cross-module DI
   * needed - see this class's own header comment for why that matters).
   */
  async isExemptFromPlanFeeViaAmbassadorSlots(sellerId: string): Promise<boolean> {
    const participant = await this.prismaAdmin.programParticipant.findUnique({
      where: { uniq_program_participant_seller_program: { sellerId, programType: "ambassador" } },
    });
    if (!participant || participant.status !== "approved") return false;
    if (!participant.freeStoreSlotsGranted || participant.freeStoreSlotsGranted <= 0) return false;

    const storeCount = await this.prismaAdmin.store.count({ where: { sellerId } });
    return storeCount <= participant.freeStoreSlotsGranted;
  }
}

function monthsForBillingInterval(interval: string): number {
  if (interval === "yearly") return 12;
  if (interval === "six_month") return 6;
  return 1; // monthly
}
