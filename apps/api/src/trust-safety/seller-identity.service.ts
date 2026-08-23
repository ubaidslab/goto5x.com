import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { InvalidCnicError, maskCnic, normalizeAndValidateCnic } from "./cnic.util";
import { decryptIdentityValue, encryptIdentityValue, fingerprintValue } from "./identity-crypto.util";
import { RiskScoreService } from "./risk-score.service";
import { SubscriptionAbuseService } from "./subscription-abuse.service";

/**
 * SRS §5.30/FR-30.1 - CNIC capture, encryption, and the platform-wide
 * uniqueness constraint (via a deterministic hash - see identity-crypto.util
 * for why encryption and hashing are two separate, deliberate mechanisms).
 * The FR-6.14-style "activation gate" is enforced at checkout, alongside
 * the existing payment-instructions readiness check (CheckoutService).
 */
@Injectable()
export class SellerIdentityService {
  private readonly encryptionKey: Buffer;
  private readonly hmacSecret: string;

  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly config: ConfigService,
    private readonly riskScore: RiskScoreService,
    private readonly subscriptionAbuse: SubscriptionAbuseService,
  ) {
    this.encryptionKey = Buffer.from(this.config.getOrThrow<string>("IDENTITY_ENCRYPTION_KEY"), "base64");
    this.hmacSecret = this.config.getOrThrow<string>("IDENTITY_FINGERPRINT_HMAC_SECRET");
  }

  async setCnic(sellerId: string, rawCnic: string): Promise<{ cnicMasked: string }> {
    let normalized: string;
    try {
      // Format/checksum-validated before anything ever touches storage (FR-30.1).
      normalized = normalizeAndValidateCnic(rawCnic);
    } catch (err) {
      if (err instanceof InvalidCnicError) throw new BadRequestException(err.message);
      throw err;
    }
    const cnicEncrypted = encryptIdentityValue(normalized, this.encryptionKey);
    const cnicHash = fingerprintValue(normalized, this.hmacSecret);

    try {
      await this.prisma.seller.update({
        where: { id: sellerId },
        data: { cnicEncrypted, cnicHash },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(
          "This CNIC is already registered to a seller account on this platform.",
        );
      }
      throw err;
    }

    await this.riskScore.recompute(sellerId);
    // SRS §5.6k/FR-6.48 (Module 71) - trigger 2.
    await this.subscriptionAbuse.checkOnCnicSet(sellerId);
    return { cnicMasked: maskCnic(normalized) };
  }

  /** Buyer/admin-safe masked view - the plaintext is never returned from any API. */
  async getMaskedCnic(sellerId: string): Promise<string | null> {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: { cnicEncrypted: true },
    });
    if (!seller) throw new NotFoundException("Seller not found.");
    if (!seller.cnicEncrypted) return null;
    const plaintext = decryptIdentityValue(seller.cnicEncrypted, this.encryptionKey);
    return maskCnic(plaintext);
  }

  async hasCnic(sellerId: string): Promise<boolean> {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId }, select: { cnicHash: true } });
    return !!seller?.cnicHash;
  }
}
