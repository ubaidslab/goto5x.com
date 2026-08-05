import * as nodemailer from "nodemailer";

export interface CampaignSenderCredential {
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPasswordPlaintext: string;
  emailAddress: string;
}

/**
 * Sends one campaign email through the seller's own SMTP (FR-51.1) -
 * same nodemailer createTransport/sendMail shape as EmailOtpAdapter
 * (order-verification/adapters/email-otp.adapter.ts), the only other
 * seller-SMTP send path in this codebase. Kept as a standalone function
 * (not a NestJS provider) since it has no dependencies beyond its
 * arguments - easy to call from both the enqueuing service and the
 * background worker.
 */
export async function sendCampaignEmail(
  sender: CampaignSenderCredential,
  recipientEmail: string,
  subject: string,
  text: string,
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpPort === 465,
    auth: { user: sender.smtpUsername, pass: sender.smtpPasswordPlaintext },
  });
  await transporter.sendMail({
    from: sender.emailAddress,
    to: recipientEmail,
    subject,
    text,
  });
}
