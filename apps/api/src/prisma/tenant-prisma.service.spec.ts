import { TenantPrismaService } from "./tenant-prisma.service";

/**
 * Phase B pre-launch audit finding (RLS defense-in-depth), updated for D88
 * item 2. Tenant isolation rests on TenantPrismaService.run() setting
 * `app.current_seller_id` via `set_config('app.current_seller_id', $1,
 * true)` - a plain SQL function call, so the sellerId travels as a real
 * bind parameter through Prisma's tagged-template `$executeRaw`, never
 * concatenated into the SQL text (unlike the retired `SET LOCAL ... = '...'`
 * form, whose own wire protocol can't parameterize a SET's value at all).
 * The UUID_RE check below is fail-fast validation now, not the injection
 * defense - that's the parameterization itself - but it's still correctly
 * guarded, so these tests still exist to catch a future refactor silently
 * weakening or removing it. Unit-level (a fake PrismaRuntimeService, no
 * real DB) because the guard throws before ever reaching `$transaction()`.
 */
describe("TenantPrismaService.run() - UUID validation before set_config() parameterization", () => {
  function buildService() {
    const executeRaw = jest.fn().mockResolvedValue(undefined);
    const tx = { $executeRaw: executeRaw };
    const transaction = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx));
    const prisma = { $transaction: transaction };
    const service = new TenantPrismaService(prisma as any);
    return { service, executeRaw, transaction };
  }

  const REJECTED_INPUTS: Array<[string, unknown]> = [
    ["a SQL-fragment string masquerading as an id", "'; DROP TABLE sellers; --"],
    ["a UUID immediately followed by a SQL fragment", "00000000-0000-4000-8000-000000000000'; DROP TABLE sellers; --"],
    ["an empty string", ""],
    ["whitespace only", "   "],
    ["null", null],
    ["undefined", undefined],
    ["a unicode/homoglyph string shaped like a UUID", "аааааааа-аааа-4ааа-8ааа-аааааааааааа"], // Cyrillic 'а', not ASCII
    ["an oversized string (valid UUID prefix, huge trailing garbage)", "00000000-0000-4000-8000-000000000000" + "x".repeat(10_000)],
    ["a UUID missing a hyphen", "00000000000-4000-8000-000000000000"],
    ["a UUID with an extra hyphen", "00000000-0000-4000-8000-0000-00000000"],
    ["a numeric id (not a UUID at all)", "12345"],
    ["a UUID with an embedded single quote before the closing one", "00000000-0000-4000-8000-00000000000'"],
    ["a UUID with a trailing newline", "00000000-0000-4000-8000-000000000000\n"],
    ["a UUID with a leading space", " 00000000-0000-4000-8000-000000000000"],
  ];

  it.each(REJECTED_INPUTS)("rejects %s without ever opening a transaction", async (_label, input) => {
    const { service, transaction } = buildService();
    await expect(service.run(input as string, async () => "unreachable")).rejects.toThrow(
      /non-UUID sellerId/,
    );
    // The guard must fire before $transaction() is ever called - proves a
    // rejected id can never reach the raw SQL interpolation at all, not just
    // that the eventual query happens to fail.
    expect(transaction).not.toHaveBeenCalled();
  });

  it("accepts a syntactically-correct lowercase UUID, passed as a bind parameter rather than concatenated into the SQL text", async () => {
    const { service, executeRaw } = buildService();
    const sellerId = "123e4567-e89b-42d3-a456-426614174000";
    const result = await service.run(sellerId, async () => "ok");
    expect(result).toBe("ok");
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = executeRaw.mock.calls[0];
    // The core property this change is about: the sellerId never appears in
    // the SQL text itself, only as a separate bind value - so even a
    // sellerId that somehow bypassed UUID_RE above couldn't break out of the
    // query, because it's never part of the query's text to begin with.
    expect(strings.join("")).not.toContain(sellerId);
    expect(strings.join("")).toContain("set_config('app.current_seller_id'");
    expect(values).toEqual([sellerId]);
  });

  it("accepts a syntactically-correct uppercase UUID (case-insensitive, matches Postgres's own uuid type)", async () => {
    const { service, executeRaw } = buildService();
    const sellerId = "123E4567-E89B-42D3-A456-426614174000";
    await service.run(sellerId, async () => "ok");
    const [strings, ...values] = executeRaw.mock.calls[0];
    expect(strings.join("")).not.toContain(sellerId);
    expect(values).toEqual([sellerId]);
  });
});
