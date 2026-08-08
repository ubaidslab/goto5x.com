import { IsString, MinLength } from "class-validator";

/** FR-60.2 - submitted via the order-status link (FR-5.4), same shape discipline as SubmitReviewDto. */
export class SubmitReturnRequestDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
