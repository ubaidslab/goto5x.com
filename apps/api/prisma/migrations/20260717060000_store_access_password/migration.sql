-- Module 5 (FR-16.5). Set only when stores.access_mode = 'password_protected'.
ALTER TABLE "stores" ADD COLUMN "access_password_hash" TEXT;
