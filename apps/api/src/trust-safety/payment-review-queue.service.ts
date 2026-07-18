import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../admin/audit-log.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";

/**
 * SRS §5.30/FR-30.2 - the admin review-queue for a name-consistency
 * mismatch, mirroring ModerationService's listQueue()/approve()/reject()
 * triple exactly (Module 6's established shape for "a flagged item awaits
 * a human decision, never auto-punished").
 */
@Injectable()
export class PaymentReviewQueueService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listQueue() {
    const instructions = await this.prismaAdmin.storePaymentInstructions.findMany({
      where: { nameConsistencyStatus: "pending" },
      orderBy: { updatedAt: "asc" },
    });
    const stores = await this.prismaAdmin.store.findMany({
      where: { id: { in: instructions.map((i) => i.storeId) } },
      select: { id: true, name: true, sellerId: true },
    });
    const storeById = new Map(stores.map((s) => [s.id, s]));
    return instructions.map((instruction) => ({
      ...instruction,
      store: storeById.get(instruction.storeId) ?? null,
    }));
  }

  async approve(adminUserId: string, storeId: string, notes: string | undefined) {
    return this.decide(adminUserId, storeId, "approved", notes);
  }

  async reject(adminUserId: string, storeId: string, notes: string | undefined) {
    return this.decide(adminUserId, storeId, "rejected", notes);
  }

  private async decide(adminUserId: string, storeId: string, status: "approved" | "rejected", notes: string | undefined) {
    const before = await this.prismaAdmin.storePaymentInstructions.findUnique({ where: { storeId } });
    if (!before) throw new NotFoundException("Store payment instructions not found.");
    if (before.nameConsistencyStatus !== "pending") {
      throw new BadRequestException("These payment instructions are not in the review queue.");
    }
    const after = await this.prismaAdmin.storePaymentInstructions.update({
      where: { storeId },
      data: { nameConsistencyStatus: status },
    });
    await this.auditLog.record({
      adminUserId,
      action: `payment_instrument_review.${status === "approved" ? "approve" : "reject"}`,
      targetType: "store_payment_instructions",
      targetId: storeId,
      beforeValue: { nameConsistencyStatus: before.nameConsistencyStatus },
      afterValue: { nameConsistencyStatus: status, notes: notes ?? null },
    });
    return after;
  }
}
