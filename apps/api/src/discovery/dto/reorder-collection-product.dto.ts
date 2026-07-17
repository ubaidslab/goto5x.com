import { IsInt, Min } from "class-validator";

export class ReorderCollectionProductDto {
  @IsInt()
  @Min(0)
  sortOrder!: number;
}
