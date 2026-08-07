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
 * FR-33.4 (binding) - called from EXACTLY ONE place:
 * PlanFeeDebitService.debitDuePlanFees()'s successful-debit branch. Never
 * called for team-seat/device-slot debits or wallet top-ups - those are
 * not "the referred seller's own plan-subscription amount," so referral
 * commission must never accrue from them.
 */
@Injectable()
export class ProgramCommissionService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly wallet: WalletService,
  ) {}

  async accrueReferralCommissionIfApplicable(referredSellerId: string, planFeeAmount: number, currency: string): Promise<void> {
    const attribution = await this.prismaAdmin.referralAttribution.findUnique({ where: { referredSellerId } });
    if (!attribution) return;
    if (attribution.commissionWindowEndsAt < new Date()) return; // window closed permanently for this attribution (FR-33.5/33.6/33.7)

    const participant = await this.prismaAdmin.programParticipant.findUniqueOrThrow({ where: { id: attribution.participantId } });
    if (participant.status !== "approved") return; // suspended/terminated participants never accrue NEW commission

    const ratePercent = await this.commissionRatePercentFor(attribution.programType);
    const amount = round2((planFeeAmount * ratePercent) / 100);
    if (amount <= 0) return;

    await this.prismaAdmin.$transaction((tx) =>
      this.wallet.postLedgerEntry(tx, { sellerId: participant.sellerId, type: "program_commission_credit", amount, currency }),
    );
  }

  private async commissionRatePercentFor(programType: ReferralProgramType): Promise<number> {
    if (programType === "ambassador") {
      return this.settings.resolve<number>("growth.ambassador_commission_percent");
    }
    return this.settings.resolve<number>("growth.student_creator_commission_percent");
  }
}
