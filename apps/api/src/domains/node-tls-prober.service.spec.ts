import { NodeTlsProberService } from "./node-tls-prober.service";

/** Real HTTPS handshakes against the live internet - same reachability already confirmed for DNS. */
jest.setTimeout(15000);

describe("NodeTlsProberService (real TLS)", () => {
  const prober = new NodeTlsProberService();

  it("succeeds against a well-known domain with a genuinely valid, trusted certificate", async () => {
    await expect(prober.probe("www.google.com")).resolves.toBe(true);
  });

  it("fails against a hostname that doesn't resolve at all", async () => {
    await expect(prober.probe("this-domain-absolutely-does-not-exist-goto5x-12345.invalid")).resolves.toBe(false);
  });
});
