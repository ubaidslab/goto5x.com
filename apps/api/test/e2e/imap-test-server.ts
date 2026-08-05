// eslint-disable-next-line @typescript-eslint/no-var-requires
const hoodiecrow = require("hoodiecrow-imap");

/**
 * No real IMAP server is reachable in this sandbox, and AdminMailService is
 * built around a linked account's real IMAP credentials (SRS §5.53/FR-53.3)
 * rather than an injectable transport. Same reasoning as smtp-test-server.ts:
 * spin up a real, lightweight IMAP-protocol server in-process (hoodiecrow-imap,
 * from the same author as nodemailer/imapflow/mailparser) rather than mock
 * imapflow, so the service's actual connect/fetch calls are exercised for
 * real. Fixed credentials per instance (hoodiecrow's `users` option), one
 * instance per linked test account/port - mirrors the SMTP test double's
 * "own port per sender" convention.
 */
export interface TestImapMessage {
  from: string;
  to: string;
  subject: string;
  date: string;
  text: string;
}

export interface TestImapServer {
  close(): Promise<void>;
}

export async function startTestImapServer(
  port: number,
  username: string,
  password: string,
  messages: TestImapMessage[],
): Promise<TestImapServer> {
  const server = hoodiecrow({
    storage: {
      INBOX: {
        messages: messages.map((m) => ({
          raw: `From: ${m.from}\r\nTo: ${m.to}\r\nSubject: ${m.subject}\r\nDate: ${m.date}\r\n\r\n${m.text}`,
        })),
      },
    },
    users: {
      [username]: { password },
    },
  });

  await new Promise<void>((resolve) => {
    server.listen(port, () => resolve());
  });

  return {
    close() {
      return new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}
