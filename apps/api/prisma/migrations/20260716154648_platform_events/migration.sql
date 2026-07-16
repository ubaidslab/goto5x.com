-- CreateTable
CREATE TABLE "platform_events" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_type" TEXT,
    "actor_id" UUID,
    "store_id" UUID,
    "entity_type" TEXT,
    "entity_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_platform_events_type_created" ON "platform_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "idx_platform_events_store" ON "platform_events"("store_id");
