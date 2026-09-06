import { DriveImportService } from "./drive-import.service";
import { DriveFile, IDriveClient } from "./drive-client.interface";

/**
 * Proves FR-9.1/FR-9.2's orchestration logic - list/select -> download ->
 * upload to object storage -> record media_assets, with the access token
 * cached in Redis and refreshed on a cache miss - independent of Google's
 * real API. See google-drive-client.service.ts for why the real
 * implementation cannot be exercised in this sandbox: this is exactly the
 * "Drive is a source, not the runtime dependency" property FR-9.2 requires,
 * demonstrated by testing against a fake instead.
 */
describe("DriveImportService", () => {
  const STORE_ID = "11111111-1111-1111-1111-111111111111";
  const SELLER_ID = "22222222-2222-2222-2222-222222222222";

  function buildFakeDriveClient(files: DriveFile[]): jest.Mocked<IDriveClient> {
    return {
      getAuthUrl: jest.fn(),
      exchangeCodeForTokens: jest.fn(),
      refreshAccessToken: jest.fn().mockResolvedValue({ accessToken: "fresh-access-token", expiresInSeconds: 3600 }),
      listImportableFiles: jest.fn().mockResolvedValue(files),
      // Security-audit fix (docs/security-audit-report.md, finding #14):
      // classification now inspects real bytes (detectMediaTypeOrThrow), not
      // the declared mimeType - so a file the fixture wants to succeed needs
      // a genuine PNG signature, and a file it wants to fail (e.g. the
      // "bad.pdf" case) can keep arbitrary bytes, which are correctly
      // rejected as unrecognized content regardless of the declared mimeType.
      downloadFile: jest.fn().mockImplementation(async (_token: string, fileId: string) => {
        const file = files.find((f) => f.id === fileId);
        const raw = Buffer.from(`bytes-for-${fileId}`);
        const buffer =
          file?.mimeType === "image/png"
            ? Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), raw])
            : raw;
        return { buffer, mimeType: file?.mimeType ?? "application/octet-stream" };
      }),
      revoke: jest.fn(),
      createFolder: jest.fn(),
      uploadFile: jest.fn(),
    };
  }

  function buildHarness(files: DriveFile[]) {
    const driveClient = buildFakeDriveClient(files);
    const redisStore = new Map<string, string>();
    const redis = {
      get: jest.fn().mockImplementation(async (key: string) => redisStore.get(key) ?? null),
      set: jest.fn().mockImplementation(async (key: string, value: string) => {
        redisStore.set(key, value);
        return "OK";
      }),
    };
    const createdAssets: { storeId: string; url: string; source: string; type: string }[] = [];
    const tx = {
      store: { findUnique: jest.fn().mockResolvedValue({ id: STORE_ID }) },
      mediaAsset: {
        create: jest.fn().mockImplementation(async ({ data }: { data: any }) => {
          createdAssets.push(data);
          return { id: `asset-${createdAssets.length}`, ...data };
        }),
      },
    };
    const tenantPrisma = { run: jest.fn().mockImplementation(async (_sellerId: string, fn: any) => fn(tx)) };
    const objectStorage = {
      putObject: jest.fn().mockImplementation(async (key: string) => `https://cdn.example.com/${key}`),
    };
    const connections = {
      getDecryptedRefreshToken: jest.fn().mockResolvedValue("stored-refresh-token"),
      markUsed: jest.fn().mockResolvedValue(undefined),
    };
    const events = { emit: jest.fn().mockResolvedValue(undefined) };

    const service = new DriveImportService(
      tenantPrisma as any,
      connections as any,
      redis as any,
      objectStorage as any,
      events as any,
      driveClient,
    );
    return { service, driveClient, redis, connections, objectStorage, events, createdAssets };
  }

  it("imports every listed file when no fileIds filter is given, creating one media_asset per file", async () => {
    const files: DriveFile[] = [
      { id: "f1", name: "a.png", mimeType: "image/png" },
      { id: "f2", name: "b.png", mimeType: "image/png" },
    ];
    const { service, createdAssets, events } = buildHarness(files);

    const result = await service.importFiles(SELLER_ID, STORE_ID);

    expect(result.succeeded).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(createdAssets).toHaveLength(2);
    expect(createdAssets.every((a) => a.source === "google_drive_import")).toBe(true);
    // SRS §3.11/FR-26.5 - one media.imported event per successfully imported file.
    expect(events.emit).toHaveBeenCalledTimes(2);
    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "media.imported", metadata: { source: "google_drive_import" } }),
    );
  });

  it("imports only the requested fileIds when a filter is provided", async () => {
    const files: DriveFile[] = [
      { id: "f1", name: "a.png", mimeType: "image/png" },
      { id: "f2", name: "b.png", mimeType: "image/png" },
      { id: "f3", name: "c.png", mimeType: "image/png" },
    ];
    const { service, createdAssets } = buildHarness(files);

    const result = await service.importFiles(SELLER_ID, STORE_ID, ["f2"]);

    expect(result.succeeded).toEqual([{ fileId: "f2", mediaAssetId: expect.any(String) }]);
    expect(createdAssets).toHaveLength(1);
  });

  it("isolates a per-file failure - one bad file does not abort the rest of the batch", async () => {
    const files: DriveFile[] = [
      { id: "good", name: "good.png", mimeType: "image/png" },
      { id: "bad", name: "bad.pdf", mimeType: "application/pdf" }, // non-image content -> detectMediaTypeOrThrow throws
    ];
    const { service, createdAssets, events } = buildHarness(files);

    const result = await service.importFiles(SELLER_ID, STORE_ID);

    expect(result.succeeded).toEqual([{ fileId: "good", mediaAssetId: expect.any(String) }]);
    expect(result.failed).toEqual([{ fileId: "bad", reason: expect.stringContaining("Unsupported file") }]);
    expect(createdAssets).toHaveLength(1);
    // Only the successfully-imported file emits an event - the failed one never got as far as a media_asset row.
    expect(events.emit).toHaveBeenCalledTimes(1);
  });

  it("refreshes and caches the access token on a cache miss, then reuses the cached value on the next call", async () => {
    const { service, driveClient, redis } = buildHarness([]);

    await service.listImportableFiles(SELLER_ID);
    expect(driveClient.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      `drive:access_token:${SELLER_ID}`,
      "fresh-access-token",
      "EX",
      expect.any(Number),
    );

    await service.listImportableFiles(SELLER_ID);
    expect(driveClient.refreshAccessToken).toHaveBeenCalledTimes(1); // still 1, not 2 - the cache was used
  });

  it("marks the connection as used after an import run", async () => {
    const { service, connections } = buildHarness([{ id: "f1", name: "a.png", mimeType: "image/png" }]);
    await service.importFiles(SELLER_ID, STORE_ID);
    expect(connections.markUsed).toHaveBeenCalledWith(SELLER_ID);
  });
});
