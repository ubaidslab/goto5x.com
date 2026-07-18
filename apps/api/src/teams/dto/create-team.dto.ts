import { IsString, IsUUID } from "class-validator";

export class CreateTeamDto {
  @IsString()
  name!: string;

  // FR-7.18 - which of the 3 Team tiers this team bills at.
  @IsUUID()
  planId!: string;
}
