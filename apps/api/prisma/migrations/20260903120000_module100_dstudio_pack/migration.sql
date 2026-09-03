-- FR-8.21 (Module 100, founder batch B18) - D-Studio Pack: a seller-
-- purchasable, time-boxed full-catalog unlock, reusing TopUpRequestStatus
-- and mirroring template_purchase_requests' exact shape/RLS pattern minus
-- theme_id (not theme-scoped - the grant this feeds is a seller-scoped
-- Settings Registry override, not a per-theme entitlement).

-- CreateTable
CREATE TABLE "dstudio_pack_purchases" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "status" "TopUpRequestStatus" NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMPTZ,
    "verified_by" UUID,

    CONSTRAINT "dstudio_pack_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_dstudio_pack_purchases_seller_status" ON "dstudio_pack_purchases"("seller_id", "status");

-- AddForeignKey
ALTER TABLE "dstudio_pack_purchases" ADD CONSTRAINT "dstudio_pack_purchases_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dstudio_pack_purchases" ADD CONSTRAINT "dstudio_pack_purchases_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- dstudio_pack_purchases is seller-scoped directly (not store-scoped) -
-- same predicate shape as template_purchase_requests.
ALTER TABLE "dstudio_pack_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dstudio_pack_purchases" FORCE ROW LEVEL SECURITY;
CREATE POLICY dstudio_pack_purchases_seller_isolation ON "dstudio_pack_purchases"
  USING (seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid);
