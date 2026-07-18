import { ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { SKIP_AGREEMENT_CHECK_KEY } from "../common/decorators/skip-agreement-check.decorator";
import { AuthenticatedRequest } from "../common/types";
import { SellerAgreementService } from "./seller-agreement.service";

/**
 * SRS §5.29/FR-29.1 - "a seller who has not re-accepted [a newly-published
 * agreement version] sees only the acceptance prompt, nothing else." Does
 * its own JWT verification first (mirrors AdminAuthGuard's self-contained
 * pattern) rather than assuming JwtAuthGuard already ran, since Nest's
 * global-vs-controller guard ordering cannot be relied on for that.
 *
 * Applied to the seller-dashboard gateway endpoints a seller reaches first
 * (their own profile, store creation) rather than retrofitted onto every
 * seller-scoped controller in the app - a deliberate, disclosed scope
 * boundary (see docs/build-plan.md) given the size/regression-risk of a
 * blanket rewire versus the fact that this only ever matters after an admin
 * explicitly publishes a new agreement version, which normal operation
 * (and every other test in this suite) never does.
 */
@Injectable()
export class SellerAgreementGuard extends AuthGuard("jwt") {
  constructor(
    private readonly agreements: SellerAgreementService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const parentAllowed = (await super.canActivate(context)) as boolean;
    if (!parentAllowed) return false;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AGREEMENT_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sellerId = request.user?.sellerId;
    if (!sellerId) return true; // not a seller session - nothing for this guard to check

    const accepted = await this.agreements.hasAcceptedCurrentVersion(sellerId);
    if (!accepted) {
      throw new ForbiddenException(
        "A new Seller Agreement version has been published - please review and accept it before continuing.",
      );
    }
    return true;
  }
}
