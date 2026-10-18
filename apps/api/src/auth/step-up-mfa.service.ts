import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { authenticator } from "otplib";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";

// D133 - otplib's own default is `window: 0`: authenticator.check() accepts
// ONLY the exact current 30-second TOTP step, with zero tolerance for the
// real, unavoidable gap between "the caller computed this code" and "this
// process validates it" (network latency, event-loop/DB/Redis time inside
// verify() itself, or ordinary clock drift). Proved to actually matter, not
// just theoretically: a code generated a moment before a 30s step boundary
// and checked a moment after it is REJECTED outright - reproduced directly
// against this exact otplib install (module79-ambassador-repricing.e2e-
// spec.ts's CI flake, D133's full writeup: the resulting 401 on this
// guard's step-up check silently short-circuits AdminWalletController.
// verify() before it ever reaches the referral-commission ledger write,
// which is what actually surfaced as the flake). `authenticator.options`
// merges into the existing options object (see @otplib/core's `set
// options()`), so this only loosens the step tolerance - digits/step/
// algorithm/secret format are untouched. AuthService/AdminAuthService set
// the identical line next to their own `authenticator.check()` calls
// (otplib hands back one shared singleton either way, so this alone would
// likely cover them too in this app's actual module graph - but each site
// sets it independently rather than leaning on that, so none of the three
// depends on a particular module-load order to be safe).
authenticator.options = { window: 1 };

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
