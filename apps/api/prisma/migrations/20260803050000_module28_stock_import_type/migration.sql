-- Module 28 (SRS §5.39/FR-39.3) - a bulk stock-quantity-only CSV edit,
-- reusing the existing import_jobs machinery in a narrower mode.
ALTER TYPE "ImportJobType" ADD VALUE 'stock_import';
