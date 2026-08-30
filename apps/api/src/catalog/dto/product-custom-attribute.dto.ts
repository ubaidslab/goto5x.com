import { IsString, MaxLength, MinLength } from "class-validator";

/** SRS §5.69/FR-69.1 (Module 94) - one {key, value} pair. Both required and non-empty - a key with no value is meaningless. */
export class ProductCustomAttributeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  value!: string;
}
