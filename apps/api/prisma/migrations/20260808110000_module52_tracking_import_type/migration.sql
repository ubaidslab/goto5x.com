-- Module 52 (SRS §5.59/FR-59.3(a)) - CSV tracking-entry import, reusing the
-- existing import_jobs machinery in a fourth narrow mode. Kept in its own
-- migration file, same precedent as Module 28/31's stock_import/
-- ad_spend_import additions (ALTER TYPE ... ADD VALUE cannot share a
-- transaction with a later migration that uses the new value).
ALTER TYPE "ImportJobType" ADD VALUE 'tracking_import';
