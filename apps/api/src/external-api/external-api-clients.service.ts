import { randomBytes } from "crypto";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ExternalApiClientType, Prisma } from "@prisma/client";
import { decryptDriveToken, encryptDriveToken } from "../media/drive-token-crypto.util";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { CreateExternalApiClientDto } from "./dto/create-external-api-client.dto";
import { UpdateExternalApiClientDto } from "./dto/update-external-api-client.dto";

/**
 * FR-8.14/§3.10 - the global registry gating both external-SaaS hooks,
 * mirroring SupplierAdapterRegistryService exactly. No RLS on
 * `external_api_clients` - every read here goes through AdminAuthGuard-gated
 * routes, same as `supplier_adapters`/`themes`.
 */
@Injectable()
export class ExternalApiClientsService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly config: ConfigService,
  ) {
    this.encryptionKey = Buffer.from(this.config.getOrThrow<string>("EXTERNAL_API_SECRET_ENCRYPTION_KEY"), "base64");
  }

  /** Never returns the secret - only whether one has been generated. */
  async list() {
    const rows = await this.prisma.externalApiClient.findMany({ orderBy: { clientType: "asc" } });
    return rows.map(({ signingSecretEncrypted, ...rest }) => ({ ...rest, hasSigningSecret: Boolean(signingSecretEncrypted) }));
  }

  /** FR-24.6 - the generated secret is returned exactly once, in this response, and never again. */
  async create(dto: CreateExternalApiClientDto) {
    const secret = randomBytes(32).toString("hex");
    try {
      const row = await this.prisma.externalApiClient.create({
        data: {
          clientType: dto.clientType,
          displayName: dto.displayName,
          signingSecretEncrypted: encryptDriveToken(secret, this.encryptionKey),
        },
      });
      const { signingSecretEncrypted, ...rest } = row;
      return { ...rest, signingSecret: secret };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`An external API client of type "${dto.clientType}" is already registered.`);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateExternalApiClientDto) {
    const existing = await this.prisma.externalApiClient.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("External API client not found.");
    const updated = await this.prisma.externalApiClient.update({
      where: { id },
      data: { displayName: dto.displayName, isEnabled: dto.isEnabled },
    });
    const { signingSecretEncrypted, ...rest } = updated;
    return { ...rest, hasSigningSecret: Boolean(signingSecretEncrypted) };
  }

  /** FR-24.6 - rotates the secret; the old one stops verifying immediately. Shown once, same discipline as create(). */
  async regenerateSecret(id: string) {
    const existing = await this.prisma.externalApiClient.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("External API client not found.");
    const secret = randomBytes(32).toString("hex");
    const updated = await this.prisma.externalApiClient.update({
      where: { id },
      data: { signingSecretEncrypted: encryptDriveToken(secret, this.encryptionKey) },
    });
    const { signingSecretEncrypted, ...rest } = updated;
    return { ...rest, signingSecret: secret };
  }

  /**
   * Internal use only (never exposed over HTTP) - resolves the decrypted
   * secret for an enabled client of the given type, for the Template
   * Install/License API and the cross-SaaS eligibility endpoint to verify an
   * inbound signed request against. Returns null (never throws) for
   * "disabled" or "not registered" - FR-8.14's "disabling immediately
   * rejects further calls" is enforced by the caller treating null the same
   * as any other verification failure, not a distinguishable error.
   */
  async getEnabledClientSecret(clientType: ExternalApiClientType): Promise<{ id: string; secret: string } | null> {
    const client = await this.prisma.externalApiClient.findUnique({ where: { clientType } });
    if (!client || !client.isEnabled) return null;
    return { id: client.id, secret: decryptDriveToken(client.signingSecretEncrypted, this.encryptionKey) };
  }

  /** Same "must be enabled" check, keyed by id instead of type - used to validate a SellerApiToken's owning client at request time (FR-8.14). */
  async isClientEnabled(clientId: string): Promise<boolean> {
    const client = await this.prisma.externalApiClient.findUnique({ where: { id: clientId } });
    return Boolean(client?.isEnabled);
  }
}
