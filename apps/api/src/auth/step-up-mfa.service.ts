import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { authenticator } from "otplib";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";

/**
 * D82 - extracted out of SellerLifecycleService.verifyStepUpMfa() (the
 * founder-walkthrough fix that first required this, Phase 2 item 16) so
 * it's a shared, reusable check rather than one lifecycle-ladder-specific
 * private method - "generalizing it into a reusable guard/decorator for
 * other money-moving/destructive admin actions" per D82's own text.
 * `StepUpMfaGuard` (common/guards/step-up-mfa.guard.ts) is the HTTP-layer
 * wrapper around this for a new route; SellerLifecycleService itself now
 * calls this directly (same behavior, same body-based `mfaCode` wire
 * contract it already had and already has a frontend for - migrating it
 * to the guard's header-based contract would be a breaking change to an
 * already-shipped admin flow, out of scope for "generalize this", not
 * done here).
 */
@Injectable()
export class StepUpMfaService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
  ) {}

  async verify(adminUserId: string, code: string | undefined, ip: string): Promise<void> {
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
}
