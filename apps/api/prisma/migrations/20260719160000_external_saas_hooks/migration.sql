-- Module 18 (External-SaaS Integration Hooks, SRS §5.24). Three new tables:
-- external_api_clients (global registry, mirrors supplier_adapters),
-- template_entitlements and seller_api_tokens (seller-scoped directly,
-- RLS added by hand below - same shape as google_drive_connections).
--
-- Note: `prisma migrate diff` spuriously proposes dropping "idx_products_search"
-- and the search_vector column default (a known false positive with generated
-- tsvector columns + prisma's diff engine, same issue every prior migration
-- in this repo has hit) - stripped, not applied.

-- CreateEnum
CREATE TYPE "ExternalApiClientType" AS ENUM ('template_store', 'social_media_saas');

-- CreateEnum
CREATE TYPE "TemplateEntitlementSource" AS ENUM ('built_in', 'marketplace_purchase');

-- CreateTable
CREATE TABLE "external_api_clients" (
    "id" UUID NOT NULL,
    "client_type" "ExternalApiClientType" NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "signing_secret_ref" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "external_api_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_entitlements" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "theme_id" UUID NOT NULL,
    "source" "TemplateEntitlementSource" NOT NULL,
    "external_purchase_ref" TEXT,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "template_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_api_tokens" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "scopes" TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "seller_api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_api_clients_client_type_key" ON "external_api_clients"("client_type");

-- CreateIndex
CREATE INDEX "idx_entitlements_seller" ON "template_entitlements"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_entitlements_seller_id_theme_id_key" ON "template_entitlements"("seller_id", "theme_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_api_tokens_token_hash_key" ON "seller_api_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_seller_tokens_seller" ON "seller_api_tokens"("seller_id");

-- AddForeignKey
ALTER TABLE "template_entitlements" ADD CONSTRAINT "template_entitlements_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_entitlements" ADD CONSTRAINT "template_entitlements_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_api_tokens" ADD CONSTRAINT "seller_api_tokens_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_api_tokens" ADD CONSTRAINT "seller_api_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "external_api_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- template_entitlements and seller_api_tokens are seller-scoped directly
-- (not store-scoped) - same predicate shape as google_drive_connections,
-- not the `stores` subquery every store-scoped table uses.
ALTER TABLE "template_entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "template_entitlements" FORCE ROW LEVEL SECURITY;
CREATE POLICY template_entitlements_seller_isolation ON "template_entitlements"
  USING (seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid);

ALTER TABLE "seller_api_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seller_api_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY seller_api_tokens_seller_isolation ON "seller_api_tokens"
  USING (seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid);

-- external_api_clients is a global, admin-managed registry (mirrors
-- supplier_adapters/themes) - deliberately NOT row-level-secured; every
-- admin-terminal read goes through AdminAuthGuard instead.

