import { IsString, MinLength } from "class-validator";

export class BlockStaffAccountDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
