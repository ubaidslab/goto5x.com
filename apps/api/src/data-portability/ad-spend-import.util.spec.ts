import { parseAdSpendImportCsv } from "./ad-spend-import.util";

describe("parseAdSpendImportCsv", () => {
  const header = ["PeriodStart", "PeriodEnd", "Amount", "Note"];

  it("parses valid rows, including an optional Note", () => {
    const rows = [
      { PeriodStart: "2026-01-01", PeriodEnd: "2026-01-31", Amount: "500", Note: "Facebook Jan" },
      { PeriodStart: "2026-02-01", PeriodEnd: "2026-02-28", Amount: "300", Note: "" },
    ];
    const result = parseAdSpendImportCsv(rows, header);
    expect(result.rowErrors).toHaveLength(0);
    expect(result.entries).toEqual([
      { row: 2, periodStart: "2026-01-01", periodEnd: "2026-01-31", amount: 500, note: "Facebook Jan" },
      { row: 3, periodStart: "2026-02-01", periodEnd: "2026-02-28", amount: 300, note: undefined },
    ]);
  });

  it("rejects a malformed date and skips the row", () => {
    const rows = [{ PeriodStart: "01-01-2026", PeriodEnd: "2026-01-31", Amount: "500" }];
    const result = parseAdSpendImportCsv(rows, header);
    expect(result.entries).toHaveLength(0);
    expect(result.rowErrors[0].message).toContain("Invalid PeriodStart");
  });

  it("rejects PeriodEnd before PeriodStart", () => {
    const rows = [{ PeriodStart: "2026-02-01", PeriodEnd: "2026-01-01", Amount: "500" }];
    const result = parseAdSpendImportCsv(rows, header);
    expect(result.entries).toHaveLength(0);
    expect(result.rowErrors[0].message).toContain("before PeriodStart");
  });

  it("rejects a negative or non-numeric Amount", () => {
    const rows = [
      { PeriodStart: "2026-01-01", PeriodEnd: "2026-01-31", Amount: "-10" },
      { PeriodStart: "2026-01-01", PeriodEnd: "2026-01-31", Amount: "abc" },
    ];
    const result = parseAdSpendImportCsv(rows, header);
    expect(result.entries).toHaveLength(0);
    expect(result.rowErrors).toHaveLength(2);
  });

  it("surfaces a column outside the core set as unmapped", () => {
    const result = parseAdSpendImportCsv([], ["PeriodStart", "PeriodEnd", "Amount", "Campaign"]);
    expect(result.unmappedFields).toEqual(["Campaign"]);
  });
});
