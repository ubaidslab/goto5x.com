-- Module 25 (Admin Completion) - two new LedgerEntryType values for the
-- seller-360 page's admin "adjust wallet" inline action (manual, reason-
-- required, audit-logged correction).
ALTER TYPE "LedgerEntryType" ADD VALUE 'admin_manual_credit';
ALTER TYPE "LedgerEntryType" ADD VALUE 'admin_manual_debit';
