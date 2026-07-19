import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../admin/audit-log.service";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { TemplateInstallDto } from "./dto/template-install.dto";
import { TemplateRevokeDto } from "./dto/template-revoke.dto";

/**
 * FR-24.3-24.7 - the Template Store's own backend calls this after a seller
 * completes a purchase there. Import-only (FR-24.4): this never returns a
 * downloadable template file - only registers the catalog entry and grants
 * the entitlement, so the seller's own theme-selection UI is the only place
 * the template ever becomes visible/usable, never a file the caller receives.
 *
 * A `themes` row is matched by `(name, version)` - the Template Package
 * Spec's own manifest identity (docs/architecture.md) - so a second install
 * call for the same template/version reuses the existing catalog row instead
 * of duplicating it; a *different* version of the same-named template is
 * treated as a distinct theme, matching the spec's own versioning.
 */
@Injectable()
export class TemplateInstallService {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly auditLog: AuditLogService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
  ) {}

  async install(dto: TemplateInstallDto, clientId: string) {
    const limit = await this.settings.resolve<number>("external_api.template_install_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`template-install:${clientId}`, limit);

    const seller = await this.prisma.seller.findUnique({ where: { id: dto.sellerId } });
    if (!seller) throw new NotFoundException("Seller not found.");

    let theme = await this.prisma.theme.findFirst({ where: { name: dto.themeName, version: dto.themeVersion } });
    if (!theme) {
      theme = await this.prisma.theme.create({
        data: {
          name: dto.themeName,
          version: dto.themeVersion,
          tier: "marketplace",
          previewImageUrl: dto.previewImageUrl,
          isActive: true,
        },
      });
    }

    // upsert, not create - a second install call for an already-entitled
    // seller (e.g. the Template Store retrying after a network error) is
    // idempotent, and re-installing after a prior revoke correctly re-grants
    // (clears revokedAt) rather than conflicting on the unique constraint.
    const entitlement = await this.tenantPrisma.run(dto.sellerId, (tx) =>
      tx.templateEntitlement.upsert({
        where: { sellerId_themeId: { sellerId: dto.sellerId, themeId: theme!.id } },
        create: {
          sellerId: dto.sellerId,
          themeId: theme!.id,
          source: "marketplace_purchase",
          externalPurchaseRef: dto.purchaseRef,
        },
        update: { revokedAt: null, externalPurchaseRef: dto.purchaseRef },
      }),
    );

    // FR-24.6 (traceable grant) + FR-24.13 (referral attribution) - one
    // audit-log write covers both: a system actor (adminUserId: null), and
    // the attribution signal folded into afterValue rather than a second
    // write, since FR-24.13 asks for "a verifiable signal," not a distinct log row.
    await this.auditLog.record({
      adminUserId: null,
      action: "template_entitlement.granted",
      targetType: "template_entitlement",
      targetId: entitlement.id,
      afterValue: {
        sellerId: dto.sellerId,
        themeId: theme.id,
        source: "marketplace_purchase",
        purchaseRef: dto.purchaseRef,
        referralAttributed: true,
      },
    });

    return { themeId: theme.id, entitlementId: entitlement.id };
  }

  async revoke(dto: TemplateRevokeDto) {
    const theme = await this.prisma.theme.findFirst({ where: { name: dto.themeName, version: dto.themeVersion } });
    if (!theme) throw new NotFoundException("Theme not found.");

    const entitlement = await this.tenantPrisma.run(dto.sellerId, (tx) =>
      tx.templateEntitlement.findUnique({
        where: { sellerId_themeId: { sellerId: dto.sellerId, themeId: theme!.id } },
      }),
    );
    if (!entitlement || entitlement.revokedAt) {
      throw new NotFoundException("Entitlement not found or already revoked.");
    }

    const updated = await this.tenantPrisma.run(dto.sellerId, (tx) =>
      tx.templateEntitlement.update({ where: { id: entitlement.id }, data: { revokedAt: new Date() } }),
    );

    // FR-24.6 - symmetric with the grant above: the `themes` catalog entry
    // itself is never touched, and no other seller's entitlement to the
    // same theme is affected (the update is scoped to this one row's id).
    await this.auditLog.record({
      adminUserId: null,
      action: "template_entitlement.revoked",
      targetType: "template_entitlement",
      targetId: updated.id,
      afterValue: { sellerId: dto.sellerId, themeId: theme.id },
    });

    return { revoked: true };
  }
}
