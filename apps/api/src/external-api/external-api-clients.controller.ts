import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { CreateExternalApiClientDto } from "./dto/create-external-api-client.dto";
import { UpdateExternalApiClientDto } from "./dto/update-external-api-client.dto";
import { ExternalApiClientsService } from "./external-api-clients.service";

/** FR-8.14 - admin can register, enable, disable, or rotate the secret for either external-SaaS client without a deploy. */
@Controller("admin/external-api-clients")
@UseGuards(AdminAuthGuard)
export class ExternalApiClientsController {
  constructor(private readonly clients: ExternalApiClientsService) {}

  @Get()
  list() {
    return this.clients.list();
  }

  @Post()
  create(@Body() dto: CreateExternalApiClientDto) {
    return this.clients.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateExternalApiClientDto) {
    return this.clients.update(id, dto);
  }

  @Post(":id/regenerate-secret")
  regenerateSecret(@Param("id") id: string) {
    return this.clients.regenerateSecret(id);
  }
}
