import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventsService } from "../events/events.service";
import { ModerationService } from "../moderation/moderation.service";
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
    private readonly moderation: ModerationService,
  ) {}

  async list(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.listingReview.findMany({
        where: { storeId },
        orderBy: { createdAt: "asc" },
        include: {
          supplierListing: {
            select: { title: true, price: true, shippingCost: true, supplier: { select: { businessName: true } } },
          },
        },
      });
    });
  }

  /**
   * Approving creates the corresponding `products` row (FR-2.7), same as
   * §14.2's existing checklist item for this behavior. **Module 8
   * amendment (SRS §5.27, v0.13):** the seller's approval here is not a
   * substitute for platform legal safety, so this now runs the same
   * `ModerationService.evaluateNewProduct()` self-fulfilled products go
   * through - a banned keyword blocks the approval outright, a restricted
   * keyword/category still routes the product into the platform
   * moderation queue (invisible until a Reviewer/Admin approves it), and a
   * trusted seller's approval bypasses it entirely, exactly like a
   * self-fulfilled listing. New-seller probation (FR-27.3) does NOT apply
   * here (`applyProbation: false`) - see decideModerationStatus's doc
   * comment for why. `SupplierListing` has no `description`/`categoryId`
   * fields in v1.0's schema, so only the title is scanned and the
   * restricted-category rule can never fire for a supplier listing yet -
   * a real, disclosed limitation (`docs/build-plan.md`), not a bug.
   */
  async approve(sellerId: string, storeId: string, reviewId: string, reviewedByUserId: string) {
    let queuedReason: string | undefined;
    const result = await this.tenantPrisma.run(sellerId, async (tx) => {
      const review = await tx.listingReview.findUnique({ where: { id: reviewId } });
      if (!review || review.storeId !== storeId) throw new NotFoundException("Listing review not found.");
      if (review.status !== "pending") throw new BadRequestException("This review has already been decided.");

      const listing = await tx.supplierListing.findUniqueOrThrow({
        where: { id: review.supplierListingId },
      });

      const decision = await this.moderation.evaluateNewProduct(tx, sellerId, {
        title: listing.title,
        applyProbation: false,
      });
      queuedReason = decision.reason;

      const product = await tx.product.create({
        data: {
          storeId,
          title: listing.title,
          status: "active",
          sourceType: "supplier",
          moderationStatus: decision.status,
        },
      });

      // Module 9 completeness fix (found while wiring checkout against a
      // real approved supplier listing): every purchasable product needs a
      // `product_variants` row - Module 8 created only the `products` row
      // here, leaving a supplier-sourced product with no variant at all,
      // and therefore nothing a cart could ever reference. The variant's
      // own price/stock are cosmetic display values only - OrderPricingService
      // (Module 9) always reads the *live* `supplier_listings.price`/
      // `stockQuantity` for a supplier item, never this row's.
      await tx.productVariant.create({
        data: {
          storeId,
          productId: product.id,
          sku: listing.externalProductId,
          price: listing.price,
          stockQuantity: listing.stockQuantity,
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
    });

    await this.events.emit({
      eventType: "listing_review.approved",
      actorType: "seller",
      actorId: sellerId,
      storeId,
      entityType: "listing_review",
      entityId: result.review.id,
    });
    if (queuedReason) {
      await this.moderation.recordQueued(result.product.id, storeId, queuedReason);
    }
    return result;
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
