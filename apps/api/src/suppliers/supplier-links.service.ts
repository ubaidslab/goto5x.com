import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { EventsService } from "../events/events.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
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
    private readonly events: EventsService,
  ) {}

  async invite(sellerId: string, storeId: string, dto: InviteSupplierDto) {
    const link = await this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      const supplierUser = await tx.user.findUnique({
        where: { email: dto.supplierEmail },
        include: { supplier: true },
      });
      if (!supplierUser?.supplier) {
        throw new BadRequestException("No supplier account exists for that email.");
      }

      try {
        // FR-2.6 - "either path lands in the same place: a StoreSupplierLink
        // pending the seller's review," even though the seller is the one
        // initiating - the seller still gives the final go-ahead.
        return await tx.storeSupplierLink.create({
          data: { storeId, supplierId: supplierUser.supplier.id, invitedBy: "seller" },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new ConflictException("This supplier already has a link to this store.");
        }
        throw err;
      }
    });

    await this.events.emit({
      eventType: "store_supplier_link.created",
      actorType: "seller",
      actorId: sellerId,
      storeId,
      entityType: "store_supplier_link",
      entityId: link.id,
    });
    return link;
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
}
