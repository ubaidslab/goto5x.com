import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";

/**
 * SRS §5.29/FR-29.1 - versioned Seller Agreement acceptance. A minimal,
 * purpose-scoped version-history table (SellerAgreementVersion), not the
 * general FR-12.1 content-pages system (which remains unbuilt - a disclosed
 * scope-narrowing, see docs/build-plan.md). The actual legal text lives in
 * docs/legal/terms-of-service.md, per FR-29.2 - this table only tracks
 * *which version* is current and *when it was published*, for the
 * re-acceptance gate.
 */
@Injectable()
export class SellerAgreementService {
  constructor(private readonly prisma: PrismaRuntimeService) {}

  async getCurrentVersion(): Promise<{ version: string; publishedAt: Date }> {
    const current = await this.prisma.sellerAgreementVersion.findFirst({
      orderBy: { publishedAt: "desc" },
    });
    if (!current) {
      throw new NotFoundException("No Seller Agreement version has been published yet.");
    }
    return current;
  }

  /** Records acceptance of whatever version is current right now (SRS FR-29.1: timestamp + accepting IP). */
  async accept(sellerId: string, ip: string): Promise<void> {
    const current = await this.getCurrentVersion();
    await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        agreementAcceptedVersion: current.version,
        agreementAcceptedAt: new Date(),
        agreementAcceptedIp: ip,
      },
    });
  }

  /** True once this seller has accepted the CURRENT version - false after a fresh signup with no acceptance yet, or after a version bump they haven't re-accepted. */
  async hasAcceptedCurrentVersion(sellerId: string): Promise<boolean> {
    const [current, seller] = await Promise.all([
      this.getCurrentVersion(),
      this.prisma.seller.findUniqueOrThrow({ where: { id: sellerId }, select: { agreementAcceptedVersion: true } }),
    ]);
    return seller.agreementAcceptedVersion === current.version;
  }

  /** Admin publishes a new version (FR-29.1 "re-acceptance on version change") - every seller must re-accept before their next dashboard action succeeds. */
  async publishNewVersion(version: string): Promise<{ version: string; publishedAt: Date }> {
    return this.prisma.sellerAgreementVersion.create({ data: { version } });
  }
}
