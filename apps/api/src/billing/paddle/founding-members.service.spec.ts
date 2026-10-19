import { PrismaAdminService } from "../../prisma/prisma-admin.service";
import { FoundingMembersService } from "./founding-members.service";

describe("FoundingMembersService", () => {
  it("claims the next ordinal when the counter is still under the cap", async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ count: 47 }]);
    const prismaAdmin = { $queryRaw: queryRaw } as unknown as PrismaAdminService;
    const service = new FoundingMembersService(prismaAdmin);

    const ordinal = await service.claimOrdinalIfEligible();

    expect(ordinal).toBe(47);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns null once the counter is already at the 100-member cap (the UPDATE's WHERE clause matches no row)", async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const prismaAdmin = { $queryRaw: queryRaw } as unknown as PrismaAdminService;
    const service = new FoundingMembersService(prismaAdmin);

    const ordinal = await service.claimOrdinalIfEligible();

    expect(ordinal).toBeNull();
  });

  it("uses the caller's own transaction client when one is passed, not the default admin client", async () => {
    const defaultQueryRaw = jest.fn().mockResolvedValue([{ count: 1 }]);
    const txQueryRaw = jest.fn().mockResolvedValue([{ count: 1 }]);
    const prismaAdmin = { $queryRaw: defaultQueryRaw } as unknown as PrismaAdminService;
    const tx = { $queryRaw: txQueryRaw } as unknown as Parameters<FoundingMembersService["claimOrdinalIfEligible"]>[0];
    const service = new FoundingMembersService(prismaAdmin);

    await service.claimOrdinalIfEligible(tx);

    expect(txQueryRaw).toHaveBeenCalledTimes(1);
    expect(defaultQueryRaw).not.toHaveBeenCalled();
  });
});
