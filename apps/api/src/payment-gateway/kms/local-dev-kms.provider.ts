import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { decryptDriveToken, encryptDriveToken } from "../../media/drive-token-crypto.util";
import { KmsProvider } from "./kms-provider.interface";

const DATA_KEY_LENGTH_BYTES = 32; // AES-256

/**
 * D117/D126 (founder decision) - dev/test/sandbox only; refused at boot in
 * production by kms.module.ts's own guard. "Wrapping" a data key here just
 * means encrypting it with a single, static master key sourced from env -
 * the same AES-256-GCM primitive every other credential type in this
 * codebase already uses, just one level further up the chain than before
 * (previously a gateway secret was encrypted directly under a static key;
 * now a per-secret data key is, and that data key wraps the secret - see
 * gateway-credential-vault.service.ts).
 */
@Injectable()
export class LocalDevKmsProvider implements KmsProvider {
  readonly name = "local-dev";
  readonly isProductionSafe = false;
  private readonly masterKey: Buffer;

  constructor(config: ConfigService) {
    this.masterKey = Buffer.from(config.getOrThrow<string>("LOCAL_DEV_KMS_MASTER_KEY"), "base64");
  }

  async generateDataKey(): Promise<{ plaintextKey: Buffer; wrappedKey: string }> {
    const plaintextKey = randomBytes(DATA_KEY_LENGTH_BYTES);
    const wrappedKey = encryptDriveToken(plaintextKey.toString("base64"), this.masterKey);
    return { plaintextKey, wrappedKey };
  }

  async unwrapDataKey(wrappedKey: string): Promise<Buffer> {
    return Buffer.from(decryptDriveToken(wrappedKey, this.masterKey), "base64");
  }
}
