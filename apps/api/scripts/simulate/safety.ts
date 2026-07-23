/**
 * Module 21 - the load/soak simulation tool creates and deletes bulk
 * business data (sellers, stores, orders, wallet entries) and drives real
 * traffic against a running stack. This must NEVER be runnable against a
 * production-flagged environment by accident - one missing safety net is
 * how a load test ends up creating thousands of fake orders in prod.
 *
 * "Production-flagged" = NODE_ENV=production, the same signal every other
 * part of this codebase already treats as authoritative (no new env var
 * invented for this one tool).
 */
export function assertNotProduction(argv: string[]): void {
  const isProduction = process.env.NODE_ENV === "production";
  const hasOverride = argv.includes("--i-know");

  if (isProduction && !hasOverride) {
    console.error(
      [
        "",
        "REFUSING TO RUN: NODE_ENV=production.",
        "",
        "This tool seeds/deletes bulk simulated data and drives real traffic -",
        "it must never touch a real production environment by accident.",
        "",
        "If you are ABSOLUTELY CERTAIN this is the environment you intend to",
        "run the simulation against (e.g. a dedicated pre-launch load-test",
        "environment that happens to be NODE_ENV=production), re-run with",
        "the explicit --i-know flag.",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
}
