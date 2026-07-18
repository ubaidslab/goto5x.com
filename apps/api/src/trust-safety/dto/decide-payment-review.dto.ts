import { IsOptional, IsString } from "class-validator";

export class DecidePaymentReviewDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
