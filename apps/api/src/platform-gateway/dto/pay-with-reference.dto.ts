import { IsOptional, IsString } from "class-validator";

/**
 * Shared by WalletService.requestPlanFeePayment() and
 * TemplatePurchaseService.requestPurchase() - both optional so the
 * existing manual bank-instructions flow (submit with no reference, wait
 * for an admin) is completely unaffected. When the platform gateway is
 * connected and active AND a reference is supplied, the request attempts
 * automatic verification before falling back to "pending, awaiting
 * manual admin confirm."
 */
export class PayWithReferenceDto {
  @IsOptional()
  @IsString()
  reference?: string;
}
