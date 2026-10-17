import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailProvider, EmailSendParams } from "./email-provider.interface";

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * D83 - the first real (non-console) EmailService provider; "SES" stays
 * validated as an allowed EMAIL_PROVIDER value (env.validation.ts) but
 * deliberately unimplemented in this pass (see EmailService.send()'s own
 * comment). A direct fetch() against Resend's HTTP API rather than
 * pulling in its SDK - one HTTP call, no new npm dependency, the same
 * pattern this codebase already uses to call other external HTTP APIs
 * (payment gateways) without adopting their SDKs.
 */
@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send({ to, subject, body, attachmentUrl }: EmailSendParams): Promise<void> {
    const apiKey = this.config.get<string>("EMAIL_PROVIDER_API_KEY");
    if (!apiKey) {
      throw new Error('EMAIL_PROVIDER_API_KEY is required when EMAIL_PROVIDER="resend".');
    }
    const from = this.config.getOrThrow<string>("EMAIL_FROM_ADDRESS");

    const payload: Record<string, unknown> = { from, to: [to], subject, text: body };
    const attachment = await this.fetchAttachment(attachmentUrl);
    if (attachment) {
      payload.attachments = [attachment];
    }

    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(`Resend API returned ${res.status}: ${errorBody}`);
    }
  }

  /**
   * Best-effort, same "never blocks the main send" discipline
   * EmailService.sendOrderConfirmationEmail's own invoicePdfUrl comment
   * already documents - Resend's API needs the actual bytes (base64),
   * not a URL reference, so this fetches them itself; a failure here
   * logs and sends without the attachment rather than losing the email
   * entirely over a PDF render/storage hiccup.
   */
  private async fetchAttachment(attachmentUrl: string | null | undefined): Promise<{ filename: string; content: string } | null> {
    if (!attachmentUrl) return null;
    try {
      const res = await fetch(attachmentUrl);
      if (!res.ok) throw new Error(`fetch returned ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const filename = new URL(attachmentUrl).pathname.split("/").pop() || "attachment.pdf";
      return { filename, content: buffer.toString("base64") };
    } catch (err) {
      this.logger.warn(
        `Couldn't fetch attachment for an outbound email (${attachmentUrl}) - sending without it.`,
        err instanceof Error ? err.stack : String(err),
      );
      return null;
    }
  }
}
