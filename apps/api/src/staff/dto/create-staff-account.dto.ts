import { ArrayMinSize, ArrayUnique, IsArray, IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { StaffScope } from "@prisma/client";

export class CreateStaffAccountDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(StaffScope, { each: true })
  scopes!: StaffScope[];
}
