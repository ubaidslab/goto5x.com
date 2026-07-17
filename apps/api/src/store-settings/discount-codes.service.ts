import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { CreateDiscountCodeDto } from "./dto/create-discount-code.dto";
import { UpdateDiscountCodeDto } from "./dto/update-discount-code.dto";

/**
 * SRS FR-2.11. CRUD + tenant isolation only - validating a code at checkout
 * (expiry/usage-limit/store match, FR-5.5) and incrementing `usageCount`
 * atomically happen in Module 9 once checkout exists, not here.
 */
@Injectable()
export class DiscountCodesService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private assertValueInRange(type: string, value: number): void {
    if (type === "percentage" && value > 100) {
      throw new BadRequestException("A percentage discount cannot exceed 100.");
    }
  }

  async create(sellerId: string, storeId: string, dto: CreateDiscountCodeDto) {
    this.assertValueInRange(dto.type, dto.value);
    try {
      return await this.tenantPrisma.run(sellerId, async (tx) => {
        const store = await tx.store.findUnique({ where: { id: storeId } });
        if (!store) throw new NotFoundException("Store not found.");
        return tx.discountCode.create({
          data: {
            storeId,
            code: dto.code,
            type: dto.type,
            value: dto.value,
            expiresAt: dto.expiresAt,
            usageLimit: dto.usageLimit,
          },
        });
      });
    } catch (err) {
      // Same reasoning as CollectionsService.create() - the unique
      // constraint (store_id, code) is the source of truth for the race,
      // not a pre-check scoped to this seller's RLS session.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Code "${dto.code}" is already used by another discount code in this store.`);
      }
      throw err;
    }
  }

  async list(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.discountCode.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
    });
  }

  async getOne(sellerId: string, storeId: string, discountCodeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const discountCode = await tx.discountCode.findUnique({ where: { id: discountCodeId } });
      if (!discountCode || discountCode.storeId !== storeId) {
        throw new NotFoundException("Discount code not found.");
      }
      return discountCode;
    });
  }

  async update(sellerId: string, storeId: string, discountCodeId: string, dto: UpdateDiscountCodeDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.discountCode.findUnique({ where: { id: discountCodeId } });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Discount code not found.");
      if (dto.value !== undefined) {
        this.assertValueInRange(existing.type, dto.value);
      }
      return tx.discountCode.update({ where: { id: discountCodeId }, data: dto });
    });
  }

  async remove(sellerId: string, storeId: string, discountCodeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.discountCode.findUnique({ where: { id: discountCodeId } });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Discount code not found.");
      await tx.discountCode.delete({ where: { id: discountCodeId } });
      return { deleted: true };
    });
  }
}
