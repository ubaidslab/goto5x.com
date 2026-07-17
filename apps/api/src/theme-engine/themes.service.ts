import { Injectable } from "@nestjs/common";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";

/**
 * `themes` is a global, admin-managed catalog with no RLS (schema.prisma's
 * doc comment on the `Theme` model) - every seller reads the same rows, so
 * this deliberately goes through PrismaRuntimeService directly rather than
 * TenantPrismaService.run(), there being no seller-scoped session variable
 * relevant to a table nothing here filters by seller/store.
 */
@Injectable()
export class ThemesService {
  constructor(private readonly prisma: PrismaRuntimeService) {}

  async listSelectable() {
    return this.prisma.theme.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }
}
