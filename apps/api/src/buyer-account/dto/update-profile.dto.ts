import { IsOptional, IsString, MaxLength } from "class-validator";

/** P1.4 input-validation sweep fix - previously an untyped @Body() object literal bypassed the global ValidationPipe entirely. */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;
}
