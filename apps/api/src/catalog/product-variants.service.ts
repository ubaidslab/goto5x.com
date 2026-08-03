import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { CreateVariantDto } from "./dto/create-variant.dto";
import { UpdateVariantDto } from "./dto/update-variant.dto";

async function assertOwnsProduct(tx: Prisma.TransactionClient, storeId: string, productId: string) {
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product || product.storeId !== storeId) throw new NotFoundException("Product not found.");
}

/** Inventory tracking (FR-2.1) is `stockQuantity` on this table - update() is the one path that adjusts it. */
@Injectable()
export class ProductVariantsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(sellerId: string, storeId: string, productId: string, dto: CreateVariantDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      await assertOwnsProduct(tx, storeId, productId);
      return tx.productVariant.create({
        data: {
          storeId,
          productId,
          sku: dto.sku,
          price: dto.price,
          compareAtPrice: dto.compareAtPrice,
          stockQuantity: dto.stockQuantity ?? 0,
          attributes: (dto.attributes ?? {}) as Prisma.InputJsonValue,
          baseCost: dto.baseCost,
        },
      });
    });
  }

  async list(sellerId: string, storeId: string, productId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      await assertOwnsProduct(tx, storeId, productId);
      return tx.productVariant.findMany({ where: { productId } });
    });
  }

  async update(sellerId: string, storeId: string, productId: string, variantId: string, dto: UpdateVariantDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      await assertOwnsProduct(tx, storeId, productId);
      const existing = await tx.productVariant.findUnique({ where: { id: variantId } });
      if (!existing || existing.productId !== productId) throw new NotFoundException("Variant not found.");
      return tx.productVariant.update({
        where: { id: variantId },
        data: { ...dto, attributes: dto.attributes as Prisma.InputJsonValue | undefined },
      });
    });
  }

  async remove(sellerId: string, storeId: string, productId: string, variantId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      await assertOwnsProduct(tx, storeId, productId);
      const existing = await tx.productVariant.findUnique({ where: { id: variantId } });
      if (!existing || existing.productId !== productId) throw new NotFoundException("Variant not found.");
      await tx.productVariant.delete({ where: { id: variantId } });
      return { deleted: true };
    });
  }
}
