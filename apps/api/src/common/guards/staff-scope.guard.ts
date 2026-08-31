import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRE_STAFF_SCOPE_KEY, RequiredStaffScope } from "../decorators/require-staff-scope.decorator";
import { AuthenticatedRequest } from "../types";

/**
 * See @RequireStaffScope() - this is the guard half of that pair (SRS
 * §5.52/FR-52.2/52.3). A non-staff session (real owner, admin,
 * supplier, or unauthenticated) always passes through untouched - this
 * guard only ever restricts a session that carries staffAccountId.
 *
 * FR-52.8 - `write` implies `read`: a staff account holding `write` on a
 * scope satisfies a route that only requires `read`, but not the other
 * way around. Reading `scopePermissions` (a map, not the old bare
 * `scopes` array) directly off the JWT payload - no DB lookup per
 * request, same stateless-token discipline this guard already had.
 */
@Injectable()
export class StaffScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.staffAccountId) return true;

    const required = this.reflector.getAllAndOverride<RequiredStaffScope>(REQUIRE_STAFF_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const held = required ? request.user.scopePermissions?.[required.scope] : undefined;
    const satisfied = required && held && (held === "write" || required.permission === "read");
    if (!satisfied) {
      throw new ForbiddenException(
        `This staff account does not have "${required?.permission ?? "required"}" access to the "${required?.scope ?? "required"}" scope for this action.`,
      );
    }
    return true;
  }
}
