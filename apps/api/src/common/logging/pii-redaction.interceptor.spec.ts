import { CallHandler, ExecutionContext, Logger } from "@nestjs/common";
import { of } from "rxjs";
import { PiiRedactionInterceptor } from "./pii-redaction.interceptor";

/** Module 21 (§14.12) - proves the "PII redaction verified in application logs" checklist item, not just asserts the interceptor exists. */
describe("PiiRedactionInterceptor (SRS §6.5/§14.12)", () => {
  function contextWithPii(): ExecutionContext {
    const request = {
      method: "POST",
      path: "/auth/login",
      body: { email: "founder@example.com", password: "correct-horse-battery" },
      query: { email: "founder@example.com" },
      headers: { authorization: "Bearer super-secret-token", cookie: "sessionId=abc123" },
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  function handlerReturning(value: unknown): CallHandler {
    return { handle: () => of(value) };
  }

  it("logs only method/path/duration - never the request body", (done) => {
    const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const interceptor = new PiiRedactionInterceptor();

    interceptor.intercept(contextWithPii(), handlerReturning({ ok: true })).subscribe(() => {
      expect(logSpy).toHaveBeenCalledTimes(1);
      const [logged] = logSpy.mock.calls[0];
      expect(String(logged)).toMatch(/^POST \/auth\/login \+\d+ms$/);
      expect(String(logged)).not.toContain("founder@example.com");
      expect(String(logged)).not.toContain("correct-horse-battery");
      expect(String(logged)).not.toContain("super-secret-token");
      expect(String(logged)).not.toContain("sessionId=abc123");
      logSpy.mockRestore();
      done();
    });
  });

  it("never logs the response body either", (done) => {
    const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const interceptor = new PiiRedactionInterceptor();
    const responseWithPii = { accessToken: "a-real-jwt-token", user: { email: "founder@example.com" } };

    interceptor.intercept(contextWithPii(), handlerReturning(responseWithPii)).subscribe(() => {
      const [logged] = logSpy.mock.calls[0];
      expect(String(logged)).not.toContain("a-real-jwt-token");
      expect(String(logged)).not.toContain("founder@example.com");
      logSpy.mockRestore();
      done();
    });
  });
});
