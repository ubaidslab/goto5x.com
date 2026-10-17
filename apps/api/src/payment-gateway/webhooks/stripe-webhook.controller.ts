import { BadRequestException, Controller, Headers, Logger, NotFoundException, Param, Post, RawBodyRequest, Req } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Request } from "express";
import Stripe from "stripe";
import { round2 } from "../../orders/money.util";
import { OrdersService } from "../../orders/orders.service";
import { PrismaAdminService } from "../../prisma/prisma-admin.service";
import { GatewayCredentialVaultService } from "../gateway-credential-vault.service";
import { stripeAmountToDecimal } from "../stripe/stripe-amount.util";
import { WebhookEventDedupeService } from "./webhook-event-dedupe.service";

/**
 * B2 (founder decision, sandbox only) - public by necessity (Stripe has
 * no session/JWT to present), same "unauthenticated but signature-
 * verified" shape as external-api/template-install.controller.ts, not
 * either payment-gateway controller's guard stack. `:storeId` in the
 * path is not itself a secret - the per-store webhook signing secret
 * (verified via the official SDK's constructEvent(), never hand-rolled)
 * is what actually gates processing, same model as every unguessable-
 * token buyer-facing route in this codebase, just with a signature
 * instead of a token.
 *
 * Deliberately bypasses PaymentGatewayService.verifyAndConfirm()/
 * chargeViaGateway() and their isGatewayLive() gate - that gate exists
 * to stop an unproven adapter from confirming a REAL buyer-facing
 * checkout (D95/Risk #50), which is exactly why Stripe isn't offered as
 * a checkout option while "verifying". A signature-verified webhook
 * event is a different thing: Stripe itself already asserts the
 * session was paid, cryptographically proven by constructEvent()
 * succeeding - there is nothing left to "verify" through the adapter's
 * own API call, and blocking this path would make it impossible to
 * ever gather the sandbox evidence needed to promote Stripe to "live"
 * in the first place.
 */
@Controller("payment-gateway/webhooks/stripe")
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly vault: GatewayCredentialVaultService,
    private readonly dedupe: WebhookEventDedupeService,
    private readonly orders: OrdersService,
  ) {}

  @Post(":storeId")
  async handle(@Param("storeId") storeId: string, @Req() req: RawBodyRequest<Request>, @Headers("stripe-signature") signature: string | undefined) {
    if (!signature) throw new BadRequestException("Missing Stripe-Signature header.");

    const connection = await this.prismaAdmin.storePaymentGatewayConnection.findUnique({
      where: { uniq_store_gateway_provider: { storeId, provider: "stripe" } },
    });
    if (!connection?.webhookSecretEncrypted || !connection.dataKeyWrapped) {
      throw new NotFoundException("No Stripe webhook is configured for this store.");
    }
    const webhookSecret = await this.vault.decrypt(connection.webhookSecretEncrypted, connection.dataKeyWrapped);

    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(req.rawBody?.toString("utf8") ?? "", signature, webhookSecret);
    } catch {
      throw new BadRequestException("Invalid webhook signature.");
    }

    // A redelivery of an already-claimed event is a no-op, not an
    // error - still a 2xx, so Stripe stops retrying something that
    // already succeeded.
    const isNew = await this.dedupe.claim("stripe", event.id, event.type);
    if (isNew && event.type === "checkout.session.completed") {
      await this.handleCheckoutSessionCompleted(storeId, event.data.object as Stripe.Checkout.Session);
    }

    return { received: true };
  }

  private async handleCheckoutSessionCompleted(storeId: string, session: Stripe.Checkout.Session): Promise<void> {
    if (session.payment_status !== "paid") return;

    const orderId = session.client_reference_id;
    if (!orderId) {
      this.logger.warn(`Stripe checkout.session.completed for store ${storeId} had no client_reference_id - ignoring.`);
      return;
    }

    const order = await this.prismaAdmin.order.findUnique({ where: { id: orderId } });
    if (!order || order.storeId !== storeId) {
      this.logger.warn(`Stripe checkout.session.completed referenced order ${orderId}, not found for store ${storeId} - ignoring.`);
      return;
    }
    // Already confirmed (or cancelled) through some other path by the
    // time this webhook arrived - a silent no-op, not an error. Letting
    // markAsPaid() throw its own "not awaiting payment" exception here
    // would surface as a non-2xx to Stripe, which would just retry the
    // same already-settled event forever.
    if (order.status !== "pending") return;

    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!paymentIntentId) {
      this.logger.warn(`Stripe checkout.session.completed for order ${orderId} had no payment_intent - ignoring.`);
      return;
    }

    const sessionAmount = session.amount_total !== null ? stripeAmountToDecimal(session.amount_total, session.currency ?? order.currency) : null;
    const sessionCurrency = session.currency?.toUpperCase();
    if (sessionAmount === null || round2(sessionAmount) !== round2(Number(order.totalAmount)) || sessionCurrency !== order.currency) {
      this.logger.error(
        `Stripe amount_mismatch for order ${orderId}: expected ${order.totalAmount} ${order.currency}, session reported ${sessionAmount ?? "n/a"} ${sessionCurrency ?? "n/a"} - refusing to confirm.`,
      );
      return;
    }

    const store = await this.prismaAdmin.store.findUniqueOrThrow({ where: { id: storeId }, select: { sellerId: true } });
    await this.orders.markAsPaid(store.sellerId, storeId, order.id, undefined, {
      gateway: "stripe",
      gatewayTransactionId: paymentIntentId,
      rawWebhookPayload: session as unknown as Prisma.InputJsonValue,
    });
  }
}
