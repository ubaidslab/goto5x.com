/**
 * D83 - the provider abstraction EmailService.send() dispatches to. Kept
 * deliberately thin (one method, the same four params send() already
 * took) so a new provider is a new class implementing this, not a new
 * shape every caller needs to learn.
 */
export interface EmailSendParams {
  to: string;
  subject: string;
  body: string;
  attachmentUrl?: string | null;
}

export interface EmailProvider {
  send(params: EmailSendParams): Promise<void>;
}
