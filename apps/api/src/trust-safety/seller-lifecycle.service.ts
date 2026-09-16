import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { $Enums } from "@prisma/client";
import { authenticator } from "otplib";
import { AuditLogService } from "../admin/audit-log.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";

type LifecycleStatus = $Enums.SellerLifecycleStatus;

const LADDER_ORDER: LifecycleStatus[] = ["active", "warned", "restricted", "suspended", "banned"];

// Founder walkthrough finding (Phase 2 item 16) - these two are the ones
// that actually enforce against the storefront (see
// StorefrontService.loadActiveStoreOrThrow), so they're the ones that
// require step-up MFA, not the softer warned/restricted rungs.
const ENFORCEMENT_STATUSES: LifecycleStatus[] = ["suspended", "banned"];

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
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Founder walkthrough finding (Phase 2 item 16) - step-up re-verification
   * for the two enforcement statuses, replacing the generic typed-value
   * confirm dialog every other admin action uses. Reuses the exact same
   * TOTP check as admin login (AdminAuthService.verifyMfaAndIssueSession) -
   * the admin's own already-enrolled secret, just invoked mid-session
   * instead of at login, so no new credential/enrollment flow is needed.
   */
  private async verifyStepUpMfa(adminUserId: string, code: string | undefined, ip: string): Promise<void> {
    const mfaVerifyLimit = await this.settings.resolve<number>("auth.mfa_verify_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`admin-mfa-stepup:${adminUserId}`, mfaVerifyLimit);
    await this.rateLimit.enforcePerHour(`admin-mfa-stepup-ip:${ip}`, mfaVerifyLimit);

    const adminUser = await this.prismaAdmin.adminUser.findUnique({ where: { id: adminUserId }, include: { user: true } });
    if (!adminUser?.user.mfaSecret) {
      throw new BadRequestException("MFA has not been enrolled for this account yet.");
    }
    if (!code || !authenticator.check(code, adminUser.user.mfaSecret)) {
      throw new UnauthorizedException("Invalid MFA code.");
    }
  }

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

  /**
   * FR-29.4 - warning/restriction/suspension/ban, in either direction
   * (escalate or lift), always an explicit admin action. Founder
   * walkthrough finding (Phase 2 item 16): `suspended`/`banned` now
   * require step-up MFA (verifyStepUpMfa above) instead of just the
   * typed-value confirm dialog, since those two are the ones that
   * actually enforce against the storefront. `until` (only meaningful
   * when status is "suspended") sets a real auto-lift date - omitted
   * means indefinite, requiring an explicit admin action to lift, same as
   * before this change.
   */
  async setLifecycleStatus(
    adminUserId: string,
    sellerId: string,
    status: LifecycleStatus,
    reason: string,
    ip: string,
    mfaCode?: string,
    until?: string,
  ) {
    if (!LADDER_ORDER.includes(status)) {
      throw new BadRequestException(`Unknown lifecycle status: ${status}`);
    }
    if (ENFORCEMENT_STATUSES.includes(status)) {
      await this.verifyStepUpMfa(adminUserId, mfaCode, ip);
    }
    if (until && status !== "suspended") {
      throw new BadRequestException('"until" is only meaningful when status is "suspended".');
    }

    const before = await this.prismaAdmin.seller.findUnique({ where: { id: sellerId } });
    if (!before) throw new NotFoundException("Seller not found.");

    const lifecycleSuspendedUntil = status === "suspended" && until ? new Date(until) : null;
    const after = await this.prismaAdmin.seller.update({
      where: { id: sellerId },
      data: { lifecycleStatus: status, lifecycleSuspendedUntil },
    });
    await this.auditLog.record({
      adminUserId,
      action: "seller.lifecycle.set_status",
      targetType: "seller",
      targetId: sellerId,
      beforeValue: { lifecycleStatus: before.lifecycleStatus, lifecycleSuspendedUntil: before.lifecycleSuspendedUntil },
      afterValue: { lifecycleStatus: status, reason, lifecycleSuspendedUntil },
    });
    return after;
  }

  async listBySellerLifecycleStatus(status: LifecycleStatus) {
    return this.prismaAdmin.seller.findMany({ where: { lifecycleStatus: status }, orderBy: { createdAt: "desc" } });
  }

  /**
   * Founder walkthrough finding (Phase 2 item 16) - the missing duration/
   * auto-lift mechanism, same shape as StaffAccountsService.runSuspensionLiftSweep()
   * (a plain updateMany, no per-row branching that could fail
   * independently), run by the same worker tick.
   */
  async runLifecycleSuspensionLiftSweep(): Promise<{ lifted: number }> {
    const result = await this.prismaAdmin.seller.updateMany({
      where: { lifecycleStatus: "suspended", lifecycleSuspendedUntil: { lte: new Date() } },
      data: { lifecycleStatus: "active", lifecycleSuspendedUntil: null },
    });
    return { lifted: result.count };
  }
}
