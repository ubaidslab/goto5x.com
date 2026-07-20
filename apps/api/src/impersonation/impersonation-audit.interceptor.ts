import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { from, map, Observable, switchMap } from "rxjs";
import { AuthenticatedRequest } from "../common/types";
import { AuditLogService } from "../admin/audit-log.service";

/**
 * Module 17 (FR-8.4) - "every action during the session is tagged with
 * impersonation_session_id in the audit log". Rather than adding an
 * AuditLogService call to every seller-facing controller (most of which
 * have no audit-logging concept today), this tags every successful
 * request made under an impersonation token generically, at the HTTP
 * layer - zero cost for the overwhelming majority of requests that carry
 * no impersonation claim at all (the check is a single property read).
 *
 * Unlike EventsService's platform_events (deliberately non-blocking, SRS
 * FR-26.3), this write IS awaited before the response completes - §14.8's
 * checklist states the tagging as an absolute guarantee ("every action...
 * is tagged"), not best-effort, so a failed audit write here fails the
 * request rather than silently going untagged.
 */
@Injectable()
export class ImpersonationAuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLog: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionId = request.user?.impersonationSessionId;
    if (!sessionId) return next.handle();

    return next.handle().pipe(
      switchMap((data) =>
        from(
          this.auditLog.record({
            adminUserId: request.user!.impersonatingAdminUserId ?? null,
            action: `${request.method} ${request.route?.path ?? request.path}`,
            targetType: "impersonation_action",
            targetId: request.user!.sellerId ?? null,
            impersonationSessionId: sessionId,
          }),
        ).pipe(map(() => data)),
      ),
    );
  }
}
