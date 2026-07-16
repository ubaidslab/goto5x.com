import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Domain } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { DNS_RESOLVER, IDnsResolver } from "./dns-resolver.interface";
import { TLS_PROBER, ITlsProber } from "./tls-prober.interface";
import { TraefikDynamicConfigService } from "./traefik-dynamic-config.service";

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, ""); // trailing dot is a valid, common DNS response quirk
}

/**
 * Orchestrates FR-11.2: DNS verification -> Traefik dynamic-config write
 * (which is what makes Traefik's own ACME flow issue a certificate,
 * docs/tech-stack.md) -> a real TLS probe confirming issuance actually
 * completed. Runs identically whether triggered on-demand (DomainsController)
 * or by the scheduled worker job (worker.main.ts) - both call verifyDomain()
 * with no seller session in scope, hence PrismaAdminService here too.
 */
@Injectable()
export class DomainVerificationService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    @Inject(DNS_RESOLVER) private readonly dnsResolver: IDnsResolver,
    @Inject(TLS_PROBER) private readonly tlsProber: ITlsProber,
    private readonly traefikConfig: TraefikDynamicConfigService,
  ) {}

  async verifyDomain(domainId: string): Promise<Domain> {
    const domain = await this.prismaAdmin.domain.findUnique({ where: { id: domainId } });
    if (!domain) throw new NotFoundException("Domain not found.");

    const dnsVerified = await this.checkDns(domain.domainName);

    if (dnsVerified) {
      if (domain.verificationStatus !== "verified") {
        // Written before the DB update, deliberately: if this throws, the DB
        // never records "verified" for a domain Traefik doesn't actually
        // know about yet - the next scheduled recheck retries both together.
        await this.traefikConfig.writeRouterConfig(domain.domainName);
      }
      const updated = await this.prismaAdmin.domain.update({
        where: { id: domainId },
        data: { verificationStatus: "verified", verifiedAt: domain.verifiedAt ?? new Date() },
      });
      return this.maybeProbeTls(updated);
    }

    if (domain.verificationStatus !== "verified") {
      return this.prismaAdmin.domain.update({ where: { id: domainId }, data: { verificationStatus: "failed" } });
    }
    // Already verified and DNS still matches at the time of a later recheck
    // - v1.0 deliberately does not downgrade a verified domain if a later
    // check fails (e.g. a transient resolver hiccup); a seller actively
    // breaking their own DNS after verifying is an edge case out of scope
    // for this module, same lean-scope discipline as other v1.0 boundaries.
    return this.maybeProbeTls(domain);
  }

  /** Batch entrypoint for the scheduled worker job - one bad domain must not block the rest (same isolation pattern as Module 2's per-file Drive import). */
  async recheckOutstandingDomains(): Promise<{ checked: number; failures: { domainId: string; reason: string }[] }> {
    const outstanding = await this.prismaAdmin.domain.findMany({
      where: {
        OR: [
          { verificationStatus: { in: ["pending", "failed"] } },
          { verificationStatus: "verified", tlsStatus: "pending" },
        ],
      },
    });

    const failures: { domainId: string; reason: string }[] = [];
    for (const domain of outstanding) {
      try {
        await this.verifyDomain(domain.id);
      } catch (err) {
        failures.push({ domainId: domain.id, reason: err instanceof Error ? err.message : "unknown error" });
      }
    }
    return { checked: outstanding.length, failures };
  }

  private async checkDns(domainName: string): Promise<boolean> {
    const [expectedCname, expectedIp] = await Promise.all([
      this.settings.resolve<string>("domains.cname_target"),
      this.settings.resolve<string>("domains.a_record_ip"),
    ]);

    const [cnames, ips] = await Promise.all([
      this.dnsResolver.resolveCname(domainName),
      this.dnsResolver.resolve4(domainName),
    ]);

    const cnameMatches = cnames.some((c) => normalizeHostname(c) === normalizeHostname(expectedCname));
    const ipMatches = ips.includes(expectedIp);
    return cnameMatches || ipMatches;
  }

  private async maybeProbeTls(domain: Domain): Promise<Domain> {
    if (domain.tlsStatus === "issued") return domain;
    const tlsWorks = await this.tlsProber.probe(domain.domainName);
    if (!tlsWorks) return domain;
    return this.prismaAdmin.domain.update({ where: { id: domain.id }, data: { tlsStatus: "issued" } });
  }
}
