import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrderVerificationChannel } from "@prisma/client";
import { EmailService } from "../notifications/email.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { SettingsService } from "../settings-registry/settings.service";
import { EmailOtpAdapter } from "./adapters/email-otp.adapter";
import { PrepaidConfirmationAdapter } from "./adapters/prepaid-confirmation.adapter";
import { PrepaidPartialAdvanceAdapter } from "./adapters/prepaid-partial-advance.adapter";
import { WhatsAppOtpAdapter } from "./adapters/whatsapp-otp.adapter";
import { generateOtp, hashOtp } from "./otp.util";
import { SellerVerificationEmailsService } from "./seller-verification-emails.service";
import { VerificationChannelAdapter } from "./verification-channel-adapter.interface";

const VALID_CHANNELS: readonly string[] = ["whatsapp_otp", "email_otp", "prepaid_confirmation", "prepaid_partial_advance"];

export interface CreateVerificationParams {
  storeId: string;
  sellerId: string;
  orderId: string;
  storeName: string;
  buyerEmail: string;
  buyerWhatsapp: string | null;
}

/**
 * SRS §3.5 (new, v0.29) / §5.37 - the orchestrating service every checkout
 * path (CheckoutService, task #254) calls after an order is placed, and the
 * sole gate the Financial Truth Invariant's pending -> confirmed transition
 * checks alongside payment (OrdersService.markAsPaid(), also task #254).
 * Never branches on which channel a store picked beyond looking up the
 * right adapter in `adapters` - all three implementations share one
 * interface (VerificationChannelAdapter).
 */
