import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{3,63}$/, {
    message: "slug must be 3-63 lowercase letters, numbers, or hyphens",
  })
  slug!: string;
}
