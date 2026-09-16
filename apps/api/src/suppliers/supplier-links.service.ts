import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { generateToken } from "../auth/token.util";
import { EventsService } from "../events/events.service";
import { EmailService } from "../notifications/email.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { SettingsService } from "../settings-registry/settings.service";
import { InviteSupplierDto } from "./dto/create-store-supplier-link.dto";

/**
 * Seller-facing half of FR-2.6/FR-3.1's supplier connection - every method
 * verifies `storeId` belongs to the calling seller before touching
 * `store_supplier_links`, same app-layer discipline as every tenant service
 * since Module 2. The supplier-initiated half (requesting a link, viewing
 * their own multi-store list) lives in `SupplierPortalService` instead,
 * since a supplier's session has no seller/store RLS context to run under.
 */
@Injectable()
export class SupplierLinksService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly events: EventsService,
    private readonly email: EmailService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Founder walkthrough finding (Phase 2 item 15): a seller inviting a
   * supplier by email no longer waits on that supplier having already
   * self-registered. If no account exists for the email yet, one is
   * created here in the background (User with `passwordHash: null` - the
   * same "invited, not yet claimed" shape AuthService.completePasswordReset()
   * already handles for any User row, regardless of whether it ever had a
   * password) and a claim-link email is sent reusing that exact mechanism.
   * Identity is deduped purely by email (the `users.email` unique
   * constraint) - a second seller inviting an already-existing supplier
   * (whether self-registered or invite-created) always resolves to the
   * SAME Supplier row and only ever adds a new, independent
   * StoreSupplierLink; it can never touch another store's existing link or
   * that supplier's listings. The supplier self-registration/portal-login
   * flow itself (AuthService.signup with role "supplier",
   * SupplierPortalService) is untouched - still there for a supplier who
   * wants to sign up directly, and still how an invited supplier manages
   * their listings once they've claimed their account.
   */
  async invite(sellerId: string, storeId: string, dto: InviteSupplierDto) {
    const result = await this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      let supplierUser = await tx.user.findUnique({
        where: { email: dto.supplierEmail },
        include: { supplier: true },
      });

      if (supplierUser && !supplierUser.supplier) {
        throw new ConflictException("An account already exists for that email and isn't a supplier account.");
      }

      let isNewSupplierAccount = false;
      if (!supplierUser) {
        if (!dto.supplierBusinessName) {
          throw new BadRequestException("A business name is required to invite a new supplier.");
        }
        supplierUser = await tx.user.create({
          data: {
            email: dto.supplierEmail,
            roleFlags: ["supplier"],
            supplier: { create: { businessName: dto.supplierBusinessName } },
          },
          include: { supplier: true },
        });
        isNewSupplierAccount = true;
      }

      try {
        // FR-2.6 - "either path lands in the same place: a StoreSupplierLink
        // pending the seller's review," even though the seller is the one
        // initiating - the seller still gives the final go-ahead.
        const link = await tx.storeSupplierLink.create({
          data: { storeId, supplierId: supplierUser.supplier!.id, invitedBy: "seller" },
        });
        return {
          link,
          isNewSupplierAccount,
          supplierUserId: supplierUser.id,
          supplierEmail: supplierUser.email,
          storeName: store.name,
        };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new ConflictException("This supplier already has a link to this store.");
        }
        throw err;
      }
    });

    if (result.isNewSupplierAccount) {
      const ttlMinutes = await this.settings.resolve<number>("auth.password_reset_token_ttl_minutes");
      const { token, tokenHash } = generateToken();
      await this.prismaAdmin.user.update({
        where: { id: result.supplierUserId },
        data: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        },
      });
      const claimUrl = `${this.config.getOrThrow<string>("APP_BASE_URL")}/reset-password?token=${token}`;
      await this.email.sendSupplierInviteClaimEmail(result.supplierEmail, result.storeName, claimUrl);
    }

    await this.events.emit({
      eventType: "store_supplier_link.created",
      actorType: "seller",
      actorId: sellerId,
      storeId,
      entityType: "store_supplier_link",
      entityId: result.link.id,
      metadata: { isNewSupplierAccount: result.isNewSupplierAccount },
    });
    return { ...result.link, isNewSupplierAccount: result.isNewSupplierAccount };
  }

  async list(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.storeSupplierLink.findMany({
        where: { storeId },
        orderBy: { createdAt: "desc" },
        include: { supplier: { select: { businessName: true, verificationStatus: true } } },
      });
    });
  }

  async approve(sellerId: string, storeId: string, linkId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const link = await tx.storeSupplierLink.findUnique({ where: { id: linkId } });
      if (!link || link.storeId !== storeId) throw new NotFoundException("Supplier link not found.");
      if (link.status !== "pending_seller_review") {
        throw new BadRequestException("This link is not pending review.");
      }
      return tx.storeSupplierLink.update({
        where: { id: linkId },
        data: { status: "active", approvedAt: new Date() },
      });
    });
  }

  async revoke(sellerId: string, storeId: string, linkId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const link = await tx.storeSupplierLink.findUnique({ where: { id: linkId } });
      if (!link || link.storeId !== storeId) throw new NotFoundException("Supplier link not found.");
      return tx.storeSupplierLink.update({ where: { id: linkId }, data: { status: "revoked" } });
    });
  }

  /** Module 96 (SRS §5.4/FR-4.12) - the Suppliers page's mini-dashboard summary strip, shown whether or not the seller has any connections yet. */
  async dashboard(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [activeSuppliersCount, pendingLinksCount, pendingReviewsCount, ordersForwardedCount, forwardingIssuesCount] =
        await Promise.all([
          tx.storeSupplierLink.count({ where: { storeId, status: "active" } }),
          tx.storeSupplierLink.count({ where: { storeId, status: "pending_seller_review" } }),
          tx.listingReview.count({ where: { storeId, status: "pending" } }),
          tx.orderTimelineEvent.count({ where: { storeId, eventType: "supplier_order_forwarded", createdAt: { gte: thirtyDaysAgo } } }),
          tx.orderTimelineEvent.count({ where: { storeId, eventType: "supplier_order_forward_failed", createdAt: { gte: thirtyDaysAgo } } }),
        ]);

      return {
        activeSuppliersCount,
        pendingApprovalsCount: pendingLinksCount + pendingReviewsCount,
        ordersForwardedCount,
        forwardingIssuesCount,
      };
    });
  }
}
