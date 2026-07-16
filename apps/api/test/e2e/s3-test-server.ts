import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const S3rver = require("s3rver");

/**
 * No real MinIO is reachable in this sandbox (no daemon, no network egress
 * to fetch the binary). Rather than mock the S3 SDK for the media e2e
 * tests, this spins up s3rver - a real, lightweight, S3-API-compatible HTTP
 * server backed by the local filesystem - so ObjectStorageService's actual
 * HTTP calls are exercised for real, matching this project's stated
 * preference for genuine infrastructure over mocks wherever practical. This
 * is a test-only stand-in; production always talks to real MinIO
 * (docs/README.md's Docker-path disclosure covers what remains unverified
 * for the real thing).
 */
export interface TestS3Server {
  close(): Promise<void>;
}

export async function startTestS3Server(port: number, bucket: string): Promise<TestS3Server> {
  const directory = mkdtempSync(join(tmpdir(), "goto5x-s3rver-"));
  const instance = new S3rver({
    port,
    address: "localhost",
    silent: true,
    directory,
    configureBuckets: [{ name: bucket, configs: [] }],
  });
  await instance.run();
  return {
    async close() {
      await new Promise<void>((resolve, reject) =>
        instance.close((err: unknown) => (err ? reject(err) : resolve())),
      );
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
