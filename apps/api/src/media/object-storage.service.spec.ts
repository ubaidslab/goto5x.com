import { ConfigService } from "@nestjs/config";
import { ObjectStorageService } from "./object-storage.service";

const sendMock = jest.fn().mockResolvedValue({});
jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  };
});

/**
 * No real MinIO is reachable in this sandbox (no daemon, no network egress
 * to fetch the binary - see README.md's Docker-path disclosure for the same
 * constraint). This test proves the request-shaping/URL logic; the founder's
 * own `docker compose up` smoke test is what exercises the real S3 wire
 * calls, exactly like Module 1's Docker gap.
 */
describe("ObjectStorageService", () => {
  function buildConfig(overrides: Record<string, string> = {}) {
    const values: Record<string, string> = {
      MINIO_ENDPOINT: "http://localhost:9000",
      MINIO_BUCKET: "goto5x-media-test",
      MINIO_ROOT_USER: "user",
      MINIO_ROOT_PASSWORD: "pass",
      ...overrides,
    };
    return {
      getOrThrow: (key: string) => {
        const v = values[key];
        if (v === undefined) throw new Error(`missing ${key}`);
        return v;
      },
      get: (key: string) => values[key],
    } as unknown as ConfigService;
  }

  beforeEach(() => sendMock.mockClear());

  it("builds the public URL from MINIO_ENDPOINT/bucket when MEDIA_PUBLIC_BASE_URL is unset", async () => {
    const service = new ObjectStorageService(buildConfig());
    const url = await service.putObject("stores/s1/media/file.png", Buffer.from("x"), "image/png");
    expect(url).toBe("http://localhost:9000/goto5x-media-test/stores/s1/media/file.png");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("prefers MEDIA_PUBLIC_BASE_URL (the CDN-fronted URL) when set", async () => {
    const service = new ObjectStorageService(buildConfig({ MEDIA_PUBLIC_BASE_URL: "https://cdn.goto5x.com" }));
    const url = await service.putObject("stores/s1/media/file.png", Buffer.from("x"), "image/png");
    expect(url).toBe("https://cdn.goto5x.com/stores/s1/media/file.png");
  });

  it("keyFromUrl recovers the storage key from a URL it produced", () => {
    const service = new ObjectStorageService(buildConfig({ MEDIA_PUBLIC_BASE_URL: "https://cdn.goto5x.com" }));
    expect(service.keyFromUrl("https://cdn.goto5x.com/stores/s1/media/file.png")).toBe("stores/s1/media/file.png");
  });

  it("keyFromUrl rejects a URL from a different base", () => {
    const service = new ObjectStorageService(buildConfig({ MEDIA_PUBLIC_BASE_URL: "https://cdn.goto5x.com" }));
    expect(() => service.keyFromUrl("https://evil.example.com/x")).toThrow();
  });

  it("deleteObject sends a delete request for the given key", async () => {
    const service = new ObjectStorageService(buildConfig());
    await service.deleteObject("stores/s1/media/file.png");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
