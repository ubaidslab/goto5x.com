import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { AdminEmailAccountsService } from "./admin-email-accounts.service";
import { AdminEmailController } from "./admin-email.controller";
import { AdminMailService } from "./admin-mail.service";

@Module({
  imports: [AdminModule],
  controllers: [AdminEmailController],
  providers: [AdminEmailAccountsService, AdminMailService],
})
export class AdminEmailModule {}
