import { Injectable, Logger } from "@nestjs/common";
import { ReferralProgramType } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";

/**
 * SRS §5.33 FR-33.1/FR-33.3 - resolves a just-captured
 * `Subscription.referralSource` (shape-validated only at signup, per
 * `resolveReferralSource()`) against a real, approved program
 * participant's referral code, and creates the ONE permanent
 * `ReferralAttribution` row for that referred seller if a match is found.
 *
 * Tolerates every non-match case without ever throwing (this runs
 * immediately after signup - it must never fail a signup that already
 * succeeded): a null/absent referralSource, a code that matches no
 * participant at all, or a code belonging to a participant who isn't
 * `approved` (e.g. a stale code copied before rejection/suspension - only
 * an approved participant's code was ever real). FR-33.3's single-source
 * guarantee is enforced by `referral_attributions`' own @@unique on
 * `referredSellerId` at the database level, not by this service's logic -
 * `tryAttribute` is naturally called at most once per seller (signup is
 * one-time), so no separate check-before-create race exists in practice.
 */
@Injectable()
export class ReferralAttributionService {
  private readonly logger = new Logger(ReferralAttributionService.name);

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
  ) {}

  async tryAttribute(referredSellerId: string, referralSource: string | null): Promise<void> {
    if (!referralSource) return;

    try {
      const participant = await this.prismaAdmin.programParticipant.findUnique({
        where: { referralCode: referralSource },
      });
      if (!participant || participant.status !== "approved") return;
      // A seller cannot refer themselves into their own attribution.
      if (participant.sellerId === referredSellerId) return;

      const windowMonths = await this.commissionWindowMonthsFor(participant.programType);
      const commissionWindowEndsAt = addMonths(new Date(), windowMonths);

      await this.prismaAdmin.referralAttribution.create({
        data: {
          referredSellerId,
          participantId: participant.id,
          programType: participant.programType,
          commissionWindowEndsAt,
        },
      });
    } catch (err) {
      // Same "a seller's legitimate action must never fail because of
      // bookkeeping" discipline as EventsService.emit() - a stale/invalid
      // code, or a race on the @@unique constraint, must never surface as
      // a signup failure.
      this.logger.error(
        `Failed to resolve referral attribution for seller ${referredSellerId} - signup itself already succeeded.`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async commissionWindowMonthsFor(programType: ReferralProgramType): Promise<number> {
    if (programType === "ambassador") {
      return this.settings.resolve<number>("growth.ambassador_commission_window_months");
    }
    return this.settings.resolve<number>("growth.student_creator_commission_window_months");
  }
}

function addMonths(from: Date, months: number): Date {
  const next = new Date(from);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}
