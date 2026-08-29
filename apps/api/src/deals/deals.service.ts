import { randomBytes } from "crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { StorefrontService } from "../storefront/storefront.service";
import { round2 } from "../orders/money.util";
import { BuyNowDto } from "./dto/buy-now.dto";
import { CreateDealDto } from "./dto/create-deal.dto";
import { DealItemInputDto } from "./dto/deal-item-input.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";

/**
 * SRS §5.67/FR-67.1-67.5 (Module 91) - a seller-created bundle of their own
 * products/variants sold together at one uniform percentage off. Seller-
 * facing CRUD runs through TenantPrismaService (RLS), mirroring
 * DiscountCodesService/CollectionsService's shape; the buyer-facing
 * listing/detail/buy-now paths are pre-auth and run through
 * PrismaAdminService (BYPASSRLS), same reasoning as StorefrontService/
 * CartService - an anonymous buyer has no seller session to `SET LOCAL
 * app.current_seller_id` for.
 */
@Injectable()
export class DealsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly storefront: StorefrontService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
  ) {}

  private async assertItemsBelongToStore(tx: Prisma.TransactionClient, storeId: string, items: DealItemInputDto[]) {
    const variantIds = [...new Set(items.map((i) => i.variantId))];
    const variants = await tx.productVariant.findMany({ where: { id: { in: variantIds } } });
    const variantById = new Map(variants.map((v) => [v.id, v]));
    for (const item of items) {
      const variant = variantById.get(item.variantId);
      if (!variant || variant.productId !== item.productId || variant.storeId !== storeId) {
        throw new NotFoundException(`Product or variant not found in this store: ${item.productId}/${item.variantId}`);
      }
    }
  }

  async create(sellerId: string, storeId: string, dto: CreateDealDto) {
    if (new Set(dto.items.map((i) => i.variantId)).size !== dto.items.length) {
      throw new BadRequestException("A deal cannot include the same variant more than once.");
    }
    try {
      return await this.tenantPrisma.run(sellerId, async (tx) => {
        const store = await tx.store.findUnique({ where: { id: storeId } });
        if (!store) throw new NotFoundException("Store not found.");
        await this.assertItemsBelongToStore(tx, storeId, dto.items);

        return tx.deal.create({
          data: {
            storeId,
            title: dto.title,
            slug: dto.slug,
            description: dto.description,
            thumbnailMediaId: dto.thumbnailMediaId,
            discountPercent: dto.discountPercent,
            status: "draft",
            startsAt: dto.startsAt,
            endsAt: dto.endsAt,
            items: {
              create: dto.items.map((item, index) => ({
                storeId,
                productId: item.productId,
                variantId: item.variantId,
                sortOrder: item.sortOrder ?? index,
              })),
            },
          },
          include: { items: { include: { product: true, variant: true }, orderBy: { sortOrder: "asc" } } },
        });
      });
    } catch (err) {
      // Same reasoning as CollectionsService.create() - the (store_id, slug)
      // unique constraint is the source of truth for the race, not a
      // pre-check scoped to this seller's RLS session.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Slug "${dto.slug}" is already used by another deal in this store.`);
      }
      throw err;
    }
  }

  async list(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.deal.findMany({
        where: { storeId },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      });
    });
  }

  async getOne(sellerId: string, storeId: string, dealId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        include: { items: { include: { product: true, variant: true }, orderBy: { sortOrder: "asc" } } },
      });
      if (!deal || deal.storeId !== storeId) throw new NotFoundException("Deal not found.");
      return deal;
    });
  }

  async update(sellerId: string, storeId: string, dealId: string, dto: UpdateDealDto) {
    try {
      return await this.tenantPrisma.run(sellerId, async (tx) => {
        const existing = await tx.deal.findUnique({ where: { id: dealId } });
        if (!existing || existing.storeId !== storeId) throw new NotFoundException("Deal not found.");
        return tx.deal.update({ where: { id: dealId }, data: dto });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Slug "${dto.slug}" is already used by another deal in this store.`);
      }
      throw err;
    }
  }

  async remove(sellerId: string, storeId: string, dealId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.deal.findUnique({ where: { id: dealId } });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Deal not found.");
      await tx.dealItem.deleteMany({ where: { dealId } });
      await tx.deal.delete({ where: { id: dealId } });
      return { deleted: true };
    });
  }

  async addItem(sellerId: string, storeId: string, dealId: string, dto: DealItemInputDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: dealId } });
      if (!deal || deal.storeId !== storeId) throw new NotFoundException("Deal not found.");
      await this.assertItemsBelongToStore(tx, storeId, [dto]);
      try {
        return await tx.dealItem.create({
          data: { storeId, dealId, productId: dto.productId, variantId: dto.variantId, sortOrder: dto.sortOrder ?? 0 },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new ConflictException("This variant is already in the deal.");
        }
        throw err;
      }
    });
  }

  async removeItem(sellerId: string, storeId: string, dealId: string, dealItemId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: dealId } });
      if (!deal || deal.storeId !== storeId) throw new NotFoundException("Deal not found.");
      const item = await tx.dealItem.findUnique({ where: { id: dealItemId } });
      if (!item || item.dealId !== dealId) throw new NotFoundException("Deal item not found.");
      await tx.dealItem.delete({ where: { id: dealItemId } });
      return { deleted: true };
    });
  }

  // --- Storefront (public, pre-auth) ---

  private isWithinWindow(deal: { startsAt: Date | null; endsAt: Date | null }): boolean {
    const now = Date.now();
    if (deal.startsAt && deal.startsAt.getTime() > now) return false;
    if (deal.endsAt && deal.endsAt.getTime() < now) return false;
    return true;
  }

  private readonly dealPublicInclude = {
    items: {
      include: { product: { include: { media: { where: { isPrimary: true }, take: 1 } } }, variant: true },
      orderBy: { sortOrder: "asc" as const },
    },
    thumbnailMedia: true,
  };

  /** Never exposes raw Prisma fields (moderationStatus, baseCost, timestamps, etc.) to the public storefront - only what a buyer needs to see. */
  private toPublicDeal(deal: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    discountPercent: unknown;
    startsAt: Date | null;
    endsAt: Date | null;
    thumbnailMedia: { url: string } | null;
    items: {
      productId: string;
      variantId: string;
      product: { title: string; media: { url: string }[] };
      variant: { price: unknown; stockQuantity: number; trackInventory: boolean };
    }[];
  }) {
    return {
      id: deal.id,
      title: deal.title,
      slug: deal.slug,
      description: deal.description,
      discountPercent: Number(deal.discountPercent),
      startsAt: deal.startsAt,
      endsAt: deal.endsAt,
      thumbnailUrl: deal.thumbnailMedia?.url ?? null,
      items: deal.items.map((item) => {
        const price = Number(item.variant.price);
        return {
          productId: item.productId,
          variantId: item.variantId,
          title: item.product.title,
          imageUrl: item.product.media[0]?.url ?? null,
          price,
          discountedPrice: DealsService.discountedUnitPrice(price, Number(deal.discountPercent)),
          inStock: !item.variant.trackInventory || item.variant.stockQuantity > 0,
        };
      }),
    };
  }

  private async loadActiveDealOrThrow(hostname: string, dealId: string) {
    const store = await this.storefront.loadActiveStoreOrThrow(hostname);
    const deal = await this.prismaAdmin.deal.findUnique({
      where: { id: dealId },
      include: this.dealPublicInclude,
    });
    if (!deal || deal.storeId !== store.id || deal.status !== "active" || !this.isWithinWindow(deal)) {
      throw new NotFoundException("Deal not found.");
    }
    return deal;
  }

  async listActive(hostname: string) {
    const store = await this.storefront.loadActiveStoreOrThrow(hostname);
    const deals = await this.prismaAdmin.deal.findMany({
      where: { storeId: store.id, status: "active" },
      include: this.dealPublicInclude,
      orderBy: { createdAt: "desc" },
    });
    return deals.filter((d) => this.isWithinWindow(d)).map((d) => this.toPublicDeal(d));
  }

  async getActiveOne(hostname: string, dealId: string) {
    const deal = await this.loadActiveDealOrThrow(hostname, dealId);
    return this.toPublicDeal(deal);
  }

  /**
   * FR-67.2 - pre-populates a real Cart row with every DealItem, tagged
   * with `dealId` so CheckoutService.placeOrder() can apply the live
   * percentage discount once this cart converts to an order through the
   * ordinary /storefront/checkout endpoint, completely unchanged. Discount
   * is never computed or stored here - only at placeOrder() time, against
   * whatever the variant's price is at that exact moment (never
   * snapshotted, per the founder-approved model).
   */
  async buyNow(dealId: string, dto: BuyNowDto, ip: string) {
    const buyNowLimit = await this.settings.resolve<number>("deals.buy_now_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`deal-buy-now-ip:${ip}`, buyNowLimit);

    const deal = await this.loadActiveDealOrThrow(dto.hostname, dealId);
    if (deal.items.length === 0) {
      throw new BadRequestException("This deal has no items and cannot be purchased.");
    }

    const cart = await this.prismaAdmin.cart.create({
      data: {
        storeId: deal.storeId,
        dealId: deal.id,
        buyerEmail: dto.buyerEmail,
        buyerWhatsapp: dto.buyerWhatsapp ?? null,
        sessionToken: randomBytes(32).toString("hex"),
        items: deal.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: 1 })) as unknown as object,
      },
    });

    return {
      sessionToken: cart.sessionToken,
      dealId: deal.id,
      dealTitle: deal.title,
      discountPercent: Number(deal.discountPercent),
      items: deal.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        title: item.product.title,
        unitPrice: Number(item.variant.price),
      })),
    };
  }

  /** FR-67.5 - store-scoped only, called from AnalyticsService; kept here so a deal's title/id lookup stays co-located with the rest of DealsService. */
  static discountedUnitPrice(price: number, discountPercent: number): number {
    return round2(price * (1 - discountPercent / 100));
  }
}
