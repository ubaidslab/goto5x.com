-- FR-66.3 (Module 83, v0.56) - live chat widget. A distinct pair of
-- tables from support_tickets/ticket_messages (that pair is seller<->
-- platform-admin only, per FR-8.20). Same denormalized-store_id-on-
-- message, single-level-RLS convention as ticket_messages.

-- CreateEnum
CREATE TYPE "ChatThreadStatus" AS ENUM ('open', 'closed');

-- CreateTable
CREATE TABLE "buyer_chat_threads" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "access_token" TEXT NOT NULL,
    "buyer_email" TEXT,
    "status" "ChatThreadStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "buyer_chat_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_chat_messages" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "author_type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "buyer_chat_threads_access_token_key" ON "buyer_chat_threads"("access_token");

-- CreateIndex
CREATE INDEX "idx_buyer_chat_threads_store" ON "buyer_chat_threads"("store_id");

-- CreateIndex
CREATE INDEX "idx_buyer_chat_messages_thread" ON "buyer_chat_messages"("thread_id", "created_at");

-- AddForeignKey
ALTER TABLE "buyer_chat_threads" ADD CONSTRAINT "buyer_chat_threads_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_chat_messages" ADD CONSTRAINT "buyer_chat_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "buyer_chat_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: store_id-through-stores-subquery pattern proven since Module 2,
-- same as ticket_messages. Buyer-facing reads bypass this entirely via
-- PrismaAdminService (BYPASSRLS), gated only by knowing the thread's
-- accessToken - same precedent as OrderStatusLookupService.
ALTER TABLE "buyer_chat_threads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "buyer_chat_threads" FORCE ROW LEVEL SECURITY;
CREATE POLICY buyer_chat_threads_seller_isolation ON "buyer_chat_threads"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

ALTER TABLE "buyer_chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "buyer_chat_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY buyer_chat_messages_seller_isolation ON "buyer_chat_messages"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));
