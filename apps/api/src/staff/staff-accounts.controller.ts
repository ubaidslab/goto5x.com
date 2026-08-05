import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { BlockStaffSessions } from "../common/decorators/block-staff-sessions.decorator";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { BlockStaffSessionsGuard } from "../common/guards/block-staff-sessions.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CreateStaffAccountDto } from "./dto/create-staff-account.dto";
import { StaffAccountsService } from "./staff-accounts.service";

/** Owner-only always (SRS §5.52/FR-52.2) - a staff session can never manage other staff accounts. */
@Controller("sellers/me/staff-accounts")
@UseGuards(JwtAuthGuard, BlockStaffSessionsGuard)
@BlockStaffSessions()
export class StaffAccountsController {
  constructor(private readonly staffAccounts: StaffAccountsService) {}

  @Post()
  create(@CurrentSellerId() sellerId: string, @Body() dto: CreateStaffAccountDto) {
    return this.staffAccounts.create(sellerId, dto);
  }

  @Get()
  list(@CurrentSellerId() sellerId: string) {
    return this.staffAccounts.list(sellerId);
  }

  @Delete(":id")
  revoke(@CurrentSellerId() sellerId: string, @Param("id") id: string) {
    return this.staffAccounts.revoke(sellerId, id);
  }
}
