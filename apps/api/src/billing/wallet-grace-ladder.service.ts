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
   * to `active` the moment balance crosses back above the (higher, safer)
   * warning threshold - this is also the restore path for a seller paused
   * by the negative-float floor (FR-6.26 fix), which never sets the
   * warning/grace tracking fields, so this must not gate on them: the
   * seller-update and store `updateMany` below are harmless no-ops for a
   * seller who was never in the ladder at all.
   */
  async checkAndRestore(sellerId: string): Promise<void> {
    const threshold = await this.settings.resolve<number>("billing.wallet_low_balance_warning_threshold");
    const balance = await this.wallet.getBalance(sellerId);
    if (balance < threshold) return;

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
   * FR-6.26 (fix) - the negative-float floor was seeded but never enforced:
   * a low balance could run arbitrarily negative through the whole grace
   * window before anything acted on it. This is the immediate,
   * grace-bypassing counterpart to the gentler warn-then-pause ladder
   * below: the moment a seller's balance crosses below the floor - checked
   * right after a commission debit lands (OrdersService.markAsPaid(), never
   * blocking the debit itself) and again on every sweep pass - every one of
   * their `active` stores pauses immediately, no grace days. Restoring is
   * still the exact same instant path (checkAndRestore(), on a verified
   * top-up) - there is no separate "floor" restore threshold.
   */
  async checkImmediateFloorPause(sellerId: string): Promise<{ paused: boolean }> {
    const floor = await this.settings.resolve<number>("billing.wallet_negative_float_floor");
    const balance = await this.wallet.getBalance(sellerId);
    if (balance >= floor) return { paused: false };

    const result = await this.pauseActiveStores(sellerId);
    return { paused: result.count > 0 };
  }

  /** Shared by the floor check above and the grace-expiry branch of runSweep() below - same non-clobbering updateMany, same event. */
  private async pauseActiveStores(sellerId: string): Promise<{ count: number }> {
    const result = await this.prismaAdmin.store.updateMany({
      where: { sellerId, status: "active" },
      data: { status: "orders_paused" },
    });
    if (result.count > 0) {
      await this.events.emit({
        eventType: "wallet.orders_paused",
        actorType: "system",
        entityType: "seller",
        entityId: sellerId,
        metadata: { storeCount: result.count },
      });
    }
    return result;
  }

  /**
   * FR-6.25 - the scheduled sweep. Per seller (the wallet's real owner,
   * one seller may hold multiple stores): below the negative-float floor
   * -> pause immediately regardless of grace state (FR-6.26's fix, above);
   * otherwise below the (positive) warning threshold + no warning yet ->
   * send warning, start the grace clock; past the grace deadline and still
   * below -> pause every one of the seller's `active` stores (never
   * touches `suspended`/`banned`/`archived` - same non-clobbering
   * discipline §14.6c's old suspend/lift sweep already established);
   * recovered above threshold -> restore, same as the instant-restore path.
   */
  async runSweep(now = new Date()): Promise<{ warned: number; paused: number; restored: number }> {
    const threshold = await this.settings.resolve<number>("billing.wallet_low_balance_warning_threshold");
    const graceDays = await this.settings.resolve<number>("billing.wallet_grace_days");
    const floor = await this.settings.resolve<number>("billing.wallet_negative_float_floor");

    const sellers = await this.prismaAdmin.seller.findMany({
      include: { user: { select: { email: true } } },
    });

    let warned = 0;
    let paused = 0;
    let restored = 0;

    for (const seller of sellers) {
      const balance = await this.wallet.getBalance(seller.id);

      if (balance < floor) {
        const result = await this.pauseActiveStores(seller.id);
        paused += result.count;
        continue;
      }

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
        const result = await this.pauseActiveStores(seller.id);
        paused += result.count;
      }
    }

    return { warned, paused, restored };
  }
}
