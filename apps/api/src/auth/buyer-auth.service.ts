import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { JwtAccessPayload } from "../common/types";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { BuyerSignupDto } from "./dto/buyer-signup.dto";
import { LoginDto } from "./dto/login.dto";
import { SecurityEventService } from "./security-event.service";
import { SessionService } from "./session.service";

const BCRYPT_ROUNDS = 12;

/**
 * FR-66.1 (Module 81, v0.56) - optional buyer accounts. Deliberately its
 * own, much smaller service rather than extending AuthService's
 * signup()/login(): none of that flow's seller-specific machinery
 * applies here (no CNIC/risk-score, no Seller Agreement, no plan
 * assignment, no regional gating - FR-25.5's own text already says
 * buyer-side access is never regionally gated, no MFA - buyer accounts
 * are optional/low-stakes by design, unlike seller/admin auth). Same
 * shared `users` table, same bcrypt/SessionService/JwtStrategy plumbing
 * as every other role, mirroring AdminAuthService's precedent of being a
 * separate Controller+Service rather than a branch inside AuthService.
 */
@Injectable()
export class BuyerAuthService {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessions: SessionService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
    private readonly securityEvents: SecurityEventService,
  ) {}

  async signup(dto: BuyerSignupDto, ip: string) {
    const limit = await this.settings.resolve<number>("auth.signup_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`buyer-signup:${ip}`, limit);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        roleFlags: ["buyer"],
        buyerProfile: { create: { displayName: dto.displayName } },
      },
      include: { buyerProfile: true },
    });

    return this.issueTokens(user.id, user.buyerProfile!.id, ip);
  }

  async login(dto: LoginDto, ip: string) {
    const limit = await this.settings.resolve<number>("auth.login_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`buyer-login:${dto.email}`, limit);
    await this.rateLimit.enforcePerHour(`buyer-login-ip:${ip}`, limit);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { buyerProfile: true },
    });

    if (!user?.buyerProfile || !user.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return this.issueTokens(user.id, user.buyerProfile.id, ip);
  }

  async refresh(sessionId: string, refreshToken: string) {
    const validation = await this.sessions.validateRefreshToken(sessionId, refreshToken);
    if (validation.status === "reused") {
      // D82 reuse detection - see AuthService.refresh()'s identical comment.
      await this.sessions.destroyAllSessionsForUser(validation.userId);
      await this.securityEvents.record(validation.userId, "refresh_token_reuse_detected");
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }
    if (validation.status === "invalid") {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }
    const userId = validation.userId;
    const deviceInfo = await this.sessions.getDeviceInfo(sessionId);
    await this.sessions.touchSession(sessionId);
    // Destroy the old session (tombstoned, for the reuse check above) and issue a new one (refresh-token rotation).
    await this.sessions.rotateOutSession(sessionId);

    const buyerProfile = await this.prisma.buyerProfile.findUniqueOrThrow({ where: { userId } });
    return this.issueTokens(userId, buyerProfile.id, deviceInfo?.ipAddress ?? "unknown");
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.destroySession(sessionId);
  }

  private async issueTokens(userId: string, buyerId: string, ip: string) {
    const { sessionId, refreshToken } = await this.sessions.createSession(userId, "Storefront", ip);
    const accessToken = this.jwt.sign({ sub: userId, buyerId } satisfies JwtAccessPayload, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: `${this.config.getOrThrow<number>("JWT_ACCESS_TTL_MINUTES")}m`,
    });
    return { accessToken, sessionId, refreshToken };
  }
}
