import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";

const RESULT_LIMIT = 10;

/**
 * Module 25 (Admin Completion) - one search box across the four entity
 * types an admin needs to find by partial name/email/ID (SRS Admin Control
 * Plane §14 requirement). Raw SQL rather than the Prisma query API: a
 * partial match against a `@db.Uuid` id column needs an explicit `::text`
 * cast for `ILIKE` to work at all (Postgres UUID has no native LIKE
 * support), matching this codebase's existing `$queryRaw` + `Prisma.sql`
 * precedent (StorefrontService's ranked full-text search) rather than
 * inventing a second raw-SQL convention.
 */
@Injectable()
export class AdminSearchService {
  constructor(private readonly prismaAdmin: PrismaAdminService) {}

  async search(q: string) {
    const term = q.trim();
    if (!term) {
      return { sellers: [], stores: [], orders: [], suppliers: [] };
    }
    const pattern = `%${term}%`;

    const [sellers, stores, orders, suppliers] = await Promise.all([
      this.prismaAdmin.$queryRaw<
        { id: string; businessName: string; email: string; lifecycleStatus: string }[]
      >(
        Prisma.sql`
          SELECT s.id, s.business_name AS "businessName", u.email, s.lifecycle_status AS "lifecycleStatus"
          FROM sellers s
          JOIN users u ON u.id = s.user_id
          WHERE s.business_name ILIKE ${pattern}
             OR u.email ILIKE ${pattern}
             OR s.id::text ILIKE ${pattern}
          ORDER BY s.created_at DESC
          LIMIT ${RESULT_LIMIT}
        `,
      ),
      this.prismaAdmin.$queryRaw<{ id: string; name: string; slug: string; sellerId: string }[]>(
        Prisma.sql`
          SELECT id, name, slug, seller_id AS "sellerId"
          FROM stores
          WHERE name ILIKE ${pattern} OR slug ILIKE ${pattern} OR id::text ILIKE ${pattern}
          ORDER BY created_at DESC
          LIMIT ${RESULT_LIMIT}
        `,
      ),
      this.prismaAdmin.$queryRaw<
        { id: string; buyerEmail: string; status: string; totalAmount: string; currency: string; storeId: string }[]
      >(
        Prisma.sql`
          SELECT id, buyer_email AS "buyerEmail", status, total_amount AS "totalAmount", currency, store_id AS "storeId"
          FROM orders
          WHERE buyer_email ILIKE ${pattern} OR id::text ILIKE ${pattern} OR status_lookup_token ILIKE ${pattern}
          ORDER BY placed_at DESC
          LIMIT ${RESULT_LIMIT}
        `,
      ),
      this.prismaAdmin.$queryRaw<{ id: string; businessName: string; email: string }[]>(
        Prisma.sql`
          SELECT s.id, s.business_name AS "businessName", u.email
          FROM suppliers s
          JOIN users u ON u.id = s.user_id
          WHERE s.business_name ILIKE ${pattern} OR u.email ILIKE ${pattern} OR s.id::text ILIKE ${pattern}
          ORDER BY s.created_at DESC
          LIMIT ${RESULT_LIMIT}
        `,
      ),
    ]);

    return {
      sellers,
      stores,
      orders: orders.map((o) => ({ ...o, totalAmount: Number(o.totalAmount) })),
      suppliers,
    };
  }
}
