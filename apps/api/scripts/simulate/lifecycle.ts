import { authenticator } from "otplib";
import { PrismaClient } from "@prisma/client";
import { ApiClient, Metrics } from "./api-client";
import { readManifest } from "./manifest";

const SHARED_PASSWORD = "sim-run-password-not-for-real-use";

/**
 * Milestone A load/soak run - extends `seed`'s output (which only reaches
 * "confirmed") to also exercise the parts of the system `seed`/`run` don't
 * touch: shipped/delivered order-lifecycle progression, a subscription
 * plan-fee payment, and a D-Studio Pack purchase - each going through the
 * same manual/admin-verify path a real no-gateway-connected dev/early-launch
 * environment uses. Run after `seed`, before `run`/`report`.
 *
 * Usage: ts-node scripts/simulate/lifecycle.ts --run <runId>
 */
interface LifecycleArgs {
  runId: string;
  apiBaseUrl: string;
}

function parseArgs(argv: string[]): LifecycleArgs {
  const get = (flag: string, fallback: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  const runId = get("--run", "");
  if (!runId) throw new Error('Missing required --run <runId> (see "seed"\'s printed output).');
  return { runId, apiBaseUrl: get("--api-base-url", process.env.API_BASE_URL ?? "http://localhost:3000") };
}

/** Re-derives a fresh admin session for this run's already-seeded sim-admin account, reusing the MFA secret `seed` already enrolled rather than re-enrolling. */
async function reloginAdmin(client: ApiClient, admin: PrismaClient, runId: string): Promise<string> {
  const email = `sim-admin-${runId}@simulation.local`;
  const user = await admin.user.findUniqueOrThrow({ where: { email } });
  if (!user.mfaSecret) throw new Error(`Simulation admin ${email} has no MFA secret - did "seed" run first?`);

  const login = await client.post("admin:login", "/admin/auth/login", { email, password: SHARED_PASSWORD });
  const code = authenticator.generate(user.mfaSecret);
  const verify = await client.post("admin:mfa-verify", "/admin/auth/mfa/verify", { preAuthToken: login.body?.preAuthToken, code });
  if (!verify.body?.accessToken) throw new Error(`Failed to re-login as simulation admin: ${JSON.stringify(verify.body)}`);
  return verify.body.accessToken as string;
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = readManifest(args.runId);
  const metrics = new Metrics();
  const client = new ApiClient(args.apiBaseUrl, metrics);
  const admin = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_ADMIN_URL } } });

  console.log(`Lifecycle extension for run "${args.runId}" - ${manifest.sellers.length} sellers...`);
  const startedAt = Date.now();

  const adminToken = await reloginAdmin(client, admin, args.runId);

  let shippedOrders = 0;
  let deliveredItems = 0;
  let subscriptionPayments = 0;
  let dstudioPackPurchases = 0;
  const errors: string[] = [];

  for (let i = 0; i < manifest.sellers.length; i++) {
    const seller = manifest.sellers[i];
    const login = await client.post("auth:login", "/auth/login", { email: seller.email, password: seller.password });
    const sellerToken = login.body?.accessToken as string | undefined;
    if (!sellerToken) {
      errors.push(`seller ${seller.email}: re-login failed (${login.status})`);
      continue;
    }

    const ordersRes = await client.get(
      "dashboard:list-orders-confirmed",
      `/stores/${seller.storeId}/orders?status=confirmed&limit=50`,
      sellerToken,
    );
    const confirmedOrders: { id: string }[] = ordersRes.body?.items ?? [];

    // Progress roughly 2/3 of this seller's confirmed orders all the way to
    // delivered - leaves ~1/3 sitting at "confirmed" (awaiting shipment),
    // matching a real store's realistic in-flight spread rather than an
    // all-or-nothing lifecycle.
    for (let j = 0; j < confirmedOrders.length; j++) {
      if (j % 3 === 2) continue;
      const orderId = confirmedOrders[j].id;

      const detail = await client.get("dashboard:get-order", `/stores/${seller.storeId}/orders/${orderId}`, sellerToken);
      const items: { id: string }[] = detail.body?.items ?? [];
      if (items.length === 0) continue;

      const tracking = await client.post(
        "dashboard:upload-order-tracking",
        `/stores/${seller.storeId}/orders/${orderId}/tracking`,
        { trackingId: `SIM-TRACK-${orderId.slice(0, 8)}`, carrier: "TCS" },
        sellerToken,
      );
      if (tracking.status < 200 || tracking.status >= 300) {
        errors.push(`order ${orderId}: tracking upload failed (${tracking.status})`);
        continue;
      }
      shippedOrders++;

      for (const item of items) {
        const deliver = await client.post(
          "dashboard:mark-item-delivered",
          `/stores/${seller.storeId}/orders/${orderId}/items/${item.id}/deliver`,
          undefined,
          sellerToken,
        );
        if (deliver.status >= 200 && deliver.status < 300) {
          deliveredItems++;
        } else {
          errors.push(`order ${orderId} item ${item.id}: mark-delivered failed (${deliver.status})`);
        }
      }
    }

    // Subscription path - every 4th seller submits a plan-fee payment (no
    // reference - the manual/no-gateway-connected dev path), admin-verified
    // the same way seed.ts already verifies wallet top-ups.
    if (i % 4 === 0) {
      const planFee = await client.post("dashboard:plan-fee-payment", "/sellers/me/wallet/plan-fee-payment", {}, sellerToken);
      const requestId = planFee.body?.request?.id;
      if (requestId) {
        const verify = await client.post("admin:verify-plan-fee", `/admin/wallet-topups/${requestId}/verify`, undefined, adminToken);
        if (verify.status >= 200 && verify.status < 300) subscriptionPayments++;
        else errors.push(`seller ${seller.email}: plan-fee admin-verify failed (${verify.status})`);
      } else {
        errors.push(`seller ${seller.email}: plan-fee-payment request failed (${planFee.status}) ${JSON.stringify(planFee.body)}`);
      }
    }

    // D-Studio Pack path - every 5th seller buys the pack (same manual/
    // admin-verify path); rejected with 400 for a seller whose real tier
    // already includes the full catalog, which none of these sim sellers'
    // default GO-tier signup does.
    if (i % 5 === 0) {
      const pack = await client.post("dashboard:dstudio-pack-purchase", "/sellers/me/dstudio-pack-purchases", {}, sellerToken);
      const requestId = pack.body?.request?.id;
      if (requestId) {
        const verify = await client.post("admin:verify-dstudio-pack", `/admin/dstudio-pack-purchases/${requestId}/verify`, undefined, adminToken);
        if (verify.status >= 200 && verify.status < 300) dstudioPackPurchases++;
        else errors.push(`seller ${seller.email}: dstudio-pack admin-verify failed (${verify.status})`);
      } else {
        errors.push(`seller ${seller.email}: dstudio-pack-purchase request failed (${pack.status}) ${JSON.stringify(pack.body)}`);
      }
    }
  }

  console.log("");
  console.log(`Lifecycle extension complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);
  console.log(`  Orders shipped (tracking uploaded): ${shippedOrders}`);
  console.log(`  Order items marked delivered:       ${deliveredItems}`);
  console.log(`  Subscription plan-fee payments:     ${subscriptionPayments}`);
  console.log(`  D-Studio Pack purchases:            ${dstudioPackPurchases}`);
  console.log(`  Total requests:                     ${metrics.samples.length}`);
  if (errors.length > 0) {
    console.log(`  ${errors.length} error(s):`);
    for (const e of errors) console.log(`    ${e}`);
  } else {
    console.log(`  Errors: none`);
  }

  await admin.$disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
