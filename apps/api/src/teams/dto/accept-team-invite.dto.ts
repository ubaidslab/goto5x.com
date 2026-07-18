import { IsBoolean, Equals } from "class-validator";

export class AcceptTeamInviteDto {
  // FR-7.12 - the invite-acceptance screen's disclosure must be seen and
  // explicitly accepted; a plain "true" is not implicit consent unless the
  // client actually sent it after showing the required disclosure text.
  @IsBoolean()
  @Equals(true, { message: "You must accept the sponsorship disclosure to join a team." })
  consentAccepted!: boolean;
}
