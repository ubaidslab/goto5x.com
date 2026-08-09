import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { CreatePlatformNewsletterDto } from "./dto/create-platform-newsletter.dto";
import { PlatformNewsletterService } from "./platform-newsletter.service";

/** Module 55 (SRS §5.62/FR-62.2) - the admin-composed platform newsletter, sent from UZEYN's own SMTP identity. */
@Controller("admin/newsletters")
@UseGuards(AdminAuthGuard)
export class AdminNewsletterController {
  constructor(private readonly newsletters: PlatformNewsletterService) {}

  @Get()
  list() {
    return this.newsletters.list();
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.newsletters.getOne(id);
  }

  @Post()
  create(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreatePlatformNewsletterDto) {
    return this.newsletters.create(user.adminUserId!, dto);
  }

  @Post(":id/send")
  send(@Param("id") id: string) {
    return this.newsletters.send(id);
  }
}
