import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

const PAYMENT_MODELS = ["prepaid", "cod", "advance"] as const;

/** FR-6.61/FR-6.63 - the seller's own store-wide payment-model choice, plus the Advance percentage when that model is selected. */
export class UpdatePaymentModelDto {
  @IsIn(PAYMENT_MODELS)
  paymentModel!: (typeof PAYMENT_MODELS)[number];

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(50)
  advancePercent?: number;
}
