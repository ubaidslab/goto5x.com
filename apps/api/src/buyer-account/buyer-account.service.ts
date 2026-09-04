import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { BuyerAddressDto } from "./dto/buyer-address.dto";

/**
 * FR-66.1 (Module 81) - buyer-facing profile/saved-address/order-history
 * reads and writes. Buyer accounts are global (no store/seller RLS
 * context to run under), so this uses PrismaAdminService throughout -
 * same BYPASSRLS reasoning OrderStatusLookupService already documents for
 * the exact same "no seller context" situation.
 */
@Injectable()
export class BuyerAccountService {
  constructor(private readonly prismaAdmin: PrismaAdminService) {}

  async getProfile(buyerId: string) {
    const profile = await this.prismaAdmin.buyerProfile.findUniqueOrThrow({
      where: { id: buyerId },
      include: { user: { select: { email: true } } },
    });
    return { id: profile.id, email: profile.user.email, displayName: profile.displayName };
  }

  async updateProfile(buyerId: string, displayName: string | undefined) {
    const profile = await this.prismaAdmin.buyerProfile.update({
      where: { id: buyerId },
      data: { displayName },
      include: { user: { select: { email: true } } },
    });
    return { id: profile.id, email: profile.user.email, displayName: profile.displayName };
  }

  async listAddresses(buyerId: string) {
    return this.prismaAdmin.buyerSavedAddress.findMany({
      where: { buyerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async createAddress(buyerId: string, dto: BuyerAddressDto) {
    if (dto.isDefault) {
      await this.prismaAdmin.buyerSavedAddress.updateMany({ where: { buyerId }, data: { isDefault: false } });
    }
    return this.prismaAdmin.buyerSavedAddress.create({ data: { buyerId, ...dto } });
  }

  async updateAddress(buyerId: string, addressId: string, dto: BuyerAddressDto) {
    await this.assertOwnsAddress(buyerId, addressId);
    if (dto.isDefault) {
      await this.prismaAdmin.buyerSavedAddress.updateMany({ where: { buyerId }, data: { isDefault: false } });
    }
    return this.prismaAdmin.buyerSavedAddress.update({ where: { id: addressId }, data: { ...dto } });
  }

  async deleteAddress(buyerId: string, addressId: string): Promise<void> {
    await this.assertOwnsAddress(buyerId, addressId);
    await this.prismaAdmin.buyerSavedAddress.delete({ where: { id: addressId } });
  }

  /** FR-66.1 - a buyer's platform-wide order history, filtered to a single store when `storeId` is given. */
  async listOrders(userId: string, storeId?: string) {
    const orders = await this.prismaAdmin.order.findMany({
      where: { buyerId: userId, ...(storeId ? { storeId } : {}) },
      orderBy: { placedAt: "desc" },
      include: { store: { select: { name: true, slug: true } } },
    });
    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      placedAt: order.placedAt,
      currency: order.currency,
      totalAmount: order.totalAmount,
      statusLookupToken: order.statusLookupToken,
      storeName: order.store.name,
      storeSlug: order.store.slug,
    }));
  }

  private async assertOwnsAddress(buyerId: string, addressId: string): Promise<void> {
    const address = await this.prismaAdmin.buyerSavedAddress.findUnique({ where: { id: addressId } });
    if (!address) throw new NotFoundException("Address not found.");
    if (address.buyerId !== buyerId) throw new ForbiddenException("This address does not belong to this account.");
  }
}
