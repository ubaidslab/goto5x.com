import { PrismaClient } from "@prisma/client";
import { decryptDriveToken, encryptDriveToken } from "../src/media/drive-token-crypto.util";
import { decryptSmtpCredential, encryptSmtpCredential } from "../src/order-verification/smtp-credential-crypto.util";
import { decryptAdminEmailCredential, encryptAdminEmailCredential } from "../src/admin-email/admin-email-credential-crypto.util";

/**
 * Phase B pre-launch audit finding (key rotation + breach runbook). Every
 * encrypted-at-rest domain in this codebase uses the same AES-256-GCM
 * packed-string implementation (`iv:authTag:ciphertext`, each base64 - see
 * media/drive-token-crypto.util.ts's own comment; the other three util
 * files are byte-identical logic under their own function names "so all
 * five secrets rotate independently"), so one generic decrypt-with-old,
 * re-encrypt-with-new utility covers every domain rather than five
 * near-duplicate scripts.
 *
 * This is the "reissue the key" half of a real breach response, and also
 * the routine-rotation tool for a key that's simply due for rotation (no
 * breach implied). See docs/launch-runbook.md's "Encryption Key Rotation +
 * Breach Response" section for when/how to run this for real.
 *
 * Deliberately connects with its own PrismaClient (DATABASE_ADMIN_URL, the
 * same BYPASSRLS role PrismaAdminService uses) rather than going through
 * Nest DI - this script must touch every seller's/admin's row, not one
 * tenant's, and needs to run standalone outside the API process during an
 * incident.
 *
 * Usage:
 *   npx ts-node scripts/rotate-encryption-key.ts <domain> <oldKeyBase64> <newKeyBase64> [--dry-run]
 *
 * <domain> is one of: cnic | drive-token | external-api-secret | seller-smtp | admin-email
 *
 * --dry-run decrypts every row with the old key (proving it's still the
 * right key and every row is readable) but writes nothing - always run this
 * first, especially before a rotation performed under incident pressure.
 *
 * Never partial-applies a row: each column on each row is decrypted then
 * re-encrypted then written as one operation; a decrypt/encrypt failure on
 * one row is caught, logged, and skipped rather than aborting the whole
 * run - the exit code is non-zero if ANY row failed, so a CI/runbook caller
 * can tell success from partial failure without parsing log output.
 */

type CryptoFns = { decrypt: (packed: string, key: Buffer) => string; encrypt: (plaintext: string, key: Buffer) => string };

const DRIVE_TOKEN_FNS: CryptoFns = { decrypt: decryptDriveToken, encrypt: encryptDriveToken };
const SMTP_FNS: CryptoFns = { decrypt: decryptSmtpCredential, encrypt: encryptSmtpCredential };
const ADMIN_EMAIL_FNS: CryptoFns = { decrypt: decryptAdminEmailCredential, encrypt: encryptAdminEmailCredential };

interface DomainConfig {
  /** Human label only, for log lines. */
  label: string;
  /** Fetches every row that has this column encrypted, `{ id, ...columns }`. */
  fetchRows: (prisma: PrismaClient) => Promise<Record<string, unknown>[]>;
  /** Writes the newly re-encrypted column(s) back for one row id. */
  updateRow: (prisma: PrismaClient, id: string, updates: Record<string, string>) => Promise<void>;
  /** Column name -> which crypto functions decrypt/encrypt it. Every domain here happens to use one shared AES-256-GCM shape, but this stays column-keyed so a row with multiple encrypted columns (admin-email) rotates each independently. */
  columns: Record<string, CryptoFns>;
}

