import { IsIn, IsOptional, IsString } from "class-validator";

/** SRS §5.14/FR-14.6 (Module 93) - `reason` is required, but only when status is "deleted"; enforced in ReviewsService, same "DTO-optional, service-required" split as DecideReturnRequestDto's sellerNote. */
export class ModerateReviewDto {
  @IsIn(["approved", "hidden", "deleted"])
  status!: "approved" | "hidden" | "deleted";

  @IsOptional()
  @IsString()
  reason?: string;
}
