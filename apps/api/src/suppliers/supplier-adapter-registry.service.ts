import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { CreateSupplierAdapterDto } from "./dto/create-supplier-adapter.dto";
import { UpdateSupplierAdapterDto } from "./dto/update-supplier-adapter.dto";

/**
 * FR-4.9 - admin can register, enable, or disable a supplier adapter
 * without a deploy. Global registry (no RLS), same pattern as
 * `external_api_clients` (docs/architecture.md). Every read here goes
 * through `AdminAuthGuard`-gated routes, so `PrismaRuntimeService` (not
 * BYPASSRLS) is fine - this table was never RLS-protected in the first place.
 */
@Injectable()
export class SupplierAdapterRegistryService {
  constructor(private readonly prisma: PrismaRuntimeService) {}

  list() {
    return this.prisma.supplierAdapter.findMany({ orderBy: { adapterType: "asc" } });
  }

  async create(dto: CreateSupplierAdapterDto) {
    try {
      return await this.prisma.supplierAdapter.create({
        data: {
          adapterType: dto.adapterType,
          displayName: dto.displayName,
          isEnabled: dto.isEnabled ?? true,
          config: (dto.config ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`An adapter of type "${dto.adapterType}" is already registered.`);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateSupplierAdapterDto) {
    const existing = await this.prisma.supplierAdapter.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Supplier adapter not found.");
    return this.prisma.supplierAdapter.update({
      where: { id },
      data: {
        isEnabled: dto.isEnabled,
        config: dto.config as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
