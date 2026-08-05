import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { BLOCK_STAFF_SESSIONS_KEY } from "../decorators/block-staff-sessions.decorator";
import { AuthenticatedRequest } from "../types";

/** See @BlockStaffSessions() - this is the guard half of that pair (SRS §5.52/FR-52.2). */
@Injectable()
export class BlockStaffSessionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const blocked = this.reflector.getAllAndOverride<boolean>(BLOCK_STAFF_SESSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!blocked) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user?.staffAccountId) {
      throw new ForbiddenException("This action is restricted to the store owner - staff accounts never have billing/payment/wallet/plan access.");
    }
    return true;
  }
}
