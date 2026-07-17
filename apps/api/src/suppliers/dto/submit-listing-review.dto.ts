import { IsUUID } from "class-validator";

/** Supplier submits one of their own listings to a specific active store link for the seller's review (FR-2.7/FR-3.2). */
export class SubmitListingReviewDto {
  @IsUUID()
  storeSupplierLinkId!: string;

  @IsUUID()
  supplierListingId!: string;
}
