-- Module 36 (SRS §5.53/FR-53.1-53.5) - Admin Email Section. UZEYN's own
-- unified inbox in the admin terminal; admin-global, no RLS (same
-- category as admin_audit_logs/impersonation_sessions).

CREATE TABLE "admin_email_accounts" (
    "id" UUID NOT NULL,
    "email_address" TEXT NOT NULL,
    "display_name" TEXT,
    "imap_host" TEXT NOT NULL,
    "imap_port" INTEGER NOT NULL,
    "imap_use_tls" BOOLEAN NOT NULL DEFAULT true,
    "imap_username" TEXT NOT NULL,
    "imap_password_encrypted" TEXT NOT NULL,
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER NOT NULL,
    "smtp_use_tls" BOOLEAN NOT NULL DEFAULT false,
    "smtp_username" TEXT NOT NULL,
    "smtp_password_encrypted" TEXT NOT NULL,
    "linked_by_admin_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_email_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_email_accounts_email_address_key" ON "admin_email_accounts"("email_address");

ALTER TABLE "admin_email_accounts" ADD CONSTRAINT "admin_email_accounts_linked_by_admin_user_id_fkey" FOREIGN KEY ("linked_by_admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
