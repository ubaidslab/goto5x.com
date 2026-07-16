import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaRuntimeService } from "./prisma-runtime.service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every tenant-scoped read/write goes through `run()`, which opens a
 * transaction, sets the Postgres session variable the RLS policies key off
 * (`app.current_seller_id`), and runs the callback inside it. `SET LOCAL`
 * cannot be parameterized by the Postgres wire protocol, so the seller id is
 * validated as a syntactically-correct UUID before being interpolated - this
 * is the one place in the codebase that builds SQL by string concatenation,
 * and it exists specifically to prevent that from being an injection vector.
 * See docs/build-plan.md "Foundational architecture decisions".
 */
@Injectable()
export class TenantPrismaService {
  constructor(private readonly prisma: PrismaRuntimeService) {}

  async run<T>(sellerId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    if (!UUID_RE.test(sellerId)) {
      throw new Error(`TenantPrismaService.run received a non-UUID sellerId: ${sellerId}`);
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_seller_id = '${sellerId}'`);
      return fn(tx);
    });
  }
}
