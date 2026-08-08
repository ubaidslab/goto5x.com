-- Module 53 (SRS §5.60/FR-60.4) - new terminal OrderStatus values reached by
-- a completed ReturnRequest. Kept in its own migration file, separate from
-- the one that creates return_requests (which uses these values), per the
-- established Module 28/31/52 precedent: ALTER TYPE ... ADD VALUE cannot run
-- in the same transaction as a statement that uses the new value.
ALTER TYPE "OrderStatus" ADD VALUE 'refunded';
ALTER TYPE "OrderStatus" ADD VALUE 'partially_refunded';
