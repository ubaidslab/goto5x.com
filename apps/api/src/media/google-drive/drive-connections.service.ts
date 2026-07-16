import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service";
import { SecurityEventService } from "../../auth/security-event.service";
import { decryptDriveToken, encryptDriveToken } from "../drive-token-crypto.util";
import { DRIVE_CLIENT, IDriveClient } from "./drive-client.interface";

const DRIVE_CONNECTION_SAFE_SELECT = {
  id: true,
  googleAccountEmail: true,
  status: true,
  connectedAt: true,
  lastUsedAt: true,
  revokedAt: true,
} as const;

/**
 * Owns the google_drive_connections row (SRS FR-9.1, the schema gap closed
 * in v0.7). `refreshTokenEncrypted` never leaves this service - every method
 * either omits it via an explicit Prisma `select`, or reads and immediately
 * decrypts it only for the one operation (refresh/revoke) that needs the raw
 * value, never returning it.
 */
@Injectable()
export class DriveConnectionsService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly securityEvents: SecurityEventService,
    config: ConfigService,
    @Inject(DRIVE_CLIENT) private readonly driveClient: IDriveClient,
  ) {
    this.encryptionKey = Buffer.from(config.getOrThrow<string>("DRIVE_TOKEN_ENCRYPTION_KEY"), "base64");
  }

  async getStatus(sellerId: string) {
    return this.tenantPrisma.run(sellerId, (tx) =>
      tx.googleDriveConnection.findUnique({
        where: { sellerId },
        select: DRIVE_CONNECTION_SAFE_SELECT,
      }),
    );
  }

  async connect(sellerId: string, userId: string, code: string) {
    const exchanged = await this.driveClient.exchangeCodeForTokens(code);
    const refreshTokenEncrypted = encryptDriveToken(exchanged.refreshToken, this.encryptionKey);

    const connection = await this.tenantPrisma.run(sellerId, (tx) =>
      tx.googleDriveConnection.upsert({
        where: { sellerId },
        create: {
          sellerId,
          googleAccountEmail: exchanged.accountEmail,
          refreshTokenEncrypted,
          grantedScopes: exchanged.scopes,
          status: "active",
        },
        update: {
          googleAccountEmail: exchanged.accountEmail,
          refreshTokenEncrypted,
          grantedScopes: exchanged.scopes,
          status: "active",
          revokedAt: null,
        },
        select: DRIVE_CONNECTION_SAFE_SELECT,
      }),
    );
    await this.securityEvents.record(userId, "google_drive_connected");
    return connection;
  }

  /** Returns the decrypted refresh token for internal use only (DriveImportService) - never exposed over the API. */
  async getDecryptedRefreshToken(sellerId: string): Promise<string> {
    const connection = await this.tenantPrisma.run(sellerId, (tx) =>
      tx.googleDriveConnection.findUnique({ where: { sellerId } }),
    );
    if (!connection || connection.status !== "active") {
      throw new BadRequestException("Connect Google Drive before importing media.");
    }
    return decryptDriveToken(connection.refreshTokenEncrypted, this.encryptionKey);
  }

  async markUsed(sellerId: string) {
    await this.tenantPrisma.run(sellerId, (tx) =>
      tx.googleDriveConnection.update({ where: { sellerId }, data: { lastUsedAt: new Date() } }),
    );
  }

  async revoke(sellerId: string, userId: string) {
    const connection = await this.tenantPrisma.run(sellerId, (tx) =>
      tx.googleDriveConnection.findUnique({ where: { sellerId } }),
    );
    if (!connection || connection.status === "revoked") {
      throw new NotFoundException("No active Google Drive connection to revoke.");
    }
    const refreshToken = decryptDriveToken(connection.refreshTokenEncrypted, this.encryptionKey);
    try {
      await this.driveClient.revoke(refreshToken);
    } catch {
      // Best-effort by design (SRS FR-9.1): the seller-side revocation (below)
      // must still succeed even if Google's endpoint is unreachable or the
      // token was already invalidated on Google's side.
    }
    const updated = await this.tenantPrisma.run(sellerId, (tx) =>
      tx.googleDriveConnection.update({
        where: { sellerId },
        data: { status: "revoked", revokedAt: new Date(), refreshTokenEncrypted: "" },
        select: DRIVE_CONNECTION_SAFE_SELECT,
      }),
    );
    await this.securityEvents.record(userId, "google_drive_revoked");
    return updated;
  }
}
