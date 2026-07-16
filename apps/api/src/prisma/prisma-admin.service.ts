import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Connects as `app_admin` (DATABASE_ADMIN_URL) - BYPASSRLS. Only ever used on
 * request paths already gated by AdminAuthGuard at the application layer; RLS
 * bypass is a narrow, deliberately-scoped capability, not a general escape
 * hatch. See docs/build-plan.md "Foundational architecture decisions".
 */
@Injectable()
export class PrismaAdminService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: { db: { url: process.env.DATABASE_ADMIN_URL } },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
