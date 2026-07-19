import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { EventsService } from "../events/events.service";
import { FreeStoreLimitService } from "../guardrails/free-store-limit.service";
import { MediaAssetsService, UploadableFile } from "../media/media-assets.service";
import { CreateStoreDto } from "./dto/create-store.dto";
import { UpdateStoreDto } from "./dto/update-store.dto";

const BCRYPT_ROUNDS = 12; // matches AuthService's own password hashing cost

/** Never let `access_password_hash` leave this service in any response. */
function stripPasswordHash<T extends { accessPasswordHash?: string | null }>(
  store: T,
): Omit<T, "accessPasswordHash"> {
  const { accessPasswordHash: _omit, ...rest } = store;
  return rest;
}

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
    private readonly freeStoreLimit: FreeStoreLimitService,
    private readonly mediaAssets: MediaAssetsService,
  ) {}

  async create(sellerId: string, dto: CreateStoreDto) {
    // SRS §5.23/FR-23.5 - checked before opening the tenant transaction
    // below (it deliberately reads cross-tenant, via PrismaAdminService).
    await this.freeStoreLimit.enforce(sellerId);

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
      // Module 7 (FR-2.10/FR-19.3) - same "never a missing-row state" reasoning
      // as themeSettings above: every store has a shipping/tax settings row
      // (with sensible v1.0 defaults) the moment it exists, so Module 9's
      // checkout never has to special-case "no settings configured yet".
      await tx.storeShippingSettings.create({ data: { storeId: created.id } });
      await tx.storeTaxSettings.create({ data: { storeId: created.id } });
      // Module 11 prerequisite fix (FR-6.14) - same auto-create discipline;
      // CheckoutService.placeOrder() assumes this row always exists.
      await tx.storePaymentInstructions.create({ data: { storeId: created.id } });
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
    return stripPasswordHash(store);
  }

  async listOwn(sellerId: string) {
    const stores = await this.tenantPrisma.run(sellerId, (tx) => tx.store.findMany({ orderBy: { createdAt: "asc" } }));
    return stores.map(stripPasswordHash);
  }

  async getOwn(sellerId: string, storeId: string) {
    const store = await this.tenantPrisma.run(sellerId, async (tx) => {
      const found = await tx.store.findUnique({
        where: { id: storeId },
        include: { logoMedia: { select: { url: true } } },
      });
      // RLS already guarantees this can never be another seller's store, but
      // findUnique-by-id-alone still needs a null check for "doesn't exist at all".
      if (!found) throw new NotFoundException("Store not found.");
      return found;
    });
    // FR-32.5 - flattened alongside the raw FK for dashboard convenience.
    const { logoMedia, ...rest } = store;
    return { ...stripPasswordHash(rest), logoUrl: logoMedia?.url ?? null };
  }

  async updateOwn(sellerId: string, storeId: string, dto: UpdateStoreDto) {
    const store = await this.tenantPrisma.run(sellerId, async (tx) => {
      // Selected WITH the hash here - this is the one internal read that
      // needs to know whether a password already exists, to decide whether
      // switching into password_protected mode is even valid.
      const existing = await tx.store.findUnique({ where: { id: storeId } });
      if (!existing) throw new NotFoundException("Store not found.");

      const { accessPassword, ...rest } = dto;
      const data: typeof rest & { accessPasswordHash?: string } = { ...rest };

      if (accessPassword) {
        data.accessPasswordHash = await bcrypt.hash(accessPassword, BCRYPT_ROUNDS);
      }

      const nextAccessMode = dto.accessMode ?? existing.accessMode;
      const willHavePassword = Boolean(data.accessPasswordHash ?? existing.accessPasswordHash);
      if (nextAccessMode === "password_protected" && !willHavePassword) {
        throw new BadRequestException(
          "Set accessPassword before switching accessMode to password_protected - no password exists yet.",
        );
      }

      return tx.store.update({ where: { id: storeId }, data });
    });
    return stripPasswordHash(store);
  }

  /**
   * FR-32.5 - reuses the existing media-upload pipeline (quota metering,
   * storage) rather than a second upload path; only this store's own
   * previous logo (if any) is cleaned up, never any other media asset.
   */
  async setLogo(sellerId: string, storeId: string, file: UploadableFile) {
    const asset = await this.mediaAssets.uploadDirect(sellerId, storeId, file);
    const previousLogoMediaId = await this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.store.findUnique({ where: { id: storeId } });
      if (!existing) throw new NotFoundException("Store not found.");
      await tx.store.update({ where: { id: storeId }, data: { logoMediaId: asset.id } });
      return existing.logoMediaId;
    });
    if (previousLogoMediaId) {
      // Best-effort - an orphaned old logo asset is a cheap cleanup problem,
      // not worth failing the (already-succeeded) new upload over.
      await this.mediaAssets.remove(sellerId, storeId, previousLogoMediaId).catch(() => undefined);
    }
    return { logoUrl: asset.url };
  }

  /** FR-32.5 - clears the logo; every surface falls back to its typographic mark. */
  async removeLogo(sellerId: string, storeId: string) {
    const previousLogoMediaId = await this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.store.findUnique({ where: { id: storeId } });
      if (!existing) throw new NotFoundException("Store not found.");
      await tx.store.update({ where: { id: storeId }, data: { logoMediaId: null } });
      return existing.logoMediaId;
    });
    if (previousLogoMediaId) {
      await this.mediaAssets.remove(sellerId, storeId, previousLogoMediaId).catch(() => undefined);
    }
    return { removed: true };
  }
}
