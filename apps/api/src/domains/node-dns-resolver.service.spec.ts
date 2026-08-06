import { NodeDnsResolverService } from "./node-dns-resolver.service";

/**
 * Real DNS queries against the live public internet - verified reachable in
 * this sandbox (unlike Google's OAuth APIs, see google-drive-client.service.ts)
 * before this file was written. Targets are well-known, extremely stable
 * public hostnames chosen specifically so this test doesn't depend on any
 * domain the founder owns - proving the resolver works for real is
 * independent of proving a specific seller's DNS is configured correctly,
 * which remains a pre-launch smoke-test item (see the Module 3 report).
 */
jest.setTimeout(15000); // real network round-trips, not mocked

describe("NodeDnsResolverService (real DNS)", () => {
  const resolver = new NodeDnsResolverService();

  it("resolves a well-known hostname's real A record", async () => {
    const ips = await resolver.resolve4("dns.google");
    expect(ips).toEqual(expect.arrayContaining(["8.8.8.8"]));
  });

  it("resolves a well-known hostname's real CNAME record", async () => {
    const cnames = await resolver.resolveCname("www.github.com");
    expect(cnames).toEqual(expect.arrayContaining(["github.com"]));
  });

  it("returns an empty array (not a throw) for a nonexistent domain", async () => {
    await expect(resolver.resolve4("this-domain-absolutely-does-not-exist-uzeyn-12345.invalid")).resolves.toEqual(
      [],
    );
    await expect(
      resolver.resolveCname("this-domain-absolutely-does-not-exist-uzeyn-12345.invalid"),
    ).resolves.toEqual([]);
  });

  it("returns an empty array for a real domain with no CNAME record (it's an A record itself)", async () => {
    // dns.google has an A record, not a CNAME - resolving CNAME on an
    // A-record-only host is a real, correctly-handled "no such record" case,
    // not an error.
    await expect(resolver.resolveCname("dns.google")).resolves.toEqual([]);
  });
});
