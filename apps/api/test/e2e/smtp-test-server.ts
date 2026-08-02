import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";

/**
 * No real SMTP relay is reachable in this sandbox, and EmailOtpAdapter is
 * deliberately built around the seller's own real SMTP credentials
 * (FR-37.3) rather than an injectable transport. Same reasoning as
 * s3-test-server.ts: spin up a real, lightweight SMTP-protocol server
 * in-process rather than mock nodemailer, so the adapter's actual
 * `createTransport`/`sendMail` calls are exercised for real.
 */
export interface TestSmtpServer {
  messages: { to: string[]; from: string; subject: string; text: string }[];
  close(): Promise<void>;
}

export async function startTestSmtpServer(port: number): Promise<TestSmtpServer> {
  const messages: TestSmtpServer["messages"] = [];

  const server = new SMTPServer({
    disabledCommands: ["AUTH", "STARTTLS"],
    onData(stream, session, callback) {
      simpleParser(stream)
        .then((parsed) => {
          messages.push({
            to: session.envelope.rcptTo.map((r) => r.address),
            from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
            subject: parsed.subject ?? "",
            text: (parsed.text ?? "").trim(),
          });
          callback();
        })
        .catch(callback);
    },
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return {
    messages,
    close() {
      return new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}
