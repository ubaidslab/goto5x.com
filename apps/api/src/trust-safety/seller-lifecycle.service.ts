import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { $Enums } from "@prisma/client";
import { AuditLogService } from "../admin/audit-log.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";

type LifecycleStatus = $Enums.SellerLifecycleStatus;

const LADDER_ORDER: LifecycleStatus[] = ["active", "warned", "restricted", "suspended", "banned"];

/**
 * SRS §5.29/FR-29.4 - the T&S enforcement ladder, built on FR-8.4's seller-
 * lifecycle admin control. FR-8.4 itself (approve/suspend/ban/limit a
 * seller) was specified in the SRS's Admin Control Plane section but never
 * actually built by any prior module - Module 12 depends on it directly
 * (the ladder has nowhere to escalate into otherwise), so its lifecycle-
 * control subset is built here. Deliberately NOT built here (out of
 * Module 12's necessary scope, disclosed): "view any store" read-only
 * admin access, "login as seller" impersonation, and instant single-store
 * force-disable - none of those are prerequisites for the T&S ladder itself,
 * and retrofitting them is left for the Admin Control Plane completion
 * module (see docs/build-plan.md).
 */
@Injectable()
export class SellerLifecycleService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** FR-8.4 "approve" - lifts the FR-30.5 activation gate after an admin reviews a pending_review/blocked seller. */
  async approveActivation(adminUserId: string, sellerId: string) {
    const before = await this.prismaAdmin.seller.findUnique({ where: { id: sellerId } });
    if (!before) throw new NotFoundException("Seller not found.");
    const after = await this.prismaAdmin.seller.update({
      where: { id: sellerId },
      data: { activationStatus: "auto_approved" },
    });
    await this.auditLog.record({
      adminUserId,
      action: "seller.activation.approve",
      targetType: "seller",
      targetId: sellerId,
      beforeValue: { activationStatus: before.activationStatus },
      afterValue: { activationStatus: "auto_approved" },
    });
    return after;
  }

  /** FR-29.4 - warning/restriction/suspension/ban, in either direction (escalate or lift), always an explicit admin action. */
  async setLifecycleStatus(adminUserId: string, sellerId: string, status: LifecycleStatus, reason: string) {
    if (!LADDER_ORDER.includes(status)) {
      throw new BadRequestException(`Unknown lifecycle status: ${status}`);
    }
    const before = await this.prismaAdmin.seller.findUnique({ where: { id: sellerId } });
    if (!before) throw new NotFoundException("Seller not found.");

    const after = await this.prismaAdmin.seller.update({
      where: { id: sellerId },
      data: { lifecycleStatus: status },
    });
    await this.auditLog.record({
      adminUserId,
      action: "seller.lifecycle.set_status",
      targetType: "seller",
      targetId: sellerId,
      beforeValue: { lifecycleStatus: before.lifecycleStatus },
      afterValue: { lifecycleStatus: status, reason },
    });
    return after;
  }

  async listBySellerLifecycleStatus(status: LifecycleStatus) {
    return this.prismaAdmin.seller.findMany({ where: { lifecycleStatus: status }, orderBy: { createdAt: "desc" } });
  }
}
