import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Response } from "express";

/**
 * Milestone A load/soak run (Sept 2026) - found by a real simulation at
 * ~25-seller scale: a malformed ID reaching any `findUnique`/`update`/
 * `delete` call on a UUID-typed column (e.g. the literal string
 * "undefined" - which is exactly what happens when an upstream call
 * silently failed and a caller string-interpolated its missing id into a
 * URL, rather than checking the response first) threw a raw
 * PrismaClientKnownRequestError that fell through to the generic 500
 * branch below - a genuinely wrong status code for what is, from the
 * caller's perspective, a bad request, not a server fault. Prisma error
 * codes reference: https://www.prisma.io/docs/orm/reference/error-reference
 *   P2023 - "Inconsistent column data" (malformed value for the column's
 *           type, e.g. a non-UUID string into a UUID column) -> 400.
 *   P2025 - "Record not found" (an update/delete targeting a row that
 *           doesn't exist) -> 404. Most call sites already look this up
 *           first and throw NotFoundException themselves; this only
 *           catches the handful using update/delete directly.
 * Both map to a clean, generic message - never the raw Prisma error text,
 * which can echo back internal file paths and query fragments (the same
 * discipline the 500 branch below already applies).
 */
function mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): { status: number; message: string } | null {
  if (exception.code === "P2023") return { status: HttpStatus.BAD_REQUEST, message: "Invalid ID format." };
  if (exception.code === "P2025") return { status: HttpStatus.NOT_FOUND, message: "Resource not found." };
  return null;
}

/**
 * P1.4 input-validation sweep finding - body-parser's own PayloadTooLargeError
 * (thrown by the `raw-body`/`http-errors` chain before Nest's routing layer
 * even runs, so it's never an HttpException instance) fell through to the
 * generic 500 branch below - the oversized-body protection itself was
 * already working, but a normal "your request is too big" client mistake
 * surfaced as a server-fault status. Duck-typed on `.type` (the stable
 * signal `raw-body` sets) rather than importing that package directly.
 */
function isPayloadTooLargeError(exception: unknown): exception is { message: string } {
  return (
    exception instanceof Error &&
    (exception as { type?: string }).type === "entity.too.large"
  );
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpException");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const prismaMapping =
      exception instanceof Prisma.PrismaClientKnownRequestError ? mapPrismaError(exception) : null;
    const payloadTooLarge = isPayloadTooLargeError(exception);

    const status = prismaMapping
      ? prismaMapping.status
      : payloadTooLarge
        ? HttpStatus.PAYLOAD_TOO_LARGE
        : exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = prismaMapping
      ? prismaMapping.message
      : payloadTooLarge
        ? "Request body too large."
        : exception instanceof HttpException
          ? exception.getResponse()
          : "Internal server error";

    if (status >= 500) {
      // Never log request bodies/headers here - see pii-redaction.interceptor.ts
      // for the same discipline applied to request logging.
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json({
      statusCode: status,
      message,
    });
  }
}
