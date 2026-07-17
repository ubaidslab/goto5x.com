import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { AddCollectionProductDto } from "./dto/add-collection-product.dto";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";

/**
 * Every method verifies `storeId` belongs to the calling seller before
 * touching `collections`/`collection_products` - same app-layer discipline
 * as every tenant service since Module 2 (RLS proves "not another seller's
 * row," not "not my OWN other store's row").
 */
@Injectable()
export class CollectionsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(sellerId: string, storeId: string, dto: CreateCollectionDto) {
    try {
      return await this.tenantPrisma.run(sellerId, async (tx) => {
        const store = await tx.store.findUnique({ where: { id: storeId } });
        if (!store) throw new NotFoundException("Store not found.");
        return tx.collection.create({
          data: {
            storeId,
            title: dto.title,
            slug: dto.slug,
            description: dto.description,
            isActive: dto.isActive ?? true,
            seoTitle: dto.seoTitle,
            seoDescription: dto.seoDescription,
          },
        });
      });
    } catch (err) {
      // Same reasoning as DomainsService.attach() - a pre-check findUnique()
      // scoped to this seller's RLS session would make another seller's
      // identically-slugged collection at a DIFFERENT store invisible
      // (there's no cross-store uniqueness anyway - the constraint is
      // per-store - but a same-store race is real), so the unique
      // constraint itself is the source of truth, not a pre-check.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Slug "${dto.slug}" is already used by another collection in this store.`);
      }
      throw err;
    }
  }

  async list(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.collection.findMany({ where: { storeId }, orderBy: { createdAt: "asc" } });
    });
  }

  async getOne(sellerId: string, storeId: string, collectionId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const collection = await tx.collection.findUnique({
        where: { id: collectionId },
        include: { products: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
      });
      if (!collection || collection.storeId !== storeId) throw new NotFoundException("Collection not found.");
      return collection;
    });
  }

  async update(sellerId: string, storeId: string, collectionId: string, dto: UpdateCollectionDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.collection.findUnique({ where: { id: collectionId } });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Collection not found.");
      return tx.collection.update({ where: { id: collectionId }, data: dto });
    });
  }

  async remove(sellerId: string, storeId: string, collectionId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.collection.findUnique({ where: { id: collectionId } });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Collection not found.");
      await tx.collectionProduct.deleteMany({ where: { collectionId } });
      await tx.collection.delete({ where: { id: collectionId } });
      return { deleted: true };
    });
  }

  async addProduct(sellerId: string, storeId: string, collectionId: string, dto: AddCollectionProductDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const collection = await tx.collection.findUnique({ where: { id: collectionId } });
      if (!collection || collection.storeId !== storeId) throw new NotFoundException("Collection not found.");
      const product = await tx.product.findUnique({ where: { id: dto.productId } });
      if (!product || product.storeId !== storeId) throw new NotFoundException("Product not found.");

      const existing = await tx.collectionProduct.findFirst({
        where: { collectionId, productId: dto.productId },
      });
      if (existing) throw new ConflictException("This product is already in the collection.");

      return tx.collectionProduct.create({
        data: { storeId, collectionId, productId: dto.productId, sortOrder: dto.sortOrder ?? 0 },
      });
    });
  }

  async reorderProduct(
    sellerId: string,
    storeId: string,
    collectionId: string,
    productId: string,
    sortOrder: number,
  ) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const collection = await tx.collection.findUnique({ where: { id: collectionId } });
      if (!collection || collection.storeId !== storeId) throw new NotFoundException("Collection not found.");
      const entry = await tx.collectionProduct.findFirst({ where: { collectionId, productId } });
      if (!entry) throw new NotFoundException("Product is not in this collection.");
      return tx.collectionProduct.update({ where: { id: entry.id }, data: { sortOrder } });
    });
  }

  async removeProduct(sellerId: string, storeId: string, collectionId: string, productId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const collection = await tx.collection.findUnique({ where: { id: collectionId } });
      if (!collection || collection.storeId !== storeId) throw new NotFoundException("Collection not found.");
      const entry = await tx.collectionProduct.findFirst({ where: { collectionId, productId } });
      if (!entry) throw new NotFoundException("Product is not in this collection.");
      await tx.collectionProduct.delete({ where: { id: entry.id } });
      return { deleted: true };
    });
  }
}
