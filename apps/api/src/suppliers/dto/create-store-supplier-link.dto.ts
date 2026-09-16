import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/**
 * Seller-initiated invite (FR-2.6): identifies the supplier by their account
 * email. `supplierBusinessName` is only used when this email has no existing
 * account (Phase 2 item 15) - required in that case for the new Supplier
 * row's businessName column, ignored when the supplier already exists.
 */
export class InviteSupplierDto {
  @IsEmail()
  supplierEmail!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  supplierBusinessName?: string;
}
