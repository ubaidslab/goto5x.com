import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { JwtAccessPayload } from "../common/types";
import { EventsService } from "../events/events.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { StaffLoginDto } from "./dto/staff-login.dto";

/**
 * SRS §5.52/FR-52.3. A staff account logs in with its own credentials,
 * separate from the owner's - modeled on AdminAuthService's shape, minus
 * MFA (not required by FR-52.x). Issues a JWT carrying sellerId = the
 * OWNER's seller id (so every existing @CurrentSellerId()-based
 * controller/service and RLS resolve tenant scope correctly with zero
 * changes - same precedent as AdminImpersonationService.start()) plus
 * staffAccountId/scopes, which is what StaffScopeGuard keys off of.
 */
@Injectable()
export class StaffAuthService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
    private readonly events: EventsService,
  ) {}

  async login(dto: StaffLoginDto, ip: string): Promise<{ accessToken: string }> {
    const loginLimit = await this.settings.resolve<number>("auth.login_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`staff-login:${dto.email}`, loginLimit);
    await this.rateLimit.enforcePerHour(`staff-login-ip:${ip}`, loginLimit);

    const staff = await this.prismaAdmin.staffAccount.findUnique({ where: { email: dto.email } });
    if (!staff || staff.status !== "active" || !(await bcrypt.compare(dto.password, staff.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const accessToken = this.jwt.sign(
      { sub: staff.id, sellerId: staff.sellerId, staffAccountId: staff.id, scopes: staff.scopes } satisfies JwtAccessPayload,
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: `${this.config.getOrThrow<number>("JWT_ACCESS_TTL_MINUTES")}m`,
      },
    );

    await this.events.emit({
      eventType: "staff_account.login",
      actorType: "staff",
      actorId: staff.id,
      entityType: "staff_account",
      entityId: staff.id,
      metadata: {},
    });
    return { accessToken };
  }
}
