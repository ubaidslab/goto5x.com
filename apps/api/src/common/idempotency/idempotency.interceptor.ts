import { CallHandler, ConflictException, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Request } from "express";
import { firstValueFrom, Observable, of } from "rxjs";
import { IdempotencyService } from "./idempotency.service";

const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24h, matches the usual Idempotency-Key convention (e.g. Stripe's own API).
const MAX_KEY_LENGTH = 200;

/**
 * Opt-in via the `Idempotency-Key` request header - a caller that doesn't
 * send it gets exactly the pre-existing behavior, every time, so applying
 * this to an existing route is a purely additive change. Applied directly
 * on the specific handlers D116 item 1 names (order creation, markAsPaid/
 * status-change, the manual-transfer reference submission, every wallet/
 * top-up mutation), not globally - those are specifically the
 * client-retryable, money-moving writes this exists to protect; most
 * writes (and all reads) have no such risk and gain nothing from it.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotency: IdempotencyService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers["idempotency-key"];
    if (typeof key !== "string" || key.length === 0) {
      return next.handle();
    }
    if (key.length > MAX_KEY_LENGTH) {
      throw new ConflictException(`Idempotency-Key must be ${MAX_KEY_LENGTH} characters or fewer.`);
    }

    const scope = `${context.getClass().name}.${context.getHandler().name}`;
    const claim = await this.idempotency.claim(scope, key, DEFAULT_TTL_SECONDS);
    if (claim.outcome === "replay") {
      return of(claim.value);
    }
    if (claim.outcome === "in_progress") {
      throw new ConflictException("A request with this Idempotency-Key is already being processed.");
    }

    try {
      const value = await firstValueFrom(next.handle());
      await this.idempotency.complete(scope, key, value, DEFAULT_TTL_SECONDS);
      return of(value);
    } catch (err) {
      await this.idempotency.release(scope, key);
      throw err;
    }
  }
}
