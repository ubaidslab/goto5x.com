import { IsInt, IsString, IsUUID, Max, Min } from "class-validator";

/** FR-14.1 - submitted via the order-status link (FR-5.4), never an account. */
export class SubmitReviewDto {
  @IsUUID()
  productId!: string;

  @IsString()
  buyerName!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  body!: string;
}
