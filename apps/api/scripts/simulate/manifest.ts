import * as fs from "fs";
import * as path from "path";

/**
 * Module 21 - what `seed` created, so `teardown` can delete exactly that
 * (and nothing else - never a blind full-database wipe, since this tool is
 * meant to run against a real pre-launch environment that may already have
 * its own Settings Registry/plan configuration worth preserving) and so
 * `run`/`report` know which sellers/stores/tokens to drive traffic against.
 */
export interface SimulationSeller {
  userId: string;
  sellerId: string;
  email: string;
  password: string;
  storeId: string;
  storeSlug: string;
  /** Seeded deliberately low/negative to exercise the grace ladder (Module 20, FR-6.25/6.26) - most sellers are not. */
  lowBalanceScenario: boolean;
}

export interface RunManifest {
  runId: string;
  createdAt: string;
  sellers: SimulationSeller[];
}

const RUNS_DIR = path.join(__dirname, ".runs");

export function manifestPath(runId: string): string {
  return path.join(RUNS_DIR, `${runId}.json`);
}

export function writeManifest(manifest: RunManifest): void {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  fs.writeFileSync(manifestPath(manifest.runId), JSON.stringify(manifest, null, 2));
}

export function readManifest(runId: string): RunManifest {
  const file = manifestPath(runId);
  if (!fs.existsSync(file)) {
    throw new Error(`No manifest found for run "${runId}" (expected ${file}). Did you run "seed" first?`);
  }
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

export function deleteManifest(runId: string): void {
  const file = manifestPath(runId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function latestRunId(): string | null {
  if (!fs.existsSync(RUNS_DIR)) return null;
  const files = fs
    .readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return files.length > 0 ? files[files.length - 1].replace(/\.json$/, "") : null;
}
