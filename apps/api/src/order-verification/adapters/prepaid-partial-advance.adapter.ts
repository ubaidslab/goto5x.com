import { Injectable } from "@nestjs/common";
import { OrderVerificationChannel } from "@prisma/client";
import {
  VerificationChannelAdapter,
  VerificationSendContext,
  VerificationSendResult,
} from "../verification-channel-adapter.interface";

/**
 * Module 76 (SRS §5.6j/FR-6.52) - no OTP and no message to send, same shape
 * as PrepaidConfirmationAdapter: this channel's "verify" step is a real
 * buyer-initiated payment through the seller's connected Module 62 gateway
 * (PaymentGatewayService.verifyPartialAdvanceByToken()), not a code the
 * buyer types in. This adapter only exists so OrderVerificationService's
 * createForOrder()/regenerateAndSend() can keep treating all four channels
 * uniformly.
 */
@Injectable()
export class PrepaidPartialAdvanceAdapter implements VerificationChannelAdapter {
  readonly channel: OrderVerificationChannel = "prepaid_partial_advance";

  async send(_context: VerificationSendContext): Promise<VerificationSendResult> {
    return {};
  }
}
