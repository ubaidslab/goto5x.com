import { ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AuthenticatedRequest } from "../types";

/**
 * Requires a valid JWT AND that it was issued for an admin who has completed
 * MFA verification for this session (SRS FR-8.12/§14.8: "Admin MFA is
 * mandatory"). This guard is the gate that makes app_admin's RLS bypass
 * (docs/build-plan.md) safe to reach - no code path uses PrismaAdminService
 * without first passing through this guard.
 */
@Injectable()
export class AdminAuthGuard extends AuthGuard("jwt") {
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
    return true;
  }
}
