import "reflect-metadata";

/**
 * Real, running worker process with zero processors registered - matches the
 * production topology from day one (docs/docker-compose.yml) rather than
 * adding the worker container only once a module needs it. Later modules
 * (hold-release, abandoned-cart, CSV import, etc.) register BullMQ Worker
 * instances here.
 */
function main() {
  // eslint-disable-next-line no-console
  console.log("goto5x worker started (no job processors registered yet - Module 1).");

  // Keep the process alive so the container behaves like a real long-running
  // worker, not a script that exits immediately.
  setInterval(() => {}, 1 << 30);
}

main();
