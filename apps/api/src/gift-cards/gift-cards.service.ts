import { randomBytes } from "crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { StorefrontService } from "../storefront/storefront.service";
import { IssueGiftCardDto } from "./dto/issue-gift-card.dto";
import { PurchaseGiftCardDto } from "./dto/purchase-gift-card.dto";

function generateCode(): string {
  return randomBytes(6).toString("hex").toUpperCase();
}

/**
 * SRS §5.49/FR-49.1-49.7. Mirrors DiscountCodesService's shape: seller-
 * facing CRUD/issuance runs through TenantPrismaService (RLS); the
 * checkout-time redemption path (validateAndRedeem, called from
 * CheckoutService) runs pre-auth via PrismaAdminService, same reasoning as
 * DiscountCodesService.validateAndApply() - an anonymous buyer's checkout
 * has no seller session to `SET LOCAL app.current_seller_id` for.
 */
@Injectable()
export class GiftCardsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly storefront: StorefrontService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
  ) {}

  /** FR-49.2 (buyer-purchase path) - creates a `pending_payment` card; unusable until FR-49.3's payment confirmation. */
  async purchase(dto: PurchaseGiftCardDto, ip: string) {
    // Phase B pre-launch audit finding - public, unauthenticated row creation.
    const purchaseLimit = await this.settings.resolve<number>("gift_cards.purchase_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`gift-card-purchase-ip:${ip}`, purchaseLimit);

    const store = await this.storefront.loadActiveStoreOrThrow(dto.hostname);
    return this.createWithUniqueCode(store.id, {
      storeId: store.id,
      source: "buyer_purchase",
      status: "pending_payment",
      initialValue: dto.amount,
      remainingBalance: dto.amount,
      currency: store.currency,
      purchaserEmail: dto.buyerEmail,
    });
  }

  /** FR-49.2 (seller-issued path) - active immediately; never a revenue event. */
  async issue(sellerId: string, storeId: string, dto: IssueGiftCardDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      try {
        return await tx.giftCard.create({
          data: {
            storeId,
            code: dto.code ?? generateCode(),
            source: "seller_issued",
            status: "active",
            initialValue: dto.amount,
            remainingBalance: dto.amount,
            currency: store.currency,
            issuedNote: dto.note,
            activatedAt: new Date(),
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new ConflictException(`Code "${dto.code}" is already used by another gift card in this store.`);
        }
        throw err;
      }
    });
  }

  private async createWithUniqueCode(
    storeId: string,
    data: {
      storeId: string;
      source: "buyer_purchase" | "seller_issued";
      status: "pending_payment" | "active";
      initialValue: number;
      remainingBalance: number;
      currency: string;
      purchaserEmail?: string;
    },
  ) {
    // Retry-on-collision (same reasoning as StatusLookupToken generation
    // elsewhere) since the code is generated server-side, not seller-
    // chosen - a collision is astronomically unlikely but the unique
    // constraint remains the actual source of truth for the race.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prismaAdmin.giftCard.create({ data: { ...data, code: generateCode() } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < 4) continue;
        throw err;
      }
    }
    throw new Error("Failed to generate a unique gift card code.");
  }

  /** FR-49.3 - the Financial Truth Invariant gate: the sole place a buyer-purchase card becomes redeemable. */
  async confirmPurchasePaid(sellerId: string, storeId: string, giftCardId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const card = await tx.giftCard.findUnique({ where: { id: giftCardId } });
      if (!card || card.storeId !== storeId) throw new NotFoundException("Gift card not found.");
      if (card.source !== "buyer_purchase") {
        throw new BadRequestException("Only a buyer-purchased gift card requires payment confirmation.");
      }
      if (card.status !== "pending_payment") {
        throw new BadRequestException("This gift card is not awaiting payment confirmation.");
      }
      return tx.giftCard.update({
        where: { id: giftCardId },
        data: { status: "active", activatedAt: new Date() },
      });
    });
  }

  async list(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.giftCard.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
    });
  }

  async getOne(sellerId: string, storeId: string, giftCardId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const card = await tx.giftCard.findUnique({
        where: { id: giftCardId },
        include: { redemptions: { orderBy: { createdAt: "desc" } } },
      });
      if (!card || card.storeId !== storeId) throw new NotFoundException("Gift card not found.");
      return card;
    });
  }

  /**
   * FR-49.4/49.6 - called from CheckoutService.placeOrder(), pre-auth, same
   * timing as DiscountCodesService.validateAndApply(). `requestedAmount` is
   * the order's total-so-far (FR-49.5 - never the pre-discount subtotal);
   * the actual amount applied is capped at whichever is smaller. The
   * atomic conditional UPDATE (remainingBalance >= amount) is the race
   * guard - two concurrent checkouts spending the last of a balance can
   * never both succeed, same idiom as DiscountCode.usageCount.
   */
  async validateAndReserve(
    storeId: string,
    code: string,
    requestedAmount: number,
  ): Promise<{ giftCardId: string; amount: number }> {
    const card = await this.prismaAdmin.giftCard.findUnique({
      where: { uniq_gift_card_store: { storeId, code } },
    });
    if (!card || card.status !== "active") {
      throw new BadRequestException(`Gift card "${code}" is not valid.`);
    }
    if (card.expiresAt && card.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(`Gift card "${code}" has expired.`);
    }
    const remaining = Number(card.remainingBalance);
    if (remaining <= 0) {
      throw new BadRequestException(`Gift card "${code}" has no remaining balance.`);
    }

    const amount = Math.min(remaining, requestedAmount);
    const result = await this.prismaAdmin.giftCard.updateMany({
      where: { id: card.id, status: "active", remainingBalance: { gte: amount } },
      data: { remainingBalance: { decrement: amount } },
    });
    if (result.count !== 1) {
      throw new BadRequestException(`Gift card "${code}" has no remaining balance.`);
    }
    // Best-effort depletion flag - informational only, a zero-balance card
    // is already unredeemable via the remainingBalance check above
    // regardless of whether this flip lands.
    if (remaining - amount <= 0) {
      await this.prismaAdmin.giftCard.updateMany({
        where: { id: card.id, remainingBalance: { lte: 0 } },
        data: { status: "depleted" },
      });
    }

    return { giftCardId: card.id, amount };
  }

  /** Counterpart to validateAndReserve() - refunds a reservation when the order that would have consumed it fails to be created. */
  async releaseReservation(giftCardId: string, amount: number): Promise<void> {
    await this.prismaAdmin.giftCard.updateMany({
      where: { id: giftCardId },
      data: { remainingBalance: { increment: amount }, status: "active" },
    });
  }

  /** Called inside CheckoutService.placeOrder()'s order-creation transaction - the append-only ledger row (FR-49.4). */
  async recordRedemption(tx: Prisma.TransactionClient, storeId: string, giftCardId: string, orderId: string, amount: number) {
    return tx.giftCardRedemption.create({ data: { storeId, giftCardId, orderId, amount } });
  }
}
