import { Injectable } from "@nestjs/common";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { SettingsService } from "../settings-registry/settings.service";

/**
 * `themes` is a global, admin-managed catalog with no RLS (schema.prisma's
 * doc comment on the `Theme` model) - every seller reads the same rows, so
 * this deliberately goes through PrismaRuntimeService directly rather than
 * TenantPrismaService.run(), there being no seller-scoped session variable
 * relevant to a table nothing here filters by seller/store.
 *
 * Module 18 (FR-24.5) - `entitled` is computed per calling seller: always
 * true for `free`/`premium` (unaffected by this module), and true for
 * `marketplace` only if a live TemplateEntitlement row exists - the
 * dashboard uses this to show a marketplace theme as locked/unlocked
 * without a second round-trip.
 */
@Injectable()
export class ThemesService {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** FR-24.1/24.2 - empty in v1.0 (no Template Store yet); the dashboard hides the showcase panel rather than rendering a broken link. */
  async getTemplateStoreShowcaseUrl(): Promise<string | null> {
    const url = await this.settings.resolve<string>("template_store.showcase_url");
    return url || null;
  }

  async listSelectable(sellerId: string) {
    const themes = await this.prisma.theme.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    const entitlements = await this.tenantPrisma.run(sellerId, (tx) =>
      tx.templateEntitlement.findMany({ where: { revokedAt: null } }),
    );
    const entitledThemeIds = new Set(entitlements.map((e) => e.themeId));
    return themes.map((theme) => ({
      ...theme,
      entitled: theme.tier !== "marketplace" || entitledThemeIds.has(theme.id),
    }));
  }
}
