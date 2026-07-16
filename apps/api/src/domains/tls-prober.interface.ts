export const TLS_PROBER = Symbol("TLS_PROBER");

/**
 * Confirms a domain's TLS certificate is genuinely valid and trusted -
 * "we asked Traefik to issue a cert" and "the cert actually works" are two
 * different claims, and FR-11.2's "TLS issuance completes" means the second.
 */
export interface ITlsProber {
  probe(hostname: string): Promise<boolean>;
}
