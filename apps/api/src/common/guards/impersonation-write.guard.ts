import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { BLOCK_DURING_IMPERSONATION_KEY } from "../decorators/block-during-impersonation.decorator";
import { AuthenticatedRequest } from "../types";

/** See @BlockDuringImpersonation() - this is the guard half of that pair. */
@Injectable()
export class ImpersonationWriteGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const blocked = this.reflector.getAllAndOverride<boolean>(BLOCK_DURING_IMPERSONATION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!blocked) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user?.impersonationSessionId) {
      throw new ForbiddenException(
        "This action is blocked during a support impersonation session - it can only be done by the seller themselves.",
      );
    }
    return true;
  }
}
