import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../admin/audit-log.service";
import { WalletService } from "../billing/wallet.service";
import { EventsService } from "../events/events.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { PlatformGatewayService } from "../platform-gateway/platform-gateway.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { SettingsService } from "../settings-registry/settings.service";

/** RISE's tierOrder - the ceiling the Pack grants. Not FLY (3): FLY-exclusive
 * variants/early access stay a real-subscription-only perk (FR-8.21). */
const PACK_GRANT_TIER_ORDER = 2;

/**
 * FR-8.21 (Module 100, founder batch B18) - D-Studio Pack: a seller-
 * purchasable, time-boxed full-catalog unlock, stacked orthogonally on top
 * of the existing GO/RUN/RISE/FLY tier ladder (FR-7.23) rather than
 * replacing it. Structurally mirrors TemplatePurchaseService's own
 * pending -> admin-verify -> grant flow (same manual-instructions/auto-
 * verify payment plumbing), but the grant step writes a time-limited
 * Settings Registry override (dstudio.tier_override_order + expiresAt)
 * instead of a permanent TemplateEntitlement row - the mechanism D-Studio's
 * own close-out already built for exactly this kind of grant.
 */
@Injectable()
export class DstudioPackService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly wallet: WalletService,
    private readonly auditLog: AuditLogService,
    private readonly events: EventsService,
    private readonly platformGateway: PlatformGatewayService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async requestPurchase(sellerId: string, reference?: string) {
    // No marginal benefit to sell a RISE/FLY-tier seller a full-catalog
    // unlock they already have for free - reject rather than take payment
    // for something that does nothing.
    const realTierOrder = await this.subscriptions.getSellerTierOrder(sellerId);
    if (realTierOrder >= PACK_GRANT_TIER_ORDER) {
      throw new BadRequestException("Your plan already includes the full D-Studio catalog - the Pack has no effect for you.");
    }

    // Retry-storm guard - same as TemplatePurchaseService's own use of this,
    // only applies when a reference is present (the only path that makes an
    // outbound gateway call). Must run BEFORE the "already pending" check
    // below: that check is itself a non-atomic check-then-create race, so
    // two concurrent requests can both observe no pending row and both
    // reach this point - claiming the atomic Redis cooldown first
    // guarantees only one of them proceeds past this line.
    if (reference) {
      const allowed = await this.platformGateway.claimSubmissionCooldown(sellerId, "dstudio_pack_purchase");
      if (!allowed) {
        throw new HttpException("Please wait a moment before resubmitting a payment reference.", HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const pending = await this.tenantPrisma.run(sellerId, (tx) =>
      tx.dstudioPackPurchase.findFirst({ where: { sellerId, status: "pending" } }),
    );
    if (pending) throw new BadRequestException("You already have a pending D-Studio Pack purchase request.");

    const amount = await this.settings.resolve<number>("dstudio.pack_price");
    const currency = "PKR";
    const request = await this.tenantPrisma.run(sellerId, (tx) =>
      tx.dstudioPackPurchase.create({ data: { sellerId, amount, currency } }),
    );

    // Platform Merchant Connection fast path - dormant unless an admin has
    // both connected real credentials AND explicitly activated a provider;
    // the request otherwise stays exactly as before this feature existed:
    // pending, awaiting manual admin confirm.
    if (reference) {
      const result = await this.platformGateway.tryAutoVerify(request.id, amount, currency, reference);
      if (result?.verified) {
        const verified = await this.verify(request.id, null);
        return { request: verified.request, instructions: await this.wallet.topUpInstructions(amount, currency), autoVerified: true };
      }
    }

    return { request, instructions: await this.wallet.topUpInstructions(amount, currency), autoVerified: false };
  }

  listOwn(sellerId: string) {
    return this.tenantPrisma.run(sellerId, (tx) => tx.dstudioPackPurchase.findMany({ where: { sellerId }, orderBy: { requestedAt: "desc" } }));
  }

  /** Admin-only - every pending request across every seller, oldest first (same shape as the wallet-topups/template-purchases queues). */
  listPendingForAdmin() {
    return this.prismaAdmin.dstudioPackPurchase.findMany({
      where: { status: "pending" },
      orderBy: { requestedAt: "asc" },
      include: { seller: { include: { user: true } } },
    });
  }

  async verify(requestId: string, adminUserId: string | null) {
    const request = await this.prismaAdmin.dstudioPackPurchase.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Purchase request not found.");
    if (request.status !== "pending") throw new BadRequestException("This purchase request has already been resolved.");

    const verifiedAt = new Date();
    const durationDays = await this.settings.resolve<number>("dstudio.pack_duration_days");
    const expiresAt = new Date(verifiedAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Renewal is a plain repeat purchase, not additive/stacking (FR-8.21) -
    // each verified Pack purchase resets the clock to a fresh window from
    // this moment, regardless of any time remaining on a still-active one.
    await this.settings.setValue("dstudio.tier_override_order", "seller", request.sellerId, PACK_GRANT_TIER_ORDER, adminUserId, expiresAt);

    await this.prismaAdmin.dstudioPackPurchase.update({
      where: { id: requestId },
      data: { status: "verified", verifiedAt, verifiedBy: adminUserId },
    });

    await this.auditLog.record({
      adminUserId,
      action: "dstudio.pack_verified",
      targetType: "dstudio_pack_purchase",
      targetId: requestId,
      beforeValue: { status: "pending" },
      afterValue: {
        status: "verified",
        sellerId: request.sellerId,
        amount: Number(request.amount),
        expiresAt: expiresAt.toISOString(),
        autoVerified: adminUserId === null,
      },
    });
    await this.events.emit({
      eventType: "dstudio.pack_verified",
      actorType: adminUserId ? "admin" : "system",
      actorId: adminUserId ?? undefined,
      entityType: "seller",
      entityId: request.sellerId,
      metadata: { amount: Number(request.amount), expiresAt: expiresAt.toISOString() },
    });

    return {
      request: await this.prismaAdmin.dstudioPackPurchase.findUniqueOrThrow({ where: { id: requestId } }),
      expiresAt,
    };
  }

  async reject(requestId: string, adminUserId: string) {
    const request = await this.prismaAdmin.dstudioPackPurchase.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Purchase request not found.");
    if (request.status !== "pending") throw new BadRequestException("This purchase request has already been resolved.");

    const after = await this.prismaAdmin.dstudioPackPurchase.update({
      where: { id: requestId },
      data: { status: "rejected", verifiedAt: new Date(), verifiedBy: adminUserId },
    });

    await this.auditLog.record({
      adminUserId,
      action: "dstudio.pack_rejected",
      targetType: "dstudio_pack_purchase",
      targetId: requestId,
      beforeValue: { status: "pending" },
      afterValue: { status: "rejected" },
    });
    return after;
  }
}
