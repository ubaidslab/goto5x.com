import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Connects as `app_runtime` (DATABASE_URL) - the RLS-restricted role used for
 * every tenant-facing request. See docs/database-schema.md and
 * docs/build-plan.md "Foundational architecture decisions".
 */
@Injectable()
export class PrismaRuntimeService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
