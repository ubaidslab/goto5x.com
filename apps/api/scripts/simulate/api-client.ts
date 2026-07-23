/**
 * Module 21 - a thin fetch wrapper shared by seed.ts (populate) and
 * traffic.ts (load-drive): every call records its own latency and
 * success/failure into the shared `Metrics` collector, tagged by a
 * caller-supplied "endpoint group" (e.g. "storefront:product-detail",
 * "checkout:mark-paid") so the final report can break p50/p95/p99 and
 * error counts down by group rather than one undifferentiated number.
 */

export interface RequestSample {
  group: string;
  durationMs: number;
  status: number;
  ok: boolean;
  errorType?: string;
}

export class Metrics {
  samples: RequestSample[] = [];

  record(sample: RequestSample): void {
    this.samples.push(sample);
  }

  groups(): string[] {
    return [...new Set(this.samples.map((s) => s.group))].sort();
  }
}

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly metrics: Metrics,
  ) {}

  async request(
    group: string,
    method: string,
    path: string,
    options: { body?: unknown; token?: string; hostname?: string } = {},
  ): Promise<{ status: number; body: any }> {
    const start = Date.now();
    let status = 0;
    let ok = false;
    let errorType: string | undefined;
    let body: any = undefined;

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (options.token) headers.Authorization = `Bearer ${options.token}`;
      if (options.hostname) headers["X-Simulated-Host"] = options.hostname;

      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
      status = res.status;
      ok = res.ok;
      if (!ok) errorType = `http_${status}`;
      const text = await res.text();
      body = text ? JSON.parse(text) : undefined;
    } catch (err) {
      errorType = err instanceof Error ? err.name || "fetch_error" : "unknown_error";
    } finally {
      this.metrics.record({ group, durationMs: Date.now() - start, status, ok, errorType });
    }

    return { status, body };
  }

  get(group: string, path: string, token?: string) {
    return this.request(group, "GET", path, { token });
  }

  post(group: string, path: string, requestBody?: unknown, token?: string) {
    return this.request(group, "POST", path, { body: requestBody, token });
  }

  patch(group: string, path: string, requestBody?: unknown, token?: string) {
    return this.request(group, "PATCH", path, { body: requestBody, token });
  }

  /** Multipart upload (Module 2's `POST /stores/:storeId/media`) - the one call shape a plain JSON body can't express. */
  async uploadFile(
    group: string,
    path: string,
    fileBuffer: Buffer,
    filename: string,
    mimetype: string,
    fields: Record<string, string>,
    token: string,
  ): Promise<{ status: number; body: any }> {
    const start = Date.now();
    let status = 0;
    let ok = false;
    let errorType: string | undefined;
    let body: any = undefined;

    try {
      const form = new FormData();
      form.append("file", new Blob([fileBuffer], { type: mimetype }), filename);
      for (const [key, value] of Object.entries(fields)) form.append(key, value);

      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      status = res.status;
      ok = res.ok;
      if (!ok) errorType = `http_${status}`;
      const text = await res.text();
      body = text ? JSON.parse(text) : undefined;
    } catch (err) {
      errorType = err instanceof Error ? err.name || "fetch_error" : "unknown_error";
    } finally {
      this.metrics.record({ group, durationMs: Date.now() - start, status, ok, errorType });
    }

    return { status, body };
  }
}

/** Bounded concurrency - runs `items` through `worker` with at most `concurrency` in flight at once. */
export async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}
