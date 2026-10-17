import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaRuntimeService } from "./prisma-runtime.service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every tenant-scoped read/write goes through `run()`, which opens a
 * transaction, sets the Postgres session variable the RLS policies key off
 * (`app.current_seller_id`), and runs the callback inside it.
 *
 * D88 (founder decision, 2026-10-10/11, RLS hardening follow-ups) -
 * `SET LOCAL`'s own syntax can't take a bind parameter (the setting value
 * has to be a literal), which is why this used to build that one statement
 * by string concatenation - a real injection vector if the UUID check below
 * were ever bypassed or weakened. `set_config()` is a plain SQL function,
 * so it CAN take a bind parameter for its value argument - same `is_local =
 * true` session-transaction-scoped behavior as `SET LOCAL`, called through
 * Prisma's own tagged-template `$executeRaw` (a real parameterized query,
 * not string interpolation - same mechanism already used elsewhere in this
 * codebase, e.g. storefront.service.ts's `Prisma.sql` conditions). The UUID
 * check stays as fail-fast validation (a non-UUID sellerId reaching here is
 * always a caller bug worth a clear error), not as the injection defense
 * anymore - that's now the parameterization itself.
 */
@Injectable()
export class TenantPrismaService {
  constructor(private readonly prisma: PrismaRuntimeService) {}

  async run<T>(sellerId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    if (!UUID_RE.test(sellerId)) {
      throw new Error(`TenantPrismaService.run received a non-UUID sellerId: ${sellerId}`);
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_seller_id', ${sellerId}, true)`;
      return fn(tx);
    });
  }
}
