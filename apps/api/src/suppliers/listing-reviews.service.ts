import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventsService } from "../events/events.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";

/**
 * Seller-facing approval queue (FR-2.7/FR-3.2) - every method verifies
 * `storeId` belongs to the calling seller before touching `listing_reviews`,
 * same discipline as every tenant service since Module 2.
 */
@Injectable()
export class ListingReviewsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly events: EventsService,
  ) {}

  async list(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.listingReview.findMany({ where: { storeId }, orderBy: { createdAt: "asc" } });
    });
  }

  /**
   * Approving creates the corresponding `products` row (FR-2.7), same as
   * §14.2's existing checklist item for this behavior. `moderationStatus`
   * is set to `not_required` directly, never run through
   * ModerationService - Module 6's engine explicitly scopes itself to
   * "self-fulfilled seller product listings" (SRS §5.27); a supplier
   * listing already has its own human-review gate right here, which serves
   * the same launch-blocking-legal-safety purpose Module 6 exists for.
   */
  async approve(sellerId: string, storeId: string, reviewId: string, reviewedByUserId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const review = await tx.listingReview.findUnique({ where: { id: reviewId } });
      if (!review || review.storeId !== storeId) throw new NotFoundException("Listing review not found.");
      if (review.status !== "pending") throw new BadRequestException("This review has already been decided.");

      const listing = await tx.supplierListing.findUniqueOrThrow({
        where: { id: review.supplierListingId },
      });

      const product = await tx.product.create({
        data: {
          storeId,
          title: listing.title,
          status: "active",
          sourceType: "supplier",
          moderationStatus: "not_required",
        },
      });

      const updated = await tx.listingReview.update({
        where: { id: reviewId },
        data: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: reviewedByUserId,
          productId: product.id,
        },
      });

      return { review: updated, product };
    }).then(async (result) => {
      await this.events.emit({
        eventType: "listing_review.approved",
        actorType: "seller",
        actorId: sellerId,
        storeId,
        entityType: "listing_review",
        entityId: result.review.id,
      });
      return result;
    });
  }

  async reject(sellerId: string, storeId: string, reviewId: string, reviewedByUserId: string) {
    const review = await this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.listingReview.findUnique({ where: { id: reviewId } });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Listing review not found.");
      if (existing.status !== "pending") throw new BadRequestException("This review has already been decided.");
      return tx.listingReview.update({
        where: { id: reviewId },
        data: { status: "rejected", reviewedAt: new Date(), reviewedBy: reviewedByUserId },
      });
    });

    await this.events.emit({
      eventType: "listing_review.rejected",
      actorType: "seller",
      actorId: sellerId,
      storeId,
      entityType: "listing_review",
      entityId: review.id,
    });
    return review;
  }
}
