import { IsNotEmpty, IsNumber, IsString } from "class-validator";

/** Module 25 (Admin Completion) - the seller-360 page's "adjust wallet" inline action. */
export class AdjustSellerWalletDto {
  @IsNumber()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
