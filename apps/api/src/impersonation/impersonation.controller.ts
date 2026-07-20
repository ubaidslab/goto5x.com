import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { StartImpersonationDto } from "./dto/start-impersonation.dto";
import { AdminImpersonationService } from "./impersonation.service";

function assertAdminUserId(user: JwtAccessPayload): asserts user is JwtAccessPayload & { adminUserId: string } {
  if (!user.adminUserId) {
    // Unreachable in practice - AdminAuthGuard already requires this.
    throw new ForbiddenException("This endpoint requires an authenticated admin session.");
  }
}

@Controller("admin")
@UseGuards(AdminAuthGuard)
export class AdminImpersonationController {
  constructor(private readonly impersonation: AdminImpersonationService) {}

  @Post("sellers/:sellerId/impersonate")
  start(@CurrentUser() user: JwtAccessPayload, @Param("sellerId") sellerId: string, @Body() dto: StartImpersonationDto) {
    assertAdminUserId(user);
    return this.impersonation.start(user.adminUserId, sellerId, dto.reason);
  }

  @Post("impersonation/:sessionId/end")
  end(@CurrentUser() user: JwtAccessPayload, @Param("sessionId") sessionId: string) {
    assertAdminUserId(user);
    return this.impersonation.end(user.adminUserId, sessionId);
  }

  /** FR-8.4 - read-only "view any store" access. */
  @Get("stores/:storeId")
  viewStore(@Param("storeId") storeId: string) {
    return this.impersonation.viewStore(storeId);
  }
}
