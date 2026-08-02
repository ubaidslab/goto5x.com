import { Injectable, Logger } from "@nestjs/common";
import { OrderVerificationChannel } from "@prisma/client";
import * as nodemailer from "nodemailer";
import {
  interpolateTemplate,
  VerificationChannelAdapter,
  VerificationSendContext,
  VerificationSendResult,
} from "../verification-channel-adapter.interface";

/**
 * SRS §5.37/FR-37.3 - sends the OTP through the seller's OWN connected
 * SMTP account, never the platform's `EmailService`/`EMAIL_PROVIDER` -
 * the whole point is that the platform's shared email-sending reputation
 * is never spent on this. Credentials arrive already decrypted
 * (SellerVerificationEmailsService owns SMTP_CREDENTIAL_ENCRYPTION_KEY,
 * this adapter never touches it - single responsibility, matching
 * TopUpAdapter's own minimalism).
 */
@Injectable()
export class EmailOtpAdapter implements VerificationChannelAdapter {
  private readonly logger = new Logger(EmailOtpAdapter.name);
  readonly channel: OrderVerificationChannel = "email_otp";

  async send(context: VerificationSendContext): Promise<VerificationSendResult> {
    if (!context.senderEmail) {
      throw new Error("Cannot send an Email OTP without a connected sender email.");
    }
    const message = interpolateTemplate(context.messageTemplate, context.otpCode);
    const transporter = nodemailer.createTransport({
      host: context.senderEmail.smtpHost,
      port: context.senderEmail.smtpPort,
      secure: context.senderEmail.smtpPort === 465,
      auth: {
        user: context.senderEmail.smtpUsername,
        pass: context.senderEmail.smtpPasswordPlaintext,
      },
    });

    await transporter.sendMail({
      from: context.senderEmail.emailAddress,
      to: context.buyerEmail,
      subject: `Verify your order at ${context.storeName}`,
      text: message,
    });
    this.logger.log(`Sent order-verification OTP email for order ${context.orderId} via ${context.senderEmail.emailAddress}.`);
    return {};
  }
}
