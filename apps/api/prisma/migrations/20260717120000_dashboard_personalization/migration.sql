-- Module 10 (Seller Dashboard UI) rollout: cosmetic dashboard personalization
-- (FR-28.4). No plan-gating enforced yet - see schema.prisma comment.

ALTER TABLE "sellers" ADD COLUMN "dashboard_theme" TEXT NOT NULL DEFAULT 'default';
