import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { SellerAgreementGuard } from "../trust-safety/seller-agreement.guard";
import { AcceptTeamInviteDto } from "./dto/accept-team-invite.dto";
import { TeamsService } from "./teams.service";

/** SRS §5.31 (FR-7.11-7.13) - the sponsored-member-facing half: accept/decline/leave. */
@Controller("sellers/me/team-membership")
@UseGuards(SellerAgreementGuard)
export class TeamMembershipController {
  constructor(private readonly teams: TeamsService) {}

  @Post(":teamMemberId/accept")
  accept(@CurrentSellerId() sellerId: string, @Param("teamMemberId") teamMemberId: string, @Body() dto: AcceptTeamInviteDto) {
    return this.teams.acceptInvite(sellerId, teamMemberId, dto);
  }

  @Post(":teamMemberId/decline")
  decline(@CurrentSellerId() sellerId: string, @Param("teamMemberId") teamMemberId: string) {
    return this.teams.declineInvite(sellerId, teamMemberId);
  }

  @Post("leave")
  leave(@CurrentSellerId() sellerId: string) {
    return this.teams.leaveTeam(sellerId);
  }
}
