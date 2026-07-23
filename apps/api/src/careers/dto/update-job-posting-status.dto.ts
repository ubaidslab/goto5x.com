import { IsIn } from "class-validator";
import { JobPostingStatus } from "@prisma/client";

const STATUSES: JobPostingStatus[] = ["draft", "open", "closed"];

export class UpdateJobPostingStatusDto {
  @IsIn(STATUSES)
  status!: JobPostingStatus;
}
