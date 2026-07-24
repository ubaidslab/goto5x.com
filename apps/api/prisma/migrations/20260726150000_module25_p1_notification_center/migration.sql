-- Module 25 P1: admin notification center read-marker.
ALTER TABLE "admin_users" ADD COLUMN "last_seen_notifications_at" TIMESTAMPTZ;
