import { IsString, IsUUID } from "class-validator";

/** P1.4 input-validation sweep fix - previously an untyped @Body() object literal bypassed the global ValidationPipe entirely. */
export class RefreshTokenDto {
  @IsUUID()
  sessionId!: string;

  @IsString()
  refreshToken!: string;
}
