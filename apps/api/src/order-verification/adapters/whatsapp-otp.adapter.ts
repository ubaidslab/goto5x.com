import { Injectable } from "@nestjs/common";
import { OrderVerificationChannel } from "@prisma/client";
import {
  interpolateTemplate,
  VerificationChannelAdapter,
  VerificationSendContext,
  VerificationSendResult,
} from "../verification-channel-adapter.interface";

/**
 * SRS §5.37/FR-37.2 - v1.0 is manual/link-assisted: this adapter never
 * sends a WhatsApp message itself. It generates the OTP-interpolated
 * `wa.me` deep link; the seller's own dashboard opens it in their own
 * connected WhatsApp app to tap-send. A future automated WhatsApp
 * Business API adapter replaces only this class - checkout, OTP
 * generation/verification, and the Financial Truth Invariant tie-in in
 * OrderVerificationService are all unaffected (FR-37.9).
 */
@Injectable()
export class WhatsAppOtpAdapter implements VerificationChannelAdapter {
  readonly channel: OrderVerificationChannel = "whatsapp_otp";

  async send(context: VerificationSendContext): Promise<VerificationSendResult> {
    if (!context.buyerWhatsapp) {
      throw new Error("Cannot send a WhatsApp OTP without a buyer WhatsApp number.");
    }
    const message = interpolateTemplate(context.messageTemplate, context.otpCode);
    const digitsOnly = context.buyerWhatsapp.replace(/[^\d]/g, "");
    const deepLink = `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
    return { deepLink };
  }
}
