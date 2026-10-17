import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KMS_PROVIDER, KmsProvider } from "./kms/kms-provider.interface";
import { decryptGatewayCredential, encryptGatewayCredential } from "./payment-gateway-credential-crypto.util";

/**
 * D117/D126 (founder decision) - envelope encryption for every gateway
 * secret this platform stores (seller-connected gateways via
 * PaymentGatewayService, and the platform's own merchant connections via
 * PlatformGatewayService). Replaces the previous scheme - encrypting a
 * secret directly under a single static PAYMENT_GATEWAY_CREDENTIAL_
 * ENCRYPTION_KEY - with a fresh, random data key per credential set (from
 * the active KmsProvider), used to encrypt each secret field with the
 * same AES-256-GCM primitive as before (payment-gateway-credential-
 * crypto.util.ts), just under a per-row key rather than one static key
 * shared by every row ever stored. That data key is itself wrapped
 * (encrypted) by the KMS and is the only thing persisted for it - the
 * plaintext data key never touches storage or a log line.
 *
 * issueDataKey() is deliberately separate from encryptWithDataKey(): a
 * connection with both an apiKey and an apiSecret encrypts BOTH under the
 * SAME data key (one wrapped-data-key column per row, not one per
 * field) - callers call issueDataKey() once per row, then
 * encryptWithDataKey() once per field.
 */
@Injectable()
export class GatewayCredentialVaultService {
  constructor(
    @Inject(KMS_PROVIDER) private readonly kms: KmsProvider,
    private readonly config: ConfigService,
  ) {}

  /**
   * D126 - refuses to issue (and therefore store) a new gateway secret in
   * production unless a real (production-safe) KMS is actually
   * configured. Never blocks decrypt() - a secret already stored under
   * local-dev in a non-production environment must stay readable there
   * regardless of this guard.
   */
  async issueDataKey(): Promise<{ plaintextKey: Buffer; wrappedDataKey: string }> {
    if (this.config.get<string>("NODE_ENV") === "production" && !this.kms.isProductionSafe) {
      throw new Error(
        `Refusing to store a gateway secret: active KMS provider "${this.kms.name}" is not production-safe.`,
      );
    }
    const { plaintextKey, wrappedKey } = await this.kms.generateDataKey();
    return { plaintextKey, wrappedDataKey: wrappedKey };
  }

  encryptWithDataKey(plaintext: string, dataKey: Buffer): string {
    return encryptGatewayCredential(plaintext, dataKey);
  }

  async decrypt(ciphertext: string, wrappedDataKey: string): Promise<string> {
    const dataKey = await this.kms.unwrapDataKey(wrappedDataKey);
    return decryptGatewayCredential(ciphertext, dataKey);
  }
}
