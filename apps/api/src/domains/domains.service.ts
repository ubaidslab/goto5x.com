import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { SettingsService } from "../settings-registry/settings.service";
import { TraefikDynamicConfigService } from "./traefik-dynamic-config.service";

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/**
 * Every method verifies the target store belongs to the calling seller,
 * same app-layer discipline as Module 2's catalog/media services - RLS
 * (docs/database-schema.md's Module 3 migration) proves "not another
 * seller's domain," not "not my OWN other store's domain."
 */
@Injectable()
export class DomainsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly traefikConfig: TraefikDynamicConfigService,
  ) {}

  async attach(sellerId: string, storeId: string, domainNameInput: string) {
    const domainName = domainNameInput.trim().toLowerCase();
    if (!HOSTNAME_RE.test(domainName)) {
      throw new BadRequestException(`"${domainNameInput}" is not a valid domain name.`);
    }

    const rootDomain = await this.settings.resolve<string>("domains.platform_root_domain");
    if (domainName === rootDomain || domainName.endsWith(`.${rootDomain}`)) {
      throw new BadRequestException(
        `"${domainName}" is one of goto5x.com's own subdomains, not an external domain you own - ` +
          `every store already gets a free subdomain automatically (FR-11.1).`,
      );
    }

    try {
      return await this.tenantPrisma.run(sellerId, async (tx) => {
        const store = await tx.store.findUnique({ where: { id: storeId } });
        if (!store) throw new NotFoundException("Store not found.");
        return tx.domain.create({ data: { storeId, domainName } });
      });
    } catch (err) {
      // Deliberately NOT a pre-check findUnique() before this create(): RLS
      // scopes that read to the calling seller's own stores, so a domain
      // already attached to a DIFFERENT seller's store would be invisible
      // to it and silently report "not found," letting the create() below
      // hit the real unique-index violation anyway - caught by an e2e test
      // attaching the same domain as two different sellers, not assumed.
      // The database's unique constraint is the actual source of truth here
      // (and the only thing that's race-condition-safe), so this catches
      // its violation and translates it to a clean 409 instead of a raw 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`"${domainName}" is already attached to a store.`);
      }
      throw err;
    }
  }

  async list(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.domain.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
    });
  }

  async remove(sellerId: string, storeId: string, domainId: string) {
    const domain = await this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.domain.findUnique({ where: { id: domainId } });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Domain not found.");
      await tx.domain.delete({ where: { id: domainId } });
      return existing;
    });
    // Best-effort, outside the DB transaction - same reasoning as Module 2's
    // media delete: a Traefik-config-file failure must not roll back an
    // already-committed DB deletion.
    try {
      await this.traefikConfig.removeRouterConfig(domain.domainName);
    } catch {
      // Deliberately swallowed - see media-assets.service.ts's identical pattern.
    }
    return domain;
  }

  /** Ownership-checked pass-through so the controller's verify-now endpoint stays symmetric with the rest of this service. */
  async assertOwnedDomain(sellerId: string, storeId: string, domainId: string): Promise<void> {
    await this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.domain.findUnique({ where: { id: domainId } });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Domain not found.");
    });
  }

  /**
   * System-level lookup, deliberately NOT seller-scoped - see
   * PrismaAdminService's doc comment for why BYPASSRLS is the correct tool
   * here, not a convenience shortcut. Consumed by a future module's
   * request-routing (storefront rendering); Module 3 only proves the lookup
   * itself is correct and collision-free (SRS §14.11).
   */
  async resolveStoreIdByHostname(hostname: string): Promise<string | null> {
    const domain = await this.prismaAdmin.domain.findUnique({
      where: { domainName: hostname.trim().toLowerCase() },
    });
    return domain?.storeId ?? null;
  }
}
