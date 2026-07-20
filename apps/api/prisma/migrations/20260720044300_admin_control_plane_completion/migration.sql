-- Module 17 (Admin Control Plane completion, SRS §5.8/§5.12, FR-8.4/8.10/8.15/12.1/12.3).
--
-- Note: `prisma migrate diff` spuriously proposes dropping "idx_products_search"
-- and the search_vector column default (a known false positive with generated
-- tsvector columns + prisma's diff engine, same issue every prior migration
-- in this repo has hit) - stripped, not applied.

-- CreateEnum
CREATE TYPE "PlatformMessageChannel" AS ENUM ('banner', 'popup', 'in_app_notification');

-- CreateEnum
CREATE TYPE "PlatformMessageTargetType" AS ENUM ('all', 'plan', 'seller');

-- AlterTable
ALTER TABLE "admin_audit_logs" ADD COLUMN     "impersonation_session_id" UUID;

-- CreateTable
CREATE TABLE "impersonation_sessions" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "ended_at" TIMESTAMPTZ,

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_pages" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "content_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_page_revisions" (
    "id" UUID NOT NULL,
    "content_page_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "edited_by_admin_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_page_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_brand_assets" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "platform_brand_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_brand_asset_revisions" (
    "id" UUID NOT NULL,
    "brand_asset_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "edited_by_admin_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_brand_asset_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_messages" (
    "id" UUID NOT NULL,
    "channel" "PlatformMessageChannel" NOT NULL,
    "target_type" "PlatformMessageTargetType" NOT NULL DEFAULT 'all',
    "target_plan_id" UUID,
    "target_seller_id" UUID,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "created_by_admin_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_impersonation_seller_started" ON "impersonation_sessions"("seller_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_pages_slug_key" ON "content_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "content_page_revisions_content_page_id_version_key" ON "content_page_revisions"("content_page_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "platform_brand_assets_kind_key" ON "platform_brand_assets"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "platform_brand_asset_revisions_brand_asset_id_version_key" ON "platform_brand_asset_revisions"("brand_asset_id", "version");

-- CreateIndex
CREATE INDEX "idx_messages_targeting" ON "platform_messages"("target_type", "target_plan_id", "target_seller_id");

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_page_revisions" ADD CONSTRAINT "content_page_revisions_content_page_id_fkey" FOREIGN KEY ("content_page_id") REFERENCES "content_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_brand_asset_revisions" ADD CONSTRAINT "platform_brand_asset_revisions_brand_asset_id_fkey" FOREIGN KEY ("brand_asset_id") REFERENCES "platform_brand_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
