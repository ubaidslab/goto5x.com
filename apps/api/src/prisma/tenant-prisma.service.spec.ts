import { TenantPrismaService } from "./tenant-prisma.service";

/**
 * Phase B pre-launch audit finding (RLS defense-in-depth). Tenant isolation
 * rests on TenantPrismaService.run() validating `sellerId` as a
 * syntactically-correct UUID before interpolating it into a raw
 * `SET LOCAL app.current_seller_id = '...'` statement (Postgres's wire
 * protocol can't parameterize SET LOCAL). It's correctly guarded today -
 * these tests exist so a future refactor can't silently weaken or remove
 * that guard without a test going red. Unit-level (a fake PrismaRuntimeService,
 * no real DB) because the guard itself throws before ever reaching
 * `$transaction()` - proving the guard doesn't need a real Postgres session.
 */
describe("TenantPrismaService.run() - UUID validation before SET LOCAL interpolation", () => {
  function buildService() {
    const executeRawUnsafe = jest.fn().mockResolvedValue(undefined);
    const tx = { $executeRawUnsafe: executeRawUnsafe };
    const transaction = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx));
    const prisma = { $transaction: transaction };
    const service = new TenantPrismaService(prisma as any);
    return { service, executeRawUnsafe, transaction };
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

  it("accepts a syntactically-correct lowercase UUID and interpolates exactly that value", async () => {
    const { service, executeRawUnsafe } = buildService();
    const sellerId = "123e4567-e89b-42d3-a456-426614174000";
    const result = await service.run(sellerId, async () => "ok");
    expect(result).toBe("ok");
    expect(executeRawUnsafe).toHaveBeenCalledWith(`SET LOCAL app.current_seller_id = '${sellerId}'`);
  });

  it("accepts a syntactically-correct uppercase UUID (case-insensitive, matches Postgres's own uuid type)", async () => {
    const { service, executeRawUnsafe } = buildService();
    const sellerId = "123E4567-E89B-42D3-A456-426614174000";
    await service.run(sellerId, async () => "ok");
    expect(executeRawUnsafe).toHaveBeenCalledWith(`SET LOCAL app.current_seller_id = '${sellerId}'`);
  });
});
