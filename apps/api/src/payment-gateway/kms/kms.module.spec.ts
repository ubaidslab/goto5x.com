import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { AwsKmsProvider } from "./aws-kms.provider";
import { KMS_PROVIDER } from "./kms-provider.interface";
import { KmsModule } from "./kms.module";
import { LocalDevKmsProvider } from "./local-dev-kms.provider";

/**
 * D126 (explicit founder instruction) - "in NODE_ENV=production the app
 * must refuse to boot with LocalDevKmsProvider ... Add a test for both."
 * This is the boot half; gateway-credential-vault.service.spec.ts covers
 * the "refuse to store a secret" half.
 */
describe("KmsModule boot guard", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  async function compile() {
    return Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: false }), KmsModule],
    }).compile();
  }

  it("refuses to boot with the default (local-dev) provider when NODE_ENV=production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.KMS_PROVIDER_TYPE;
    process.env.LOCAL_DEV_KMS_MASTER_KEY = Buffer.alloc(32).toString("base64");

    await expect(compile()).rejects.toThrow(/Refusing to boot/);
  });

  it("boots fine with the local-dev provider outside production", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.KMS_PROVIDER_TYPE;
    process.env.LOCAL_DEV_KMS_MASTER_KEY = Buffer.alloc(32).toString("base64");

    const moduleRef = await compile();
    expect(moduleRef.get(KMS_PROVIDER)).toBeInstanceOf(LocalDevKmsProvider);
  });

  it("boots fine in production when KMS_PROVIDER_TYPE=aws with AWS config present", async () => {
    process.env.NODE_ENV = "production";
    process.env.KMS_PROVIDER_TYPE = "aws";
    process.env.AWS_KMS_KEY_ID = "arn:aws:kms:us-east-1:111111111111:key/test-key-id";
    process.env.AWS_REGION = "us-east-1";

    const moduleRef = await compile();
    expect(moduleRef.get(KMS_PROVIDER)).toBeInstanceOf(AwsKmsProvider);
  });

  it("still throws in production if KMS_PROVIDER_TYPE is explicitly set to local-dev", async () => {
    process.env.NODE_ENV = "production";
    process.env.KMS_PROVIDER_TYPE = "local-dev";
    process.env.LOCAL_DEV_KMS_MASTER_KEY = Buffer.alloc(32).toString("base64");

    await expect(compile()).rejects.toThrow(/Refusing to boot/);
  });
});
