import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { from, map, Observable, switchMap } from "rxjs";
import { EventsService } from "../events/events.service";
import { AuthenticatedRequest } from "../common/types";

/**
 * SRS §5.52/FR-52.4 - "every write a staff session performs is recorded
 * to the Platform Event Log tagged with its staffAccountId". Same
 * generic HTTP-layer tagging approach as ImpersonationAuditInterceptor,
 * rather than adding an EventsService call to every seller-facing
 * service individually - zero cost for the overwhelming majority of
 * requests that carry no staffAccountId claim at all. Reads (GET) are
 * excluded - FR-52.4 says "every write", not every request.
 */
@Injectable()
export class StaffAuditInterceptor implements NestInterceptor {
  constructor(private readonly events: EventsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const staffAccountId = request.user?.staffAccountId;
    if (!staffAccountId || request.method === "GET") return next.handle();

    return next.handle().pipe(
      switchMap((data) =>
        from(
          this.events.emit({
            eventType: "staff_account.action",
            actorType: "staff",
            actorId: staffAccountId,
            storeId: (request.params as { storeId?: string }).storeId,
            entityType: "staff_account",
            entityId: staffAccountId,
            metadata: { method: request.method, path: request.route?.path ?? request.path },
          }),
        ).pipe(map(() => data)),
      ),
    );
  }
}
