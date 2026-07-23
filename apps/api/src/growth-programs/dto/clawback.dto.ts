import { IsNumber, IsString, Min, MinLength, MaxLength } from "class-validator";

export class ClawbackDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  // Required, unlike most admin decision notes elsewhere in this SRS
  // (RejectProductDto's precedent) - a clawback needs an explicit,
  // recorded reason, never a bare amount.
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  notes!: string;
}
