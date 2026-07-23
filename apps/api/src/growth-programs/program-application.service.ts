import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ProgramParticipant, ReferralProgramType } from "@prisma/client";
import { randomBytes } from "crypto";
import { AuditLogService } from "../admin/audit-log.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";

function generateReferralCode(): string {
  return randomBytes(6).toString("hex"); // 12 hex chars - short enough to share as a link, long enough to not collide in practice
}

/**
 * SRS §5.33 FR-33.2 - the one shared application/approval/suspension shape
 * every program (Ambassador/Student Referral/Creator) follows. No program
 * has a self-serve join button; a `referralCode` is issued only at
 * approval - an application that was never approved has nothing to give
 * out (so a stray/guessed code can never resolve to an unapproved
 * participant, closing that gap at the data level, not just by convention).
 */
@Injectable()
export class ProgramApplicationService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** FR-33.5 - Ambassador is the one program gated on already holding an eligible paid plan; Student Referral/Creator have no such gate (FR-33.6/33.7's text never mentions one). */
  async apply(sellerId: string, programType: ReferralProgramType): Promise<ProgramParticipant> {
    if (programType === "ambassador") {
      const context = await this.subscriptions.getPlanContext(sellerId);
      const eligible = await this.settings.resolve<boolean>("growth.ambassador_eligible", context);
      if (!eligible) {
        throw new ForbiddenException("Your current plan does not include Ambassador program eligibility.");
      }
    }

    const existing = await this.prismaAdmin.programParticipant.findUnique({
      where: { uniq_program_participant_seller_program: { sellerId, programType } },
    });
    if (existing) {
      throw new BadRequestException("You have already applied to this program.");
    }

    return this.prismaAdmin.programParticipant.create({ data: { sellerId, programType } });
  }

  async listOwn(sellerId: string): Promise<ProgramParticipant[]> {
    return this.prismaAdmin.programParticipant.findMany({ where: { sellerId }, orderBy: { appliedAt: "desc" } });
  }

  /** FR-33.11 - the admin application queue, pending applications only. */
  async listQueue(): Promise<ProgramParticipant[]> {
    return this.prismaAdmin.programParticipant.findMany({ where: { status: "pending" }, orderBy: { appliedAt: "asc" } });
  }

  async approve(adminUserId: string, participantId: string, notes: string | undefined): Promise<ProgramParticipant> {
    const before = await this.requirePending(participantId);
    const referralCode = generateReferralCode();

    const after = await this.prismaAdmin.programParticipant.update({
      where: { id: participantId },
      data: { status: "approved", referralCode, decidedAt: new Date(), decidedByAdminUserId: adminUserId, decisionNotes: notes ?? null },
    });
    await this.auditLog.record({
      adminUserId,
      action: "growth_programs.application_approved",
      targetType: "program_participant",
      targetId: participantId,
      beforeValue: { status: before.status },
      afterValue: { status: "approved", programType: before.programType },
    });
    return after;
  }

  async reject(adminUserId: string, participantId: string, notes: string | undefined): Promise<ProgramParticipant> {
    const before = await this.requirePending(participantId);

    const after = await this.prismaAdmin.programParticipant.update({
      where: { id: participantId },
      data: { status: "rejected", decidedAt: new Date(), decidedByAdminUserId: adminUserId, decisionNotes: notes ?? null },
    });
    await this.auditLog.record({
      adminUserId,
      action: "growth_programs.application_rejected",
      targetType: "program_participant",
      targetId: participantId,
      beforeValue: { status: before.status },
      afterValue: { status: "rejected", programType: before.programType },
    });
    return after;
  }

  /** FR-33.2 - "an admin may also suspend... any approved participant's access, in-flight rewards, or account at any time." */
  async suspend(adminUserId: string, participantId: string, notes: string | undefined): Promise<ProgramParticipant> {
    const before = await this.prismaAdmin.programParticipant.findUnique({ where: { id: participantId } });
    if (!before) throw new NotFoundException("Program participant not found.");
    if (before.status !== "approved") {
      throw new BadRequestException("Only an approved participant can be suspended.");
    }

    const after = await this.prismaAdmin.programParticipant.update({
      where: { id: participantId },
      data: { status: "suspended", decisionNotes: notes ?? before.decisionNotes },
    });
    await this.auditLog.record({
      adminUserId,
      action: "growth_programs.participant_suspended",
      targetType: "program_participant",
      targetId: participantId,
      beforeValue: { status: before.status },
      afterValue: { status: "suspended" },
    });
    return after;
  }

  /** FR-33.2 - "...or terminate any approved participant's access...at any time." From either approved or already-suspended. */
  async terminate(adminUserId: string, participantId: string, notes: string | undefined): Promise<ProgramParticipant> {
    const before = await this.prismaAdmin.programParticipant.findUnique({ where: { id: participantId } });
    if (!before) throw new NotFoundException("Program participant not found.");
    if (before.status !== "approved" && before.status !== "suspended") {
      throw new BadRequestException("Only an approved or suspended participant can be terminated.");
    }

    const after = await this.prismaAdmin.programParticipant.update({
      where: { id: participantId },
      data: { status: "terminated", decisionNotes: notes ?? before.decisionNotes },
    });
    await this.auditLog.record({
      adminUserId,
      action: "growth_programs.participant_terminated",
      targetType: "program_participant",
      targetId: participantId,
      beforeValue: { status: before.status },
      afterValue: { status: "terminated" },
    });
    return after;
  }

  private async requirePending(participantId: string): Promise<ProgramParticipant> {
    const participant = await this.prismaAdmin.programParticipant.findUnique({ where: { id: participantId } });
    if (!participant) throw new NotFoundException("Program participant not found.");
    if (participant.status !== "pending") throw new BadRequestException("This application has already been decided.");
    return participant;
  }
}
