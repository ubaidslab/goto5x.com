import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { EventsService } from "../events/events.service";
import { EmailService } from "../notifications/email.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { RiskScoreService } from "../trust-safety/risk-score.service";
import { SubscriptionAbuseService } from "../trust-safety/subscription-abuse.service";
import { SellerAgreementService } from "../trust-safety/seller-agreement.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { resolveReferralSource } from "../plans/referral-source.util";
import { ReferralAttributionService } from "../growth-programs/referral-attribution.service";
import { JwtAccessPayload } from "../common/types";
import { labelDevice } from "./device-label.util";
import { CompletePasswordResetDto, RequestPasswordResetDto } from "./dto/password-reset.dto";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";
import { SecurityEventService } from "./security-event.service";
import { SessionService } from "./session.service";
import { generateToken, hashToken } from "./token.util";

const BCRYPT_ROUNDS = 12;
const EMAIL_VERIFICATION_TTL_MINUTES = 60 * 24; // 24h, not settings-tunable (fixed, unlike password reset which SRS calls out explicitly)
const MFA_PRE_AUTH_TTL_MINUTES = 5; // same window as the admin flow (AdminAuthService)

export interface TokenPair {
  accessToken: string;
  sessionId: string;
  refreshToken: string;
}

export interface MfaStepRequired {
  preAuthToken: string;
  mfaEnrolled: boolean;
}

