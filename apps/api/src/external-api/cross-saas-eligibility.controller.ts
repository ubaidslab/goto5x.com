import { BadRequestException, Controller, Get, Headers, NotFoundException, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { ExternalApiSignatureService } from "./external-api-signature.service";

/**
 * FR-24.14 - either external SaaS calls this to decide whether a seller
 * qualifies for a cross-product discount on *that SaaS's own* pricing.
 * uzeyn.com never applies or knows the discount terms - it only answers
 * the eligibility boolean, same "each product's own billing stays inside
 * that product" rule as FR-24.7/24.12.
 */
@Controller("external/eligibility")
export class CrossSaasEligibilityController {
  constructor(
    private readonly signatures: ExternalApiSignatureService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Get()
  async check(
    @Query("sellerId") sellerId: string | undefined,
    @Req() req: Request,
    @Headers("x-uzeyn-client-type") clientType: string | undefined,
    @Headers("x-uzeyn-timestamp") timestamp: string | undefined,
    @Headers("x-uzeyn-signature") signature: string | undefined,
  ) {
    if (!sellerId) throw new BadRequestException("sellerId is required.");
    // GET has no body to sign - the canonical query string (exactly what the
    // caller sent after "?") is the signed payload instead, never a
    // re-serialized/parsed representation of it.
    const queryString = req.url.includes("?") ? req.url.slice(req.url.indexOf("?") + 1) : "";
    await this.signatures.verify(clientType, timestamp, signature, queryString);

    const subscription = await this.subscriptions.getSubscription(sellerId).catch(() => null);
    if (!subscription) throw new NotFoundException("Seller not found.");

    // FR-7.1 - the Free (individual) plan is always tierOrder 0; any other
    // plan (a higher individual tier, or a Team plan) is a paid plan.
    return { eligible: subscription.plan.tierOrder > 0 };
  }
}
