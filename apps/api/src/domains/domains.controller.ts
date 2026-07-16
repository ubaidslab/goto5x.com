import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { DomainVerificationService } from "./domain-verification.service";
import { DomainsService } from "./domains.service";
import { AttachDomainDto } from "./dto/attach-domain.dto";

@Controller("stores/:storeId/domains")
@UseGuards(JwtAuthGuard)
export class DomainsController {
  constructor(
    private readonly domains: DomainsService,
    private readonly verification: DomainVerificationService,
  ) {}

  @Post()
  attach(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: AttachDomainDto) {
    return this.domains.attach(sellerId, storeId, dto.domainName);
  }

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.domains.list(sellerId, storeId);
  }

  @Delete(":domainId")
  remove(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("domainId") domainId: string,
  ) {
    return this.domains.remove(sellerId, storeId, domainId);
  }

  // Seller-triggered "check now" (SRS FR-11.2's "automated verification" is
  // the check itself running without a human manually inspecting DNS - not
  // necessarily silent background polling, which the scheduled worker job
  // also provides). Ownership is checked here, separately from
  // DomainVerificationService, which deliberately has no seller context.
  @Post(":domainId/verify")
  async verifyNow(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("domainId") domainId: string,
  ) {
    await this.domains.assertOwnedDomain(sellerId, storeId, domainId);
    return this.verification.verifyDomain(domainId);
  }
}
