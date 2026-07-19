import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuditLogService } from "../admin/audit-log.service";
import { SettingsService } from "../settings-registry/settings.service";

const HANDOFF_TOKEN_TTL_MINUTES = 5;

/**
 * FR-24.8 - the dashboard's "Marketing" section hands the seller off to the
 * Social Media SaaS via SSO (§3.2a): a short-lived JWT signed with the same
 * JWT_ACCESS_SECRET every other seller access token already uses (the
 * "existing SSO hook" the FR calls for - not a second, separately-keyed
 * token scheme), narrowly typed so it can never be replayed as a real
 * session token against this platform's own API.
 *
 * Same "no hard dependency" discipline as FR-24.1/24.2's premium-templates
 * showcase: `social_media_saas.marketing_handoff_base_url` defaults to
 * empty, so the handoff is a documented 400 (never a silent 500 or a broken
 * link) until the founder's Social Media SaaS actually exists and this is
 * configured.
 */
@Injectable()
export class MarketingHandoffService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async createHandoffUrl(sellerId: string): Promise<{ url: string }> {
    const baseUrl = await this.settings.resolve<string>("social_media_saas.marketing_handoff_base_url");
    if (!baseUrl) {
      throw new BadRequestException("The Marketing integration isn't configured yet.");
    }

    const token = this.jwt.sign(
      { sub: sellerId, type: "social_media_saas_sso" },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: `${HANDOFF_TOKEN_TTL_MINUTES}m`,
      },
    );

    // FR-24.13 - a verifiable referral-attribution signal, recorded as a
    // system actor - one write per handoff click (a seller navigating to
    // Marketing is a low-frequency action, not per-request noise).
    await this.auditLog.record({
      adminUserId: null,
      action: "saas_referral.sso_handoff",
      targetType: "seller",
      targetId: sellerId,
      afterValue: { destination: "social_media_saas", referralAttributed: true },
    });

    const separator = baseUrl.includes("?") ? "&" : "?";
    return { url: `${baseUrl}${separator}sso_token=${token}&ref=goto5x` };
  }
}
