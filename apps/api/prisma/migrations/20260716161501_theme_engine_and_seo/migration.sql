-- CreateEnum
CREATE TYPE "StoreAccessMode" AS ENUM ('public', 'coming_soon', 'password_protected');

-- CreateEnum
CREATE TYPE "ThemeTier" AS ENUM ('free', 'premium', 'marketplace');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "seo_description" TEXT,
ADD COLUMN     "seo_title" TEXT;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "access_mode" "StoreAccessMode" NOT NULL DEFAULT 'public',
ADD COLUMN     "seo_description" TEXT,
ADD COLUMN     "seo_title" TEXT;

-- CreateTable
CREATE TABLE "themes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tier" "ThemeTier" NOT NULL DEFAULT 'free',
    "preview_image_url" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_theme_settings" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "theme_id" UUID NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "custom_code" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "store_theme_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_theme_settings_store_id_key" ON "store_theme_settings"("store_id");

-- AddForeignKey
ALTER TABLE "store_theme_settings" ADD CONSTRAINT "store_theme_settings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_theme_settings" ADD CONSTRAINT "store_theme_settings_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
