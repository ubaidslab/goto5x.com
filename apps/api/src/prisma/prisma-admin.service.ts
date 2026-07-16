import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Connects as `app_admin` (DATABASE_ADMIN_URL) - BYPASSRLS. RLS bypass is a
 * narrow, deliberately-scoped capability, not a general escape hatch. See
 * docs/build-plan.md "Foundational architecture decisions". Two legitimate
 * uses, and no others:
 * 1. Request paths already gated by AdminAuthGuard at the application layer.
 * 2. Narrowly-scoped, read-only, system-level lookups that inherently
 *    precede any tenant context - e.g. `DomainsService.resolveStoreIdByHostname`
 *    (Module 3), which resolves an incoming request's hostname to a store
 *    *before* any seller/tenant session exists to `SET LOCAL
 *    app.current_seller_id` for in the first place. `app_runtime` cannot
 *    serve this query at all (RLS would always return zero rows with no
 *    session variable set), so BYPASSRLS is the only correct tool, not a
 *    convenience shortcut around it.
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
