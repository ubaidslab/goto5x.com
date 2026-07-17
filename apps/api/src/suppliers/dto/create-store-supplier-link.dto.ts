import { IsEmail } from "class-validator";

/** Seller-initiated invite (FR-2.6): identifies the supplier by their account email. */
export class InviteSupplierDto {
  @IsEmail()
  supplierEmail!: string;
}
