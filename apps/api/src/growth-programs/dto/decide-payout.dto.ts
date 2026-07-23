import { IsOptional, IsString, MaxLength } from "class-validator";

export class DecidePayoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class MarkPayoutPaidDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  paymentReference?: string;
}
