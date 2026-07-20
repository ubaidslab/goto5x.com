import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { SellerIdentityService } from "../trust-safety/seller-identity.service";
import { hasAnyPaymentMethod } from "../store-settings/payment-instructions.service";
import { EmailService } from "../notifications/email.service";
import { EventsService } from "../events/events.service";
import { WalletService } from "./wallet.service";

/**
 * Module 20 (SRS §5.6e, FR-6.21/FR-6.25). Two distinct, deliberately
 * separate concerns live here: the one-time publish gate (FR-6.21) and the
 * recurring low-balance grace ladder (FR-6.25) - both key off the same
 * wallet balance, so they share a home rather than splitting WalletService
 * further.
 */
@Injectable()
export class WalletGraceLadderService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly sellerIdentity: SellerIdentityService,
    private readonly wallet: WalletService,
    private readonly email: EmailService,
    private readonly events: EventsService,
  ) {}

  /**
   * FR-6.21 - an explicit, seller-clicked action (not an implicit per-
   * checkout-attempt gate, the founder-confirmed design call): payment
   * method + CNIC + minimum wallet top-up, all three. Sticky - publishedAt
   * is never cleared once set, same discipline as onboardingCompletedAt.
   */
  async publish(sellerId: string, storeId: string): Promise<{ publishedAt: Date }> {
    const store = await this.prismaAdmin.store.findUnique({ where: { id: storeId } });
    if (!store || store.sellerId !== sellerId) throw new NotFoundException("Store not found.");
    if (store.publishedAt) return { publishedAt: store.publishedAt };

    const paymentInstructions = await this.prismaAdmin.storePaymentInstructions.findUnique({ where: { storeId } });
    if (!paymentInstructions || !hasAnyPaymentMethod(paymentInstructions)) {
      throw new BadRequestException("Configure at least one payment method before publishing this store.");
    }
    if (!(await this.sellerIdentity.hasCnic(sellerId))) {
      throw new BadRequestException("Complete identity verification (CNIC) before publishing this store.");
    }
    const minTopUp = await this.settings.resolve<number>("billing.wallet_min_initial_topup");
    const balance = await this.wallet.getBalance(sellerId);
    if (balance < minTopUp) {
      throw new BadRequestException(
        `Top up your wallet to at least ${minTopUp} before publishing this store (current balance: ${balance}).`,
      );
    }

    const updated = await this.prismaAdmin.store.update({
      where: { id: storeId },
      data: { publishedAt: new Date() },
    });
    await this.events.emit({
      eventType: "store.published",
      actorType: "seller",
      actorId: sellerId,
      storeId,
      entityType: "store",
      entityId: storeId,
    });
    return { publishedAt: updated.publishedAt! };
  }

  /**
   * Called right after a verified top-up (FR-6.25's "instant auto-restore,
   * no admin action needed"). Clears the warning/grace tracking and
   * restores every one of this seller's currently-`orders_paused` stores
   * to `active` the moment balance crosses back above the threshold - a
   * no-op if the seller was never in the ladder.
   */
  async checkAndRestore(sellerId: string): Promise<void> {
    const threshold = await this.settings.resolve<number>("billing.wallet_low_balance_warning_threshold");
    const balance = await this.wallet.getBalance(sellerId);
    if (balance < threshold) return;

    const seller = await this.prismaAdmin.seller.findUnique({ where: { id: sellerId } });
    if (!seller || (!seller.walletLowBalanceWarningSentAt && !seller.walletGracePeriodEndsAt)) return;

    await this.prismaAdmin.seller.update({
      where: { id: sellerId },
      data: { walletLowBalanceWarningSentAt: null, walletGracePeriodEndsAt: null },
    });
    const restored = await this.prismaAdmin.store.updateMany({
      where: { sellerId, status: "orders_paused" },
      data: { status: "active" },
    });
    if (restored.count > 0) {
      await this.events.emit({
        eventType: "wallet.orders_resumed",
        actorType: "system",
        entityType: "seller",
        entityId: sellerId,
        metadata: { storeCount: restored.count },
      });
    }
  }

  /**
   * FR-6.25 - the scheduled sweep. Per seller (the wallet's real owner,
   * one seller may hold multiple stores): below threshold + no warning yet
   * -> send warning, start the grace clock; past the grace deadline and
   * still below -> pause every one of the seller's `active` stores (never
   * touches `suspended`/`banned`/`archived` - same non-clobbering
   * discipline §14.6c's old suspend/lift sweep already established);
   * recovered above threshold -> restore, same as the instant-restore path.
   */
  async runSweep(now = new Date()): Promise<{ warned: number; paused: number; restored: number }> {
    const threshold = await this.settings.resolve<number>("billing.wallet_low_balance_warning_threshold");
    const graceDays = await this.settings.resolve<number>("billing.wallet_grace_days");

    const sellers = await this.prismaAdmin.seller.findMany({
      include: { user: { select: { email: true } } },
    });

    let warned = 0;
    let paused = 0;
    let restored = 0;

    for (const seller of sellers) {
      const balance = await this.wallet.getBalance(seller.id);

      if (balance >= threshold) {
        if (seller.walletLowBalanceWarningSentAt || seller.walletGracePeriodEndsAt) {
          await this.checkAndRestore(seller.id);
          restored += 1;
        }
        continue;
      }

      if (!seller.walletLowBalanceWarningSentAt) {
        await this.prismaAdmin.seller.update({
          where: { id: seller.id },
          data: {
            walletLowBalanceWarningSentAt: now,
            walletGracePeriodEndsAt: new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000),
          },
        });
        await this.email.sendWalletLowBalanceWarning(seller.user.email, graceDays);
        warned += 1;
        continue;
      }

      if (seller.walletGracePeriodEndsAt && seller.walletGracePeriodEndsAt <= now) {
        const result = await this.prismaAdmin.store.updateMany({
          where: { sellerId: seller.id, status: "active" },
          data: { status: "orders_paused" },
        });
        if (result.count > 0) {
          paused += result.count;
          await this.events.emit({
            eventType: "wallet.orders_paused",
            actorType: "system",
            entityType: "seller",
            entityId: seller.id,
            metadata: { storeCount: result.count },
          });
        }
      }
    }

    return { warned, paused, restored };
  }
}
