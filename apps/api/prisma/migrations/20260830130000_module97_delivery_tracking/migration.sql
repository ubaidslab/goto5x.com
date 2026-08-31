-- Module 97 (SRS §5.38/FR-38.7, founder batch "Honest Delivery Tracking")
-- Optional courier tracking link, alongside the existing trackingId/carrier.
ALTER TABLE "tracking_updates" ADD COLUMN "tracking_url" TEXT;
