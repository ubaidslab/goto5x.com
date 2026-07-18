import { Module } from "@nestjs/common";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { TrustSafetyModule } from "../trust-safety/trust-safety.module";
import { TeamMembershipController } from "./team-membership.controller";
import { TeamsController } from "./teams.controller";
import { TeamsService } from "./teams.service";

@Module({
  imports: [PlansModule, SettingsModule, TrustSafetyModule],
  controllers: [TeamsController, TeamMembershipController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
