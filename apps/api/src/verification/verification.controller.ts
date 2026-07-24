import { Controller, Get, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { VerificationApplicationService } from "./verification-application.service";
import { VerificationEligibilityService } from "./verification-eligibility.service";

/** SRS §5.35, FR-35.1/35.2 - the seller-facing eligibility portal + application flow. */
@Controller("stores/:storeId/verification")
@UseGuards(JwtAuthGuard)
export class VerificationController {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly eligibility: VerificationEligibilityService,
    private readonly applications: VerificationApplicationService,
  ) {}

  /** FR-35.1 - live, per-criterion pass/fail, plain language. Read-only - never itself the enforcement gate (see apply()). */
  @Get("eligibility")
  async getEligibility(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    await this.assertOwnership(sellerId, storeId);
    return this.eligibility.check(storeId);
  }

  @Get("status")
  async getStatus(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    const store = await this.assertOwnership(sellerId, storeId);
    return {
      verifiedStatus: store.verifiedStatus,
      verifiedSince: store.verifiedSince,
      verifiedExpiresAt: store.verifiedExpiresAt,
      reReviewReason: store.reReviewReason,
    };
  }

  @Get("applications")
  async listApplications(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    await this.assertOwnership(sellerId, storeId);
    return this.applications.listOwn(sellerId, storeId);
  }

  /** FR-35.2 - re-checks eligibility server-side regardless of the portal's own last read (§14.35's anti-bypass requirement). */
  @Post("apply")
  async apply(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    await this.assertOwnership(sellerId, storeId);
    return this.applications.apply(sellerId, storeId);
  }

  private async assertOwnership(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return store;
    });
  }
}
