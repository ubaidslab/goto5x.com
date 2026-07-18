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
    // FR-7.4 (inverse commission laddering) - resolves against the seller's
    // real plan assignment now that one exists (Module 14); `subscriptions`
    // has no RLS (it's a global table), so it's safe to read via the same
    // tenant-scoped `tx` this call already runs inside.
    const subscription = await tx.subscription.findUnique({ where: { sellerId } });
    const baseRatePercent = await this.settings.resolve<number>("billing.commission_rate_percent", {
      sellerId,
      planId: subscription?.planId,
    });
    const ratePercent = Math.max(0, baseRatePercent - (await this.launchCampaignDiscountPercent(tx, sellerId)));
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

  /**
   * FR-7.7 - launch-campaign pricing: a time-limited or first-N-sellers
   * discount off the resolved commission rate. Both conditions are
   * optional (empty expiry / zero seller_limit = that condition isn't
   * set); when neither is set, discount_percent alone still gates the
   * whole thing (0 = campaign off).
   */
  private async launchCampaignDiscountPercent(tx: Prisma.TransactionClient, sellerId: string): Promise<number> {
    const discountPercent = await this.settings.resolve<number>("billing.launch_campaign_discount_percent");
    if (discountPercent <= 0) return 0;

    const expiry = await this.settings.resolve<string>("billing.launch_campaign_expiry");
    if (expiry && new Date(expiry) < new Date()) return 0;

    const sellerLimit = await this.settings.resolve<number>("billing.launch_campaign_seller_limit");
    if (sellerLimit > 0) {
      const seller = await tx.seller.findUnique({ where: { id: sellerId }, select: { createdAt: true } });
      if (!seller) return 0;
      const rank = await tx.seller.count({ where: { createdAt: { lte: seller.createdAt } } });
      if (rank > sellerLimit) return 0;
    }

    return discountPercent;
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
