import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { EventsService } from "../events/events.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

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
  ) {}

  async create(sellerId: string, storeId: string, dto: CreateProductDto) {
    const product = await this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      if (dto.categoryId) {
        const category = await tx.category.findUnique({ where: { id: dto.categoryId } });
        if (!category) throw new NotFoundException("Category not found.");
      }
      return tx.product.create({
        data: {
          storeId,
          title: dto.title,
          description: dto.description,
          categoryId: dto.categoryId,
          status: dto.status ?? "draft",
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
    return product;
  }

  async list(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.product.findMany({
        where: { storeId },
        include: { variants: true },
        orderBy: { createdAt: "desc" },
      });
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
