import { IsUUID } from "class-validator";

export class AdminGrantPlanDto {
  @IsUUID()
  planId!: string;
}
