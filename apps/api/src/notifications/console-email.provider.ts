import { Injectable, Logger } from "@nestjs/common";
import { EmailProvider, EmailSendParams } from "./email-provider.interface";

/** D83 - the existing dev/test console-logging behavior, unchanged, moved out of EmailService.send() into its own provider. */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send({ to, subject, body, attachmentUrl }: EmailSendParams): Promise<void> {
    const attachmentLine = attachmentUrl ? `\n[attachment] ${attachmentUrl}` : "";
    this.logger.log(`[console email] to=${to} subject="${subject}"\n${body}${attachmentLine}`);
  }
}
