import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRE_STAFF_SCOPE_KEY } from "../decorators/require-staff-scope.decorator";
import { AuthenticatedRequest, StaffScope } from "../types";

/**
 * See @RequireStaffScope() - this is the guard half of that pair (SRS
 * §5.52/FR-52.2/52.3). A non-staff session (real owner, admin,
 * supplier, or unauthenticated) always passes through untouched - this
 * guard only ever restricts a session that carries staffAccountId.
 */
@Injectable()
export class StaffScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.staffAccountId) return true;

    const required = this.reflector.getAllAndOverride<StaffScope>(REQUIRE_STAFF_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || !request.user.scopes?.includes(required)) {
      throw new ForbiddenException(`This staff account does not have the "${required ?? "required"}" scope for this action.`);
    }
    return true;
  }
}
