import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class BulkDecideProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  productIds!: string[];

  @IsIn(["approve", "reject"])
  decision!: "approve" | "reject";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
