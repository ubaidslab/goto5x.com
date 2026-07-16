export const DNS_RESOLVER = Symbol("DNS_RESOLVER");

/**
 * Adapter boundary (same shape as the Supplier Adapter, SRS §3.5, and
 * Module 2's IDriveClient): the real implementation makes genuine DNS
 * queries against the public internet, which this sandbox CAN reach (unlike
 * Google's OAuth APIs) - verified directly before writing this interface.
 * Tests exercise the real implementation against real, stable, well-known
 * public hostnames rather than a founder-owned test domain, which is a
 * pre-launch smoke-test item like the other disclosed gaps.
 */
export interface IDnsResolver {
  resolveCname(hostname: string): Promise<string[]>;
  resolve4(hostname: string): Promise<string[]>;
}