const DOMAINS: Record<string, DomainConfig> = {
  cnic: {
    label: "Seller CNIC (sellers.cnic_encrypted)",
    fetchRows: (prisma) =>
      prisma.seller.findMany({ where: { cnicEncrypted: { not: null } }, select: { id: true, cnicEncrypted: true } }),
    updateRow: async (prisma, id, updates) => {
      await prisma.seller.update({ where: { id }, data: { cnicEncrypted: updates.cnicEncrypted } });
    },
    // Identity values reuse encryptDriveToken/decryptDriveToken verbatim
    // (trust-safety/identity-crypto.util.ts) - same functions, different key.
    columns: { cnicEncrypted: DRIVE_TOKEN_FNS },
  },
  "drive-token": {
    label: "Google Drive refresh tokens (google_drive_connections.refresh_token_encrypted)",
    fetchRows: (prisma) => prisma.googleDriveConnection.findMany({ select: { id: true, refreshTokenEncrypted: true } }),
    updateRow: async (prisma, id, updates) => {
      await prisma.googleDriveConnection.update({ where: { id }, data: { refreshTokenEncrypted: updates.refreshTokenEncrypted } });
    },
    columns: { refreshTokenEncrypted: DRIVE_TOKEN_FNS },
  },
  "external-api-secret": {
    label: "External API client signing secrets (external_api_clients.signing_secret_ref)",
    fetchRows: (prisma) => prisma.externalApiClient.findMany({ select: { id: true, signingSecretEncrypted: true } }),
    updateRow: async (prisma, id, updates) => {
      await prisma.externalApiClient.update({ where: { id }, data: { signingSecretEncrypted: updates.signingSecretEncrypted } });
    },
    columns: { signingSecretEncrypted: DRIVE_TOKEN_FNS },
  },
  "seller-smtp": {
    label: "Seller connected SMTP credentials (seller_verification_emails.smtp_password_encrypted)",
    fetchRows: (prisma) => prisma.sellerVerificationEmail.findMany({ select: { id: true, smtpPasswordEncrypted: true } }),
    updateRow: async (prisma, id, updates) => {
      await prisma.sellerVerificationEmail.update({ where: { id }, data: { smtpPasswordEncrypted: updates.smtpPasswordEncrypted } });
    },
    columns: { smtpPasswordEncrypted: SMTP_FNS },
  },
  "admin-email": {
    label: "Linked admin email account IMAP+SMTP credentials (admin_email_accounts)",
    fetchRows: (prisma) =>
      prisma.adminEmailAccount.findMany({ select: { id: true, imapPasswordEncrypted: true, smtpPasswordEncrypted: true } }),
    updateRow: async (prisma, id, updates) => {
      await prisma.adminEmailAccount.update({ where: { id }, data: updates });
    },
    columns: { imapPasswordEncrypted: ADMIN_EMAIL_FNS, smtpPasswordEncrypted: ADMIN_EMAIL_FNS },
  },
};

async function main() {
  const [domainArg, oldKeyArg, newKeyArg, ...rest] = process.argv.slice(2);
  const dryRun = rest.includes("--dry-run");

  if (!domainArg || !oldKeyArg || !newKeyArg) {
    // eslint-disable-next-line no-console
    console.error(
      "Usage: npx ts-node scripts/rotate-encryption-key.ts <domain> <oldKeyBase64> <newKeyBase64> [--dry-run]\n" +
        `<domain> is one of: ${Object.keys(DOMAINS).join(" | ")}`,
    );
    process.exit(1);
  }

  const config = DOMAINS[domainArg];
  if (!config) {
    // eslint-disable-next-line no-console
    console.error(`Unknown domain "${domainArg}". Must be one of: ${Object.keys(DOMAINS).join(" | ")}`);
    process.exit(1);
  }

  const oldKey = Buffer.from(oldKeyArg, "base64");
  const newKey = Buffer.from(newKeyArg, "base64");
  if (oldKey.length !== 32 || newKey.length !== 32) {
    // eslint-disable-next-line no-console
    console.error("Both keys must be base64-encoded 32-byte (AES-256) keys, e.g. `openssl rand -base64 32`.");
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_ADMIN_URL } } });

  // eslint-disable-next-line no-console
  console.log(`${dryRun ? "[DRY RUN] " : ""}Rotating: ${config.label}`);

  const rows = await config.fetchRows(prisma);
  // eslint-disable-next-line no-console
  console.log(`Found ${rows.length} row(s).`);

  let rotated = 0;
  let failed = 0;

  for (const row of rows) {
    const id = row.id as string;
    const updates: Record<string, string> = {};
    let rowFailed = false;

    for (const [column, fns] of Object.entries(config.columns)) {
      const packed = row[column] as string | null;
      if (!packed) continue; // e.g. admin-email rows always have both, but stay defensive
      try {
        const plaintext = fns.decrypt(packed, oldKey);
        updates[column] = fns.encrypt(plaintext, newKey);
      } catch (err) {
        rowFailed = true;
        // eslint-disable-next-line no-console
        console.error(`  FAILED id=${id} column=${column}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (rowFailed || Object.keys(updates).length === 0) {
      failed += rowFailed ? 1 : 0;
      continue;
    }

    if (!dryRun) {
      await config.updateRow(prisma, id, updates);
    }
    rotated += 1;
  }

  await prisma.$disconnect();

  // eslint-disable-next-line no-console
  console.log(
    `${dryRun ? "[DRY RUN] Would rotate" : "Rotated"} ${rotated}/${rows.length} row(s).` +
      (failed > 0 ? ` ${failed} row(s) FAILED - old key could not decrypt them. Investigate before proceeding.` : ""),
  );

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
