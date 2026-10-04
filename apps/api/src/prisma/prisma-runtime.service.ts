import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { withConnectionLimit } from "../common/database-url.util";

/**
 * Connects as `app_runtime` (DATABASE_URL) - the RLS-restricted role used for
 * every tenant-facing request. See docs/database-schema.md and
 * docs/build-plan.md "Foundational architecture decisions".
 */
@Injectable()
export class PrismaRuntimeService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const limit = Number(process.env.DATABASE_RUNTIME_CONNECTION_LIMIT ?? 10);
    super({
      datasources: { db: { url: withConnectionLimit(process.env.DATABASE_URL!, limit) } },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
