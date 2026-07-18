import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { EventsService } from "../events/events.service";
import { mediaTypeFromMimetype, sanitizeFilename } from "./media.util";
import { ObjectStorageService } from "./object-storage.service";

export interface UploadableFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/**
 * Every method verifies the target store belongs to the calling seller (RLS
 * backstops the "not another seller's data" half of that - see
 * docs/database-schema.md's new RLS policies for Module 2 - but a seller who
 * owns multiple stores could otherwise reach store B's media through a URL
 * for store A; that half of the boundary only the app layer can enforce,
 * since RLS here keys off seller_id, not the store_id in the request path).
 */
@Injectable()
export class MediaAssetsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly objectStorage: ObjectStorageService,
    private readonly events: EventsService,
  ) {}

  async uploadDirect(sellerId: string, storeId: string, file: UploadableFile, productId?: string) {
    const type = mediaTypeFromMimetype(file.mimetype);
    const url = await this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      if (productId) {
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product || product.storeId !== storeId) throw new NotFoundException("Product not found.");
      }
      return null; // ownership validated; the actual upload happens outside the DB transaction below
    }).then(async () => {
      const key = `stores/${storeId}/media/${randomUUID()}-${sanitizeFilename(file.originalname)}`;
      return this.objectStorage.putObject(key, file.buffer, file.mimetype);
    });

    const asset = await this.tenantPrisma.run(sellerId, (tx) =>
      tx.mediaAsset.create({
        data: { storeId, productId: productId ?? null, url, source: "upload", type },
      }),
    );
    // SRS §3.11/FR-26.5 - after commit, non-blocking (FR-26.3).
    await this.events.emit({
      eventType: "media.imported",
      actorType: "seller",
      actorId: sellerId,
      storeId,
      entityType: "media_asset",
      entityId: asset.id,
      metadata: { source: "upload" },
    });
    return asset;
  }

  async list(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.mediaAsset.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
    });
  }

  async remove(sellerId: string, storeId: string, mediaId: string) {
    const asset = await this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.mediaAsset.findUnique({ where: { id: mediaId } });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Media asset not found.");
      await tx.mediaAsset.delete({ where: { id: mediaId } });
      return existing;
    });
    // Best-effort, outside the DB transaction: an object-storage failure here
    // must not roll back the already-committed deletion of the DB record.
    try {
      await this.objectStorage.deleteObject(this.objectStorage.keyFromUrl(asset.url));
    } catch {
      // Deliberately swallowed - orphaned storage objects are a cheap,
      // non-user-visible cleanup problem; a dangling DB row pointing at
      // nothing is the worse failure mode, and delete() above already
      // guarantees this method doesn't produce one.
    }
    return asset;
  }

  async attachToProduct(sellerId: string, storeId: string, mediaId: string, productId: string | null) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.mediaAsset.findUnique({ where: { id: mediaId } });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Media asset not found.");
      if (productId) {
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product || product.storeId !== storeId) throw new NotFoundException("Product not found.");
      }
      return tx.mediaAsset.update({ where: { id: mediaId }, data: { productId } });
    });
  }

  /** `mediaIds` is the full, desired order for one product's image set - each id's index becomes its sortOrder. */
  async reorder(sellerId: string, storeId: string, productId: string, mediaIds: string[]) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.mediaAsset.findMany({ where: { storeId, productId } });
      const existingIds = new Set(existing.map((asset) => asset.id));
      if (mediaIds.length !== existing.length || !mediaIds.every((id) => existingIds.has(id))) {
        throw new BadRequestException("mediaIds must be exactly this product's current image set.");
      }
      await Promise.all(
        mediaIds.map((id, index) => tx.mediaAsset.update({ where: { id }, data: { sortOrder: index } })),
      );
      return tx.mediaAsset.findMany({ where: { storeId, productId }, orderBy: { sortOrder: "asc" } });
    });
  }

  async setPrimary(sellerId: string, storeId: string, mediaId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.mediaAsset.findUnique({ where: { id: mediaId } });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Media asset not found.");
      if (!existing.productId) throw new BadRequestException("Only a product-attached image can be set primary.");
      await tx.mediaAsset.updateMany({
        where: { storeId, productId: existing.productId, isPrimary: true },
        data: { isPrimary: false },
      });
      return tx.mediaAsset.update({ where: { id: mediaId }, data: { isPrimary: true } });
    });
  }
}
