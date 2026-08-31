/**
 * SRS §5.52/FR-52.11 - a derived read over the existing Platform Event
 * Log (StaffAuditInterceptor's `staff_account.action` events), not a new
 * write path. Maps a request path to the coarse resource it touched and
 * an HTTP method to a plain-language verb, purely for display.
 */
const RESOURCE_PATTERNS: { pattern: RegExp; resource: string }[] = [
  { pattern: /\/products\//, resource: "products" },
  { pattern: /\/products$/, resource: "products" },
  { pattern: /\/orders\/.*\/tracking/, resource: "tracking" },
  { pattern: /\/orders\/.*\/status/, resource: "orders" },
  { pattern: /\/orders\/.*\/notes/, resource: "order notes" },
  { pattern: /\/orders/, resource: "orders" },
  { pattern: /\/discount-codes|\/discounts/, resource: "discounts" },
  { pattern: /\/customers/, resource: "customers" },
  { pattern: /\/theme-settings|\/branding|\/customizer/, resource: "store design" },
  { pattern: /\/campaigns/, resource: "campaigns" },
  { pattern: /\/customer-segments/, resource: "customer segments" },
  { pattern: /\/gift-cards/, resource: "gift cards" },
  { pattern: /\/whatsapp/, resource: "WhatsApp messages" },
  { pattern: /\/deals/, resource: "deals" },
  { pattern: /\/reviews/, resource: "reviews" },
  { pattern: /\/supplier-links|\/listing-reviews/, resource: "suppliers" },
];

export function resourceForPath(path: string): string {
  const match = RESOURCE_PATTERNS.find((r) => r.pattern.test(path));
  return match?.resource ?? "the store";
}

const VERB_BY_METHOD: Record<string, string> = {
  POST: "added",
  PATCH: "edited",
  PUT: "edited",
  DELETE: "removed",
};

export function verbForMethod(method: string): string {
  return VERB_BY_METHOD[method] ?? "updated";
}

export interface StaffActivityEntry {
  staffAccountId: string;
  staffName: string;
  date: string;
  resource: string;
  verb: string;
  count: number;
  summary: string;
}

/** Groups raw {method, path, staffAccountId, createdAt} events into "Ahmed edited 5 products today" style entries. */
export function summarizeStaffActivity(
  events: { staffAccountId: string; method: string; path: string; createdAt: Date }[],
  staffNames: Map<string, string>,
): StaffActivityEntry[] {
  const groups = new Map<string, { staffAccountId: string; date: string; resource: string; verb: string; count: number }>();

  for (const event of events) {
    const date = event.createdAt.toISOString().slice(0, 10);
    const resource = resourceForPath(event.path);
    const verb = verbForMethod(event.method);
    const key = `${event.staffAccountId}|${date}|${resource}|${verb}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { staffAccountId: event.staffAccountId, date, resource, verb, count: 1 });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  return [...groups.values()]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((g) => {
      const staffName = staffNames.get(g.staffAccountId) ?? "A staff member";
      const dateLabel = g.date === today ? "today" : g.date;
      return {
        staffAccountId: g.staffAccountId,
        staffName,
        date: g.date,
        resource: g.resource,
        verb: g.verb,
        count: g.count,
        summary: `${staffName} ${g.verb} ${g.count} ${g.resource} ${dateLabel}`,
      };
    });
}
