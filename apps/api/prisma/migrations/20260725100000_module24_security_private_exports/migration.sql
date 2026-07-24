-- Module 24 security fix (v0.28): the seller_data_exports file columns
-- stored plain, permanent, unsigned MinIO URLs for CSVs/PDFs that contain
-- customer PII. Renamed to *_key to reflect that they now hold internal
-- object-storage keys (under a non-public "private/" prefix) rather than
-- URLs - the only access path is the new ownership-checked, authenticated
-- download endpoint. RENAME (not drop+recreate) since this is a pure
-- rename with no type/nullability change.
ALTER TABLE "seller_data_exports" RENAME COLUMN "products_csv_url" TO "products_csv_key";
ALTER TABLE "seller_data_exports" RENAME COLUMN "orders_csv_url" TO "orders_csv_key";
ALTER TABLE "seller_data_exports" RENAME COLUMN "customers_csv_url" TO "customers_csv_key";
ALTER TABLE "seller_data_exports" RENAME COLUMN "summary_pdf_url" TO "summary_pdf_key";
