import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaAdminService } from "../../prisma/prisma-admin.service";

const MAX_FOUNDING_MEMBERS = 100;

/**
 * D17/D134 - "the first 100 PAYING sellers, counted across ALL billing
 * rails" (manual/wallet and Paddle both feed the same counter - not a
 * Paddle-only cohort). Called from both WalletService.verifyTopUp()
 * (the manual rail's own first-payment branch) and
 * PaddleSubscriptionLifecycleService.confirmCharge() (Paddle's), each
 * only on that seller's genuinely first-ever verified plan-fee payment.
 *
 * The race this guards against: two sellers' first-ever payments
 * verified at the same instant must never both claim ordinal 100. A
 * single `UPDATE ... WHERE count < 100 RETURNING count` is Postgres's
 * own row-level locking doing the serialization - the same guarantee
 * this codebase already proves out via `SELECT ... FOR UPDATE` for the
 * campaign-quota/supplier-wallet-debit races (security-audit-report.md
 * §3 #9/#17), just one fewer round trip since there's no second write
 * to hold the lock across here.
 */
@Injectable()
export class FoundingMembersService {
  constructor(private readonly prismaAdmin: PrismaAdminService) {}

  /**
   * Accepts the caller's own transaction client when it has one
   * (WalletService.verifyTopUp()/PaddleSubscriptionLifecycleService.
   * confirmCharge() both call this from inside an outer `$transaction`) so
   * the counter claim rolls back together with the rest of that payment-
   * confirmation write if anything after it fails - claiming ordinal #100
   * on a connection the enclosing transaction doesn't share would let the
   * claim survive a rollback while the subscription row it was meant for
   * never got marked, permanently burning that ordinal. Same
   * `Prisma.TransactionClient`-or-default-client shape as returns.service.
   * ts's own `db` parameter.
   */
  async claimOrdinalIfEligible(tx: Prisma.TransactionClient | PrismaAdminService = this.prismaAdmin): Promise<number | null> {
    const rows = await tx.$queryRaw<{ count: number }[]>`
      UPDATE founding_member_counter
      SET count = count + 1
      WHERE id = 1 AND count < ${MAX_FOUNDING_MEMBERS}
      RETURNING count
    `;
    if (rows.length === 0) return null;
    return rows[0].count;
  }
}
