import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { CreatePlatformMessageDto } from "./dto/create-platform-message.dto";
import { PlatformMessagesService } from "./platform-messages.service";

@Controller("admin/messages")
@UseGuards(AdminAuthGuard)
export class AdminPlatformMessagesController {
  constructor(private readonly messages: PlatformMessagesService) {}

  @Get()
  listAll() {
    return this.messages.listAll();
  }

  @Post()
  create(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreatePlatformMessageDto) {
    if (!user.adminUserId) {
      // Unreachable in practice - AdminAuthGuard already requires this.
      throw new ForbiddenException("This endpoint requires an authenticated admin session.");
    }
    return this.messages.create(dto, user.adminUserId);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.messages.remove(id);
  }
}

/** The seller-facing read driving the storefront-adjacent banner/popup/notification UI. */
@Controller("sellers/me/messages")
@UseGuards(JwtAuthGuard)
export class SellerPlatformMessagesController {
  constructor(private readonly messages: PlatformMessagesService) {}

  @Get()
  listActive(@CurrentSellerId() sellerId: string) {
    return this.messages.listActiveFor(sellerId);
  }
}
