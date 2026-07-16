import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service";
import { RedisService } from "../../common/redis/redis.service";
import { mediaTypeFromMimetype, sanitizeFilename } from "../media.util";
import { ObjectStorageService } from "../object-storage.service";
import { DRIVE_CLIENT, IDriveClient } from "./drive-client.interface";
import { DriveConnectionsService } from "./drive-connections.service";

export interface DriveImportResult {
  succeeded: { fileId: string; mediaAssetId: string }[];
  failed: { fileId: string; reason: string }[];
}

function accessTokenCacheKey(sellerId: string): string {
  return `drive:access_token:${sellerId}`;
}

/**
 * Orchestrates FR-9.1/FR-9.2: list-or-select Drive files -> download bytes ->
 * copy into MinIO -> record media_assets. The access token this depends on
 * is never persisted to Postgres (SRS §6.5) - it lives here, cached in Redis
 * only for the lifetime of an import job, refreshed from the encrypted
 * refresh token on a cache miss.
 */
@Injectable()
export class DriveImportService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly connections: DriveConnectionsService,
    private readonly redis: RedisService,
    private readonly objectStorage: ObjectStorageService,
    @Inject(DRIVE_CLIENT) private readonly driveClient: IDriveClient,
  ) {}

  async listImportableFiles(sellerId: string) {
    const accessToken = await this.getAccessToken(sellerId);
    return this.driveClient.listImportableFiles(accessToken);
  }

  async importFiles(sellerId: string, storeId: string, fileIds?: string[]): Promise<DriveImportResult> {
    await this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
    });

    const accessToken = await this.getAccessToken(sellerId);
    const available = await this.driveClient.listImportableFiles(accessToken);
    const targets = fileIds ? available.filter((f) => fileIds.includes(f.id)) : available;

    const result: DriveImportResult = { succeeded: [], failed: [] };
    for (const file of targets) {
      try {
        const downloaded = await this.driveClient.downloadFile(accessToken, file.id);
        const type = mediaTypeFromMimetype(downloaded.mimeType);
        const key = `stores/${storeId}/media/drive-${file.id}-${sanitizeFilename(file.name)}`;
        const url = await this.objectStorage.putObject(key, downloaded.buffer, downloaded.mimeType);
        const asset = await this.tenantPrisma.run(sellerId, (tx) =>
          tx.mediaAsset.create({
            data: { storeId, url, source: "google_drive_import", type },
          }),
        );
        result.succeeded.push({ fileId: file.id, mediaAssetId: asset.id });
      } catch (err) {
        result.failed.push({ fileId: file.id, reason: err instanceof Error ? err.message : "unknown error" });
      }
    }

    await this.connections.markUsed(sellerId);
    return result;
  }

  private async getAccessToken(sellerId: string): Promise<string> {
    const cached = await this.redis.get(accessTokenCacheKey(sellerId));
    if (cached) return cached;

    const refreshToken = await this.connections.getDecryptedRefreshToken(sellerId);
    const refreshed = await this.driveClient.refreshAccessToken(refreshToken);
    // Cache for slightly less than its real lifetime so a query is never
    // served a token that expires mid-flight to Google.
    const ttlSeconds = Math.max(30, refreshed.expiresInSeconds - 60);
    await this.redis.set(accessTokenCacheKey(sellerId), refreshed.accessToken, "EX", ttlSeconds);
    return refreshed.accessToken;
  }
}
