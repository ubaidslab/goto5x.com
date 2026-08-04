import { IsEmail, IsNumber, IsPositive, IsString } from "class-validator";

/** FR-49.2 - the buyer-purchase path; public, unauthenticated, same shape as CheckoutDto. */
export class PurchaseGiftCardDto {
  @IsString()
  hostname!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsEmail()
  buyerEmail!: string;
}
