import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Readable } from "stream";

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

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

  /**
   * Module 24 security fix (v0.28) - reads an object's bytes back through
   * this service's own credentials rather than a public URL, so a key can be
   * stored/served without ever being reachable by an unauthenticated raw
   * request. Used by SellerDataExport's authenticated download endpoint
   * (PII-bearing CSVs/PDF must never sit behind a guessable public URL).
   */
  async getObject(key: string): Promise<{ body: Buffer; contentType?: string }> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const body = await streamToBuffer(result.Body as Readable);
    return { body, contentType: result.ContentType };
  }

  /** Module 25 (system status page) - a lightweight reachability check, never a full bucket listing (that's O(objects), not something a status page should ever pay for). */
  async checkReachable(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
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
