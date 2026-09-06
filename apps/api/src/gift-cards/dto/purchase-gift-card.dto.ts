import { IsEmail, IsNumber, IsPositive, IsString, Max } from "class-validator";
import { MAX_MONEY_VALUE } from "../../common/validation/money.constants";

/** FR-49.2 - the buyer-purchase path; public, unauthenticated, same shape as CheckoutDto. */
export class PurchaseGiftCardDto {
  @IsString()
  hostname!: string;

  @IsNumber()
  @IsPositive()
  @Max(MAX_MONEY_VALUE)
  amount!: number;

  @IsEmail()
  buyerEmail!: string;
}
