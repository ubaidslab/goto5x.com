import { createParamDecorator, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { AuthenticatedRequest } from "../types";

/** Extracts the authenticated seller's id, or rejects if this session isn't a seller session. */
export const CurrentSellerId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.user?.sellerId) {
    throw new ForbiddenException("This endpoint requires an authenticated seller session.");
  }
  return request.user.sellerId;
});
