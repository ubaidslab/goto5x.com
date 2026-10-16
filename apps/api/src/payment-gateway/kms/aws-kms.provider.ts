import { DecryptCommand, GenerateDataKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KmsProvider } from "./kms-provider.interface";

/**
 * D117/D126 (founder decision) - the real, production-bound KMS provider.
 * AWS KMS is the first production target "because it works from any
 * host" - credentials resolve through the AWS SDK's own standard chain
 * (env vars, shared config file, or an attached IAM role), never read
 * directly in this file. No live credentials exist in this sandbox; per
 * D117/D126, they only ever arrive later, through a real environment's
 * own local .env, never through chat or the repo.
 *
 * AWS_KMS_ENDPOINT is optional and exists ONLY to point at a LocalStack
 * instance in CI (.github/workflows/ci.yml's kms-localstack-test job) or
 * another local KMS emulator - unset in every real environment, the same
 * pattern BackupStorageService's S3 client already uses for a non-AWS
 * S3-compatible endpoint.
 */
@Injectable()
export class AwsKmsProvider implements KmsProvider {
  readonly name = "aws-kms";
  readonly isProductionSafe = true;
  private readonly client: KMSClient;
  private readonly keyId: string;

  constructor(config: ConfigService) {
    this.keyId = config.getOrThrow<string>("AWS_KMS_KEY_ID");
    const endpoint = config.get<string>("AWS_KMS_ENDPOINT");
    this.client = new KMSClient({
      region: config.getOrThrow<string>("AWS_REGION"),
      ...(endpoint ? { endpoint } : {}),
    });
  }

  async generateDataKey(): Promise<{ plaintextKey: Buffer; wrappedKey: string }> {
    const result = await this.client.send(new GenerateDataKeyCommand({ KeyId: this.keyId, KeySpec: "AES_256" }));
    if (!result.Plaintext || !result.CiphertextBlob) {
      throw new Error("AWS KMS GenerateDataKey did not return both Plaintext and CiphertextBlob.");
    }
    return {
      plaintextKey: Buffer.from(result.Plaintext),
      wrappedKey: Buffer.from(result.CiphertextBlob).toString("base64"),
    };
  }

  async unwrapDataKey(wrappedKey: string): Promise<Buffer> {
    // KeyId is technically redundant here (the ciphertext blob itself
    // encodes which key encrypted it) but costs nothing to pass - AWS KMS
    // uses it as an extra integrity check and fails the call if the
    // ciphertext was actually wrapped under a different key.
    const result = await this.client.send(
      new DecryptCommand({ KeyId: this.keyId, CiphertextBlob: Buffer.from(wrappedKey, "base64") }),
    );
    if (!result.Plaintext) {
      throw new Error("AWS KMS Decrypt did not return Plaintext.");
    }
    return Buffer.from(result.Plaintext);
  }
}
