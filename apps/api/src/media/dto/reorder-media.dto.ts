import { ArrayMinSize, IsArray, IsUUID } from "class-validator";

export class ReorderMediaDto {
  @IsUUID()
  productId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  mediaIds!: string[];
}
