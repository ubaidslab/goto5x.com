import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SettingsService } from "../settings-registry/settings.service";
import { round2 } from "../orders/money.util";

interface OrderLike {
  id: string;
  storeId: string;
  totalAmount: Prisma.Decimal | number | string;
  taxAmount: Prisma.Decimal | number | string;
}

/**
 * FR-6.16. The commission base is the order's post-discount product+
 * shipping subtotal, excluding tax - `totalAmount - taxAmount` holds
 * regardless of whether the store's tax setting is inclusive or exclusive
 * (see order-totals.util.ts: in both branches, totalAmount decomposes as
 * (product+shipping, ex-tax) + taxAmount).
 */
@Injectable()
export class LedgerService {
  constructor(private readonly settings: SettingsService) {}

  /**
   * Called from inside OrdersService.markAsPaid()'s existing transaction -
   * a commission_accrued entry must never exist without the order that
   * produced it actually being confirmed, and vice versa.
   */
  async accrueCommission(
    tx: Prisma.TransactionClient,
    sellerId: string,
    order: OrderLike,
    currency: string,
  ): Promise<void> {
    const commissionBase = round2(Number(order.totalAmount) - Number(order.taxAmount));
    const ratePercent = await this.settings.resolve<number>("billing.commission_rate_percent", { sellerId });
    const amount = round2((commissionBase * ratePercent) / 100);

    await tx.ledgerEntry.create({
      data: {
        sellerId,
        orderId: order.id,
        type: "commission_accrued",
        amount,
        currency,
      },
    });
  }

  /** FR-6.20 - waives (reduces) a specific accrued commission without touching any other entry. */
  async waiveCommission(
    tx: Prisma.TransactionClient,
    sellerId: string,
    orderId: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    await tx.ledgerEntry.create({
      data: {
        sellerId,
        orderId,
        type: "commission_waived",
        amount: -Math.abs(amount),
        currency,
      },
    });
  }
}
