import { IsString, MaxLength, MinLength } from "class-validator";

export class RejectProductDto {
  // Required, unlike approve's notes - a rejected seller needs a reason
  // (SRS FR-27.5: "the seller sees the rejection reason and notes").
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  notes!: string;
}
