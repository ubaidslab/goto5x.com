import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { SellerAgreementGuard } from "../trust-safety/seller-agreement.guard";
import { CreateTeamDto } from "./dto/create-team.dto";
import { InviteTeamMemberDto } from "./dto/invite-team-member.dto";
import { TeamsService } from "./teams.service";

/** SRS §5.31 (FR-7.11-7.14) - the leader-facing half: create/invite/dashboard. */
@Controller("sellers/me/teams")
@UseGuards(SellerAgreementGuard)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  listMine(@CurrentSellerId() sellerId: string) {
    return this.teams.listMine(sellerId);
  }

  @Post()
  create(@CurrentSellerId() sellerId: string, @Body() dto: CreateTeamDto) {
    return this.teams.createTeam(sellerId, dto);
  }

  @Get(":teamId/dashboard")
  dashboard(@CurrentSellerId() sellerId: string, @Param("teamId") teamId: string) {
    return this.teams.getTeamDashboard(sellerId, teamId);
  }

  @Post(":teamId/invite")
  invite(@CurrentSellerId() sellerId: string, @Param("teamId") teamId: string, @Body() dto: InviteTeamMemberDto) {
    return this.teams.inviteMember(sellerId, teamId, dto);
  }
}
