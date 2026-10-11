// D87 (founder decision, 2026-10-10/11, P0/Risk #51) - reused verbatim,
// same idiom as trust-safety/identity-crypto.util.ts - the exact AES-256-
// GCM implementation already used for the Google Drive refresh token
// (same algorithm/IV length/iv:authTag:ciphertext packing this file hand-
// copied before this). One audited implementation, not a duplicate - a
// future correctness fix to the shared shape now only needs to land here.
// Still encrypted under this credential type's own
// SMTP_CREDENTIAL_ENCRYPTION_KEY, independent of every other credential
// type in this codebase - only the code is shared, never the key.
import { decryptDriveToken, encryptDriveToken } from "../media/drive-token-crypto.util";

export const encryptSmtpCredential = encryptDriveToken;
export const decryptSmtpCredential = decryptDriveToken;
