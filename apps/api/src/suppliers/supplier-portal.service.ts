import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { EventsService } from "../events/events.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { RequestStoreLinkDto } from "./dto/request-store-link.dto";

/**
 * Supplier-facing half of FR-2.6/FR-3.1/FR-3.3 - a supplier's session has no
 * seller/store RLS context to run under (it legitimately spans multiple
 * sellers' stores at once), so every method here uses PrismaAdminService
 * (BYPASSRLS - see that service's third documented legitimate use) and
 * filters explicitly on `supplierId` instead of relying on RLS.
 */
@Injectable()
export class SupplierPortalService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly events: EventsService,
  ) {}

  async requestLink(supplierId: string, dto: RequestStoreLinkDto) {
    const store = await this.prismaAdmin.store.findUnique({ where: { slug: dto.storeSlug } });
    if (!store) throw new NotFoundException("Store not found.");

    let link;
    try {
      // FR-2.6 - same "pending the seller's review regardless of who
      // initiated" rule as the seller-invite path.
      link = await this.prismaAdmin.storeSupplierLink.create({
        data: { storeId: store.id, supplierId, invitedBy: "supplier" },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("A link between this supplier and store already exists.");
      }
      throw err;
    }

    await this.events.emit({
      eventType: "store_supplier_link.created",
      actorType: "supplier",
      actorId: supplierId,
      storeId: store.id,
      entityType: "store_supplier_link",
      entityId: link.id,
    });
    return link;
  }

  /** FR-3.3 - every store this supplier is linked to, any status. */
  async listOwnLinks(supplierId: string) {
    return this.prismaAdmin.storeSupplierLink.findMany({
      where: { supplierId },
      include: { store: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async submitForReview(
    supplierId: string,
    input: { storeSupplierLinkId: string; supplierListingId: string },
  ) {
    const link = await this.prismaAdmin.storeSupplierLink.findUnique({
      where: { id: input.storeSupplierLinkId },
    });
    if (!link || link.supplierId !== supplierId) {
      throw new NotFoundException("Supplier link not found.");
    }
    if (link.status !== "active") {
      throw new BadRequestException("This store link is not active yet.");
    }

    const listing = await this.prismaAdmin.supplierListing.findUnique({
      where: { id: input.supplierListingId },
    });
    if (!listing || listing.supplierId !== supplierId) {
      throw new NotFoundException("Listing not found.");
    }

    const review = await this.prismaAdmin.listingReview.create({
      data: {
        storeId: link.storeId,
        storeSupplierLinkId: link.id,
        supplierListingId: listing.id,
      },
    });

    await this.events.emit({
      eventType: "listing_review.submitted",
      actorType: "supplier",
      actorId: supplierId,
      storeId: link.storeId,
      entityType: "listing_review",
      entityId: review.id,
    });
    return review;
  }
}
