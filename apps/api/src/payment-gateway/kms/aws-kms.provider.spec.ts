import { DecryptCommand, GenerateDataKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { ConfigService } from "@nestjs/config";
import { mockClient } from "aws-sdk-client-mock";
import { AwsKmsProvider } from "./aws-kms.provider";

const kmsMock = mockClient(KMSClient);

function buildProvider(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    AWS_KMS_KEY_ID: "arn:aws:kms:us-east-1:111111111111:key/test-key-id",
    AWS_REGION: "us-east-1",
    ...overrides,
  };
  const config = {
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`Missing required config: ${key}`);
      return value;
    }),
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
  return new AwsKmsProvider(config);
}

describe("AwsKmsProvider", () => {
  beforeEach(() => kmsMock.reset());

  it("identifies itself as production-safe", () => {
    const provider = buildProvider();
    expect(provider.isProductionSafe).toBe(true);
    expect(provider.name).toBe("aws-kms");
  });

  it("generateDataKey() calls GenerateDataKeyCommand with the configured KeyId and AES_256, returning both forms", async () => {
    const plaintext = Buffer.from("0".repeat(32));
    const ciphertextBlob = Buffer.from("wrapped-bytes");
    kmsMock.on(GenerateDataKeyCommand).resolves({ Plaintext: plaintext, CiphertextBlob: ciphertextBlob });

    const provider = buildProvider();
    const result = await provider.generateDataKey();

    expect(result.plaintextKey).toEqual(plaintext);
    expect(result.wrappedKey).toBe(ciphertextBlob.toString("base64"));
    expect(kmsMock.commandCalls(GenerateDataKeyCommand)[0].args[0].input).toMatchObject({
      KeyId: "arn:aws:kms:us-east-1:111111111111:key/test-key-id",
      KeySpec: "AES_256",
    });
  });

  it("generateDataKey() throws if AWS KMS omits either field", async () => {
    kmsMock.on(GenerateDataKeyCommand).resolves({ Plaintext: undefined, CiphertextBlob: Buffer.from("x") });
    const provider = buildProvider();
    await expect(provider.generateDataKey()).rejects.toThrow(/did not return both/);
  });

  it("unwrapDataKey() calls DecryptCommand with the ciphertext blob and KeyId, returning the plaintext", async () => {
    const plaintext = Buffer.from("1".repeat(32));
    kmsMock.on(DecryptCommand).resolves({ Plaintext: plaintext });

    const provider = buildProvider();
    const wrapped = Buffer.from("wrapped-bytes").toString("base64");
    const result = await provider.unwrapDataKey(wrapped);

    expect(result).toEqual(plaintext);
    const call = kmsMock.commandCalls(DecryptCommand)[0].args[0].input;
    expect(call.KeyId).toBe("arn:aws:kms:us-east-1:111111111111:key/test-key-id");
    expect(Buffer.from(call.CiphertextBlob as Uint8Array).toString("base64")).toBe(wrapped);
  });

  it("unwrapDataKey() throws if AWS KMS omits Plaintext", async () => {
    kmsMock.on(DecryptCommand).resolves({});
    const provider = buildProvider();
    await expect(provider.unwrapDataKey(Buffer.from("x").toString("base64"))).rejects.toThrow(/did not return Plaintext/);
  });

  it("passes AWS_KMS_ENDPOINT through to the client only when set (LocalStack override)", () => {
    expect(() => buildProvider({ AWS_KMS_ENDPOINT: "http://localhost:4566" })).not.toThrow();
    expect(() => buildProvider({ AWS_KMS_ENDPOINT: undefined })).not.toThrow();
  });
});
