import { Global, Module } from "@nestjs/common";
import { IdempotencyInterceptor } from "./idempotency.interceptor";
import { IdempotencyService } from "./idempotency.service";

/** Global, mirroring RedisModule - no consuming module needs a new import to use @UseInterceptors(IdempotencyInterceptor). */
@Global()
@Module({
  providers: [IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
