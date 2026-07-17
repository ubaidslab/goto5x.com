import { IsBoolean, IsISO8601, IsInt, IsNumber, IsOptional, IsPositive, Min } from "class-validator";

// `code`/`type` are deliberately not editable after creation (v1.0 scope) -
// a seller who wants a different code/type deactivates this one
// (`isActive: false`) and creates a new one instead.
export class UpdateDiscountCodeDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  value?: number;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
