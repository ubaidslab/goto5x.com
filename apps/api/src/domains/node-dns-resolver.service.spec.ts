import { promises as dns } from "dns";
import { NodeDnsResolverService } from "./node-dns-resolver.service";

/**
 * Founder item 6 (D99, 2026-10-11) - rewritten from real DNS queries
 * against the live internet to a mocked `dns.promises` module. The real-
 * network version depended on this environment having outbound DNS
 * reachability, which isn't guaranteed everywhere this suite runs (this
 * sandbox's own container can't reach 8.8.8.8/github.com over raw DNS,
 * confirmed directly) - exactly the flake item 6 flagged. What's actually
 * under test is this service's own try/catch-into-[] wrapping around
 * Node's resolver, not Node's resolver itself or any real hostname's DNS
 * records, so a mock proves the same contract without it.
 */
jest.mock("dns", () => ({
  promises: { resolveCname: jest.fn(), resolve4: jest.fn() },
}));

describe("NodeDnsResolverService (mocked dns.promises)", () => {
  const resolver = new NodeDnsResolverService();
  const mockedResolve4 = dns.resolve4 as jest.Mock;
  const mockedResolveCname = dns.resolveCname as jest.Mock;

  afterEach(() => {
    mockedResolve4.mockReset();
    mockedResolveCname.mockReset();
  });

  it("returns dns.resolve4()'s A records as-is", async () => {
    mockedResolve4.mockResolvedValue(["8.8.8.8"]);
    await expect(resolver.resolve4("dns.google")).resolves.toEqual(["8.8.8.8"]);
    expect(mockedResolve4).toHaveBeenCalledWith("dns.google");
  });

  it("returns dns.resolveCname()'s CNAME records as-is", async () => {
    mockedResolveCname.mockResolvedValue(["github.com"]);
    await expect(resolver.resolveCname("www.github.com")).resolves.toEqual(["github.com"]);
    expect(mockedResolveCname).toHaveBeenCalledWith("www.github.com");
  });

  it("returns an empty array (not a throw) when resolve4 rejects (e.g. ENOTFOUND for a nonexistent domain)", async () => {
    mockedResolve4.mockRejectedValue(Object.assign(new Error("queryA ENOTFOUND"), { code: "ENOTFOUND" }));
    await expect(resolver.resolve4("this-domain-absolutely-does-not-exist-uzeyn-12345.invalid")).resolves.toEqual([]);
  });

  it("returns an empty array (not a throw) when resolveCname rejects (e.g. ENODATA for an A-record-only host)", async () => {
    // dns.google has an A record, not a CNAME - resolving CNAME on an
    // A-record-only host is a real, correctly-handled "no such record"
    // case (Node rejects with ENODATA), not an error this wrapper surfaces.
    mockedResolveCname.mockRejectedValue(Object.assign(new Error("queryCname ENODATA"), { code: "ENODATA" }));
    await expect(resolver.resolveCname("dns.google")).resolves.toEqual([]);
  });
});
