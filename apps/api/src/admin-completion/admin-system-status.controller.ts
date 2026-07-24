import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { AdminSystemStatusService } from "./admin-system-status.service";

@Controller("admin/system-status")
@UseGuards(AdminAuthGuard)
export class AdminSystemStatusController {
  constructor(private readonly status: AdminSystemStatusService) {}

  @Get()
  get() {
    return this.status.getStatus();
  }
}
