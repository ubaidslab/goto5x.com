import { IsDateString, IsNumber, IsOptional, IsString, Min } from "class-validator";

/** Module 31 (SRS §5.42/FR-42.1) - manual ad-spend entry, scoped to a date period. */
export class CreateAdSpendEntryDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
