import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { SupportTicketsController } from "./support-tickets.controller";
import { AdminSupportTicketsController } from "./admin-support-tickets.controller";
import { SupportTicketsService } from "./support-tickets.service";
import { SupportTicketSlaService } from "./support-ticket-sla.service";
import { SupportTicketSlaScheduler } from "./support-ticket-sla.scheduler";

/** SRS §5.6k/FR-6.45 (Module 68) + FR-8.18 (Module 90) - built together since Module 68's SLA hours need a real ticket to enforce against. */
@Module({
  imports: [AdminModule, PlansModule, SettingsModule],
  controllers: [SupportTicketsController, AdminSupportTicketsController],
  providers: [SupportTicketsService, SupportTicketSlaService, SupportTicketSlaScheduler],
  exports: [SupportTicketsService, SupportTicketSlaService],
})
export class SupportTicketsModule {}
