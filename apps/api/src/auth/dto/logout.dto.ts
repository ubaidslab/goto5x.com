import { IsUUID } from "class-validator";

/** P1.4 input-validation sweep fix - previously an untyped @Body() object literal bypassed the global ValidationPipe entirely. */
export class LogoutDto {
  @IsUUID()
  sessionId!: string;
}
