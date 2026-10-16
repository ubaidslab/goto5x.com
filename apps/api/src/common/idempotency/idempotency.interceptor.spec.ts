import { CallHandler, ExecutionContext } from "@nestjs/common";
import { from, of, throwError } from "rxjs";
import { IdempotencyInterceptor } from "./idempotency.interceptor";
import { IdempotencyService } from "./idempotency.service";

/** D116 item 1 (Stage 0) - "the same key twice = one effect," proved at the interceptor level, not just the store. */
describe("IdempotencyInterceptor (D116 item 1)", () => {
  function buildFakeRedis() {
    const store = new Map<string, string>();
    return {
      set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
        if (args.includes("NX") && store.has(key)) return null;
        store.set(key, value);
        return "OK";
      }),
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      del: jest.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    };
  }

  function buildInterceptor() {
    return new IdempotencyInterceptor(new IdempotencyService(buildFakeRedis() as any));
  }

  function contextWithKey(key: string | undefined): ExecutionContext {
    const request = { headers: key === undefined ? {} : { "idempotency-key": key } };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getClass: () => ({ name: "CheckoutController" }),
      getHandler: () => ({ name: "checkout" }),
    } as unknown as ExecutionContext;
  }

  function handlerReturning(effect: jest.Mock): CallHandler {
    return { handle: () => of(effect()) };
  }

  it("the same Idempotency-Key submitted twice runs the handler once and returns the same result both times", async () => {
    const interceptor = buildInterceptor();
    const effect = jest.fn(() => ({ orderId: "order-1" }));

    const firstObservable = await interceptor.intercept(contextWithKey("retry-key-1"), handlerReturning(effect));
    const firstValue = await new Promise((resolve) => firstObservable.subscribe(resolve));

    const secondObservable = await interceptor.intercept(contextWithKey("retry-key-1"), handlerReturning(effect));
    const secondValue = await new Promise((resolve) => secondObservable.subscribe(resolve));

    expect(effect).toHaveBeenCalledTimes(1);
    expect(firstValue).toEqual({ orderId: "order-1" });
    expect(secondValue).toEqual({ orderId: "order-1" });
  });

  it("two different keys each run the handler independently", async () => {
    const interceptor = buildInterceptor();
    const effect = jest.fn(() => ({ orderId: "order-1" }));

    await interceptor.intercept(contextWithKey("key-a"), handlerReturning(effect));
    await interceptor.intercept(contextWithKey("key-b"), handlerReturning(effect));

    expect(effect).toHaveBeenCalledTimes(2);
  });

  it("a request with no Idempotency-Key header behaves exactly as before - the handler runs every time", async () => {
    const interceptor = buildInterceptor();
    const effect = jest.fn(() => ({ orderId: "order-1" }));

    await interceptor.intercept(contextWithKey(undefined), handlerReturning(effect));
    await interceptor.intercept(contextWithKey(undefined), handlerReturning(effect));

    expect(effect).toHaveBeenCalledTimes(2);
  });

  it("a concurrent duplicate of the same key, before the first attempt completes, is rejected rather than run twice", async () => {
    const interceptor = buildInterceptor();
    // A handler under this test's own control - only resolves once resolveFirst() is called below,
    // so the first call is still genuinely "in flight" when the second call is made.
    let resolveFirst!: (value: unknown) => void;
    const firstHandlerResult = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const slowHandler: CallHandler = { handle: () => from(firstHandlerResult) };

    const firstCallPromise = interceptor.intercept(contextWithKey("in-flight-key"), slowHandler);
    await expect(interceptor.intercept(contextWithKey("in-flight-key"), slowHandler)).rejects.toThrow(
      "already being processed",
    );

    resolveFirst({ orderId: "order-1" });
    await firstCallPromise;
  });

  it("releases the claim on failure, so a retry after an error gets a genuinely fresh attempt", async () => {
    const redis = buildFakeRedis();
    const interceptor = new IdempotencyInterceptor(new IdempotencyService(redis as any));
    const erroringHandler: CallHandler = { handle: () => throwError(() => new Error("downstream failure")) };

    await expect(interceptor.intercept(contextWithKey("retry-key-2"), erroringHandler)).rejects.toThrow("downstream failure");

    const succeedingHandler = handlerReturning(jest.fn(() => ({ orderId: "order-2" })));
    const retryObservable = await interceptor.intercept(contextWithKey("retry-key-2"), succeedingHandler);
    const retryValue = await new Promise((resolve) => retryObservable.subscribe(resolve));
    expect(retryValue).toEqual({ orderId: "order-2" });
  });
});
