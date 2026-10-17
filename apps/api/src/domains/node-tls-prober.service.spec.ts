import { request } from "https";
import { NodeTlsProberService } from "./node-tls-prober.service";

/**
 * Founder item 6 (D99, 2026-10-11) - rewritten from a real HTTPS handshake
 * against the live internet to a mocked `https.request`. This sandbox's
 * own container can't reach www.google.com over raw TLS (confirmed
 * directly), so the real-network version was exactly the flake item 6
 * flagged. What's under test is this service's own resolve-true-on-
 * response / resolve-false-on-error/timeout wrapping around Node's
 * `https.request`, not any real certificate or hostname.
 */
jest.mock("https", () => ({ request: jest.fn() }));

type FakeRequest = {
  on: jest.Mock;
  end: jest.Mock;
  destroy: jest.Mock;
  trigger: (event: string, ...args: unknown[]) => void;
};

function fakeRequest(): FakeRequest {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;
    }),
    end: jest.fn(),
    destroy: jest.fn(),
    trigger: (event, ...args) => handlers[event]?.(...args),
  };
}

describe("NodeTlsProberService (mocked https.request)", () => {
  const prober = new NodeTlsProberService();
  const mockedRequest = request as unknown as jest.Mock;

  afterEach(() => {
    mockedRequest.mockReset();
  });

  it("resolves true once a response comes back (a successful handshake)", async () => {
    let req!: FakeRequest;
    mockedRequest.mockImplementation((_options: unknown, callback: (res: { resume: jest.Mock }) => void) => {
      req = fakeRequest();
      queueMicrotask(() => callback({ resume: jest.fn() }));
      return req;
    });

    await expect(prober.probe("www.google.com")).resolves.toBe(true);
    expect(req.end).toHaveBeenCalled();
  });

  it("resolves false when the request errors (e.g. a hostname that doesn't resolve at all)", async () => {
    let req!: FakeRequest;
    mockedRequest.mockImplementation(() => {
      req = fakeRequest();
      queueMicrotask(() => req.trigger("error", Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" })));
      return req;
    });

    await expect(prober.probe("this-domain-absolutely-does-not-exist-uzeyn-12345.invalid")).resolves.toBe(false);
  });

  it("resolves false and destroys the socket on timeout", async () => {
    let req!: FakeRequest;
    mockedRequest.mockImplementation(() => {
      req = fakeRequest();
      queueMicrotask(() => req.trigger("timeout"));
      return req;
    });

    await expect(prober.probe("slow-host.example")).resolves.toBe(false);
    expect(req.destroy).toHaveBeenCalled();
  });
});