interface SellerPreAuthPayload {
  sub: string;
  type: "seller_pre_auth";
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
    private readonly events: EventsService,
    private readonly sellerAgreement: SellerAgreementService,
    private readonly riskScore: RiskScoreService,
    private readonly subscriptionAbuse: SubscriptionAbuseService,
    private readonly subscriptions: SubscriptionsService,
    private readonly referralAttribution: ReferralAttributionService,
  ) {}

  async signup(dto: SignupDto, ip: string): Promise<{ userId: string } | { waitlisted: true }> {
    const limit = await this.settings.resolve<number>("auth.signup_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`signup:${ip}`, limit);

    const role = dto.role ?? "seller";

    // New (v0.41, founder request) - "pause new subscriptions" mode, a
    // narrower kill-switch than platform-wide maintenance mode: blocks
    // only a NEW seller signup, never a supplier (a supplier isn't a
    // "new subscription" in the sense the founder means), and never an
    // existing seller doing anything else.
    if (role === "seller") {
      const paused = await this.settings.resolve<boolean>("billing.new_subscriptions_paused");
      if (paused) {
        const message = await this.settings.resolve<string>("billing.new_subscriptions_paused_message");
        throw new ServiceUnavailableException(message);
      }
    }

    // SRS §5.25/FR-25.5 - checked before anything else touches the `users`
    // table: a blocked country never learns whether dto.email already has
    // an account, and no User/Seller row is ever created for it. Scoped to
    // sellers only, same as FR-25.6/25.7 - buyer-side access (no accounts
    // exist yet, FR-22.1) and supplier signup are never regionally gated.
    if (role === "seller") {
      const country = dto.country ?? "PK";
      const allowedCountries = await this.settings.resolve<string[]>("auth.seller_signup_allowed_countries");
      if (!allowedCountries.includes(country)) {
        await this.prisma.sellerSignupWaitlist.create({ data: { email: dto.email, country } });
        return { waitlisted: true };
      }
    }

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
        roleFlags: [role],
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60_000),
        ...(role === "supplier"
          ? { supplier: { create: { businessName: dto.businessName } } }
          : { seller: { create: { businessName: dto.businessName } } }),
      },
      include: { seller: true, supplier: true },
    });

    const verifyUrl = `${this.config.getOrThrow<string>("APP_BASE_URL")}/verify-email?token=${token}`;
    await this.email.sendVerificationEmail(user.email, verifyUrl);

    // SRS §3.11/FR-26.5 - after the signup itself has succeeded (non-blocking, FR-26.3).
    // Module 8 (FR-3.1) - `supplier.signup` is a new eventType, no schema
    // change needed (platform_events.event_type is a free-form string).
    await this.events.emit(
      role === "supplier"
        ? {
            eventType: "supplier.signup",
            actorType: "supplier",
            actorId: user.supplier!.id,
            entityType: "supplier",
            entityId: user.supplier!.id,
          }
        : {
            eventType: "seller.signup",
            actorType: "seller",
            actorId: user.seller!.id,
            entityType: "seller",
            entityId: user.seller!.id,
          },
    );

    // Module 12 (SRS §5.30/FR-30.5) - the same user_security_events table
    // FR-25.3 already uses, a new "signup" event type, capturing whatever
    // device fingerprint the client supplied (a risk-score input only).
    await this.securityEvents.record(user.id, "signup", ip, dto.deviceFingerprint);

    // SRS §5.33/FR-33.1 - captured once here, regardless of role, since
    // this is the only moment it can ever be recorded (unbackfillable).
    const referralSource = resolveReferralSource(dto.referralCode);

    if (role === "seller") {
      // SRS §5.29/FR-29.1 - SignupDto.agreementAccepted is already validated
      // `=== true` before this point; recording acceptance here is what
      // makes "must accept at signup" real, not merely a client-side check.
      await this.sellerAgreement.accept(user.seller!.id, ip);
      // SRS §5.30/FR-30.5 - computed once, at activation; re-evaluated
      // later whenever a scored input changes (CNIC saved, a payment
      // instrument's name-consistency result).
      await this.riskScore.computeAtSignup(user.seller!.id, ip, dto.deviceFingerprint);
      // SRS §5.6k/FR-6.48 (Module 71) - trigger 1: phone/device-cluster
      // signals are available now, before the discounted first cycle is
      // ever paid.
      await this.subscriptionAbuse.checkAtSignup(user.seller!.id, ip, dto.deviceFingerprint);
      // SRS §5.7/FR-7.1/7.3 (v0.33) - every seller starts on First Month
      // (individual, tier 0): a real, paid first billing cycle, not a Free
      // Plan - see subscriptions.service.ts's own note.
      await this.subscriptions.assignEntryTierAtSignup(user.seller!.id, referralSource);
      // SRS §5.33 FR-33.3 - resolves the just-captured referralSource
      // against an approved program participant's referral code, if any;
      // a no-op (never throws, never blocks signup) if null/invalid/
      // unmatched, same discipline as resolveReferralSource() itself.
      await this.referralAttribution.tryAttribute(user.seller!.id, referralSource);
    } else if (role === "supplier") {
      // Module 20 (SRS FR-7.10 supplement) - a supplier now gets a real
      // plan assignment too, closing the gap Module 14 documented as
      // deferred ("Subscription is seller-only... for the same reason").
      await this.subscriptions.assignFreeSupplierPlanAtSignup(user.supplier!.id, referralSource);
    }

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

  async login(dto: LoginDto, ip: string, userAgent: string | undefined): Promise<TokenPair | MfaStepRequired> {
    // Module 21 (§14.12 rate-limit audit) - signup/password-reset already
    // used RateLimitService (see this module's own comment in
    // app.module.ts: "auth-specific limits use RateLimitService"); login
    // was the one auth endpoint that never got it, relying only on the
    // generic 100/min API-wide ThrottlerGuard. Dual-keyed (account + IP),
    // same shape as password-reset's own FR-25.2 limiting - checked before
    // the bcrypt compare so a lockout doesn't burn compute on every attempt.
    const loginLimit = await this.settings.resolve<number>("auth.login_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`login:${dto.email}`, loginLimit);
    await this.rateLimit.enforcePerHour(`login-ip:${ip}`, loginLimit);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { seller: true, supplier: true },
    });

    if (!user || !user.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    // SRS §5.25/FR-25.6 - already-enrolled always steps through the code
    // (regardless of enforcement mode); an unenrolled seller only steps
    // through it when the mode is `required_always`. Scoped to sellers
    // only, per FR-25.6's text - suppliers/admins are unaffected.
    const needsMfaStep = user.mfaSecret
      ? true
      : user.seller
        ? (await this.settings.resolve<string>("auth.seller_mfa_enforcement", { sellerId: user.seller.id })) ===
          "required_always"
        : false;

    if (needsMfaStep) {
      return {
        preAuthToken: this.signSellerPreAuthToken(user.id),
        mfaEnrolled: !!user.mfaSecret,
      };
    }

    return this.issueTokens(user.id, { sellerId: user.seller?.id, supplierId: user.supplier?.id }, ip, userAgent);
  }

  /** SRS §5.25/FR-25.6 - reached mid-login (via the pre-auth token), when login() itself already determined 2FA is required. */
  async beginMfaEnrollment(preAuthToken: string): Promise<{ secret: string; otpauthUrl: string }> {
    const payload = this.verifySellerPreAuthToken(preAuthToken);
    return this.generateMfaSecret(payload.sub);
  }

  /** SRS §5.25/FR-25.6 - the *voluntary* enrollment path: a seller who is already fully logged in (enforcement is `optional`, nothing forced them into it) can still choose to turn 2FA on from their dashboard. Same underlying mechanism, no separate preAuthToken needed since they're already authenticated. */
  async enrollMfaForAuthenticatedUser(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    return this.generateMfaSecret(userId);
  }

  /** Confirms a voluntary enrollment (see enrollMfaForAuthenticatedUser) - the seller stays logged in on their current session; no new tokens are issued. */
  async confirmMfaEnrollmentForAuthenticatedUser(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecret) {
      throw new BadRequestException("Start enrollment first before verifying a code.");
    }
    if (!authenticator.check(code, user.mfaSecret)) {
      throw new UnauthorizedException("Invalid MFA code.");
    }
    if (!user.mfaEnabled) {
      await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    }
  }

  private async generateMfaSecret(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaSecret: secret } });

    // Reuses the admin issuer name - it's the platform's own name shown in
    // an authenticator app, the same regardless of which role enrolled.
    const otpauthUrl = authenticator.keyuri(user.email, this.config.getOrThrow<string>("ADMIN_MFA_ISSUER_NAME"), secret);
    return { secret, otpauthUrl };
  }

  /** SRS §5.25/FR-25.6 - verifies the TOTP code and completes login, same shape as AdminAuthService.verifyMfaAndIssueSession(). */
  async verifyMfaAndIssueSession(
    preAuthToken: string,
    code: string,
    ip: string,
    userAgent: string | undefined,
  ): Promise<TokenPair> {
    const payload = this.verifySellerPreAuthToken(preAuthToken);

    // Phase B pre-launch audit finding - a 6-digit TOTP code is a genuinely
    // guessable space; rate-limit the verify attempt itself, dual-keyed
    // (account + IP) the same as login, before ever calling authenticator.check.
    const mfaVerifyLimit = await this.settings.resolve<number>("auth.mfa_verify_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`mfa-verify:${payload.sub}`, mfaVerifyLimit);
    await this.rateLimit.enforcePerHour(`mfa-verify-ip:${ip}`, mfaVerifyLimit);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      include: { seller: true, supplier: true },
    });

    if (!user.mfaSecret) {
      throw new BadRequestException("MFA has not been enrolled for this account yet.");
    }
    if (!authenticator.check(code, user.mfaSecret)) {
      throw new UnauthorizedException("Invalid MFA code.");
    }
    if (!user.mfaEnabled) {
      await this.prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
    }

    return this.issueTokens(
      user.id,
      { sellerId: user.seller?.id, supplierId: user.supplier?.id, mfaVerified: true },
      ip,
      userAgent,
    );
  }

  async refresh(sessionId: string, refreshToken: string): Promise<TokenPair> {
    const userId = await this.sessions.validateRefreshToken(sessionId, refreshToken);
    if (!userId) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }
    // Carries the same device identity forward across rotation - this is
    // the SAME session continuing, not a new device (SRS FR-25.7).
    const deviceInfo = await this.sessions.getDeviceInfo(sessionId);
    await this.sessions.touchSession(sessionId);
    // Destroy the old session and issue a new one (refresh-token rotation).
    await this.sessions.destroySession(sessionId);

    const [seller, supplier] = await Promise.all([
      this.prisma.seller.findUnique({ where: { userId } }),
      this.prisma.supplier.findUnique({ where: { userId } }),
    ]);
    return this.issueTokens(
      userId,
      { sellerId: seller?.id, supplierId: supplier?.id },
      deviceInfo?.ipAddress,
      undefined,
      deviceInfo?.deviceLabel,
    );
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

  private async issueTokens(
    userId: string,
    extra: Partial<JwtAccessPayload>,
    ip?: string,
    userAgent?: string,
    deviceLabelOverride?: string,
  ): Promise<TokenPair> {
    // SRS §5.25/FR-25.7 - scoped to sellers only (the FR's literal text);
    // a seller-scope override represents a purchased extra-device-slot
    // add-on, resolved with the usual seller > plan > global precedence.
    if (extra.sellerId) {
      const maxDevices = await this.settings.resolve<number>("auth.max_concurrent_devices", {
        sellerId: extra.sellerId,
      });
      const activeCount = await this.sessions.countActiveSessions(userId);
      if (activeCount >= maxDevices) {
        throw new ForbiddenException(
          `Device limit reached (${maxDevices}) - revoke a session from your dashboard first.`,
        );
      }
    }

    const deviceLabel = deviceLabelOverride ?? labelDevice(userAgent);
    const { sessionId, refreshToken } = await this.sessions.createSession(userId, deviceLabel, ip ?? "unknown");
    const accessToken = this.jwt.sign(
      { sub: userId, ...extra } satisfies JwtAccessPayload,
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: `${this.config.getOrThrow<number>("JWT_ACCESS_TTL_MINUTES")}m`,
      },
    );
    return { accessToken, sessionId, refreshToken };
  }

  private signSellerPreAuthToken(userId: string): string {
    return this.jwt.sign(
      { sub: userId, type: "seller_pre_auth" } satisfies SellerPreAuthPayload,
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: `${MFA_PRE_AUTH_TTL_MINUTES}m`,
      },
    );
  }

  private verifySellerPreAuthToken(token: string): SellerPreAuthPayload {
    try {
      const payload = this.jwt.verify<SellerPreAuthPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
      if (payload.type !== "seller_pre_auth") throw new Error("wrong token type");
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired pre-auth token.");
    }
  }
}
