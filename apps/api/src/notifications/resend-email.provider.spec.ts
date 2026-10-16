import { ConfigService } from "@nestjs/config";
import { ResendEmailProvider } from "./resend-email.provider";

describe("ResendEmailProvider (D83)", () => {
  function makeProvider(env: Record<string, string>) {
    const config = new ConfigService(env);
    return new ResendEmailProvider(config);
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("throws clearly when EMAIL_PROVIDER_API_KEY is not configured", async () => {
    const provider = makeProvider({ EMAIL_FROM_ADDRESS: "no-reply@uzeyn.com" });
    await expect(provider.send({ to: "buyer@example.com", subject: "Hi", body: "Body" })).rejects.toThrow(
      'EMAIL_PROVIDER_API_KEY is required when EMAIL_PROVIDER="resend".',
    );
  });

  it("posts to Resend's API with the configured from address, bearer key, and no attachment field when none is given", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => "" });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = makeProvider({ EMAIL_PROVIDER_API_KEY: "re_test_key", EMAIL_FROM_ADDRESS: "no-reply@uzeyn.com" });
    await provider.send({ to: "buyer@example.com", subject: "Hi", body: "Body text" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
    const payload = JSON.parse(init.body);
    expect(payload).toEqual({ from: "no-reply@uzeyn.com", to: ["buyer@example.com"], subject: "Hi", text: "Body text" });
  });

  it("fetches and base64-inlines a given attachment URL's bytes", async () => {
    // Buffer.from(str).buffer is Node's pooled allocation, not a tightly-
    // sized ArrayBuffer (small Buffers share an 8KB pool) - slice to the
    // real byte range so this matches what a real Response.arrayBuffer()
    // actually returns.
    const bytes = Buffer.from("pdf-bytes");
    const exactArrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => exactArrayBuffer })
      .mockResolvedValueOnce({ ok: true, text: async () => "" });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = makeProvider({ EMAIL_PROVIDER_API_KEY: "re_test_key", EMAIL_FROM_ADDRESS: "no-reply@uzeyn.com" });
    await provider.send({ to: "buyer@example.com", subject: "Invoice", body: "See attached", attachmentUrl: "https://cdn.example.com/invoices/123.pdf" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://cdn.example.com/invoices/123.pdf");
    const sendCallPayload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(sendCallPayload.attachments).toEqual([{ filename: "123.pdf", content: Buffer.from("pdf-bytes").toString("base64") }]);
  });

  it("sends without the attachment, not failing the whole email, when fetching the attachment fails", async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ ok: true, text: async () => "" });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = makeProvider({ EMAIL_PROVIDER_API_KEY: "re_test_key", EMAIL_FROM_ADDRESS: "no-reply@uzeyn.com" });
    await provider.send({ to: "buyer@example.com", subject: "Invoice", body: "See attached", attachmentUrl: "https://cdn.example.com/invoices/123.pdf" });

    const sendCallPayload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(sendCallPayload.attachments).toBeUndefined();
  });

  it("throws with the response body when Resend returns a non-OK status", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 422, text: async () => '{"message":"invalid from address"}' });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = makeProvider({ EMAIL_PROVIDER_API_KEY: "re_test_key", EMAIL_FROM_ADDRESS: "no-reply@uzeyn.com" });
    await expect(provider.send({ to: "buyer@example.com", subject: "Hi", body: "Body" })).rejects.toThrow(/Resend API returned 422/);
  });
});
