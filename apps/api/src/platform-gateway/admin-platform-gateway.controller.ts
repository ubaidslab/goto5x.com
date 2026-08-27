import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { PaymentGatewayProvider } from "@prisma/client";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { ConnectPlatformGatewayDto } from "./dto/connect-platform-gateway.dto";
import { SetPlatformGatewayActiveDto } from "./dto/set-platform-gateway-active.dto";
import { PlatformGatewayService } from "./platform-gateway.service";

/** Founder-directed scope addition - "Platform Merchant Connection" admin controls. Admin-only, same money-adjacent discipline as every other gateway/payment surface. */
@Controller("admin/platform-gateway")
@UseGuards(AdminAuthGuard)
export class AdminPlatformGatewayController {
  constructor(private readonly platformGateway: PlatformGatewayService) {}

  @Get()
  list() {
    return this.platformGateway.list();
  }

  @Post()
  connect(@Body() dto: ConnectPlatformGatewayDto) {
    return this.platformGateway.connect(dto);
  }

  @Patch(":provider/active")
  setActive(@Param("provider") provider: PaymentGatewayProvider, @Body() dto: SetPlatformGatewayActiveDto) {
    return this.platformGateway.setActive(provider, dto.isActive);
  }

  @Post(":provider/test")
  testConnection(@Param("provider") provider: PaymentGatewayProvider) {
    return this.platformGateway.testConnection(provider);
  }

  @Delete(":provider")
  remove(@Param("provider") provider: PaymentGatewayProvider) {
    return this.platformGateway.remove(provider);
  }
}
