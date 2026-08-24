import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ExternalApiClientType } from "@prisma/client";
import { generateToken } from "../auth/token.util";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { SettingsService } from "../settings-registry/settings.service";

/**
 * FR-24.10 - the seller-facing half of the Product Feed API's auth: create,
 * list, and revoke a token from the dashboard's "Marketing" section.
 * `template_store` has no seller-facing token concept (FR-24.3's install
 * flow is client-to-client, keyed by sellerId directly, never a seller-held
 * token) - this service only ever issues tokens for `social_media_saas`.
 */
@Injectable()
export class SellerApiTokensService {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /**
   * Phase 4 close-out - lets the Marketing hub's FB/IG Shop feed tab render
   * a real locked-vs-unlocked state without guessing: both gates
   * (`social_media.meta_catalog_feed_enabled`, FR-55.2's
   * `whatsapp.product_share_enabled`) resolve through the same plan
   * context ProductFeedService/WhatsAppMessagingService already check
   * server-side at call time - this is a read of the same truth, not a
   * separate one.
   */
  async getSocialMediaFeedStatus(sellerId: string) {
    const planContext = await this.subscriptions.getPlanContext(sellerId);
    const [metaCatalogFeedEnabled, whatsappProductShareEnabled] = await Promise.all([
      this.settings.resolve<boolean>("social_media.meta_catalog_feed_enabled", planContext),
      this.settings.resolve<boolean>("whatsapp.product_share_enabled", planContext),
    ]);
    return { metaCatalogFeedEnabled, whatsappProductShareEnabled, metaCatalogFeedPath: "/external/social-media/meta-catalog-feed" };
  }

  /** The plaintext token is returned exactly once, here, and never again - only its hash is ever persisted. */
  async create(sellerId: string) {
    const client = await this.prisma.externalApiClient.findUnique({
      where: { clientType: ExternalApiClientType.social_media_saas },
    });
    if (!client) {
      throw new BadRequestException("The Social Media SaaS integration is not configured yet.");
    }

    const { token, tokenHash } = generateToken();
    const row = await this.tenantPrisma.run(sellerId, (tx) =>
      tx.sellerApiToken.create({
        data: { sellerId, clientId: client.id, tokenHash, scopes: ["products:read"] },
      }),
    );
    return { id: row.id, token, scopes: row.scopes, createdAt: row.createdAt };
  }

  async list(sellerId: string) {
    const rows = await this.tenantPrisma.run(sellerId, (tx) =>
      tx.sellerApiToken.findMany({ orderBy: { createdAt: "desc" }, include: { client: { select: { displayName: true } } } }),
    );
    return rows.map(({ tokenHash, ...rest }) => rest);
  }

  /** FR-24.10 - a revoked token is rejected on its very next use (ProductFeedService checks revokedAt on every call). */
  async revoke(sellerId: string, tokenId: string) {
    const existing = await this.tenantPrisma.run(sellerId, (tx) => tx.sellerApiToken.findUnique({ where: { id: tokenId } }));
    if (!existing) throw new NotFoundException("Token not found.");
    await this.tenantPrisma.run(sellerId, (tx) =>
      tx.sellerApiToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } }),
    );
    return { revoked: true };
  }
}
