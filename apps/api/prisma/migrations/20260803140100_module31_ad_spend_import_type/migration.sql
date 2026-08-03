-- Module 31 (SRS §5.42/FR-42.1) - a CSV ad-spend import, reusing the
-- existing import_jobs machinery in a third narrow mode. Kept in its own
-- migration file, same precedent as Module 28's stock_import addition.
ALTER TYPE "ImportJobType" ADD VALUE 'ad_spend_import';
