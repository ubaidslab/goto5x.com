import { PrismaClient } from "@prisma/client";
import { deleteManifest, readManifest } from "./manifest";

/**
 * Module 21 - deletes exactly what `seed` created for this run (scoped by
 * the sellerId/storeId/userId list in the manifest), never a blind
 * full-database wipe - this tool may run against a real pre-launch
 * environment with its own genuine Settings Registry/plan configuration
 * worth preserving.
 *
 * None of this schema's foreign keys use ON DELETE CASCADE (confirmed by
 * grep - every FK relies on the app's own transaction discipline instead),
 * so a plain scoped DELETE in the wrong order would fail with a constraint
 * violation. `session_replication_role = replica` is the standard
 * Postgres mechanism for exactly this case (a superuser/admin-only,
 * temporary, transaction-scoped suspension of FK/trigger enforcement) -
 * used here instead of hand-maintaining a 30-table dependency order that
 * would silently drift out of sync with schema changes.
 */
async function teardown(runId: string): Promise<void> {
  const manifest = readManifest(runId);
  const storeIds = manifest.sellers.map((s) => s.storeId).filter(Boolean);
  const sellerIds = manifest.sellers.map((s) => s.sellerId).filter(Boolean);
  const userIds = manifest.sellers.map((s) => s.userId).filter(Boolean);

  if (storeIds.length === 0 && sellerIds.length === 0) {
    console.log(`Run "${runId}" has no seller/store IDs recorded (seed may have failed early) - nothing to delete.`);
    deleteManifest(runId);
    return;
  }

  const admin = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_ADMIN_URL } } });

  console.log(`Tearing down run "${runId}": ${sellerIds.length} sellers, ${storeIds.length} stores...`);

  await admin.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`);

    if (storeIds.length > 0) {
      await tx.$executeRawUnsafe(
        `DELETE FROM tracking_updates WHERE order_item_id IN (SELECT id FROM order_items WHERE store_id = ANY($1::uuid[]))`,
        storeIds,
      );
      await tx.$executeRawUnsafe(`DELETE FROM order_timeline_events WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM order_notes WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM payments WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM order_items WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM orders WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM carts WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM product_reviews WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM collection_products WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM collections WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM media_assets WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM product_variants WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM products WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM customers WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM discount_codes WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM store_payment_instructions WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM store_shipping_settings WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM store_tax_settings WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM store_theme_settings WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM store_navigation_menus WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM domains WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM import_jobs WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM listing_reviews WHERE store_id = ANY($1::uuid[])`, storeIds);
      await tx.$executeRawUnsafe(`DELETE FROM store_supplier_links WHERE store_id = ANY($1::uuid[])`, storeIds);
    }

    if (sellerIds.length > 0) {
      await tx.$executeRawUnsafe(`DELETE FROM ledger_entries WHERE seller_id = ANY($1::uuid[])`, sellerIds);
      await tx.$executeRawUnsafe(`DELETE FROM seller_invoices WHERE seller_id = ANY($1::uuid[])`, sellerIds);
      await tx.$executeRawUnsafe(`DELETE FROM wallet_topup_requests WHERE owner_type = 'seller' AND owner_id = ANY($1::uuid[])`, sellerIds);
      await tx.$executeRawUnsafe(`DELETE FROM subscriptions WHERE seller_id = ANY($1::uuid[])`, sellerIds);
      await tx.$executeRawUnsafe(`DELETE FROM google_drive_connections WHERE seller_id = ANY($1::uuid[])`, sellerIds);
      // seller_agreement_versions is NOT seller-scoped - it's the global,
      // shared table of published agreement text/version history (schema.prisma's
      // SellerAgreementVersion model). A seller's own acceptance is 3 columns
      // directly on the `sellers` row (agreement_accepted_version/_at/_ip),
      // already covered when `sellers` is deleted below - there is no
      // separate per-seller acceptance table to clean up here (found by
      // actually running this DELETE against the real schema, which doesn't
      // have a seller_id column on this table at all).
      await tx.$executeRawUnsafe(`DELETE FROM seller_api_tokens WHERE seller_id = ANY($1::uuid[])`, sellerIds);
    }

    if (storeIds.length > 0) {
      await tx.$executeRawUnsafe(`DELETE FROM stores WHERE id = ANY($1::uuid[])`, storeIds);
    }
    if (sellerIds.length > 0) {
      await tx.$executeRawUnsafe(`DELETE FROM sellers WHERE id = ANY($1::uuid[])`, sellerIds);
    }
    // user_security_events is NOT deleted here, deliberately: like
    // admin_audit_logs, it revokes UPDATE/DELETE from app_admin at the
    // grant level for immutability (SRS FR-8.9) - only the Postgres
    // superuser connection can touch it (see README/test/e2e/setup.ts's
    // own note on this). `session_replication_role = replica` bypasses FK
    // *trigger* enforcement, not table-level GRANTs, so a handful of
    // security-event rows referencing these now-deleted simulation user
    // IDs are left behind - harmless audit clutter, not business data,
    // and a superuser cleanup step is documented in docs/launch-runbook.md
    // for anyone who wants it gone too.
    if (userIds.length > 0) {
      await tx.$executeRawUnsafe(`DELETE FROM users WHERE id = ANY($1::uuid[])`, userIds);
    }

    // The one shared category and the simulation admin account this run created.
    await tx.$executeRawUnsafe(`DELETE FROM categories WHERE slug = $1`, `sim-${runId}-category`);
    await tx.$executeRawUnsafe(
      `DELETE FROM admin_users WHERE user_id IN (SELECT id FROM users WHERE email = $1)`,
      `sim-admin-${runId}@simulation.local`,
    );
    await tx.$executeRawUnsafe(`DELETE FROM users WHERE email = $1`, `sim-admin-${runId}@simulation.local`);
  });

  await admin.$disconnect();
  deleteManifest(runId);
  console.log(`Teardown complete for run "${runId}".`);
}

export async function main() {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf("--run");
  const runId = idx >= 0 ? argv[idx + 1] : undefined;
  if (!runId) throw new Error("Missing required --run <runId>.");
  await teardown(runId);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
