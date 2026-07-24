import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

/** Shared by every admin decision on the Verified Store Program's queues (approve/reject/clear/revoke) - notes are always optional except a direct revoke, which requires a reason (see RevokeNotesDto). */
export class DecisionNotesDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/** FR-35.5 - "an admin can revoke... with notes" reads as a required reason for a standing, any-time override, unlike a routine approve/reject. */
export class RevokeNotesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  notes!: string;
}
