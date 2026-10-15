import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { StepUpMfaService } from "../../auth/step-up-mfa.service";
import { AuthenticatedRequest } from "../types";

/**
 * D82 - the reusable form of the step-up-MFA check
 * SellerLifecycleService.setLifecycleStatus() already required for
 * suspend/ban (Phase 2 item 16). Runs after AdminAuthGuard (which already
 * guarantees `request.user.adminUserId` and a login-time-MFA-verified
 * session) - this is a SECOND, fresh TOTP check for one specific
 * money-moving/destructive action, not a substitute for AdminAuthGuard.
 *
 * Reads the code from a header (`X-Step-Up-MFA-Code`), not a DTO body
 * field - keeps this guard usable on any route without that route's own
 * DTO needing to know this concern exists, the same way
 * RefreshCookieCsrfGuard's X-Requested-With header works regardless of
 * what each guarded route's body looks like.
 */
@Injectable()
export class StepUpMfaGuard implements CanActivate {
  constructor(private readonly stepUpMfa: StepUpMfaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const adminUserId = request.user?.adminUserId;
    if (!adminUserId) {
      throw new ForbiddenException("This endpoint requires an authenticated admin session.");
    }

    const code = request.headers["x-step-up-mfa-code"];
    await this.stepUpMfa.verify(adminUserId, typeof code === "string" ? code : undefined, request.ip ?? "unknown");
    return true;
  }
}
