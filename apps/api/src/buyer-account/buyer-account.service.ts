import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
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
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

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

  /**
   * FR-66.5 (Module 85) - a buyer's platform-wide wishlist. Product has no
   * explicit Prisma relation back to Store (only the scalar storeId column
   * - same reasoning OrderPricingService's own comment documents), so
   * stores are batch-loaded separately rather than via `include`.
   */
  async listWishlist(buyerId: string) {
    const items = await this.prismaAdmin.buyerWishlistItem.findMany({
      where: { buyerId },
      orderBy: { createdAt: "desc" },
      include: { product: { include: { variants: true, media: true } } },
    });
    const storeIds = [...new Set(items.map((i) => i.product.storeId))];
    const stores = await this.prismaAdmin.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true, slug: true } });
    const storeById = new Map(stores.map((s) => [s.id, s]));
    return items.map((item) => {
      const store = storeById.get(item.product.storeId);
      return {
        productId: item.productId,
        addedAt: item.createdAt,
        title: item.product.title,
        price: item.product.variants[0] ? Number(item.product.variants[0].price) : null,
        imageUrl: item.product.media[0]?.url ?? null,
        storeName: store?.name ?? "",
        storeSlug: store?.slug ?? "",
      };
    });
  }

  async isWishlisted(buyerId: string, productId: string) {
    const item = await this.prismaAdmin.buyerWishlistItem.findUnique({
      where: { uniq_buyer_wishlist_item: { buyerId, productId } },
    });
    return { wishlisted: Boolean(item) };
  }

  /**
   * Idempotent - calling twice for the same product is a no-op, not an
   * error (a heart-toggle button's "on" state). Server-side plan-gate
   * enforcement (same discipline as BuyerChatService.startChat()) - the
   * storefront never renders the wishlist button unless wishlistEnabled
   * is true, but this endpoint is called directly, so it re-checks.
   */
  async addWishlistItem(buyerId: string, productId: string): Promise<void> {
    const product = await this.prismaAdmin.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException("Product not found.");

    const planContext = await this.subscriptions.getPlanContext(await this.sellerIdForStore(product.storeId));
    const enabled = await this.settings.resolve<boolean>("wishlist.enabled", planContext);
    if (!enabled) throw new ForbiddenException("Wishlist is not available for this store.");

    await this.prismaAdmin.buyerWishlistItem.upsert({
      where: { uniq_buyer_wishlist_item: { buyerId, productId } },
      create: { buyerId, productId },
      update: {},
    });
  }

  /** Idempotent - removing an item that's already gone (or never there) is a no-op, not a 404. */
  async removeWishlistItem(buyerId: string, productId: string): Promise<void> {
    await this.prismaAdmin.buyerWishlistItem.deleteMany({ where: { buyerId, productId } });
  }

  private async sellerIdForStore(storeId: string): Promise<string> {
    const store = await this.prismaAdmin.store.findUniqueOrThrow({ where: { id: storeId }, select: { sellerId: true } });
    return store.sellerId;
  }
}
