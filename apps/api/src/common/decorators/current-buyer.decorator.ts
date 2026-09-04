import { createParamDecorator, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { AuthenticatedRequest } from "../types";

/**
 * FR-66.1 (Module 81) - same shape as CurrentSellerId, but a buyer needs
 * both ids: `buyerId` (BuyerProfile.id, for buyer_profiles/
 * buyer_saved_addresses queries) and `userId` (users.id / JWT `sub`,
 * which is what Order.buyerId actually references).
 */
export const CurrentBuyer = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): { buyerId: string; userId: string } => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.buyerId) {
      throw new ForbiddenException("This endpoint requires an authenticated buyer session.");
    }
    return { buyerId: request.user.buyerId, userId: request.user.sub };
  },
);
