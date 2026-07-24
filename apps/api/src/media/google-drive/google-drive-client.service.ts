import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { google } from "googleapis";
import {
  DownloadedDriveFile,
  DriveAccessTokenRefresh,
  DriveFile,
  DriveTokenExchangeResult,
  IDriveClient,
} from "./drive-client.interface";

const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  // Module 24 (SRS §5.36, FR-36.3) - required to create/write the seller's
  // dedicated export folder and its files. `drive.file` only ever grants
  // access to files/folders THIS app creates - never the seller's own
  // existing Drive content - which is exactly "never a folder the seller
  // didn't create for this purpose" enforced structurally by Google's own
  // scope model, not by application-level discipline alone. A connection
  // made before this scope was added only has `drive.readonly`
  // (`GoogleDriveConnection.grantedScopes`) - DataExportService checks for
  // this scope and falls back to the email delivery path until the seller
  // reconnects; it never silently attempts an upload it can't perform.
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

/**
 * Real implementation (SRS FR-9.1) - talks to Google's OAuth + Drive v3 APIs.
 * Not exercised by any test in this repo: this sandbox has no network egress
 * to accounts.google.com/googleapis.com (only npm/pypi/crates/anthropic
 * domains are reachable through the proxy), so there is no way to obtain a
 * real authorization code here. Every unit test for the FR-9.1 flow injects
 * a fake IDriveClient instead - see drive-import.service.spec.ts - which is
 * exactly what proves the "Drive is a source, not the runtime dependency"
 * requirement (FR-9.2): the import pipeline's correctness does not depend on
 * this class. The founder's own Google Cloud OAuth credentials are needed to
 * verify this class for real, the same disclosure pattern as Module 1's
 * unverified `docker compose up` path.
 */
@Injectable()
export class GoogleDriveClientService implements IDriveClient {
  constructor(private readonly config: ConfigService) {}

  private buildOAuthClient() {
    return new google.auth.OAuth2(
      this.config.getOrThrow<string>("GOOGLE_DRIVE_CLIENT_ID"),
      this.config.getOrThrow<string>("GOOGLE_DRIVE_CLIENT_SECRET"),
      this.config.getOrThrow<string>("GOOGLE_DRIVE_REDIRECT_URI"),
    );
  }

  getAuthUrl(state: string): string {
    const client = this.buildOAuthClient();
    return client.generateAuthUrl({
      access_type: "offline", // required to receive a refresh_token at all
      prompt: "consent", // forces a refresh_token on every connect, not just the first ever grant
      scope: DRIVE_SCOPES,
      state,
    });
  }

  async exchangeCodeForTokens(code: string): Promise<DriveTokenExchangeResult> {
    const client = this.buildOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token || !tokens.access_token) {
      throw new Error(
        "Google did not return a refresh_token - the seller must revoke prior app access in their Google " +
          "Account and reconnect (Google only issues a refresh_token on first consent unless prompt=consent).",
      );
    }
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ auth: client, version: "v2" });
    const { data } = await oauth2.userinfo.get();
    if (!data.email) throw new Error("Google did not return the connected account's email.");
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresInSeconds: tokens.expiry_date ? Math.max(0, Math.floor((tokens.expiry_date - Date.now()) / 1000)) : 3600,
      scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
      accountEmail: data.email,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<DriveAccessTokenRefresh> {
    const client = this.buildOAuthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) throw new Error("Google refresh did not return an access_token.");
    return {
      accessToken: credentials.access_token,
      expiresInSeconds: credentials.expiry_date
        ? Math.max(0, Math.floor((credentials.expiry_date - Date.now()) / 1000))
        : 3600,
    };
  }

  async listImportableFiles(accessToken: string): Promise<DriveFile[]> {
    const client = this.buildOAuthClient();
    client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ auth: client, version: "v3" });
    const { data } = await drive.files.list({
      q: "(mimeType contains 'image/' or mimeType contains 'video/') and trashed = false",
      fields: "files(id, name, mimeType)",
      pageSize: 100,
    });
    return (data.files ?? []).map((f) => ({ id: f.id!, name: f.name!, mimeType: f.mimeType! }));
  }

  async downloadFile(accessToken: string, fileId: string): Promise<DownloadedDriveFile> {
    const client = this.buildOAuthClient();
    client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ auth: client, version: "v3" });
    const meta = await drive.files.get({ fileId, fields: "mimeType" });
    const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
    return { buffer: Buffer.from(res.data as ArrayBuffer), mimeType: meta.data.mimeType ?? "application/octet-stream" };
  }

  async revoke(refreshToken: string): Promise<void> {
    const client = this.buildOAuthClient();
    await client.revokeToken(refreshToken);
  }

  async createFolder(accessToken: string, name: string): Promise<string> {
    const client = this.buildOAuthClient();
    client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ auth: client, version: "v3" });
    const { data } = await drive.files.create({
      requestBody: { name, mimeType: "application/vnd.google-apps.folder" },
      fields: "id",
    });
    if (!data.id) throw new Error("Google Drive did not return a folder ID.");
    return data.id;
  }

  async uploadFile(accessToken: string, folderId: string, filename: string, mimeType: string, buffer: Buffer): Promise<string> {
    const client = this.buildOAuthClient();
    client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ auth: client, version: "v3" });
    const { Readable } = await import("node:stream");
    const { data } = await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media: { mimeType, body: Readable.from(buffer) },
      fields: "id",
    });
    if (!data.id) throw new Error("Google Drive did not return a file ID.");
    return data.id;
  }
}
