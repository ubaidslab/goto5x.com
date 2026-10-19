import { BadRequestException, Controller, Headers, Inject, Logger, Post, RawBodyRequest, Req } from "@nestjs/common";
import { Paddle } from "@paddle/paddle-node-sdk";
import { Request } from "express";
import { ConfigService } from "@nestjs/config";
import { WebhookEventDedupeService } from "../../payment-gateway/webhooks/webhook-event-dedupe.service";
import { PaddleSubscriptionLifecycleService } from "./paddle-subscription-lifecycle.service";
import { PADDLE_CLIENT } from "./paddle-client.provider";

/**
 * D135/B3 (Paddle) - public by necessity, same "unauthenticated but
 * signature-verified" shape as B2's StripeWebhookController: Paddle has
 * no session/JWT to present, and the webhook secret (verified via the
 * official SDK's unmarshal(), never hand-rolled) is what actually gates
 * processing. One endpoint for the whole platform, not per-store - this
 * is PLATFORM billing (a seller paying US), not a buyer-facing gateway,
 * so there's no :storeId in the path the way StripeWebhookController has.
 * `customData.sellerId`, set on the Paddle Price/transaction at checkout
 * time, is how an incoming event maps back to a seller.
 */
@Controller("billing/webhooks/paddle")
export class PaddleWebhookController {
  private readonly logger = new Logger(PaddleWebhookController.name);

  constructor(
    private readonly dedupe: WebhookEventDedupeService,
    private readonly lifecycle: PaddleSubscriptionLifecycleService,
    private readonly config: ConfigService,
    @Inject(PADDLE_CLIENT) private readonly paddle: Paddle | null,
  ) {}

  @Post()
  async handle(@Req() req: RawBodyRequest<Request>, @Headers("paddle-signature") signature: string | undefined) {
    const webhookSecret = this.config.get<string>("PADDLE_WEBHOOK_SECRET");
    if (!webhookSecret) throw new BadRequestException("Paddle billing is not configured.");
    if (!signature) throw new BadRequestException("Missing Paddle-Signature header.");
    if (!req.rawBody) throw new BadRequestException("Missing request body.");

    // `webhooks.unmarshal()` both verifies the signature and parses the
    // event in one call (HMAC-SHA256 over `ts:rawBody`); it throws on a
    // bad/forged signature rather than returning a falsy value - see
    // the SDK's own compiled source, confirmed directly rather than
    // assumed, same diligence B2's host/port bug was caught by.
    const client = this.paddle ?? new Paddle("unused-for-signature-verification-only");
    let event;
    try {
      event = await client.webhooks.unmarshal(req.rawBody.toString(), webhookSecret, signature);
    } catch {
      throw new BadRequestException("Invalid Paddle webhook signature.");
    }

    const claimed = await this.dedupe.claim("paddle", event.eventId, event.eventType);
    if (!claimed) {
      this.logger.log(`Paddle event ${event.eventId} (${event.eventType}) already processed - skipping (redelivery).`);
      return { received: true };
    }

    switch (event.eventType) {
      case "transaction.completed": {
        const transaction = event.data;
        const sellerId = (transaction.customData as Record<string, unknown> | null)?.sellerId as string | undefined;
        if (!sellerId || !transaction.subscriptionId || !transaction.customerId) {
          this.logger.warn(`transaction.completed ${transaction.id} is missing sellerId/subscriptionId/customerId in customData - skipping.`);
          break;
        }
        await this.lifecycle.confirmCharge({
          sellerId,
          paddleSubscriptionId: transaction.subscriptionId,
          paddleCustomerId: transaction.customerId,
          paddleTransactionId: transaction.id,
        });
        break;
      }
      case "subscription.canceled": {
        await this.lifecycle.markCanceled(event.data.id);
        break;
      }
      case "adjustment.updated": {
        // Approval/rejection outcome for a refund THIS platform's own
        // requestRefund()/adminApproveRefund() already drives
        // synchronously - this event is a confirmation signal, not the
        // trigger (we never wait on Paddle's own async approval before
        // telling a seller their refund succeeded), so there's
        // deliberately no further action here today. Logged so a
        // mismatch (e.g. Paddle later rejects what we thought was
        // approved) is visible, not silently dropped.
        this.logger.log(`adjustment.updated received for ${event.data.id} (status ${event.data.status}) - informational, no action taken.`);
        break;
      }
      case "subscription.past_due": {
        // Deliberately no action - our own overdue-detection already
        // works off currentPeriodEnd vs now (PlanFeeDebitService), the
        // same mechanism the manual rail already relies on. A payment
        // that hasn't succeeded simply never advances currentPeriodEnd;
        // nothing here needs to separately track Paddle's own past_due
        // status (SubscriptionStatus has no such value - active/
        // cancelled only, confirmed from schema.prisma directly rather
        // than assumed).
        break;
      }
      default:
        this.logger.log(`Unhandled Paddle event type: ${event.eventType}`);
    }

    return { received: true };
  }
}
