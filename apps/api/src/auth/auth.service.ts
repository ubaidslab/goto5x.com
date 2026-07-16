import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { EmailService } from "../notifications/email.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { JwtAccessPayload } from "../common/types";
import { CompletePasswordResetDto, RequestPasswordResetDto } from "./dto/password-reset.dto";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";
import { SecurityEventService } from "./security-event.service";
import { SessionService } from "./session.service";
import { generateToken, hashToken } from "./token.util";

const BCRYPT_ROUNDS = 12;
const EMAIL_VERIFICATION_TTL_MINUTES = 60 * 24; // 24h, not settings-tunable (fixed, unlike password reset which SRS calls out explicitly)

export interface TokenPair {
  accessToken: string;
  sessionId: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessions: SessionService,
    private readonly email: EmailService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
    private readonly securityEvents: SecurityEventService,
  ) {}

  async signup(dto: SignupDto, ip: string): Promise<{ userId: string }> {
    const limit = await this.settings.resolve<number>("auth.signup_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`signup:${ip}`, limit);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const { token, tokenHash } = generateToken();

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        roleFlags: ["seller"],
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60_000),
        seller: { create: { businessName: dto.businessName } },
      },
    });

    const verifyUrl = `${this.config.getOrThrow<string>("APP_BASE_URL")}/verify-email?token=${token}`;
    await this.email.sendVerificationEmail(user.email, verifyUrl);

    return { userId: user.id };
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationTokenHash: tokenHash },
    });

    if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException("This verification link is invalid or has expired.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });

    await this.securityEvents.record(user.id, "email_verified");
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { seller: true },
    });

    if (!user || !user.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return this.issueTokens(user.id, { sellerId: user.seller?.id });
  }

  async refresh(sessionId: string, refreshToken: string): Promise<TokenPair> {
    const userId = await this.sessions.validateRefreshToken(sessionId, refreshToken);
    if (!userId) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }
    // Destroy the old session and issue a new one (refresh-token rotation).
    await this.sessions.destroySession(sessionId);

    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    return this.issueTokens(userId, { sellerId: seller?.id });
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.destroySession(sessionId);
  }

  async requestPasswordReset(dto: RequestPasswordResetDto, ip: string): Promise<void> {
    const rateLimitPerHour = await this.settings.resolve<number>(
      "auth.password_reset_rate_limit_per_hour",
    );
    await this.rateLimit.enforcePerHour(`password-reset-request:${dto.email}`, rateLimitPerHour);
    await this.rateLimit.enforcePerHour(`password-reset-request-ip:${ip}`, rateLimitPerHour);

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Always behave identically whether or not the account exists, so this
    // endpoint can never be used to enumerate registered emails (SRS §6.5).
    if (user) {
      const ttlMinutes = await this.settings.resolve<number>(
        "auth.password_reset_token_ttl_minutes",
      );
      const { token, tokenHash } = generateToken();
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        },
      });
      const resetUrl = `${this.config.getOrThrow<string>("APP_BASE_URL")}/reset-password?token=${token}`;
      await this.email.sendPasswordResetEmail(user.email, resetUrl);
      await this.securityEvents.record(user.id, "password_reset_requested", ip);
    }
  }

  async completePasswordReset(dto: CompletePasswordResetDto, ip: string): Promise<void> {
    const tokenHash = hashToken(dto.token);
    const user = await this.prisma.user.findFirst({ where: { passwordResetTokenHash: tokenHash } });

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException("This password reset link is invalid or has expired.");
    }

    const rateLimitPerHour = await this.settings.resolve<number>(
      "auth.password_reset_rate_limit_per_hour",
    );
    await this.rateLimit.enforcePerHour(`password-reset-complete:${user.id}`, rateLimitPerHour);

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // Single-use: clearing the token hash means this exact token can
        // never be replayed, even before its expiry (SRS FR-25.1/25.4).
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });

    // A compromised session cannot outlive a password reset (SRS FR-25.4).
    await this.sessions.destroyAllSessionsForUser(user.id);
    await this.securityEvents.record(user.id, "password_reset_completed", ip);
  }

  private async issueTokens(userId: string, extra: Partial<JwtAccessPayload>): Promise<TokenPair> {
    const { sessionId, refreshToken } = await this.sessions.createSession(userId);
    const accessToken = this.jwt.sign(
      { sub: userId, ...extra } satisfies JwtAccessPayload,
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: `${this.config.getOrThrow<number>("JWT_ACCESS_TTL_MINUTES")}m`,
      },
    );
    return { accessToken, sessionId, refreshToken };
  }
}
