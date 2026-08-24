import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ReviewStatus } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { ObjectStorageService } from "../media/object-storage.service";
import { mediaTypeFromMimetype, sanitizeFilename } from "../media/media.util";

function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

/** Phase 4 close-out (FR-14.1 buyer-experience batch) - a review's own attachment cap, independent of any product's media limit. */
const MAX_REVIEW_MEDIA_FILES = 5;

/**
 * FR-14.1-14.4. Buyer submission is public/pre-auth (same BYPASSRLS reasoning
 * as OrderStatusLookupService - the order-status token is the buyer's only
 * identification mechanism, no account); seller moderation runs through
 * TenantPrismaService (RLS) exactly like every other dashboard surface.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  /** FR-14.1/14.2 - identified via the order-status link (FR-5.4) rather than an account. */
  async submit(
    token: string,
    input: { productId: string; buyerName: string; rating: number; body: string },
    ip: string,
  ) {
    // Phase B pre-launch audit finding - public, token-gated but with no
    // submission cap of its own; dual-keyed (token + IP) before the write.
    const submissionLimit = await this.settings.resolve<number>("reviews.submission_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`review-submit-token:${token}`, submissionLimit);
    await this.rateLimit.enforcePerHour(`review-submit-ip:${ip}`, submissionLimit);

    const order = await this.prismaAdmin.order.findUnique({
      where: { statusLookupToken: token },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found.");

    const product = await this.prismaAdmin.product.findUnique({ where: { id: input.productId } });
    if (!product || product.storeId !== order.storeId) throw new NotFoundException("Product not found.");

    // FR-14.2 - "linked to a real order for that product at that store";
    // Financial Truth Invariant (§3.12) - only a confirmed (actually paid)
    // order counts as a real purchase, never a still-pending one.
    const isVerifiedPurchase =
      order.status === "confirmed" && order.items.some((item) => item.productId === input.productId);

    return this.prismaAdmin.productReview.create({
      data: {
        storeId: order.storeId,
        productId: input.productId,
        orderId: order.id,
        buyerName: input.buyerName,
        buyerEmail: order.buyerEmail,
        rating: input.rating,
        body: input.body,
        isVerifiedPurchase,
      },
    });
  }

  /**
   * Phase 4 close-out (FR-14.1) - a second, small write path alongside
   * submit() rather than folding media into that endpoint: submit() stays
   * exactly the JSON-only contract it already is (and already has e2e
   * coverage for), and a review's photos/video are optional and can be
   * added right after in the same buyer flow. Ownership is checked via the
   * SAME order-status token used to create the review in the first place -
   * a token only ever resolves to one order, and a review can only be
   * added to here if it belongs to that exact order (never "any review at
   * this store").
   */
  async addMedia(token: string, reviewId: string, files: Express.Multer.File[], ip: string) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded (expected multipart field "media").');
    }

    const submissionLimit = await this.settings.resolve<number>("reviews.submission_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`review-media-token:${token}`, submissionLimit);
    await this.rateLimit.enforcePerHour(`review-media-ip:${ip}`, submissionLimit);

    const order = await this.prismaAdmin.order.findUnique({ where: { statusLookupToken: token } });
    if (!order) throw new NotFoundException("Order not found.");

    const review = await this.prismaAdmin.productReview.findUnique({
      where: { id: reviewId },
      include: { media: true },
    });
    if (!review || review.orderId !== order.id) throw new NotFoundException("Review not found.");

    if (review.media.length + files.length > MAX_REVIEW_MEDIA_FILES) {
      throw new BadRequestException(`A review can have at most ${MAX_REVIEW_MEDIA_FILES} photos/videos - this one already has ${review.media.length}.`);
    }

    // Validate every file's type before uploading any of them - a rejection
    // on file 3 of 5 must never leave files 1-2 orphaned in object storage
    // with nothing pointing at them.
    const types = files.map((file) => mediaTypeFromMimetype(file.mimetype));

    let sortOrder = review.media.length;
    const rows = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key = `reviews/${review.id}/${randomUUID()}-${sanitizeFilename(file.originalname)}`;
      const url = await this.objectStorage.putObject(key, file.buffer, file.mimetype);
      rows.push({ storeId: review.storeId, reviewId: review.id, type: types[i], url, sortOrder: sortOrder++ });
    }

    await this.prismaAdmin.reviewMedia.createMany({ data: rows });
    return this.prismaAdmin.reviewMedia.findMany({ where: { reviewId: review.id }, orderBy: { sortOrder: "asc" } });
  }

  /** FR-14.3 - seller's own moderation queue. */
  async listForModeration(sellerId: string, storeId: string, status?: ReviewStatus) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.productReview.findMany({
        where: { storeId, ...(status ? { status } : {}) },
        include: { product: { select: { title: true } }, media: { orderBy: { sortOrder: "asc" } } },
        orderBy: { createdAt: "desc" },
      });
    });
  }

  /**
   * FR-14.3/14.4 - approve or hide; no review publishes automatically. The
   * product's denormalized average is recomputed immediately after, since
   * this is the only event that can change it.
   */
  async moderate(sellerId: string, storeId: string, reviewId: string, status: "approved" | "hidden") {
    const productId = await this.tenantPrisma.run(sellerId, async (tx) => {
      const review = await tx.productReview.findUnique({ where: { id: reviewId } });
      if (!review || review.storeId !== storeId) throw new NotFoundException("Review not found.");
      await tx.productReview.update({ where: { id: reviewId }, data: { status } });
      return review.productId;
    });
    await this.recomputeProductRating(productId);
  }

  /** FR-14.4 - denormalized for page-load speed, the highest-traffic read path a review touches. */
  private async recomputeProductRating(productId: string) {
    const approved = await this.prismaAdmin.productReview.findMany({
      where: { productId, status: "approved" },
      select: { rating: true },
    });
    const reviewCount = approved.length;
    const averageRating = reviewCount === 0 ? 0 : round1(approved.reduce((sum, r) => sum + r.rating, 0) / reviewCount);
    await this.prismaAdmin.product.update({ where: { id: productId }, data: { averageRating, reviewCount } });
  }
}
