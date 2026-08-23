-- Module 67 (SRS §5.6k, FR-6.44) - payment gateway health monitoring.
ALTER TABLE "store_payment_gateway_connections" ADD COLUMN "last_failed_at" TIMESTAMPTZ;

CREATE TABLE "payment_gateway_health_alerts" (
    "provider" "PaymentGatewayProvider" NOT NULL,
    "alerted_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payment_gateway_health_alerts_pkey" PRIMARY KEY ("provider")
);
