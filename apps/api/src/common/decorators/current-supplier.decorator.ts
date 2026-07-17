import { createParamDecorator, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { AuthenticatedRequest } from "../types";

/** Extracts the authenticated supplier's id, or rejects if this session isn't a supplier session. */
export const CurrentSupplierId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.user?.supplierId) {
    throw new ForbiddenException("This endpoint requires an authenticated supplier session.");
  }
  return request.user.supplierId;
});
