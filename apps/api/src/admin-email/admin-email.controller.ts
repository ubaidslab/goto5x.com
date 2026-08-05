import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { AdminEmailAccountsService } from "./admin-email-accounts.service";
import { AdminMailService } from "./admin-mail.service";
import { LinkAdminEmailAccountDto } from "./dto/link-admin-email-account.dto";
import { SendAdminEmailReplyDto } from "./dto/send-admin-email-reply.dto";

/** SRS §5.53/FR-53.1-53.5 - UZEYN's own unified inbox in the admin terminal. */
@Controller("admin/email")
@UseGuards(AdminAuthGuard)
export class AdminEmailController {
  constructor(
    private readonly accounts: AdminEmailAccountsService,
    private readonly mail: AdminMailService,
  ) {}

  @Get("accounts")
  listAccounts() {
    return this.accounts.list();
  }

  @Post("accounts")
  linkAccount(@CurrentUser() user: JwtAccessPayload, @Body() dto: LinkAdminEmailAccountDto) {
    return this.accounts.link(user.adminUserId, dto);
  }

  @Delete("accounts/:id")
  unlinkAccount(@CurrentUser() user: JwtAccessPayload, @Param("id") id: string) {
    return this.accounts.unlink(user.adminUserId, id);
  }

  @Post("accounts/:id/test-connection")
  testConnection(@Param("id") id: string) {
    return this.accounts.testConnection(id);
  }

  @Get("inbox")
  getInbox() {
    return this.mail.fetchUnifiedInbox();
  }

  @Post("reply")
  reply(@Body() dto: SendAdminEmailReplyDto) {
    return this.mail.sendReply(dto);
  }
}
