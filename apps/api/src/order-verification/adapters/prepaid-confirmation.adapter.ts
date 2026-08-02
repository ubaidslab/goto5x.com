import { Injectable } from "@nestjs/common";
import { OrderVerificationChannel } from "@prisma/client";
import {
  VerificationChannelAdapter,
  VerificationSendContext,
  VerificationSendResult,
} from "../verification-channel-adapter.interface";

/**
 * SRS §5.37/FR-37.4 - v1.0 has no OTP and no message to send: confirmation
 * is a manual "seller marks deposit received" action, the same
 * human-in-the-loop shape OrdersService.markAsPaid() already established.
 * That action lives on OrderVerificationService, not here - this adapter
 * only exists so the orchestrating service can treat all three channels
 * uniformly. Mirrors ManualReviewAdapter in
 * trust-safety/title-verification.adapter.ts: does nothing else, no
 * network call.
 */
@Injectable()
export class PrepaidConfirmationAdapter implements VerificationChannelAdapter {
  readonly channel: OrderVerificationChannel = "prepaid_confirmation";

  async send(_context: VerificationSendContext): Promise<VerificationSendResult> {
    return {};
  }
}