@Injectable()
export class OrderVerificationService {
  private readonly logger = new Logger(OrderVerificationService.name);
  private readonly adapters: Map<OrderVerificationChannel, VerificationChannelAdapter>;

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly senderEmails: SellerVerificationEmailsService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly subscriptions: SubscriptionsService,
    whatsAppAdapter: WhatsAppOtpAdapter,
    emailAdapter: EmailOtpAdapter,
    prepaidAdapter: PrepaidConfirmationAdapter,
    prepaidPartialAdvanceAdapter: PrepaidPartialAdvanceAdapter,
  ) {
    this.adapters = new Map([
      [whatsAppAdapter.channel, whatsAppAdapter as VerificationChannelAdapter],
      [emailAdapter.channel, emailAdapter as VerificationChannelAdapter],
      [prepaidAdapter.channel, prepaidAdapter as VerificationChannelAdapter],
      [prepaidPartialAdvanceAdapter.channel, prepaidPartialAdvanceAdapter as VerificationChannelAdapter],
    ]);
  }

  /**
   * FR-37.1 - the same "store readiness" style gate CheckoutService already
   * runs for payment instructions/CNIC/publish, checked BEFORE an order is
   * created rather than after: a store whose Email OTP channel has no
   * connected sender must not accept checkouts it can never actually
   * verify, instead of creating an order that can then never be confirmed.
   */
  async assertChannelReady(sellerId: string, storeId: string): Promise<void> {
    const channel = await this.settings.resolve<string>("orders.verification_channel", { storeId });
    if (channel === "email_otp") {
      const sender = await this.senderEmails.pickSenderForSend(sellerId, storeId);
      if (!sender) {
        throw new BadRequestException(
          "This store's Email OTP verification has no connected sender email available - checkout isn't available.",
        );
      }
      return;
    }
    // Module 76 (FR-6.52) - a store configured for the partial-advance
    // channel with no active gateway connection could never let a buyer
    // actually pay the advance, same failure mode as Email OTP's missing
    // sender above. A direct Prisma read rather than injecting
    // PaymentGatewayService - that would be circular (PaymentGatewayModule
    // imports OrdersModule, which imports this module).
    if (channel === "prepaid_partial_advance") {
      const activeGateways = await this.prismaAdmin.storePaymentGatewayConnection.count({ where: { storeId, isActive: true } });
      if (activeGateways === 0) {
        throw new BadRequestException(
          "This store's prepaid partial-advance verification has no connected, active payment gateway - checkout isn't available.",
        );
      }
    }
  }

  /**
   * FR-37.1 - resolves the store's configured channel and, if it isn't
   * "none", creates the pending OrderVerification row and sends the first
   * OTP (or, for prepaid_confirmation, nothing - there is no OTP for that
   * channel). Returns null when the store has verification disabled, which
   * callers treat as "no gate to wait for."
   */
  async createForOrder(params: CreateVerificationParams) {
    const channel = await this.settings.resolve<string>("orders.verification_channel", { storeId: params.storeId });
    if (!VALID_CHANNELS.includes(channel)) return null;
    const resolvedChannel = channel as OrderVerificationChannel;
    const adapter = this.adapters.get(resolvedChannel);
    if (!adapter) return null;

    const [ttlMinutes, messageTemplate] = await Promise.all([
      this.settings.resolve<number>("orders.verification_otp_ttl_minutes", { storeId: params.storeId }),
      this.settings.resolve<string>("orders.verification_message_template", { storeId: params.storeId }),
    ]);

    const needsOtp = resolvedChannel !== "prepaid_confirmation";
    const otp = needsOtp ? generateOtp() : null;

    let senderEmailId: string | null = null;
    let senderEmailContext: { emailAddress: string; smtpHost: string; smtpPort: number; smtpUsername: string; smtpPasswordPlaintext: string } | undefined;
    if (resolvedChannel === "email_otp") {
      const sender = await this.senderEmails.pickSenderForSend(params.sellerId, params.storeId);
      if (!sender) {
        throw new BadRequestException("Connect a sender email before Email OTP verification can be used.");
      }
      senderEmailId = sender.id;
      senderEmailContext = {
        emailAddress: sender.emailAddress,
        smtpHost: sender.smtpHost,
        smtpPort: sender.smtpPort,
        smtpUsername: sender.smtpUsername,
        smtpPasswordPlaintext: this.senderEmails.decryptCredential(sender),
      };
    }

    const verification = await this.tenantPrisma.run(params.sellerId, (tx) =>
      tx.orderVerification.create({
        data: {
          storeId: params.storeId,
          orderId: params.orderId,
          channel: resolvedChannel,
          otpHash: otp?.codeHash ?? null,
          otpExpiresAt: otp ? new Date(Date.now() + ttlMinutes * 60_000) : null,
          senderEmailId,
        },
      }),
    );

    // Best-effort from here on: the OrderVerification row above is the real
    // gate (FTI checks its `status`, not whether a message actually landed
    // in an inbox) - a transient SMTP/network hiccup sending the first OTP
    // must never undo an order that was already placed. The buyer can
    // always hit resend once the underlying issue (e.g. the seller's SMTP
    // credentials) is fixed.
    let deepLink: string | undefined;
    try {
      const result = await adapter.send({
        orderId: params.orderId,
        storeName: params.storeName,
        buyerEmail: params.buyerEmail,
        buyerWhatsapp: params.buyerWhatsapp,
        otpCode: otp?.code ?? null,
        messageTemplate,
        senderEmail: senderEmailContext,
      });
      deepLink = result.deepLink;
      if (senderEmailId) await this.senderEmails.recordSend(senderEmailId);
    } catch (err) {
      this.logger.warn(
        `Failed to send the initial order-verification OTP for order ${params.orderId} via ${resolvedChannel} - the order remains pending verification and the buyer can request a resend.`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return { channel: resolvedChannel, status: verification.status, deepLink };
  }

  /** Buyer-facing status check - no seller session exists at this point, same reasoning as OrderStatusLookupService. */
  async getStatusForOrder(orderId: string) {
    const verification = await this.prismaAdmin.orderVerification.findUnique({ where: { orderId } });
    if (!verification) return null;
    return { channel: verification.channel, status: verification.status };
  }

  /**
   * The buyer's only handle on an order is the unguessable
   * statusLookupToken (FR-5.4, same as OrderStatusLookupService) - every
   * buyer-facing verification action resolves it to an order id first.
   */
  private async resolveOrderByToken(token: string) {
    const order = await this.prismaAdmin.order.findUnique({
      where: { statusLookupToken: token },
      select: { id: true, buyerEmail: true, buyerWhatsapp: true, store: { select: { name: true } } },
    });
    if (!order) throw new NotFoundException("Order not found.");
    return order;
  }

  async getStatusByToken(token: string) {
    const order = await this.resolveOrderByToken(token);
    return this.getStatusForOrder(order.id);
  }

  async verifyByToken(token: string, code: string) {
    const order = await this.resolveOrderByToken(token);
    return this.verifyOtp(order.id, code);
  }

  async resendByToken(token: string) {
    const order = await this.resolveOrderByToken(token);
    return this.resendOtp(order.id, order.store.name, order.buyerEmail, order.buyerWhatsapp);
  }

  /** True when this order has no verification gate at all, or has already cleared it - the FTI check task #254 wires in. */
  async isClearedForConfirmation(orderId: string): Promise<boolean> {
    const verification = await this.prismaAdmin.orderVerification.findUnique({ where: { orderId } });
    if (!verification) return true;
    return verification.status === "verified";
  }

  /** FR-37.5 - single-use, retry-capped, time-limited. Buyer-facing (statusLookupToken-gated by the caller), so PrismaAdminService. */
  async verifyOtp(orderId: string, code: string) {
    const verification = await this.prismaAdmin.orderVerification.findUnique({ where: { orderId } });
    if (!verification) throw new NotFoundException("No verification is pending for this order.");
    if (verification.status !== "pending") {
      throw new BadRequestException(`This order's verification is already "${verification.status}".`);
    }

    if (verification.otpExpiresAt && verification.otpExpiresAt.getTime() < Date.now()) {
      await this.prismaAdmin.orderVerification.update({ where: { orderId }, data: { status: "expired" } });
      throw new BadRequestException("This verification code has expired - request a new one.");
    }

    const maxAttempts = await this.settings.resolve<number>("orders.verification_otp_max_attempts", {
      storeId: verification.storeId,
    });
    if (verification.attemptCount >= maxAttempts) {
      await this.prismaAdmin.orderVerification.update({ where: { orderId }, data: { status: "failed" } });
      await this.alertSellerVerificationFailed(orderId, verification.storeId);
      throw new BadRequestException("Too many incorrect attempts - request a new code.");
    }

    if (hashOtp(code) !== verification.otpHash) {
      const attemptCount = verification.attemptCount + 1;
      const failedNow = attemptCount >= maxAttempts;
      await this.prismaAdmin.orderVerification.update({
        where: { orderId },
        data: { attemptCount, status: failedNow ? "failed" : "pending" },
      });
      if (failedNow) await this.alertSellerVerificationFailed(orderId, verification.storeId);
      throw new BadRequestException(
        failedNow ? "Too many incorrect attempts - request a new code." : "Incorrect verification code.",
      );
    }

    const verified = await this.prismaAdmin.orderVerification.update({
      where: { orderId },
      data: { status: "verified", verifiedAt: new Date() },
    });
    // FR-37.4's "same audit trail precedent as markAsPaid()" - the order's
    // own timeline (already surfaced on the seller's order-detail view)
    // records the moment its FTI gate cleared, same as any other
    // status-affecting event.
    await this.prismaAdmin.orderTimelineEvent.create({
      data: {
        storeId: verification.storeId,
        orderId,
        eventType: "verification_confirmed",
        afterValue: { channel: verification.channel },
      },
    });
    return verified;
  }

  /**
   * Module 55 (SRS §5.62/FR-62.1) - the order-payment/verification-events
   * transactional alert, mirroring sendDormantStoreWarning/
   * sendWalletLowBalanceWarning's account-health pattern in
   * email.service.ts but scoped to a single order's verification gate,
   * not the seller's whole account. Best-effort: a missing store/seller
   * row never blocks the buyer-facing verification response.
   */
  private async alertSellerVerificationFailed(orderId: string, storeId: string): Promise<void> {
    try {
      const store = await this.prismaAdmin.store.findUnique({ where: { id: storeId } });
      if (!store) return;
      const seller = await this.prismaAdmin.seller.findUnique({ where: { id: store.sellerId }, include: { user: true } });
      if (!seller) return;
      await this.email.sendOrderVerificationFailedEmail(
        seller.user.email,
        store.name,
        `${this.config.getOrThrow<string>("APP_BASE_URL")}/stores/${store.id}/orders/${orderId}`,
      );
    } catch (err) {
      this.logger.warn(`Failed to send verification-failed alert for order ${orderId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * FR-37.5 rate limit on resends - `updatedAt` doubles as "last sent at"
   * since every resend rewrites the same row (a fresh otpHash/otpExpiresAt),
   * so no separate lastSentAt column is needed.
   */
  async resendOtp(orderId: string, storeName: string, buyerEmail: string, buyerWhatsapp: string | null) {
    const verification = await this.prismaAdmin.orderVerification.findUnique({ where: { orderId } });
    if (!verification) throw new NotFoundException("No verification is pending for this order.");

    const cooldownSeconds = await this.settings.resolve<number>("orders.verification_otp_resend_cooldown_seconds", {
      storeId: verification.storeId,
    });
    const secondsSinceLastSend = (Date.now() - verification.updatedAt.getTime()) / 1000;
    if (secondsSinceLastSend < cooldownSeconds) {
      throw new BadRequestException(
        `Please wait ${Math.ceil(cooldownSeconds - secondsSinceLastSend)}s before requesting another code.`,
      );
    }

    return this.regenerateAndSend(verification, storeName, buyerEmail, buyerWhatsapp);
  }

  /**
   * The shared "issue a fresh OTP and send it" core, factored out of
   * resendOtp() so the seller's own resend action (resendForSeller(), FR-
   * 37.2's "seller opens the link to send manually") is never blocked by
   * the resend cooldown - that cooldown exists to rate-limit repeated
   * BUYER-triggered resends (FR-37.5), not to stop a seller from fetching
   * the wa.me link they themselves need to act on.
   */
  private async regenerateAndSend(
    verification: { orderId: string; status: string; channel: OrderVerificationChannel; storeId: string; senderEmailId: string | null },
    storeName: string,
    buyerEmail: string,
    buyerWhatsapp: string | null,
  ) {
    const orderId = verification.orderId;
    if (verification.status !== "pending") {
      throw new BadRequestException(`This order's verification is already "${verification.status}".`);
    }
    if (verification.channel === "prepaid_confirmation" || verification.channel === "prepaid_partial_advance") {
      throw new BadRequestException("This order's verification channel has no code to resend.");
    }

    const [ttlMinutes, messageTemplate] = await Promise.all([
      this.settings.resolve<number>("orders.verification_otp_ttl_minutes", { storeId: verification.storeId }),
      this.settings.resolve<string>("orders.verification_message_template", { storeId: verification.storeId }),
    ]);

    const adapter = this.adapters.get(verification.channel);
    if (!adapter) throw new BadRequestException("This order's verification channel is no longer available.");

    const otp = generateOtp();
    let senderEmailContext: { emailAddress: string; smtpHost: string; smtpPort: number; smtpUsername: string; smtpPasswordPlaintext: string } | undefined;
    if (verification.channel === "email_otp" && verification.senderEmailId) {
      const sender = await this.prismaAdmin.sellerVerificationEmail.findUniqueOrThrow({
        where: { id: verification.senderEmailId },
      });
      senderEmailContext = {
        emailAddress: sender.emailAddress,
        smtpHost: sender.smtpHost,
        smtpPort: sender.smtpPort,
        smtpUsername: sender.smtpUsername,
        smtpPasswordPlaintext: this.senderEmails.decryptCredential(sender),
      };
    }

    await this.prismaAdmin.orderVerification.update({
      where: { orderId },
      data: { otpHash: otp.codeHash, otpExpiresAt: new Date(Date.now() + ttlMinutes * 60_000), attemptCount: 0 },
    });

    const result = await adapter.send({
      orderId,
      storeName,
      buyerEmail,
      buyerWhatsapp,
      otpCode: otp.code,
      messageTemplate,
      senderEmail: senderEmailContext,
    });

    if (verification.senderEmailId) await this.senderEmails.recordSend(verification.senderEmailId);
    return { deepLink: result.deepLink };
  }

  /**
   * FR-37.4 - the manual "seller marks deposit received" action for the
   * prepaid_confirmation channel; the exact same human-in-the-loop shape as
   * OrdersService.markAsPaid(), not a new pattern.
   */
  async markPrepaidReceived(sellerId: string, storeId: string, orderId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const verification = await tx.orderVerification.findUnique({ where: { orderId } });
      if (!verification || verification.storeId !== storeId) {
        throw new NotFoundException("No verification found for this order.");
      }
      if (verification.channel !== "prepaid_confirmation") {
        throw new BadRequestException("This order isn't using the prepaid-confirmation channel.");
      }
      if (verification.status !== "pending") {
        throw new BadRequestException(`This order's verification is already "${verification.status}".`);
      }
      const verified = await tx.orderVerification.update({
        where: { orderId },
        data: { status: "verified", verifiedAt: new Date() },
      });
      // FR-37.4 - "same audit trail precedent as markAsPaid()".
      await tx.orderTimelineEvent.create({
        data: { storeId, orderId, eventType: "verification_confirmed", afterValue: { channel: "prepaid_confirmation" } },
      });
      return verified;
    });
  }

  /** Seller-facing status check for an order's own dashboard/order-detail view. */
  async getStatusForSeller(sellerId: string, storeId: string, orderId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.storeId !== storeId) throw new NotFoundException("Order not found.");
      const verification = await tx.orderVerification.findUnique({ where: { orderId } });
      if (!verification) return null;
      return { channel: verification.channel, status: verification.status };
    });
  }

  /**
   * FR-37.2 - the WhatsApp channel's OTP is deliberately never persisted in
   * plaintext (only its hash), so the wa.me deep link the seller taps to
   * send it can only ever be surfaced at the moment an OTP is (re)issued,
   * never reconstructed later. Deliberately bypasses resendOtp()'s cooldown
   * (calls regenerateAndSend() directly) - that cooldown rate-limits
   * BUYER-triggered resends, not a seller fetching their own order's link.
   */
  async resendForSeller(sellerId: string, storeId: string, orderId: string) {
    const { order, verification } = await this.tenantPrisma.run(sellerId, async (tx) => {
      const found = await tx.order.findUnique({ where: { id: orderId } });
      if (!found || found.storeId !== storeId) throw new NotFoundException("Order not found.");
      const verificationRow = await tx.orderVerification.findUnique({ where: { orderId } });
      if (!verificationRow) throw new NotFoundException("No verification found for this order.");
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
      return {
        order: { buyerEmail: found.buyerEmail, buyerWhatsapp: found.buyerWhatsapp, storeName: store.name },
        verification: verificationRow,
      };
    });
    return this.regenerateAndSend(verification, order.storeName, order.buyerEmail, order.buyerWhatsapp);
  }

  /** FR-37.1/FR-37.6 - the seller's own store-level channel + message-template choice (Settings Registry, `store` scope). */
  async getSettingsForStore(sellerId: string, storeId: string) {
    await this.assertOwnsStore(sellerId, storeId);
    const [channel, messageTemplate] = await Promise.all([
      this.settings.resolve<string>("orders.verification_channel", { storeId }),
      this.settings.resolve<string>("orders.verification_message_template", { storeId }),
    ]);
    return { channel, messageTemplate };
  }

  async updateSettingsForStore(
    sellerId: string,
    storeId: string,
    userId: string,
    dto: { channel: string; messageTemplate?: string },
  ) {
    await this.assertOwnsStore(sellerId, storeId);
    // Module 76 (FR-6.52) - free from RUN upward.
    if (dto.channel === "prepaid_partial_advance") {
      const planContext = await this.subscriptions.getPlanContext(sellerId);
      const enabled = await this.settings.resolve<boolean>("orders.prepaid_partial_advance_enabled", planContext);
      if (!enabled) {
        throw new ForbiddenException("Prepaid partial-advance verification is not included in your current plan.");
      }
    }
    // Module 77 (FR-6.53) - same RUN+ boundary; email verification is
    // never gated (email_otp has no corresponding check here at all).
    if (dto.channel === "whatsapp_otp") {
      const planContext = await this.subscriptions.getPlanContext(sellerId);
      const enabled = await this.settings.resolve<boolean>("orders.whatsapp_verification_enabled", planContext);
      if (!enabled) {
        throw new ForbiddenException("WhatsApp verification is not included in your current plan.");
      }
    }
    await this.settings.setValue("orders.verification_channel", "store", storeId, dto.channel, userId);
    if (dto.messageTemplate !== undefined) {
      await this.settings.setValue("orders.verification_message_template", "store", storeId, dto.messageTemplate, userId);
    }
    return this.getSettingsForStore(sellerId, storeId);
  }

  private async assertOwnsStore(sellerId: string, storeId: string): Promise<void> {
    await this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
    });
  }
}
