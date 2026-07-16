import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Thin wrapper around the S3-compatible API MinIO exposes (SRS §3.3). Using
 * the standard AWS SDK client rather than a MinIO-specific one is
 * deliberate: it means a later move to Cloudflare R2/AWS S3 (docs/tech-
 * stack.md's stated migration path) is a config change, not a rewrite.
 */
@Injectable()
export class ObjectStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    const endpoint = config.getOrThrow<string>("MINIO_ENDPOINT");
    this.bucket = config.getOrThrow<string>("MINIO_BUCKET");
    this.publicBaseUrl = config.get<string>("MEDIA_PUBLIC_BASE_URL") || `${endpoint}/${this.bucket}`;
    this.client = new S3Client({
      endpoint,
      region: "us-east-1", // required by the SDK; meaningless for a self-hosted MinIO target
      forcePathStyle: true, // MinIO requires path-style addressing, not virtual-hosted-style
      credentials: {
        accessKeyId: config.getOrThrow<string>("MINIO_ROOT_USER"),
        secretAccessKey: config.getOrThrow<string>("MINIO_ROOT_PASSWORD"),
      },
    });
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return this.getPublicUrl(key);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  /** Derives the storage key back out of a URL this service produced, e.g. to delete on removal. */
  keyFromUrl(url: string): string {
    const prefix = `${this.publicBaseUrl}/`;
    if (!url.startsWith(prefix)) {
      throw new Error(`URL "${url}" was not produced by this ObjectStorageService instance.`);
    }
    return url.slice(prefix.length);
  }
}
