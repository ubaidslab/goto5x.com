import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { EventsService } from "../events/events.service";
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
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly events: EventsService,
  ) {}

  async create(sellerId: string, dto: CreateStoreDto) {
    const store = await this.tenantPrisma.run(sellerId, async (tx) => {
      const existingSlug = await tx.store.findUnique({ where: { slug: dto.slug } });
      if (existingSlug) {
        throw new ConflictException(`Slug "${dto.slug}" is already taken.`);
      }
      const created = await tx.store.create({
        data: { sellerId, name: dto.name, slug: dto.slug },
      });
      // SRS FR-1.2/§14.1 (Module 4) - every store gets a theme the moment it
      // exists, so the customizer/storefront never have to handle "no theme
      // assigned yet" as a state. `themes` has no RLS (global catalog), so
      // this read is unaffected by the seller-scoped session this
      // transaction is already running under.
      const defaultTheme = await tx.theme.findFirst({
        where: { tier: "free", isActive: true },
        orderBy: { name: "asc" },
      });
      if (!defaultTheme) {
        // Deliberately fails loudly rather than silently creating a store
        // with no theme settings - this is a deployment/seeding bug (see
        // README's local-setup step 6b), not a recoverable user-facing
        // condition, same discipline as a missing Settings Registry key
        // throwing instead of guessing a value.
        throw new InternalServerErrorException(
          "No active free theme is seeded - run src/theme-engine/themes.seed.ts before creating stores.",
        );
      }
      await tx.storeThemeSettings.create({
        data: { storeId: created.id, themeId: defaultTheme.id },
      });
      return created;
    });
    // SRS §3.11/FR-26.5 - after commit, non-blocking (FR-26.3).
    await this.events.emit({
      eventType: "store.created",
      actorType: "seller",
      actorId: sellerId,
      storeId: store.id,
      entityType: "store",
      entityId: store.id,
    });
    return store;
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
