import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { JwtAccessPayload } from "../common/types";
import { AuditLogService } from "../admin/audit-log.service";
import { AdminLoginDto } from "./dto/admin-login.dto";
import { SessionService } from "./session.service";

const PRE_AUTH_TTL_MINUTES = 5;

interface AdminPreAuthPayload {
  sub: string;
  adminUserId: string;
  type: "admin_pre_auth";
}

/**
 * Separate, more scrutinized login flow from seller/supplier auth (SRS §6.5).
 * MFA is mandatory, not optional (FR-8.12): a fully-verified admin session
 * (mfaVerified: true in the JWT) is only issued after a valid TOTP code,
 * whether that's the admin's first-ever enrollment or a returning admin's
 * regular code entry.
 */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessions: SessionService,
    private readonly auditLog: AuditLogService,
  ) {}

  async login(dto: AdminLoginDto): Promise<{ preAuthToken: string; mfaEnrolled: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { adminUser: true },
    });

    if (!user?.adminUser || !user.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const preAuthToken = this.jwt.sign(
      { sub: user.id, adminUserId: user.adminUser.id, type: "admin_pre_auth" } satisfies AdminPreAuthPayload,
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: `${PRE_AUTH_TTL_MINUTES}m`,
      },
    );

    return { preAuthToken, mfaEnrolled: user.adminUser.mfaEnabled };
  }

  /** Called with a valid preAuthToken when the admin has no TOTP secret yet. */
  async beginMfaEnrollment(preAuthToken: string): Promise<{ secret: string; otpauthUrl: string }> {
    const payload = this.verifyPreAuthToken(preAuthToken);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });

    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaSecret: secret } });

    const otpauthUrl = authenticator.keyuri(
      user.email,
      this.config.getOrThrow<string>("ADMIN_MFA_ISSUER_NAME"),
      secret,
    );
    return { secret, otpauthUrl };
  }

  /** Verifies a TOTP code and, on success, issues a fully-verified admin session. */
  async verifyMfaAndIssueSession(
    preAuthToken: string,
    code: string,
  ): Promise<{ accessToken: string; sessionId: string; refreshToken: string }> {
    const payload = this.verifyPreAuthToken(preAuthToken);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      include: { adminUser: true },
    });

    if (!user.mfaSecret) {
      throw new BadRequestException("MFA has not been enrolled for this account yet.");
    }
    if (!authenticator.check(code, user.mfaSecret)) {
      throw new UnauthorizedException("Invalid MFA code.");
    }

    if (!user.adminUser!.mfaEnabled) {
      await this.prisma.adminUser.update({ where: { id: user.adminUser!.id }, data: { mfaEnabled: true } });
    }

    await this.auditLog.record({
      adminUserId: user.adminUser!.id,
      action: "admin.login",
      targetType: "admin_user",
      targetId: user.adminUser!.id,
    });

    const { sessionId, refreshToken } = await this.sessions.createSession(user.id);
    const accessToken = this.jwt.sign(
      {
        sub: user.id,
        adminUserId: user.adminUser!.id,
        adminRole: user.adminUser!.role,
        mfaVerified: true,
      } satisfies JwtAccessPayload,
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: `${this.config.getOrThrow<number>("JWT_ACCESS_TTL_MINUTES")}m`,
      },
    );

    return { accessToken, sessionId, refreshToken };
  }

  private verifyPreAuthToken(token: string): AdminPreAuthPayload {
    try {
      const payload = this.jwt.verify<AdminPreAuthPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
      if (payload.type !== "admin_pre_auth") throw new Error("wrong token type");
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired pre-auth token.");
    }
  }
}
