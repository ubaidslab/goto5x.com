import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class StaffLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  // SRS §5.52/FR-52.12 - a persisted per-device token the login flow sets
  // client-side; only meaningful when the staff account has
  // deviceRestrictionEnabled. Absent for a client that hasn't adopted this
  // yet - treated as "no device on file," same as any unrecognized value.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceId?: string;
}
