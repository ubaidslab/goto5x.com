import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { BlockStaffSessions } from "../common/decorators/block-staff-sessions.decorator";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { BlockStaffSessionsGuard } from "../common/guards/block-staff-sessions.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CreateStaffAccountDto } from "./dto/create-staff-account.dto";
import { UpdateStaffAccountDto } from "./dto/update-staff-account.dto";
import { StaffAccountsService } from "./staff-accounts.service";

/** Owner-only always (SRS §5.52/FR-52.2) - a staff session can never manage other staff accounts. */
@Controller("sellers/me/staff-accounts")
@UseGuards(JwtAuthGuard, BlockStaffSessionsGuard)
@BlockStaffSessions()
export class StaffAccountsController {
  constructor(private readonly staffAccounts: StaffAccountsService) {}

  /** Registered before ":id" so it isn't shadowed by that param route, same precedent as OrdersController's "overview". */
  @Get("role-templates")
  getRoleTemplates() {
    return this.staffAccounts.getRoleTemplates();
  }

  @Get("activity")
  getActivityLog(@CurrentSellerId() sellerId: string) {
    return this.staffAccounts.getActivityLog(sellerId);
  }

  @Post("devices/revoke-all")
  revokeAllDevices(@CurrentSellerId() sellerId: string) {
    return this.staffAccounts.revokeAllDevices(sellerId);
  }

  @Post()
  create(@CurrentSellerId() sellerId: string, @Body() dto: CreateStaffAccountDto) {
    return this.staffAccounts.create(sellerId, dto);
  }

  @Get()
  list(@CurrentSellerId() sellerId: string) {
    return this.staffAccounts.list(sellerId);
  }

  @Patch(":id")
  update(@CurrentSellerId() sellerId: string, @Param("id") id: string, @Body() dto: UpdateStaffAccountDto) {
    return this.staffAccounts.update(sellerId, id, dto);
  }

  @Delete(":id")
  revoke(@CurrentSellerId() sellerId: string, @Param("id") id: string) {
    return this.staffAccounts.revoke(sellerId, id);
  }

  @Get(":id/devices")
  listDevices(@CurrentSellerId() sellerId: string, @Param("id") id: string) {
    return this.staffAccounts.listDevices(sellerId, id);
  }

  @Patch(":id/devices/:deviceId/approve")
  approveDevice(@CurrentSellerId() sellerId: string, @Param("id") id: string, @Param("deviceId") deviceId: string) {
    return this.staffAccounts.approveDevice(sellerId, id, deviceId);
  }

  @Patch(":id/devices/:deviceId/revoke")
  revokeDevice(@CurrentSellerId() sellerId: string, @Param("id") id: string, @Param("deviceId") deviceId: string) {
    return this.staffAccounts.revokeDevice(sellerId, id, deviceId);
  }
}
