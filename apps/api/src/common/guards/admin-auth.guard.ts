import { ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { ALLOW_REVIEWER_KEY } from "../decorators/allow-reviewer.decorator";
import { AuthenticatedRequest } from "../types";

/**
 * Requires a valid JWT AND that it was issued for an admin who has completed
 * MFA verification for this session (SRS FR-8.12/§14.8: "Admin MFA is
 * mandatory"). This guard is the gate that makes app_admin's RLS bypass
 * (docs/build-plan.md) safe to reach - no code path uses PrismaAdminService
 * without first passing through this guard.
 *
 * Module 6 (SRS §4/FR-27.6): the REVIEWER sub-role is denied every admin
 * route by default - only a route explicitly decorated with
 * `@AllowReviewer()` (the moderation queue) accepts it. This is a single
 * change here rather than editing every existing `@UseGuards(AdminAuthGuard)`
 * controller individually, so REVIEWER is excluded from settings, audit
 * logs, payouts, etc. without any of those controllers needing to know
 * this role exists.
 */
@Injectable()
export class AdminAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const parentAllowed = (await super.canActivate(context)) as boolean;
    if (!parentAllowed) return false;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.adminUserId) {
      throw new ForbiddenException("This endpoint requires an authenticated admin session.");
    }
    if (!request.user.mfaVerified) {
      throw new ForbiddenException("This endpoint requires MFA verification.");
    }
    if (request.user.adminRole === "reviewer") {
      const allowReviewer = this.reflector.getAllAndOverride<boolean>(ALLOW_REVIEWER_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowReviewer) {
        throw new ForbiddenException("This account is limited to the moderation queue.");
      }
    }
    return true;
  }
}
