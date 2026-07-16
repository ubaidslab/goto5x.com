import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{2,100}$/, { message: "slug must be 2-100 lowercase letters, numbers, or hyphens" })
  slug!: string;
}
