import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";

type CustomerSort = "total_spent" | "orders_count" | "last_order_at";

/**
 * FR-13.1-13.3. Every dashboard-facing method runs through TenantPrismaService
 * (RLS) - a seller never sees another seller's customers, even for an
 * identical buyer email (FR-13.3, two separate rows by design).
 */
@Injectable()
export class CustomersService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /**
   * FR-13.1 - called from inside CheckoutService.placeOrder()'s existing
   * transaction, for both storefront and manual (FR-17.1) order sources, so
   * a customer record exists uniformly regardless of order source. Runs on
   * the same admin tx placeOrder already uses - no seller/RLS context exists
   * yet at storefront-checkout time.
   */
  async findOrCreateForOrder(tx: Prisma.TransactionClient, storeId: string, email: string, name: string, phone: string) {
    return tx.customer.upsert({
      where: { uniq_customer_store_email: { storeId, email } },
      update: { name, phone },
      create: { storeId, email, name, phone },
    });
  }

  /**
   * FR-13.1 - called from inside OrdersService.markAsPaid()'s existing
   * transaction, the sole place the Financial Truth Invariant's pending ->
   * confirmed transition happens (§3.12): order_count/total_spent must
   * never count an order that was never actually paid.
   */
  async recordCompletedOrder(
    tx: Prisma.TransactionClient,
    customerId: string,
    orderTotal: Prisma.Decimal | number | string,
    placedAt: Date,
  ) {
    const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
    await tx.customer.update({
      where: { id: customerId },
      data: {
        ordersCount: { increment: 1 },
        totalSpent: { increment: Number(orderTotal) },
        firstOrderAt: customer.firstOrderAt ?? placedAt,
        lastOrderAt: placedAt,
      },
    });
  }

  /** FR-13.2 - searchable, sortable by total spent/order count. */
  async list(sellerId: string, storeId: string, filters: { search?: string; sort?: CustomerSort }) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.customer.findMany({
        where: {
          storeId,
          ...(filters.search
            ? {
                OR: [
                  { email: { contains: filters.search, mode: "insensitive" as const } },
                  { name: { contains: filters.search, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        orderBy:
          filters.sort === "orders_count"
            ? { ordersCount: "desc" as const }
            : filters.sort === "last_order_at"
              ? { lastOrderAt: "desc" as const }
              : { totalSpent: "desc" as const },
      });
    });
  }

  /** FR-13.2 - per-customer detail view showing their order history at that store. */
  async getOne(sellerId: string, storeId: string, customerId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        include: { orders: { orderBy: { placedAt: "desc" } } },
      });
      if (!customer || customer.storeId !== storeId) throw new NotFoundException("Customer not found.");
      return customer;
    });
  }
}
