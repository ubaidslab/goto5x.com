import { Injectable } from "@nestjs/common";
import { ReferralProgramType } from "@prisma/client";
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

    const ratePercent = await this.commissionRatePercentFor(attribution.programType);
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

  private async commissionRatePercentFor(programType: ReferralProgramType): Promise<number> {
    if (programType === "ambassador") {
      return this.settings.resolve<number>("growth.ambassador_commission_percent");
    }
    return this.settings.resolve<number>("growth.student_creator_commission_percent");
  }
}
