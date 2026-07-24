export const DRIVE_CLIENT = Symbol("DRIVE_CLIENT");

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface DriveTokenExchangeResult {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  scopes: string[];
  accountEmail: string;
}

export interface DriveAccessTokenRefresh {
  accessToken: string;
  expiresInSeconds: number;
}

export interface DownloadedDriveFile {
  buffer: Buffer;
  mimeType: string;
}

/** Module 24 (SRS §5.36, FR-36.3) - the scope required to create/write files the app itself owns (never a folder the seller created). */
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/**
 * Adapter boundary (same shape of idea as the Supplier Adapter pattern, SRS
 * §3.5): the real implementation talks to Google's actual APIs and cannot be
 * exercised in this sandbox (no network egress to accounts.google.com/
 * googleapis.com - see the Module 2 verification report). Tests inject a
 * fake implementing this same interface, which is what proves
 * DriveImportService's orchestration logic (list -> download -> upload to
 * MinIO -> record media_assets) independent of Google actually being
 * reachable - the same "Drive is a source, not a runtime dependency"
 * property FR-9.2 requires in production is what makes this testable at all.
 */
export interface IDriveClient {
  getAuthUrl(state: string): string;
  exchangeCodeForTokens(code: string): Promise<DriveTokenExchangeResult>;
  refreshAccessToken(refreshToken: string): Promise<DriveAccessTokenRefresh>;
  listImportableFiles(accessToken: string): Promise<DriveFile[]>;
  downloadFile(accessToken: string, fileId: string): Promise<DownloadedDriveFile>;
  revoke(refreshToken: string): Promise<void>;
  /** Module 24 (FR-36.3) - creates a folder the app owns (requires `drive.file` scope); returns the new folder's Drive file ID. */
  createFolder(accessToken: string, name: string): Promise<string>;
  /** Module 24 (FR-36.3) - uploads into a folder the app already created; returns the new file's Drive file ID. */
  uploadFile(accessToken: string, folderId: string, filename: string, mimeType: string, buffer: Buffer): Promise<string>;
}
