import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Request } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

/**
 * Logs method/path/status/duration for every request - deliberately never the
 * request body, query string, or headers, since those are exactly where PII
 * (email, phone, password) lives. This is the mechanism §6.5/§14.12's "PII
 * redaction verified in application logs" checklist item tests against.
 */
@Injectable()
export class PiiRedactionInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`${request.method} ${request.path} +${Date.now() - start}ms`);
      }),
    );
  }
}
