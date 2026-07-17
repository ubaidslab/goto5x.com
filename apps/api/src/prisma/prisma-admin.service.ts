import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Connects as `app_admin` (DATABASE_ADMIN_URL) - BYPASSRLS. RLS bypass is a
 * narrow, deliberately-scoped capability, not a general escape hatch. See
 * docs/build-plan.md "Foundational architecture decisions". Three
 * legitimate uses, and no others:
 * 1. Request paths already gated by AdminAuthGuard at the application layer.
 * 2. Narrowly-scoped, read-only, system-level lookups that inherently
 *    precede any tenant context - e.g. `DomainsService.resolveStoreIdByHostname`
 *    (Module 3), which resolves an incoming request's hostname to a store
 *    *before* any seller/tenant session exists to `SET LOCAL
 *    app.current_seller_id` for in the first place. `app_runtime` cannot
 *    serve this query at all (RLS would always return zero rows with no
 *    session variable set), so BYPASSRLS is the only correct tool, not a
 *    convenience shortcut around it.
 * 3. A supplier's own reads/writes on tenant tables they legitimately span
 *    across (Module 8) - e.g. `SupplierPortalService`'s multi-store view
 *    (FR-3.3), which by definition spans multiple *sellers'* stores at
 *    once. `store_supplier_links`/`listing_reviews` RLS is keyed on
 *    `app.current_seller_id` (protects the seller's own isolation
 *    guarantee); there is no single seller id to key a supplier's session
 *    on, so this read path bypasses RLS and filters explicitly on
 *    `supplier_id` in the query itself instead.
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
