import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAccessPayload } from "../common/types";
import { BlockStaffSessionsGuard } from "../common/guards/block-staff-sessions.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CreateSupportTicketDto } from "./dto/create-support-ticket.dto";
import { ReplySupportTicketDto } from "./dto/reply-support-ticket.dto";
import { SupportTicketsService } from "./support-tickets.service";

/** SRS §5.6k/FR-8.18 (Module 90) - seller-facing create/list/view/reply surface. Owner-only (staff sessions blocked - a support ticket is the seller's own line to the platform). */
@Controller("stores/:storeId/support-tickets")
@UseGuards(JwtAuthGuard, BlockStaffSessionsGuard)
export class SupportTicketsController {
  constructor(private readonly tickets: SupportTicketsService) {}

  @Post()
  create(
    @CurrentSellerId() sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.tickets.create(sellerId, storeId, user.sub, dto.subject, dto.body);
  }

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.tickets.listForStore(sellerId, storeId);
  }

  @Get(":ticketId")
  get(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("ticketId") ticketId: string) {
    return this.tickets.getForStore(sellerId, storeId, ticketId);
  }

  @Post(":ticketId/messages")
  reply(
    @CurrentSellerId() sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @Param("ticketId") ticketId: string,
    @Body() dto: ReplySupportTicketDto,
  ) {
    return this.tickets.replyAsSeller(sellerId, storeId, ticketId, user.sub, dto.body);
  }
}
