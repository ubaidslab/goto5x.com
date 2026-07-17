import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";

/**
 * A supplier's own catalog (`supplier_listings`, global table, no RLS - see
 * docs/database-schema.md's tenant-strategy note). Isolation is enforced at
 * the app layer via an explicit `WHERE supplierId = ...` filter, same
 * reasoning as `SupplierPortalService`.
 */
@Injectable()
export class SupplierListingsService {
  constructor(private readonly prismaAdmin: PrismaAdminService) {}

  async listOwn(supplierId: string) {
    return this.prismaAdmin.supplierListing.findMany({
      where: { supplierId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getOwn(supplierId: string, listingId: string) {
    const listing = await this.prismaAdmin.supplierListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.supplierId !== supplierId) throw new NotFoundException("Listing not found.");
    return listing;
  }

  /**
   * FR-4.5 - oversell protection: a single atomic conditional UPDATE, so
   * two concurrent calls against the same row can never both succeed when
   * only one unit remains. The mechanism is built and tested here in
   * isolation; wiring it into a live checkout's order-placement path is
   * Module 9's job once checkout exists.
   */
  async decrementStock(listingId: string, quantity: number): Promise<boolean> {
    const result = await this.prismaAdmin.supplierListing.updateMany({
      where: { id: listingId, stockQuantity: { gte: quantity } },
      data: { stockQuantity: { decrement: quantity } },
    });
    return result.count === 1;
  }
}
