import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { CreateSupplierAdapterDto } from "./dto/create-supplier-adapter.dto";
import { UpdateSupplierAdapterDto } from "./dto/update-supplier-adapter.dto";
import { SupplierAdapterRegistryService } from "./supplier-adapter-registry.service";

/** FR-4.9 - admin can register, enable, or disable a supplier adapter without a deploy. */
@Controller("admin/supplier-adapters")
@UseGuards(AdminAuthGuard)
export class SupplierAdaptersController {
  constructor(private readonly registry: SupplierAdapterRegistryService) {}

  @Get()
  list() {
    return this.registry.list();
  }

  @Post()
  create(@Body() dto: CreateSupplierAdapterDto) {
    return this.registry.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateSupplierAdapterDto) {
    return this.registry.update(id, dto);
  }
}
