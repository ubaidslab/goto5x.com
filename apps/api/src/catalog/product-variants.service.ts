import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
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
          trackInventory: dto.trackInventory ?? true,
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
      try {
        await tx.productVariant.delete({ where: { id: variantId } });
      } catch (err) {
        // Security-checklist audit finding: OrderItem.variantId is a required
        // FK with no onDelete action, so Postgres already rejects this at the
        // DB level once a real order references the variant - this only
        // translates that rejection into a clean 409 instead of an uncaught
        // P2003 reaching the client. This is also what keeps Product.remove()
        // above safe from ever destroying order history: a product can only
        // reach zero variants once every variant that ever had an order has
        // already failed to delete here.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
          throw new ConflictException("This variant has order history and cannot be deleted.");
        }
        throw err;
      }
      return { deleted: true };
    });
  }
}
