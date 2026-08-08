import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ModerationStatus, Prisma } from "@prisma/client";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { EventsService } from "../events/events.service";
import { ModerationService } from "../moderation/moderation.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { SettingsService } from "../settings-registry/settings.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductListQueryDto } from "./dto/product-list-query.dto";

const DEFAULT_PRODUCT_PAGE_LIMIT = 20;
const MAX_PRODUCT_PAGE_LIMIT = 100;

export interface ProductListPage {
  items: unknown[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Every method verifies `storeId` belongs to the calling seller before
 * touching `products`. RLS (docs/database-schema.md, Module 2 migration)
 * already guarantees no *other seller's* data is reachable; what RLS cannot
 * express is "and it's specifically the store named in this URL" for a
 * seller who owns more than one store - that half of FR-2.1's scoping is an
 * application-layer check, done here explicitly rather than assumed.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly events: EventsService,
    private readonly moderation: ModerationService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async create(sellerId: string, storeId: string, dto: CreateProductDto) {
    let queuedReason: string | undefined;
    const product = await this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      // SRS §5.23/FR-23.1 - enforced at creation time, not a soft warning.
      const context = await this.subscriptions.getPlanContext(sellerId);

      // Module 37 (SRS §5.54/FR-54.1) - an admin-applied per-seller block,
      // checked before the plan-limit check since it's a stronger, targeted
      // gate rather than a capacity ceiling. Only blocks NEW listings -
      // never touches products already created.
      const listingBlocked = await this.settings.resolve<boolean>("catalog.listing_blocked", context);
      if (listingBlocked) {
        throw new BadRequestException("New product listings are currently blocked for this seller.");
      }

      const productLimit = await this.settings.resolve<number>("catalog.product_limit", context);
      const existingCount = await tx.product.count({ where: { storeId } });
      if (existingCount >= productLimit) {
        throw new BadRequestException(`Your plan's product limit (${productLimit}) has been reached.`);
      }

      if (dto.categoryId) {
        const category = await tx.category.findUnique({ where: { id: dto.categoryId } });
        if (!category) throw new NotFoundException("Category not found.");
      }
      // Module 6 (SRS §5.27/FR-27.1-27.5) - evaluated inside this same
      // transaction so the probation-count check is consistent with the
      // row being inserted. Throws (blocking creation entirely) on a
      // banned keyword; otherwise decides the row's moderation_status.
      const decision = await this.moderation.evaluateNewProduct(tx, sellerId, {
        title: dto.title,
        description: dto.description,
        categoryId: dto.categoryId,
      });
      queuedReason = decision.reason;
      return tx.product.create({
        data: {
          storeId,
          title: dto.title,
          description: dto.description,
          categoryId: dto.categoryId,
          status: dto.status ?? "draft",
          moderationStatus: decision.status,
          tags: dto.tags ?? [],
        },
      });
    });
    // SRS §3.11/FR-26.5 - after commit, non-blocking (FR-26.3).
    await this.events.emit({
      eventType: "product.created",
      actorType: "seller",
      actorId: sellerId,
      storeId,
      entityType: "product",
      entityId: product.id,
    });
    // SRS §5.27/FR-27.6 - the reason a listing was queued is captured too,
    // not only the eventual approve/reject decision. Best-effort (see
    // ModerationService.recordQueued's own comment).
    if (queuedReason) {
      await this.moderation.recordQueued(product.id, storeId, queuedReason);
    }
    return product;
  }

  /**
   * SRS §5.57/FR-57.2/57.3 - search/tag/stock-status/price-range/category/
   * moderation-state filters, all combinable, plus pagination (same
   * {items,page,limit,total,totalPages} shape as Phase B item 3's
   * WalletService.getTransactionHistory()). Stock status is derived from
   * the store's own `inventory.low_stock_threshold` (Module 28), using a
   * "worst variant wins" rule: a product is "out" if any trackable variant
   * is at 0, "low" if any trackable variant is at/under the threshold but
   * none are at 0, and "in" otherwise (including products with no
   * trackable variants at all) - simple enough to explain to a seller in
   * one sentence, per the Simplicity Invariant.
   */
  async list(sellerId: string, storeId: string, query: ProductListQueryDto = {}): Promise<ProductListPage> {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      const page = query.page ?? 1;
      const limit = Math.min(query.limit ?? DEFAULT_PRODUCT_PAGE_LIMIT, MAX_PRODUCT_PAGE_LIMIT);

      const conditions: Prisma.ProductWhereInput[] = [{ storeId }];

      if (query.search) {
        conditions.push({
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { variants: { some: { sku: { contains: query.search, mode: "insensitive" } } } },
          ],
        });
      }
      if (query.tag) {
        conditions.push({ tags: { has: query.tag } });
      }
      if (query.categoryId) {
        conditions.push({ categoryId: query.categoryId });
      }
      if (query.moderationStatus) {
        conditions.push({ moderationStatus: query.moderationStatus as ModerationStatus });
      }
      if (query.minPrice != null || query.maxPrice != null) {
        conditions.push({
          variants: {
            some: {
              price: {
                ...(query.minPrice != null ? { gte: query.minPrice } : {}),
                ...(query.maxPrice != null ? { lte: query.maxPrice } : {}),
              },
            },
          },
        });
      }
      if (query.stockStatus) {
        const threshold = await this.settings.resolve<number>("inventory.low_stock_threshold", { storeId });
        const atOrUnderThreshold: Prisma.ProductWhereInput = {
          variants: { some: { trackInventory: true, stockQuantity: { lte: threshold } } },
        };
        const anyOut: Prisma.ProductWhereInput = {
          variants: { some: { trackInventory: true, stockQuantity: { lte: 0 } } },
        };
        if (query.stockStatus === "in") {
          conditions.push({ NOT: atOrUnderThreshold });
        } else if (query.stockStatus === "low") {
          conditions.push(atOrUnderThreshold, { NOT: anyOut });
        } else {
          conditions.push(anyOut);
        }
      }

      const where: Prisma.ProductWhereInput = { AND: conditions };

      const [items, total] = await Promise.all([
        tx.product.findMany({
          where,
          include: { variants: true },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        tx.product.count({ where }),
      ]);

      return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
    });
  }

  async getOne(sellerId: string, storeId: string, productId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, include: { variants: true } });
      if (!product || product.storeId !== storeId) throw new NotFoundException("Product not found.");
      return product;
    });
  }

  async update(sellerId: string, storeId: string, productId: string, dto: UpdateProductDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.product.findUnique({ where: { id: productId } });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Product not found.");
      if (dto.categoryId) {
        const category = await tx.category.findUnique({ where: { id: dto.categoryId } });
        if (!category) throw new NotFoundException("Category not found.");
      }
      return tx.product.update({ where: { id: productId }, data: dto });
    });
  }

  async remove(sellerId: string, storeId: string, productId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.product.findUnique({ where: { id: productId } });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Product not found.");
      const variantCount = await tx.productVariant.count({ where: { productId } });
      if (variantCount > 0) {
        throw new ConflictException("Delete this product's variants before deleting the product.");
      }
      await tx.product.delete({ where: { id: productId } });
      return { deleted: true };
    });
  }
}
