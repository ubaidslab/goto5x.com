import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { CreateStoreDto } from "./dto/create-store.dto";
import { UpdateStoreDto } from "./dto/update-store.dto";

/**
 * Every method here goes through TenantPrismaService.run(sellerId, ...),
 * which sets the RLS session variable before the query runs. This is
 * deliberately the ONLY way this service touches `stores` - there is no
 * "trust me, I filtered by sellerId in the WHERE clause" code path, because
 * the database enforces it independently (SRS §3.2's two-layer model).
 */
@Injectable()
export class StoresService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(sellerId: string, dto: CreateStoreDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existingSlug = await tx.store.findUnique({ where: { slug: dto.slug } });
      if (existingSlug) {
        throw new ConflictException(`Slug "${dto.slug}" is already taken.`);
      }
      return tx.store.create({
        data: { sellerId, name: dto.name, slug: dto.slug },
      });
    });
  }

  async listOwn(sellerId: string) {
    return this.tenantPrisma.run(sellerId, (tx) => tx.store.findMany({ orderBy: { createdAt: "asc" } }));
  }

  async getOwn(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      // RLS already guarantees this can never be another seller's store, but
      // findUnique-by-id-alone still needs a null check for "doesn't exist at all".
      if (!store) throw new NotFoundException("Store not found.");
      return store;
    });
  }

  async updateOwn(sellerId: string, storeId: string, dto: UpdateStoreDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.store.findUnique({ where: { id: storeId } });
      if (!existing) throw new NotFoundException("Store not found.");
      return tx.store.update({ where: { id: storeId }, data: dto });
    });
  }
}
