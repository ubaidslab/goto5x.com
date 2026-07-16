import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";

export interface EmitEventInput {
  eventType: string;
  actorType?: string;
  actorId?: string;
  storeId?: string;
  entityType?: string;
  entityId?: string;
  /** IDs only - never PII (SRS §3.11/FR-26.4, §6.5). Enforced by code review, not a runtime scanner. */
  metadata?: Record<string, unknown>;
}

/**
 * SRS §3.11/FR-26.x - the one call every module makes to record a business-
 * lifecycle event. `emit()` never throws: a failed write is caught and
 * logged here, so the action it's describing (a signup, a product creation)
 * is never rolled back or surfaced as an error because analytics recording
 * had a bad moment (FR-26.3, binding). Call sites do not need their own
 * try/catch around this.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly prisma: PrismaRuntimeService) {}

  async emit(input: EmitEventInput): Promise<void> {
    try {
      await this.prisma.platformEvent.create({
        data: {
          eventType: input.eventType,
          actorType: input.actorType,
          actorId: input.actorId,
          storeId: input.storeId,
          entityType: input.entityType,
          entityId: input.entityId,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to record platform event "${input.eventType}" - the triggering action still succeeded.`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
