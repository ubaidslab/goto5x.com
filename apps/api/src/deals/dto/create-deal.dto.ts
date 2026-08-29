import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { DealItemInputDto } from "./deal-item-input.dto";

/** SRS §5.67/FR-67.1 (Module 91) - status defaults to draft in DealsService, not accepted here (a new deal is never created already-active). */
export class CreateDealDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{1,63}$/, {
    message: "slug must be 1-63 lowercase letters, numbers, or hyphens",
  })
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  thumbnailMediaId?: string;

  // Uniform percentage off the whole deal (FR-67.1) - the founder-approved
  // model, not a per-item discount. 100 would mean free, which is a
  // legitimate (if unusual) seller choice, so the ceiling is inclusive.
  @IsNumber()
  @IsPositive()
  @Max(100)
  discountPercent!: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DealItemInputDto)
  items!: DealItemInputDto[];
}
