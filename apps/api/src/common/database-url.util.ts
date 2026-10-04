/**
 * Security-checklist audit finding: neither Prisma client set an explicit
 * connection-pool size - both were left on Prisma's own undocumented-in-repo
 * default (num_cpus*2+1 per process), despite docs/tech-stack.md/
 * docs/architecture.md/docs/SRS.md all documenting a connection-pool limit
 * as "required from Phase 1." Prisma reads `connection_limit` as a query
 * parameter on the connection URL itself, not a separate client option -
 * this appends one only when the URL doesn't already specify it, so an
 * operator who has already tuned their own DATABASE_URL/DATABASE_ADMIN_URL
 * is never silently overridden.
 */
export function withConnectionLimit(url: string, defaultLimit: number): string {
  if (/[?&]connection_limit=/.test(url)) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}connection_limit=${defaultLimit}`;
}
