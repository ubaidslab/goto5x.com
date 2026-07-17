import { ArrayMaxSize, IsArray, IsString, MaxLength } from "class-validator";

/** FR-17.3 - free-form labels; replaces the tag set wholesale. */
export class UpdateOrderTagsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags!: string[];
}
