import { Injectable } from "@nestjs/common";
import { ReferralProgramType } from "@prisma/client";
import { round2 } from "../orders/money.util";
import { PrismaAdminService } from "../prisma/prisma-admin.service";

export interface ProgramReport {
  programType: ReferralProgramType;
  totalApplications: number;
  everApproved: number;
  rejected: number;
  rejectionRatePercent: number;
  referrals: number;
  conversions: number;
  payoutsPaidCount: number;
  payoutsPaidTotal: number;
}

/** FR-33.11 - "a per-program report (referrals, conversions, payouts, rejection rate)." */
@Injectable()
export class ProgramReportService {
  constructor(private readonly prismaAdmin: PrismaAdminService) {}

  async report(programType: ReferralProgramType): Promise<ProgramReport> {
    const participants = await this.prismaAdmin.programParticipant.findMany({ where: { programType } });
    const totalApplications = participants.length;
    const everApproved = participants.filter((p) => p.status === "approved" || p.status === "suspended" || p.status === "terminated").length;
    const rejected = participants.filter((p) => p.status === "rejected").length;
    const decided = everApproved + rejected;
    const rejectionRatePercent = decided > 0 ? round2((rejected / decided) * 100) : 0;

    const participantIds = participants.map((p) => p.id);
    const referrals = participantIds.length > 0 ? await this.prismaAdmin.referralAttribution.count({ where: { participantId: { in: participantIds } } }) : 0;

    let conversions = 0;
    if (participantIds.length > 0) {
      const attributions = await this.prismaAdmin.referralAttribution.findMany({
        where: { participantId: { in: participantIds } },
        select: { referredSellerId: true },
      });
      if (attributions.length > 0) {
        conversions = await this.prismaAdmin.subscription.count({
          where: { sellerId: { in: attributions.map((a) => a.referredSellerId) }, plan: { price: { gt: 0 } } },
        });
      }
    }

    const sellerIds = participants.map((p) => p.sellerId);
    const paidPayouts =
      sellerIds.length > 0
        ? await this.prismaAdmin.payoutRequest.aggregate({
            where: { sellerId: { in: sellerIds }, status: "paid" },
            _sum: { amount: true },
            _count: true,
          })
        : { _sum: { amount: null }, _count: 0 };

    return {
      programType,
      totalApplications,
      everApproved,
      rejected,
      rejectionRatePercent,
      referrals,
      conversions,
      payoutsPaidCount: paidPayouts._count,
      payoutsPaidTotal: Number(paidPayouts._sum.amount ?? 0),
    };
  }
}
