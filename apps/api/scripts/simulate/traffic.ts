import { ApiClient, Metrics } from "./api-client";
import { readManifest, SimulationSeller } from "./manifest";
import { generateReport, writeReport } from "./report";

interface TrafficArgs {
  runId: string;
  durationSeconds: number;
  concurrency: number;
  apiBaseUrl: string;
  storefrontHostSuffix: string;
}

function parseArgs(argv: string[]): TrafficArgs {
  const get = (flag: string, fallback: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  const runId = get("--run", "");
  if (!runId) throw new Error('Missing required --run <runId> (see "seed"\'s printed output).');
  return {
    runId,
    durationSeconds: Number(get("--duration", "300")),
    concurrency: Number(get("--concurrency", "20")),
    apiBaseUrl: get("--api-base-url", process.env.API_BASE_URL ?? "http://localhost:3000"),
    storefrontHostSuffix: get("--storefront-host-suffix", ".goto5x.com"),
  };
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Browse/search/cart - the bulk of real storefront traffic, dominated by reads. */
async function storefrontWorker(client: ApiClient, sellers: SimulationSeller[], hostSuffix: string, deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    const seller = pick(sellers);
    const hostname = `${seller.storeSlug}${hostSuffix}`;

    const list = await client.get("storefront:list-products", `/storefront/products?hostname=${hostname}`);
    await client.get("storefront:search", `/storefront/search?hostname=${hostname}&q=simulation`);

    const products = Array.isArray(list.body) ? list.body : list.body?.items;
    if (Array.isArray(products) && products.length > 0) {
      const product = pick(products);
      if (product?.id) {
        await client.get("storefront:product-detail", `/storefront/products/${product.id}?hostname=${hostname}`);
      }
    }

    // Occasional real cart-to-checkout attempt (write path), not on every
    // iteration - matches a realistic browse:buy ratio better than 1:1.
    if (Math.random() < 0.2 && Array.isArray(products) && products.length > 0) {
      const product = pick(products);
      const variantId = product?.variants?.[0]?.id;
      if (product?.id && variantId) {
        await client.post("storefront:add-to-cart", "/storefront/cart", {
          hostname,
          buyerEmail: `sim-buyer-traffic-${Date.now()}-${Math.floor(Math.random() * 1e6)}@simulation.local`,
          items: [{ productId: product.id, variantId, quantity: 1 }],
        });
      }
    }
  }
}

/**
 * One persistent dashboard session for the whole run - logs in once (like a
 * real seller who doesn't re-authenticate on every page view) and reuses
 * that token for repeated reads. Re-logging in every loop iteration was
 * this worker's original design; found (while smoke-testing this tool)
 * to be both unrealistic and self-defeating - it exhausts
 * `auth.login_rate_limit_per_hour` (Module 21's own login-rate-limit fix)
 * within the run's first few seconds, drowning the rest of the report in
 * 429s instead of real dashboard-endpoint latency.
 */
async function dashboardWorker(client: ApiClient, sellers: SimulationSeller[], deadline: number): Promise<void> {
  const seller = pick(sellers);
  let token: string | undefined;

  while (Date.now() < deadline) {
    if (!token) {
      const login = await client.post("dashboard:login", "/auth/login", { email: seller.email, password: seller.password });
      token = login.body?.accessToken as string | undefined;
      if (!token) return; // login itself failed/rate-limited - nothing more this worker can do
    }

    const [, orders, products] = await Promise.all([
      client.get("dashboard:wallet-balance", "/sellers/me/wallet", token),
      client.get("dashboard:list-orders", `/stores/${seller.storeId}/orders`, token),
      client.get("dashboard:list-products", `/stores/${seller.storeId}/products`, token),
    ]);
    if (orders.status === 401 || products.status === 401) token = undefined; // token expired mid-run - relogin next iteration
  }
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = readManifest(args.runId);
  if (manifest.sellers.length === 0) {
    throw new Error(`Manifest for run "${args.runId}" has no sellers - did "seed" fail?`);
  }

  const metrics = new Metrics();
  const client = new ApiClient(args.apiBaseUrl, metrics);
  const deadline = Date.now() + args.durationSeconds * 1000;

  console.log(
    `Driving traffic for run "${args.runId}" - ${args.durationSeconds}s, concurrency ${args.concurrency}, against ${args.apiBaseUrl}...`,
  );

  const half = Math.max(1, Math.floor(args.concurrency / 2));
  const workers = [
    ...Array.from({ length: half }, () => storefrontWorker(client, manifest.sellers, args.storefrontHostSuffix, deadline)),
    ...Array.from({ length: args.concurrency - half }, () => dashboardWorker(client, manifest.sellers, deadline)),
  ];

  const progressTimer = setInterval(() => {
    const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    console.log(`  ...${remaining}s remaining, ${metrics.samples.length} requests so far`);
  }, 30_000);

  await Promise.all(workers);
  clearInterval(progressTimer);

  console.log(`Traffic phase complete - ${metrics.samples.length} total requests. Generating report...`);
  const report = await generateReport(args.runId, metrics, manifest);
  const reportPath = writeReport(args.runId, report);
  console.log(report);
  console.log(`\nReport written to ${reportPath}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
