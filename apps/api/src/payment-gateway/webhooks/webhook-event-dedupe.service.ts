import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaAdminService } from "../../prisma/prisma-admin.service";

function isUniqueConstraintViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * D117/B2 (founder decision) - "idempotent webhook handling (dedupe on
 * event ID)". Backed by ProcessedWebhookEvent (see schema.prisma's own
 * comment on that model for why this isn't the existing, Redis-backed
 * IdempotencyService). Global/admin-scoped, not store-RLS-scoped - a
 * webhook event ID is a fact about the provider's delivery, not a
 * seller's own data.
 */
@Injectable()
export class WebhookEventDedupeService {
  constructor(private readonly prismaAdmin: PrismaAdminService) {}

  /**
   * Attempts to claim this event. `true` - never seen before, go ahead
   * and process it. `false` - already claimed (a redelivery of the same
   * event, or a concurrent duplicate request), skip processing; the
   * caller should still return a 2xx to the provider so it stops
   * retrying, since the event genuinely has already been handled.
   */
  async claim(provider: string, eventId: string, eventType: string): Promise<boolean> {
    try {
      await this.prismaAdmin.processedWebhookEvent.create({ data: { provider, eventId, eventType } });
      return true;
    } catch (err) {
      if (isUniqueConstraintViolation(err)) return false;
      throw err;
    }
  }
}
