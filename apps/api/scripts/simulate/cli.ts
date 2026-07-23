import { assertNotProduction } from "./safety";

/**
 * Module 21 - Load/Soak Simulation Tooling. See docs/launch-runbook.md for
 * the full pre-launch usage sequence. Every subcommand goes through the
 * same production safety net before doing anything else.
 *
 * Usage:
 *   ts-node scripts/simulate/cli.ts seed [--count 100] [--concurrency 10]
 *   ts-node scripts/simulate/cli.ts run --run <runId> [--duration 300] [--concurrency 20]
 *   ts-node scripts/simulate/cli.ts report --run <runId>
 *   ts-node scripts/simulate/cli.ts teardown --run <runId>
 *
 * Each subcommand's own module exports `main()` and reads its args from
 * `process.argv` directly - reassigned below (argv[0]/[1] preserved, the
 * rest replaced with this invocation's own flags) so every subcommand's
 * existing arg-parsing works unchanged whether run directly (`ts-node
 * scripts/simulate/seed.ts --count 50`) or through this dispatcher.
 */
async function main() {
  const [command, ...rest] = process.argv.slice(2);
  assertNotProduction(process.argv.slice(2));
  process.argv = [process.argv[0], process.argv[1], ...rest];

  switch (command) {
    case "seed":
      return (await import("./seed")).main();
    case "run":
      return (await import("./traffic")).main();
    case "report":
      return (await import("./report")).main();
    case "teardown":
      return (await import("./teardown")).main();
    default:
      console.error(
        [
          `Unknown command: "${command ?? ""}"`,
          "",
          "Usage:",
          "  seed     [--count 100] [--concurrency 10]",
          "  run      --run <runId> [--duration 300] [--concurrency 20]",
          "  report   --run <runId>",
          "  teardown --run <runId>",
        ].join("\n"),
      );
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
