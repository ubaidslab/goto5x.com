import { Injectable } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const CONFIRMED_OR_BEYOND: OrderStatus[] = ["confirmed", "shipped", "delivered", "completed"];

interface FunnelStage {
  stage: "signed_up" | "store_created" | "first_product_listed" | "published" | "first_sale";
  count: number;
  dropOffFromPrevious: number | null;
}

interface StuckSeller {
  sellerId: string;
  businessName: string;
  stage: FunnelStage["stage"];
  daysAtStage: number;
}

/**
 * SRS §5.6k/FR-6.46 (Module 69) - admin seller-health funnel: signup ->
 * store created -> first product listed -> published -> first sale, plus
 * sellers stuck at their current stage past growth.funnel_stuck_days.
 * Computed live from existing Seller/Store/Product/Order state - no new
 * tracking table (per the FR's own text). Neither Product nor Order carry
 * a sellerId column (only storeId), so this joins through Store in
 * application code rather than issuing four separate groupBy queries that
 * would each need their own store->seller join anyway.
 */
@Injectable()
export class SellerHealthFunnelService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
  ) {}

  async compute(now = new Date()) {
    const stuckDays = await this.settings.resolve<number>("growth.funnel_stuck_days");
    const stuckCutoff = new Date(now.getTime() - stuckDays * DAY_MS);

    const [sellers, stores, products, confirmedOrders] = await Promise.all([
      this.prismaAdmin.seller.findMany({ select: { id: true, businessName: true, createdAt: true } }),
      this.prismaAdmin.store.findMany({ select: { id: true, sellerId: true, createdAt: true, publishedAt: true } }),
      this.prismaAdmin.product.findMany({ select: { storeId: true, createdAt: true } }),
      this.prismaAdmin.order.findMany({ where: { status: { in: CONFIRMED_OR_BEYOND } }, select: { storeId: true, placedAt: true } }),
    ]);

    const sellerIdByStoreId = new Map(stores.map((s) => [s.id, s.sellerId]));
    const storesBySeller = groupBy(stores, (s) => s.sellerId);
    const productDatesBySeller = groupBy(
      products.filter((p) => sellerIdByStoreId.has(p.storeId)),
      (p) => sellerIdByStoreId.get(p.storeId)!,
    );
    const saleDatesBySeller = groupBy(
      confirmedOrders.filter((o) => sellerIdByStoreId.has(o.storeId)),
      (o) => sellerIdByStoreId.get(o.storeId)!,
    );

    let storeCreated = 0;
    let productListed = 0;
    let published = 0;
    let firstSale = 0;
    const stuckSellers: StuckSeller[] = [];

    for (const seller of sellers) {
      const sellerStores = storesBySeller.get(seller.id) ?? [];
      const hasStore = sellerStores.length > 0;
      const earliestStoreAt = earliestOf(sellerStores.map((s) => s.createdAt));

      const productDates = (productDatesBySeller.get(seller.id) ?? []).map((p) => p.createdAt);
      const hasProduct = productDates.length > 0;
      const earliestProductAt = earliestOf(productDates);

      const publishedStores = sellerStores.filter((s) => s.publishedAt);
      const isPublished = publishedStores.length > 0;
      const earliestPublishedAt = earliestOf(publishedStores.map((s) => s.publishedAt!));

      const saleDates = (saleDatesBySeller.get(seller.id) ?? []).map((o) => o.placedAt);
      const hasSale = saleDates.length > 0;

      if (hasStore) storeCreated += 1;
      if (hasProduct) productListed += 1;
      if (isPublished) published += 1;
      if (hasSale) firstSale += 1;

      if (hasSale) continue; // reached the end of the funnel - never "stuck"

      let stage: FunnelStage["stage"];
      let enteredAt: Date;
      if (isPublished) {
        stage = "published";
        enteredAt = earliestPublishedAt!;
      } else if (hasProduct) {
        stage = "first_product_listed";
        enteredAt = earliestProductAt!;
      } else if (hasStore) {
        stage = "store_created";
        enteredAt = earliestStoreAt!;
      } else {
        stage = "signed_up";
        enteredAt = seller.createdAt;
      }

      if (enteredAt <= stuckCutoff) {
        stuckSellers.push({
          sellerId: seller.id,
          businessName: seller.businessName,
          stage,
          daysAtStage: Math.floor((now.getTime() - enteredAt.getTime()) / DAY_MS),
        });
      }
    }

    const counts = [sellers.length, storeCreated, productListed, published, firstSale];
    const stageNames: FunnelStage["stage"][] = ["signed_up", "store_created", "first_product_listed", "published", "first_sale"];
    const stages: FunnelStage[] = stageNames.map((stage, i) => ({
      stage,
      count: counts[i],
      dropOffFromPrevious: i === 0 ? null : counts[i - 1] - counts[i],
    }));

    stuckSellers.sort((a, b) => b.daysAtStage - a.daysAtStage);
    return { stages, stuckSellers };
  }
}

function earliestOf(dates: Date[]): Date | null {
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}
