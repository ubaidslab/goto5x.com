import { IsIn, IsOptional, IsString } from "class-validator";

/** FR-60.3 - seller (or admin, FR-60.5) approve/reject; sellerNote is required on reject only, enforced in ReturnsService (a reason must exist, but its field name stays generic - the same seller_note column an approval note also uses). */
export class DecideReturnRequestDto {
  @IsIn(["approved", "rejected"])
  status!: "approved" | "rejected";

  @IsOptional()
  @IsString()
  sellerNote?: string;
}
