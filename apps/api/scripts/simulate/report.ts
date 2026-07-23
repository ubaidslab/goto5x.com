import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { Metrics } from "./api-client";
import { RunManifest, readManifest } from "./manifest";
import { summarizeLatencies } from "./stats";

const REPORTS_DIR = path.join(__dirname, "reports");

function reportPath(runId: string): string {
  return path.join(REPORTS_DIR, `${runId}.txt`);
}

export function writeReport(runId: string, report: string): string {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const file = reportPath(runId);
  fs.writeFileSync(file, report);
  return file;
}

/**
 * Module 21 - two concrete invariants, not a vague "check the data looks
 * right": (1) no confirmed order ever produced more than one
 * `commission_accrued` ledger entry - if concurrent traffic somehow caused
 * a double mark-as-paid to double-debit a wallet, this catches it; (2) no
 * order/product ever references another store's data - a live, load-bearing
 * proof of tenant isolation, not just a design claim.
 */
async function checkInvariants(admin: PrismaClient): Promise<string[]> {
  const violations: string[] = [];

  const duplicateCommissionEntries = await admin.$queryRaw<{ order_id: string; entry_count: bigint }[]>`
    SELECT order_id, COUNT(*) AS entry_count
    FROM ledger_entries
    WHERE type = 'commission_accrued' AND order_id IS NOT NULL
    GROUP BY order_id
    HAVING COUNT(*) > 1
  `;
  for (const row of duplicateCommissionEntries) {
    violations.push(`WALLET: order ${row.order_id} has ${row.entry_count} commission_accrued ledger entries (expected exactly 1).`);
  }

  const crossTenantOrderItems = await admin.$queryRaw<{ order_id: string; order_store: string; product_store: string }[]>`
    SELECT oi.order_id, o.store_id AS order_store, p.store_id AS product_store
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.store_id <> p.store_id
  `;
  for (const row of crossTenantOrderItems) {
    violations.push(
      `CROSS-TENANT: order ${row.order_id} (store ${row.order_store}) has a line item referencing product from a DIFFERENT store (${row.product_store}).`,
    );
  }

  const crossTenantMedia = await admin.$queryRaw<{ media_id: string; media_store: string; product_store: string }[]>`
    SELECT m.id AS media_id, m.store_id AS media_store, p.store_id AS product_store
    FROM media_assets m
    JOIN products p ON p.id = m.product_id
    WHERE m.product_id IS NOT NULL AND m.store_id <> p.store_id
  `;
  for (const row of crossTenantMedia) {
    violations.push(`CROSS-TENANT: media asset ${row.media_id} (store ${row.media_store}) is attached to a product from a different store (${row.product_store}).`);
  }

  return violations;
}

async function slowestQueries(admin: PrismaClient): Promise<string[]> {
  try {
    const rows = await admin.$queryRaw<{ query: string; calls: bigint; mean_exec_time: number; max_exec_time: number }[]>`
      SELECT query, calls, mean_exec_time, max_exec_time
      FROM pg_stat_statements
      WHERE query NOT ILIKE '%pg_stat_statements%'
      ORDER BY mean_exec_time DESC
      LIMIT 15
    `;
    if (rows.length === 0) return ["  (pg_stat_statements returned no rows - nothing recorded yet, or the extension was just enabled.)"];
    return rows.map(
      (r, i) =>
        `  ${i + 1}. avg ${r.mean_exec_time.toFixed(1)}ms / max ${r.max_exec_time.toFixed(1)}ms / ${r.calls} calls - ${r.query.slice(0, 140).replace(/\s+/g, " ")}`,
    );
  } catch {
    return [
      "  pg_stat_statements is not enabled on this database, so slow-query data isn't available.",
      "  Enable it before the next run for this section to populate:",
      "    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;",
      "  (requires it to also be listed in postgresql.conf's shared_preload_libraries and a restart - see docs/launch-runbook.md.)",
    ];
  }
}

export async function generateReport(runId: string, metrics: Metrics, manifest: RunManifest): Promise<string> {
  const admin = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_ADMIN_URL } } });

  const lines: string[] = [];
  lines.push("=".repeat(72));
  lines.push(`Load/Soak Simulation Report - run "${runId}"`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Sellers/stores in this run: ${manifest.sellers.length}`);
  lines.push("=".repeat(72));

  lines.push("");
  lines.push("-- Requests & errors --");
  const errorsByType = new Map<string, number>();
  for (const s of metrics.samples) {
    if (!s.ok) errorsByType.set(s.errorType ?? "unknown", (errorsByType.get(s.errorType ?? "unknown") ?? 0) + 1);
  }
  lines.push(`Total requests: ${metrics.samples.length}`);
  lines.push(`Total errors:   ${metrics.samples.filter((s) => !s.ok).length}`);
  if (errorsByType.size > 0) {
    lines.push("Errors by type:");
    for (const [type, count] of [...errorsByType].sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${type}: ${count}`);
    }
  } else {
    lines.push("Errors by type: none");
  }

  lines.push("");
  lines.push("-- Latency per endpoint group (ms) --");
  lines.push(`${"group".padEnd(32)} ${"count".padStart(8)} ${"p50".padStart(8)} ${"p95".padStart(8)} ${"p99".padStart(8)} ${"max".padStart(8)}`);
  for (const group of metrics.groups()) {
    const durations = metrics.samples.filter((s) => s.group === group).map((s) => s.durationMs);
    const summary = summarizeLatencies(durations);
    lines.push(
      `${group.padEnd(32)} ${String(summary.count).padStart(8)} ${String(summary.p50).padStart(8)} ${String(summary.p95).padStart(8)} ${String(summary.p99).padStart(8)} ${String(summary.max).padStart(8)}`,
    );
  }

  lines.push("");
  lines.push("-- Slowest DB queries (pg_stat_statements) --");
  lines.push(...(await slowestQueries(admin)));

  lines.push("");
  lines.push("-- Invariant checks --");
  const violations = await checkInvariants(admin);
  if (violations.length === 0) {
    lines.push("  No violations found (wallet ledger consistency, cross-tenant isolation).");
  } else {
    lines.push(`  ${violations.length} VIOLATION(S) FOUND:`);
    for (const v of violations) lines.push(`  - ${v}`);
  }

  lines.push("");
  lines.push("=".repeat(72));

  await admin.$disconnect();
  return lines.join("\n");
}

export async function main() {
  const argv = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  const runId = get("--run");
  if (!runId) throw new Error('Missing required --run <runId>.');

  const manifest = readManifest(runId);
  // Standalone `report` (as opposed to the report traffic.ts prints
  // automatically at the end of a run) has no in-memory samples to work
  // from - it re-runs only the DB-backed sections (slow queries,
  // invariants), which is still the most valuable part to re-check on
  // demand.
  const report = await generateReport(runId, new Metrics(), manifest);
  const file = writeReport(runId, report);
  console.log(report);
  console.log(`\nReport written to ${file}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
