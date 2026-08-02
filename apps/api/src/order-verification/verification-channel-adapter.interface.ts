import { OrderVerificationChannel } from "@prisma/client";

/**
 * SRS §3.5 (new, v0.29) / §5.37 - one interface, three v1.0
 * implementations, mirroring the existing TopUpAdapter/
 * TitleVerificationAdapter pattern. The orchestrating service
 * (OrderVerificationService) never branches on which channel a store
 * picked - that logic lives entirely inside each adapter. A future
 * automated WhatsApp Business API adapter implements this same interface
 * with zero change to checkout or the Financial Truth Invariant tie-in.
 */
export interface VerificationSendContext {
  orderId: string;
  storeName: string;
  buyerEmail: string;
  buyerWhatsapp: string | null;
  /** null for prepaid_confirmation, which has no OTP at all. */
  otpCode: string | null;
  /** Seller-editable template (FR-37.6); `{{otp}}` is interpolated by the adapter. */
  messageTemplate: string;
  /** Only present for the email_otp channel - already-decrypted, resolved by the caller. */
  senderEmail?: {
    emailAddress: string;
    smtpHost: string;
    smtpPort: number;
    smtpUsername: string;
    smtpPasswordPlaintext: string;
  };
}

export interface VerificationSendResult {
  /** whatsapp_otp only - the wa.me deep link shown to the seller to send manually (FR-37.2). */
  deepLink?: string;
}

export interface VerificationChannelAdapter {
  readonly channel: OrderVerificationChannel;
  send(context: VerificationSendContext): Promise<VerificationSendResult>;
}

export function interpolateTemplate(template: string, otp: string | null): string {
  return otp ? template.replace(/\{\{otp\}\}/g, otp) : template;
}
