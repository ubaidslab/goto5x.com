import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditLogService } from "../admin/audit-log.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { BannedKeywordError, decideModerationStatus, ModerationDecision } from "./moderation-decision.util";

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Called from ProductsService.create(), inside the same seller-scoped
   * transaction, so the approved-product count and the insert are
   * consistent with each other. Throws BadRequestException on a banned
   * keyword (FR-27.1) - the product is never created.
   */
  async evaluateNewProduct(
    tx: Prisma.TransactionClient,
    sellerId: string,
    input: { title: string; description?: string | null; categoryId?: string | null },
  ): Promise<ModerationDecision> {
    const [bannedKeywords, restrictedKeywords, restrictedCategoryIds, probationCount, seller, sellerStores] =
      await Promise.all([
        this.settings.resolve<string[]>("moderation.banned_keywords"),
        this.settings.resolve<string[]>("moderation.restricted_keywords"),
        this.settings.resolve<string[]>("moderation.restricted_categories"),
        this.settings.resolve<number>("moderation.new_seller_probation_count"),
        tx.seller.findUniqueOrThrow({ where: { id: sellerId } }),
        tx.store.findMany({ where: { sellerId }, select: { id: true } }),
      ]);
    // Product has no explicit Prisma relation back to Store (only the
    // scalar storeId column - see schema.prisma), so the seller's stores
    // are resolved first and the count filters on storeId directly.
    const approvedProductCount = await tx.product.count({
      where: { storeId: { in: sellerStores.map((s) => s.id) }, moderationStatus: "approved" },
    });

    try {
      return decideModerationStatus({
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        isTrusted: seller.isTrusted,
        approvedProductCount,
        probationCount,
        bannedKeywords,
        restrictedKeywords,
        restrictedCategoryIds,
      });
    } catch (err) {
      if (err instanceof BannedKeywordError) {
        throw new BadRequestException(
          `This listing cannot be submitted - it contains a banned term ("${err.keyword}").`,
        );
      }
      throw err;
    }
  }

  /**
   * Best-effort, called after the product-creation transaction commits -
   * same "a seller's legitimate action must never fail because of an
   * internal bookkeeping write" discipline as EventsService.emit()
   * (SRS FR-26.3), applied here because this is triggered by a seller
   * action, not an admin one (unlike approve()/reject() below).
   */
  async recordQueued(productId: string, storeId: string, reason: string): Promise<void> {
    try {
      await this.auditLog.record({
        adminUserId: null,
        action: "moderation.queued",
        targetType: "product",
        targetId: productId,
        afterValue: { reason, storeId },
      });
    } catch (err) {
      this.logger.error(
        `Failed to record moderation.queued for product ${productId} - the listing was still created/queued.`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * FR-27.6 - REVIEWER's (and admin's) queue view. Product has no explicit
   * Prisma relation to Store (see evaluateNewProduct's comment above), so
   * the store names/slugs are fetched separately and merged in.
   */
  async listQueue() {
    const products = await this.prismaAdmin.product.findMany({
      where: { moderationStatus: "pending" },
      orderBy: { createdAt: "asc" },
    });
    const stores = await this.prismaAdmin.store.findMany({
      where: { id: { in: [...new Set(products.map((p) => p.storeId))] } },
      select: { id: true, name: true, slug: true },
    });
    const storeById = new Map(stores.map((s) => [s.id, s]));
    return products.map((product) => ({
      ...product,
      store: storeById.get(product.storeId) ?? null,
    }));
  }

  async approve(adminUserId: string, productId: string, notes: string | undefined) {
    const before = await this.prismaAdmin.product.findUnique({ where: { id: productId } });
    if (!before) throw new NotFoundException("Product not found.");
    if (before.moderationStatus !== "pending") {
      throw new BadRequestException("This product is not in the moderation queue.");
    }
    const after = await this.prismaAdmin.product.update({
      where: { id: productId },
      data: { moderationStatus: "approved", moderationNotes: notes ?? null },
    });
    await this.auditLog.record({
      adminUserId,
      action: "moderation.approve",
      targetType: "product",
      targetId: productId,
      beforeValue: { moderationStatus: before.moderationStatus },
      afterValue: { moderationStatus: "approved", notes: notes ?? null },
    });
    return after;
  }

  async reject(adminUserId: string, productId: string, notes: string) {
    const before = await this.prismaAdmin.product.findUnique({ where: { id: productId } });
    if (!before) throw new NotFoundException("Product not found.");
    if (before.moderationStatus !== "pending") {
      throw new BadRequestException("This product is not in the moderation queue.");
    }
    const after = await this.prismaAdmin.product.update({
      where: { id: productId },
      data: { moderationStatus: "rejected", moderationNotes: notes },
    });
    await this.auditLog.record({
      adminUserId,
      action: "moderation.reject",
      targetType: "product",
      targetId: productId,
      beforeValue: { moderationStatus: before.moderationStatus },
      afterValue: { moderationStatus: "rejected", notes },
    });
    return after;
  }
}
