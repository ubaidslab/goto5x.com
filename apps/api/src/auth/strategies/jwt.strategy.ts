import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaRuntimeService } from "../../prisma/prisma-runtime.service";
import { JwtAccessPayload } from "../../common/types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaRuntimeService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  // Whatever this returns becomes `request.user`.
  async validate(payload: JwtAccessPayload): Promise<JwtAccessPayload> {
    // Security-audit fix (docs/security-audit-report.md, finding #4): an
    // impersonation token's own expiry used to be the only thing that
    // stopped it working - AdminImpersonationService.end() only flagged
    // `endedAt` in the database, which nothing ever read back. Every
    // request carrying an impersonationSessionId now re-checks that the
    // session is still genuinely live (not ended, not expired) - a real
    // revocation-state lookup, not just claim presence. This runs on
    // every authenticated request but the extra query only fires for the
    // rare impersonation-token case; a normal seller/buyer/admin token
    // never has this field and skips it entirely.
    if (payload.impersonationSessionId) {
      const session = await this.prisma.impersonationSession.findUnique({
        where: { id: payload.impersonationSessionId },
        select: { endedAt: true, expiresAt: true },
      });
      if (!session || session.endedAt !== null || session.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException("This impersonation session has ended.");
      }
    }
    return payload;
  }
}
