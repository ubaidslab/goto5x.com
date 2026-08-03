import { parseStockImportCsv } from "./stock-import.util";

describe("parseStockImportCsv", () => {
  it("parses valid SKU/Quantity rows", () => {
    const rows = [
      { SKU: "SKU-1", Quantity: "10" },
      { SKU: "SKU-2", Quantity: "0" },
    ];
    const result = parseStockImportCsv(rows, ["SKU", "Quantity"]);
    expect(result.updates).toEqual([
      { row: 2, sku: "SKU-1", quantity: 10 },
      { row: 3, sku: "SKU-2", quantity: 0 },
    ]);
    expect(result.rowErrors).toHaveLength(0);
    expect(result.unmappedFields).toHaveLength(0);
  });

  it("skips a row with a missing SKU and records a row error", () => {
    const rows = [{ SKU: "", Quantity: "5" }];
    const result = parseStockImportCsv(rows, ["SKU", "Quantity"]);
    expect(result.updates).toHaveLength(0);
    expect(result.rowErrors[0].message).toMatch(/Missing SKU/);
  });

  it("skips a row with a negative or non-numeric Quantity", () => {
    const rows = [
      { SKU: "SKU-1", Quantity: "-5" },
      { SKU: "SKU-2", Quantity: "not-a-number" },
    ];
    const result = parseStockImportCsv(rows, ["SKU", "Quantity"]);
    expect(result.updates).toHaveLength(0);
    expect(result.rowErrors).toHaveLength(2);
  });

  it("surfaces a column outside SKU/Quantity as unmapped, never silently dropped", () => {
    const rows = [{ SKU: "SKU-1", Quantity: "10", Price: "500" }];
    const result = parseStockImportCsv(rows, ["SKU", "Quantity", "Price"]);
    expect(result.unmappedFields).toEqual(["Price"]);
  });
});
