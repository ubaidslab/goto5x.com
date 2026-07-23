import { IsIn } from "class-validator";
import { ReferralProgramType } from "@prisma/client";

const PROGRAM_TYPES: ReferralProgramType[] = ["ambassador", "student_referral", "creator"];

export class ApplyProgramDto {
  @IsIn(PROGRAM_TYPES)
  programType!: ReferralProgramType;
}
