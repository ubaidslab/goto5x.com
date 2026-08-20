import { IsInt, Min } from "class-validator";

/** Module 79 - admin override of an approved Ambassador's granted free-store-slot count. */
export class UpdateFreeStoreSlotsDto {
  @IsInt()
  @Min(0)
  freeStoreSlotsGranted!: number;
}
