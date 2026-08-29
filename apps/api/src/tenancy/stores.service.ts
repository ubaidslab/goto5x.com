import { BadRequestException, ConflictException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { EventsService } from "../events/events.service";
import { MediaAssetsService, UploadableFile } from "../media/media-assets.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { SettingsService } from "../settings-registry/settings.service";
import { sanitizeHeadTags } from "../storefront/head-tag-sanitizer.util";
import { CreateStoreDto } from "./dto/create-store.dto";
import { UpdateStoreDto } from "./dto/update-store.dto";

// Module 58 (SRS §5.65, FR-65.5) - the store-level advanced-SEO fields;
// present-in-dto is the trigger for the Growth+ gate check below, same
// "only enforced when actually touched" shape as every other optional-DTO
// gate in this codebase.
const ADVANCED_SEO_STORE_FIELDS = [
  "seoRobotsIndexDefault",
  "seoRobotsFollowDefault",
  "seoStructuredDataDefault",
  "seoSitemapIncludedDefault",
  "customHeadTags",
] as const;

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
    private readonly mediaAssets: MediaAssetsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly settings: SettingsService,
  ) {}

  /** SRS §5.56/FR-56.1 - plan-tier store-count gate, same check-then-act shape as StaffAccountsService.create()'s staff.max_accounts gate. Per-seller count (a store has no owner other than the seller creating it), never per-store. */
  async create(sellerId: string, dto: CreateStoreDto) {
    const planContext = await this.subscriptions.getPlanContext(sellerId);
    const maxStores = await this.settings.resolve<number>("stores.max_per_seller", planContext);
    const existingCount = await this.tenantPrisma.run(sellerId, (tx) => tx.store.count({ where: { sellerId } }));
    if (existingCount >= maxStores) {
      throw new BadRequestException(`Your plan's store limit (${maxStores}) has been reached.`);
    }

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
        orderBy: { sortOrder: "asc" },
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
    // Module 91 (founder batch B15) - the dashboard's own "locked, not
    // hidden" convention (UpgradeLockedCard) needs to know whether this
    // gate is actually open, same reasoning as updateOwn()'s enforcement
    // below - computed once here rather than a second round-trip.
    const planContext = await this.subscriptions.getPlanContext(sellerId);
    const seoAdvancedFieldsEnabled = await this.settings.resolve<boolean>("seo.advanced_fields_enabled", planContext);
    return { ...stripPasswordHash(rest), logoUrl: logoMedia?.url ?? null, seoAdvancedFieldsEnabled };
  }

  async updateOwn(sellerId: string, storeId: string, dto: UpdateStoreDto) {
    if (ADVANCED_SEO_STORE_FIELDS.some((field) => dto[field] !== undefined)) {
      const planContext = await this.subscriptions.getPlanContext(sellerId);
      const enabled = await this.settings.resolve<boolean>("seo.advanced_fields_enabled", planContext);
      if (!enabled) {
        throw new ForbiddenException("Advanced SEO controls are a Growth-plan feature - upgrade your plan to use them.");
      }
    }

    const store = await this.tenantPrisma.run(sellerId, async (tx) => {
      // Selected WITH the hash here - this is the one internal read that
      // needs to know whether a password already exists, to decide whether
      // switching into password_protected mode is even valid.
      const existing = await tx.store.findUnique({ where: { id: storeId } });
      if (!existing) throw new NotFoundException("Store not found.");

      const { accessPassword, ...rest } = dto;
      const data: typeof rest & { accessPasswordHash?: string } = { ...rest };
      // FR-65.4 - sanitized to the meta/link/script[type=application/ld+json]
      // allowlist here, right before it ever touches the database - never
      // stored raw, regardless of what the seller pasted in.
      if (data.customHeadTags !== undefined) {
        data.customHeadTags = sanitizeHeadTags(data.customHeadTags);
      }

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

  /**
   * Module 16 (SRS §5.20/FR-20.1) - the onboarding wizard's 4-step progress.
   * Theme and logo are read straight off `stores` (theme's ack timestamp is
   * set here or by StoreThemeSettingsService.update(); logo is `logoMediaId`
   * itself); product is a live count (any status - draft counts, this is
   * "has the seller touched product creation at all", not a publish check);
   * domain is a live domain-row count OR its own explicit ack. Once
   * `onboardingCompletedAt` is set it is returned as-is and never
   * recomputed - sticky by design (§14.20), so deleting the only product
   * afterward can never resurrect the wizard.
   */
  async getOnboardingProgress(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      if (store.onboardingCompletedAt) {
        return {
          theme: true,
          logo: true,
          product: true,
          domain: true,
          completedAt: store.onboardingCompletedAt,
        };
      }

      const [productCount, domainCount] = await Promise.all([
        tx.product.count({ where: { storeId } }),
        tx.domain.count({ where: { storeId } }),
      ]);

      const steps = {
        theme: !!store.onboardingThemeAckAt,
        logo: !!store.logoMediaId,
        product: productCount > 0,
        domain: !!store.onboardingDomainAckAt || domainCount > 0,
      };

      let completedAt: Date | null = null;
      if (steps.theme && steps.logo && steps.product && steps.domain) {
        const updated = await tx.store.update({
          where: { id: storeId },
          data: { onboardingCompletedAt: new Date() },
        });
        completedAt = updated.onboardingCompletedAt;
      }

      return { ...steps, completedAt };
    });
  }

  /** The theme step's explicit "keep this theme" path - a seller who never opens the customizer at all still has a valid, deliberate choice to make once. Idempotent; never overwrites an already-set ack (first-write-wins, matching the "any theme-settings save also sets this" path in StoreThemeSettingsService). */
  async ackOnboardingTheme(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      if (!store.onboardingThemeAckAt) {
        await tx.store.update({ where: { id: storeId }, data: { onboardingThemeAckAt: new Date() } });
      }
      return { acknowledged: true };
    });
  }

  /** The domain step's explicit "use the free subdomain" path. Idempotent, same shape as ackOnboardingTheme. */
  async ackOnboardingDomain(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      if (!store.onboardingDomainAckAt) {
        await tx.store.update({ where: { id: storeId }, data: { onboardingDomainAckAt: new Date() } });
      }
      return { acknowledged: true };
    });
  }
}
