import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ExternalApiClientType } from "@prisma/client";
import { ExternalApiClientsService } from "./external-api-clients.service";
import { isTimestampFresh, verifySignature } from "./signature.util";

/**
 * SRS §6.5/FR-24.6/FR-24.14 - shared verification entry point for the two
 * client-level-signed endpoints (Template Install/License, cross-SaaS
 * eligibility). Never accepts an unauthenticated or unsigned call under any
 * circumstance - every failure mode (missing header, disabled client, stale
 * timestamp, bad signature) throws the same UnauthorizedException with no
 * distinguishing detail, so a forged request can't learn which check it failed.
 */
@Injectable()
export class ExternalApiSignatureService {
  constructor(private readonly clients: ExternalApiClientsService) {}

  async verify(
    clientTypeHeader: string | undefined,
    timestampHeader: string | undefined,
    signatureHeader: string | undefined,
    payload: string,
  ): Promise<{ clientId: string; clientType: ExternalApiClientType }> {
    if (!clientTypeHeader || !timestampHeader || !signatureHeader) {
      throw new UnauthorizedException("Missing signed-request headers.");
    }
    if (!Object.values(ExternalApiClientType).includes(clientTypeHeader as ExternalApiClientType)) {
      throw new UnauthorizedException("Invalid signature.");
    }
    if (!isTimestampFresh(timestampHeader)) {
      throw new UnauthorizedException("Invalid signature.");
    }
    const clientType = clientTypeHeader as ExternalApiClientType;
    const resolved = await this.clients.getEnabledClientSecret(clientType);
    if (!resolved) {
      throw new UnauthorizedException("Invalid signature.");
    }
    if (!verifySignature(resolved.secret, timestampHeader, payload, signatureHeader)) {
      throw new UnauthorizedException("Invalid signature.");
    }
    return { clientId: resolved.id, clientType };
  }
}
