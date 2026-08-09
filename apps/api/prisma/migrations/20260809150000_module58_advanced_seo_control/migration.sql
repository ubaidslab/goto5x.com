-- Module 58 (SRS §5.65/FR-65.1-65.5) - Advanced Store SEO Control. Extends
-- the existing SEO fallback cascade (resolveSeoFallback(), FR-1.5/FR-16.6)
-- rather than a second, parallel SEO data path. Store-level defaults are
-- NOT NULL with a default of true (existing behavior is preserved for
-- every pre-existing row); the Product/Collection-level per-item columns
-- are nullable, meaning "inherit the store default" - same cascade shape
-- as the pre-existing seoTitle/seoDescription fallback.

ALTER TABLE "stores" ADD COLUMN "seo_robots_index_default" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "stores" ADD COLUMN "seo_robots_follow_default" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "stores" ADD COLUMN "seo_structured_data_default" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "stores" ADD COLUMN "seo_sitemap_included_default" BOOLEAN NOT NULL DEFAULT true;
-- FR-65.4 - sanitized to an explicit meta/link/script[type=application/ld+json]
-- allowlist before storage (SanitizeHeadTagsService) - never raw seller HTML.
ALTER TABLE "stores" ADD COLUMN "custom_head_tags" TEXT;

ALTER TABLE "products" ADD COLUMN "canonical_url" TEXT;
ALTER TABLE "products" ADD COLUMN "robots_index" BOOLEAN;
ALTER TABLE "products" ADD COLUMN "robots_follow" BOOLEAN;
ALTER TABLE "products" ADD COLUMN "og_image_media_id" UUID REFERENCES "media_assets"("id");
ALTER TABLE "products" ADD COLUMN "og_title" TEXT;
ALTER TABLE "products" ADD COLUMN "og_description" TEXT;
ALTER TABLE "products" ADD COLUMN "structured_data_enabled" BOOLEAN;
ALTER TABLE "products" ADD COLUMN "sitemap_included" BOOLEAN;
-- FR-65.3 - additive only: nullable, unique per store (not globally - two
-- different sellers may each use "blue-shirt"). The existing UUID-based
-- storefront route (/storefront/products/[productId]) is never replaced.
ALTER TABLE "products" ADD COLUMN "slug" TEXT;
ALTER TABLE "products" ADD CONSTRAINT "uniq_product_store_slug" UNIQUE ("store_id", "slug");

ALTER TABLE "collections" ADD COLUMN "canonical_url" TEXT;
ALTER TABLE "collections" ADD COLUMN "robots_index" BOOLEAN;
ALTER TABLE "collections" ADD COLUMN "robots_follow" BOOLEAN;
ALTER TABLE "collections" ADD COLUMN "og_image_media_id" UUID REFERENCES "media_assets"("id");
ALTER TABLE "collections" ADD COLUMN "og_title" TEXT;
ALTER TABLE "collections" ADD COLUMN "og_description" TEXT;
ALTER TABLE "collections" ADD COLUMN "sitemap_included" BOOLEAN;
