import { HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Backups reality check (Risk 5/13) - a genuinely SEPARATE S3-compatible
 * target from ObjectStorageService/MinIO (BACKUP_S3_*, not MINIO_*):
 * ObjectStorageService IS the primary on-box store, so pointing "off-box
 * backups" at it would back a disk up onto itself. This service is
 * deliberately optional - unlike ObjectStorageService, it must never fail
 * app boot when unconfigured (see DatabaseBackupService), because backup
 * automation is additive ops infra the app's core runtime doesn't depend
 * on, not a request-path dependency every seller-facing page needs.
 */
@Injectable()
export class BackupStorageService {
  private readonly client?: S3Client;
  private readonly bucket?: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>("BACKUP_S3_ENDPOINT");
    const bucket = config.get<string>("BACKUP_S3_BUCKET");
    const accessKeyId = config.get<string>("BACKUP_S3_ACCESS_KEY_ID");
    const secretAccessKey = config.get<string>("BACKUP_S3_SECRET_ACCESS_KEY");
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return;

    this.bucket = bucket;
    this.client = new S3Client({
      endpoint,
      region: config.get<string>("BACKUP_S3_REGION", "us-east-1"),
      forcePathStyle: config.get<string>("BACKUP_S3_FORCE_PATH_STYLE", "true") === "true",
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  isConfigured(): boolean {
    return this.client !== undefined;
  }

  async checkReachable(): Promise<boolean> {
    if (!this.client || !this.bucket) return false;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }

  async putObject(key: string, body: Buffer): Promise<void> {
    if (!this.client || !this.bucket) {
      throw new Error("BackupStorageService.putObject() called while unconfigured - check isConfigured() first.");
    }
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: "application/gzip" }),
    );
  }
}
