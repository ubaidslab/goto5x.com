import { IsIn } from "class-validator";

export class ModerateReviewDto {
  @IsIn(["approved", "hidden"])
  status!: "approved" | "hidden";
}
