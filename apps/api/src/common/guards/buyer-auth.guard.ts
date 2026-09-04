import { ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AuthenticatedRequest } from "../types";

/**
 * Requires a valid JWT issued by BuyerAuthService (FR-66.1, Module 81) -
 * same "guard checks which optional payload field is present" pattern as
 * AdminAuthGuard/StaffScopeGuard, no separate Passport strategy needed.
 */
@Injectable()
export class BuyerAuthGuard extends AuthGuard("jwt") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const parentAllowed = (await super.canActivate(context)) as boolean;
    if (!parentAllowed) return false;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.buyerId) {
      throw new ForbiddenException("This endpoint requires an authenticated buyer session.");
    }
    return true;
  }
}
