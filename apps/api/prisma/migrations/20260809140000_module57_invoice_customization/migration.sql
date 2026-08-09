-- Module 57 (SRS §5.64/FR-64.1) - Invoice/Receipt Customization, limited:
-- three optional, seller-editable Store fields that render on generated
-- invoices only when set (FR-64.2). No RLS change needed - stores already
-- has row-level security in place, these are ordinary nullable columns.

ALTER TABLE "stores" ADD COLUMN "tax_number" TEXT;
ALTER TABLE "stores" ADD COLUMN "invoice_footer_text" TEXT;
ALTER TABLE "stores" ADD COLUMN "invoice_terms_text" TEXT;
