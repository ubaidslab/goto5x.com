import { DomainVerificationService } from "./domain-verification.service";
import { IDnsResolver } from "./dns-resolver.interface";
import { ITlsProber } from "./tls-prober.interface";

/**
 * Orchestration logic only - real DNS/TLS/filesystem behavior is proven by
 * node-dns-resolver.service.spec.ts, node-tls-prober.service.spec.ts, and
 * traefik-dynamic-config.service.spec.ts respectively. This proves the
 * state-machine (pending/failed/verified, tls pending/issued) is correct
 * independent of any of those real integrations succeeding or failing.
 */
describe("DomainVerificationService", () => {
  function buildHarness(initialDomain: {
    id: string;
    domainName: string;
    verificationStatus: "pending" | "verified" | "failed";
    tlsStatus: "pending" | "issued" | "error";
    verifiedAt: Date | null;
  }) {
    const domains = new Map([[initialDomain.id, { ...initialDomain }]]);
    const prismaAdmin = {
      domain: {
        findUnique: jest.fn().mockImplementation(async ({ where: { id } }: any) => domains.get(id) ?? null),
        findMany: jest.fn().mockImplementation(async ({ where }: any) => {
          return [...domains.values()].filter((d) => {
            const orClauses = where.OR as any[];
            return orClauses.some((clause) => {
              if (clause.verificationStatus?.in) return clause.verificationStatus.in.includes(d.verificationStatus);
              if (clause.verificationStatus && clause.tlsStatus) {
                return d.verificationStatus === clause.verificationStatus && d.tlsStatus === clause.tlsStatus;
              }
              return false;
            });
          });
        }),
        update: jest.fn().mockImplementation(async ({ where: { id }, data }: any) => {
          const existing = domains.get(id)!;
          const updated = { ...existing, ...data };
          domains.set(id, updated);
          return updated;
        }),
      },
    };

    const settingsValues: Record<string, unknown> = {
      "domains.cname_target": "stores.goto5x.com",
      "domains.a_record_ip": "127.0.0.1",
    };
    const settings = { resolve: jest.fn().mockImplementation(async (key: string) => settingsValues[key]) };

    const dnsResolver: jest.Mocked<IDnsResolver> = {
      resolveCname: jest.fn().mockResolvedValue([]),
      resolve4: jest.fn().mockResolvedValue([]),
    };
    const tlsProber: jest.Mocked<ITlsProber> = { probe: jest.fn().mockResolvedValue(false) };
    const traefikConfig = { writeRouterConfig: jest.fn().mockResolvedValue(undefined), removeRouterConfig: jest.fn() };
    const events = { emit: jest.fn().mockResolvedValue(undefined) };

    const service = new DomainVerificationService(
      prismaAdmin as any,
      settings as any,
      dnsResolver,
      tlsProber,
      traefikConfig as any,
      events as any,
    );
    return { service, prismaAdmin, dnsResolver, tlsProber, traefikConfig, events, domains };
  }

  it("moves pending -> verified when the CNAME matches the configured target, and writes the Traefik config", async () => {
    const { service, dnsResolver, traefikConfig, events } = buildHarness({
      id: "d1",
      domainName: "shop.example.com",
      verificationStatus: "pending",
      tlsStatus: "pending",
      verifiedAt: null,
    });
    dnsResolver.resolveCname.mockResolvedValue(["stores.goto5x.com"]);

    const result = await service.verifyDomain("d1");

    expect(result.verificationStatus).toBe("verified");
    expect(result.verifiedAt).toBeInstanceOf(Date);
    expect(traefikConfig.writeRouterConfig).toHaveBeenCalledWith("shop.example.com");
    // SRS §3.11/FR-26.5 - emitted on the transition to verified.
    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "domain.verified", entityId: "d1" }),
    );
  });

  it("moves pending -> verified when the A record matches the configured IP (apex domain path)", async () => {
    const { service, dnsResolver } = buildHarness({
      id: "d1",
      domainName: "apex.example.com",
      verificationStatus: "pending",
      tlsStatus: "pending",
      verifiedAt: null,
    });
    dnsResolver.resolve4.mockResolvedValue(["127.0.0.1"]);

    const result = await service.verifyDomain("d1");
    expect(result.verificationStatus).toBe("verified");
  });

  it("moves pending -> failed when neither CNAME nor A record match", async () => {
    const { service } = buildHarness({
      id: "d1",
      domainName: "shop.example.com",
      verificationStatus: "pending",
      tlsStatus: "pending",
      verifiedAt: null,
    });

    const result = await service.verifyDomain("d1");
    expect(result.verificationStatus).toBe("failed");
  });

  it("does not write a Traefik config again for a domain that is already verified (no-op on the file, still probes TLS)", async () => {
    const { service, dnsResolver, traefikConfig, tlsProber, events } = buildHarness({
      id: "d1",
      domainName: "shop.example.com",
      verificationStatus: "verified",
      tlsStatus: "pending",
      verifiedAt: new Date("2026-01-01"),
    });
    dnsResolver.resolveCname.mockResolvedValue(["stores.goto5x.com"]);
    tlsProber.probe.mockResolvedValue(true);

    const result = await service.verifyDomain("d1");

    expect(traefikConfig.writeRouterConfig).not.toHaveBeenCalled();
    expect(result.tlsStatus).toBe("issued");
    // Already verified before this call - no duplicate domain.verified event.
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("does not downgrade an already-verified domain when a later check doesn't match (lean v1.0 scope, documented)", async () => {
    const { service } = buildHarness({
      id: "d1",
      domainName: "shop.example.com",
      verificationStatus: "verified",
      tlsStatus: "issued",
      verifiedAt: new Date("2026-01-01"),
    });
    // dnsResolver returns nothing matching this time (transient hiccup)

    const result = await service.verifyDomain("d1");
    expect(result.verificationStatus).toBe("verified");
  });

  it("never re-probes TLS once issued", async () => {
    const { service, tlsProber } = buildHarness({
      id: "d1",
      domainName: "shop.example.com",
      verificationStatus: "verified",
      tlsStatus: "issued",
      verifiedAt: new Date("2026-01-01"),
    });

    await service.verifyDomain("d1");
    expect(tlsProber.probe).not.toHaveBeenCalled();
  });

  it("recheckOutstandingDomains processes pending/failed/tls-pending domains and isolates a per-domain failure", async () => {
    const { service, prismaAdmin, dnsResolver } = buildHarness({
      id: "d1",
      domainName: "good.example.com",
      verificationStatus: "pending",
      tlsStatus: "pending",
      verifiedAt: null,
    });
    // A second domain that will throw when looked up mid-batch, proving
    // isolation - same discipline as Module 2's per-file Drive import errors.
    prismaAdmin.domain.findMany.mockResolvedValueOnce([
      { id: "d1", domainName: "good.example.com", verificationStatus: "pending", tlsStatus: "pending" },
      { id: "d2", domainName: "broken.example.com", verificationStatus: "failed", tlsStatus: "pending" },
    ]);
    prismaAdmin.domain.findUnique.mockImplementation(async ({ where: { id } }: any) => {
      if (id === "d2") throw new Error("simulated lookup failure");
      return { id: "d1", domainName: "good.example.com", verificationStatus: "pending", tlsStatus: "pending", verifiedAt: null };
    });
    dnsResolver.resolveCname.mockResolvedValue(["stores.goto5x.com"]);

    const result = await service.recheckOutstandingDomains();

    expect(result.checked).toBe(2);
    expect(result.failures).toEqual([{ domainId: "d2", reason: "simulated lookup failure" }]);
  });
});
