import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAccessPayload } from "../common/types";
import { ReplySupportTicketDto } from "./dto/reply-support-ticket.dto";
import { SupportTicketsService } from "./support-tickets.service";

/** SRS §5.6k/FR-8.18 (Module 90) - admin-facing list/respond/resolve surface. Bare, functional only, same discipline as every other admin-terminal screen pending Phase 6's re-skin. */
@Controller("admin/support-tickets")
@UseGuards(AdminAuthGuard)
export class AdminSupportTicketsController {
  constructor(private readonly tickets: SupportTicketsService) {}

  @Get()
  list(@Query("status") status?: "open" | "resolved") {
    return this.tickets.listAllForAdmin(status);
  }

  @Get(":ticketId")
  get(@Param("ticketId") ticketId: string) {
    return this.tickets.getForAdmin(ticketId);
  }

  @Post(":ticketId/messages")
  reply(@CurrentUser() user: JwtAccessPayload, @Param("ticketId") ticketId: string, @Body() dto: ReplySupportTicketDto) {
    return this.tickets.replyAsAdmin(ticketId, user.adminUserId!, dto.body);
  }

  @Post(":ticketId/resolve")
  resolve(@CurrentUser() user: JwtAccessPayload, @Param("ticketId") ticketId: string) {
    return this.tickets.resolve(ticketId, user.adminUserId!);
  }
}
