import { IsIn } from "class-validator";
import { JobApplicationStatus } from "@prisma/client";

const STATUSES: JobApplicationStatus[] = ["received", "reviewing", "interviewing", "rejected", "hired"];

export class UpdateApplicationStatusDto {
  @IsIn(STATUSES)
  status!: JobApplicationStatus;
}
