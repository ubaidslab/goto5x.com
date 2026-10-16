import { ArgumentsHost, BadRequestException, InternalServerErrorException } from "@nestjs/common";

// @sentry/node's named exports aren't configurable, so jest.spyOn() on the
// imported namespace throws "Cannot redefine property" - a full jest.mock()
// of the module is the correct way to intercept it here.
jest.mock("@sentry/node", () => ({ captureException: jest.fn() }));

import * as Sentry from "@sentry/node";
import { HttpExceptionFilter } from "./http-exception.filter";

/** D116 item 6 (Stage 0) - error tracking/alerting: a real server fault (5xx) must reach Sentry; a client error (4xx) must not. */
describe("HttpExceptionFilter (D116 item 6)", () => {
  function hostWithResponse() {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;
    return { host, response };
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("reports a 5xx exception to Sentry", () => {
    const filter = new HttpExceptionFilter();
    const { host } = hostWithResponse();
    const exception = new InternalServerErrorException("boom");

    filter.catch(exception, host);

    expect(Sentry.captureException).toHaveBeenCalledWith(exception);
  });

  it("does not report an ordinary 4xx client error to Sentry", () => {
    const filter = new HttpExceptionFilter();
    const { host } = hostWithResponse();

    filter.catch(new BadRequestException("bad input"), host);

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
