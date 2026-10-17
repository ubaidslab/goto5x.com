import disposableDomains from "disposable-email-domains";
import disposableWildcardSuffixes from "disposable-email-domains/wildcard.json";

/**
 * D116 item 5 (Stage 0) - "disposable-email block." A maintained, regularly
 * updated public list (121k+ domains) rather than a hand-rolled one, which
 * would just go stale - the npm-registry copy was last published days
 * before this was written. `wildcard.json` additionally covers domains
 * whose every subdomain is disposable (e.g. a throwaway-mail provider that
 * issues one subdomain per inbox).
 */
const DISPOSABLE_DOMAINS = new Set<string>(disposableDomains as string[]);
const WILDCARD_SUFFIXES = disposableWildcardSuffixes as string[];

export function isDisposableEmailDomain(email: string): boolean {
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) return false;
  const domain = email.slice(atIndex + 1).toLowerCase().trim();
  if (domain.length === 0) return false;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  return WILDCARD_SUFFIXES.some((suffix) => domain === suffix || domain.endsWith(`.${suffix}`));
}
