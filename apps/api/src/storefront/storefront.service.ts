import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { resolveSeoFallback } from "./seo-fallback.util";

/**
 * Public, unauthenticated storefront read API - every method here runs
 * *before* any tenant/seller session exists (an anonymous buyer's browser
 * hitting a storefront hostname), so PrismaAdminService (BYPASSRLS) is the
 * correct tool, same reasoning as DomainsService.resolveStoreIdByHostname
 * (Module 3) - see PrismaAdminService's doc comment for the two legitimate
 * BYPASSRLS use cases.
 */
@Injectable()
export class StorefrontService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * A verified custom domain takes precedence (FR-11.2); the free
   * `<slug>.<platform_root_domain>` subdomain is the fallback every store
   * always has. An *unverified* custom domain never resolves here - Traefik
   * itself never routes traffic for one in production (Module 3 only
   * writes its dynamic-config router entry once verified), so treating an
   * unverified domain as unresolvable here matches what would actually
   * happen end-to-end, not just this method in isolation.
   */
  async resolveStoreIdByHostname(hostname: string): Promise<string | null> {
    const normalized = hostname.trim().toLowerCase();

    const domain = await this.prismaAdmin.domain.findFirst({
      where: { domainName: normalized, verificationStatus: "verified" },
    });
    if (domain) return domain.storeId;

    const rootDomain = await this.settings.resolve<string>("domains.platform_root_domain");
    const suffix = `.${rootDomain}`;
    if (normalized.endsWith(suffix)) {
      const slug = normalized.slice(0, -suffix.length);
      const store = await this.prismaAdmin.store.findUnique({ where: { slug } });
      if (store) return store.id;
    }

    return null;
  }

  private async loadActiveStoreOrThrow(hostname: string) {
    const storeId = await this.resolveStoreIdByHostname(hostname);
    if (!storeId) throw new NotFoundException("No store found for this hostname.");
    const store = await this.prismaAdmin.store.findUnique({
      where: { id: storeId },
      include: { themeSettings: { include: { theme: true } }, domains: true },
    });
    // A suspended/banned/archived store is not publicly reachable at all -
    // no different from the hostname not resolving to anything.
    if (!store || store.status !== "active") {
      throw new NotFoundException("Store not found.");
    }
    return store;
  }

  private async canonicalHostnameFor(store: { slug: string; domains: { domainName: string; verificationStatus: string }[] }) {
    const verified = store.domains.find((d) => d.verificationStatus === "verified");
    if (verified) return verified.domainName;
    const rootDomain = await this.settings.resolve<string>("domains.platform_root_domain");
    return `${store.slug}.${rootDomain}`;
  }

  async getStorePublic(hostname: string) {
    const store = await this.loadActiveStoreOrThrow(hostname);
    const canonicalHostname = await this.canonicalHostnameFor(store);
    const seo = resolveSeoFallback({
      seoTitle: store.seoTitle,
      seoDescription: store.seoDescription,
      fallbackName: store.name,
    });

    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      currency: store.currency,
      accessMode: store.accessMode,
      canonicalHostname,
      seoTitle: seo.title,
      seoDescription: seo.description,
      theme: store.themeSettings
        ? {
            name: store.themeSettings.theme.name,
            settings: store.themeSettings.settings,
          }
        : null,
    };
  }

  async listProducts(hostname: string) {
    const store = await this.loadActiveStoreOrThrow(hostname);
    const products = await this.prismaAdmin.product.findMany({
      where: { storeId: store.id, status: "active" },
      include: { variants: true, media: true },
      orderBy: { createdAt: "desc" },
    });
    return products.map((product) => this.toPublicProduct(product, store));
  }

  async getProduct(hostname: string, productId: string) {
    const store = await this.loadActiveStoreOrThrow(hostname);
    const product = await this.prismaAdmin.product.findUnique({
      where: { id: productId },
      include: { variants: true, media: true },
    });
    if (!product || product.storeId !== store.id || product.status !== "active") {
      throw new NotFoundException("Product not found.");
    }
    return this.toPublicProduct(product, store);
  }

  private toPublicProduct(
    product: {
      id: string;
      title: string;
      description: string | null;
      seoTitle: string | null;
      seoDescription: string | null;
      averageRating: unknown;
      reviewCount: number;
      variants: unknown[];
      media: unknown[];
    },
    store: { seoTitle: string | null; seoDescription: string | null },
  ) {
    const seo = resolveSeoFallback({
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      fallbackName: product.title,
      fallbackDescription: product.description,
      storeDefault: { seoDescription: store.seoDescription },
    });
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      averageRating: product.averageRating,
      reviewCount: product.reviewCount,
      variants: product.variants,
      media: product.media,
      seoTitle: seo.title,
      seoDescription: seo.description,
    };
  }
}
