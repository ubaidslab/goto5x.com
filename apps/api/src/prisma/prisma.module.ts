import { Global, Module } from "@nestjs/common";
import { PrismaAdminService } from "./prisma-admin.service";
import { PrismaRuntimeService } from "./prisma-runtime.service";
import { TenantPrismaService } from "./tenant-prisma.service";

@Global()
@Module({
  providers: [PrismaRuntimeService, PrismaAdminService, TenantPrismaService],
  exports: [PrismaRuntimeService, PrismaAdminService, TenantPrismaService],
})
export class PrismaModule {}
