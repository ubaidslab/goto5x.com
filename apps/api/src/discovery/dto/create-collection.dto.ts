import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class CreateCollectionDto {
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
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  seoDescription?: string;
}
