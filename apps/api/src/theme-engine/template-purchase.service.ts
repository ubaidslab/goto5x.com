import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../admin/audit-log.service";
import { WalletService } from "../billing/wallet.service";
import { EventsService } from "../events/events.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";

/**
 * Premium Motion Templates (founder-approved scope addition) - the in-app
 * purchase flow for a `marketplace`-tier theme, reusing the exact "manual
 * payment-instructions + admin-confirms" pattern WalletService's
 * requestTopUp()/verifyTopUp()/rejectTopUp() already established (same
 * instructions text via WalletService.topUpInstructions(), same
 * pending/verified/rejected shape) rather than a second payment system.
 * Deliberately distinct from TemplateInstallService (FR-24.3-24.7) - that
 * one is the *external* Template Store's own webhook-driven grant
 * (`marketplace_purchase`); this is UZEYN's own in-app channel
 * (`platform_purchase`) for the founder's new premium templates.
 */
@Injectable()
export class TemplatePurchaseService {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly wallet: WalletService,
    private readonly auditLog: AuditLogService,
    private readonly events: EventsService,
  ) {}

  async requestPurchase(sellerId: string, themeId: string) {
    const theme = await this.prisma.theme.findFirst({ where: { id: themeId, isActive: true } });
    if (!theme) throw new NotFoundException("Template not found.");
    if (theme.tier !== "marketplace" || theme.price === null) {
      throw new BadRequestException("This template isn't available for in-app purchase.");
    }

    const existingEntitlement = await this.tenantPrisma.run(sellerId, (tx) =>
      tx.templateEntitlement.findUnique({ where: { sellerId_themeId: { sellerId, themeId } } }),
    );
    if (existingEntitlement && !existingEntitlement.revokedAt) {
      throw new BadRequestException("You already own this template.");
    }

    const pending = await this.tenantPrisma.run(sellerId, (tx) =>
      tx.templatePurchaseRequest.findFirst({ where: { sellerId, themeId, status: "pending" } }),
    );
    if (pending) throw new BadRequestException("You already have a pending purchase request for this template.");

    const amount = Number(theme.price);
    const currency = "PKR";
    const request = await this.tenantPrisma.run(sellerId, (tx) =>
      tx.templatePurchaseRequest.create({ data: { sellerId, themeId, amount, currency } }),
    );
    return { request, instructions: await this.wallet.topUpInstructions(amount, currency) };
  }

  listOwn(sellerId: string) {
    return this.tenantPrisma.run(sellerId, (tx) =>
      tx.templatePurchaseRequest.findMany({ where: { sellerId }, orderBy: { requestedAt: "desc" }, include: { theme: true } }),
    );
  }

  /** Admin-only - every pending request across every seller, oldest first (same shape as the wallet-topups queue). */
  listPendingForAdmin() {
    return this.prismaAdmin.templatePurchaseRequest.findMany({
      where: { status: "pending" },
      orderBy: { requestedAt: "asc" },
      include: { theme: true, seller: { include: { user: true } } },
    });
  }

  async verify(requestId: string, adminUserId: string) {
    const request = await this.prismaAdmin.templatePurchaseRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Purchase request not found.");
    if (request.status !== "pending") throw new BadRequestException("This purchase request has already been resolved.");

    // upsert, not create - re-verifying after a prior revoke correctly
    // re-grants (clears revokedAt) rather than conflicting on the unique
    // constraint, same idempotent shape as TemplateInstallService.install().
    const entitlement = await this.tenantPrisma.run(request.sellerId, (tx) =>
      tx.templateEntitlement.upsert({
        where: { sellerId_themeId: { sellerId: request.sellerId, themeId: request.themeId } },
        create: { sellerId: request.sellerId, themeId: request.themeId, source: "platform_purchase" },
        update: { revokedAt: null, source: "platform_purchase" },
      }),
    );

    await this.prismaAdmin.templatePurchaseRequest.update({
      where: { id: requestId },
      data: { status: "verified", verifiedAt: new Date(), verifiedBy: adminUserId },
    });

    await this.auditLog.record({
      adminUserId,
      action: "theme.purchase_verified",
      targetType: "template_purchase_request",
      targetId: requestId,
      beforeValue: { status: "pending" },
      afterValue: { status: "verified", themeId: request.themeId, sellerId: request.sellerId, amount: Number(request.amount) },
    });
    await this.events.emit({
      eventType: "theme.purchase_verified",
      actorType: "admin",
      actorId: adminUserId,
      entityType: "seller",
      entityId: request.sellerId,
      metadata: { themeId: request.themeId, amount: Number(request.amount) },
    });

    return {
      request: await this.prismaAdmin.templatePurchaseRequest.findUniqueOrThrow({ where: { id: requestId } }),
      entitlementId: entitlement.id,
    };
  }

  async reject(requestId: string, adminUserId: string) {
    const request = await this.prismaAdmin.templatePurchaseRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Purchase request not found.");
    if (request.status !== "pending") throw new BadRequestException("This purchase request has already been resolved.");

    const after = await this.prismaAdmin.templatePurchaseRequest.update({
      where: { id: requestId },
      data: { status: "rejected", verifiedAt: new Date(), verifiedBy: adminUserId },
    });

    await this.auditLog.record({
      adminUserId,
      action: "theme.purchase_rejected",
      targetType: "template_purchase_request",
      targetId: requestId,
      beforeValue: { status: "pending" },
      afterValue: { status: "rejected" },
    });
    return after;
  }
}
