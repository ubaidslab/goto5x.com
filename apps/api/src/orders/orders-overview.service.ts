import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";

export const ORDER_BUCKETS = [
  "pending",
  "awaitingVerification",
  "prepaidReceived",
  "awaitingTracking",
  "shipped",
  "delivered",
  "cancelledReturned",
] as const;
export type OrderBucket = (typeof ORDER_BUCKETS)[number];

/**
 * SRS §5.38/FR-38.1-38.2 - the single predicate definition every bucket
 * count AND its "click through to exactly these orders" list filter both
 * use, so the two can never drift (§14.38's "derived read, provably never
 * a second source of truth" checklist item is true by construction, not
 * just by convention). `pending`/`awaitingVerification`/`prepaidReceived`
 * are mutually exclusive sub-partitions of `Order.status = 'pending'` - a
 * single `OrderVerification` row has exactly one status, so a pending
 * order can match at most one of the two named sub-buckets.
 */
export function orderBucketWhereClause(bucket: OrderBucket): Prisma.OrderWhereInput {
  switch (bucket) {
    case "awaitingVerification":
      return { status: "pending", verification: { status: "pending" } };
    case "prepaidReceived":
      return { status: "pending", verification: { channel: "prepaid_confirmation", status: "verified" } };
    case "pending":
      return {
        status: "pending",
        NOT: [{ verification: { status: "pending" } }, { verification: { channel: "prepaid_confirmation", status: "verified" } }],
      };
    case "awaitingTracking":
      return { status: "confirmed" };
    case "shipped":
      return { status: "shipped" };
    case "delivered":
      return { status: { in: ["delivered", "completed"] } };
    case "cancelledReturned":
      return { status: { in: ["cancelled", "disputed"] } };
  }
}

@Injectable()
export class OrdersOverviewService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async getOverview(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      const counts = await Promise.all(
        ORDER_BUCKETS.map((bucket) => tx.order.count({ where: { storeId, ...orderBucketWhereClause(bucket) } })),
      );
      const buckets = Object.fromEntries(ORDER_BUCKETS.map((bucket, i) => [bucket, counts[i]])) as Record<OrderBucket, number>;
      const total = counts.reduce((sum, n) => sum + n, 0);

      // FR-38.1's "plus the existing supplier fulfillment checklist" - a
      // derived count over data Module 8/9 already tracks, not a new
      // source of truth.
      const supplierItemsAwaitingFulfillment = await tx.orderItem.count({
        where: { storeId, supplierId: { not: null }, fulfillmentStatus: { in: ["pending", "confirmed"] } },
      });

      return { buckets, total, supplierItemsAwaitingFulfillment };
    });
  }
}
