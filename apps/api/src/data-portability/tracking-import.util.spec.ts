import { parseTrackingImportCsv } from "./tracking-import.util";

describe("parseTrackingImportCsv", () => {
  const header = ["OrderNumber", "Courier", "TrackingId"];

  it("parses valid rows, including an optional Courier", () => {
    const rows = [
      { OrderNumber: "1042", Courier: "TCS", TrackingId: "TCS-9981" },
      { OrderNumber: "1043", Courier: "", TrackingId: "LEO-4412" },
    ];
    const result = parseTrackingImportCsv(rows, header);
    expect(result.rowErrors).toHaveLength(0);
    expect(result.rows).toEqual([
      { row: 2, orderNumber: 1042, trackingId: "TCS-9981", carrier: "TCS" },
      { row: 3, orderNumber: 1043, trackingId: "LEO-4412", carrier: undefined },
    ]);
  });

  it("rejects a missing or non-numeric OrderNumber", () => {
    const rows = [
      { OrderNumber: "", Courier: "TCS", TrackingId: "TCS-1" },
      { OrderNumber: "abc", Courier: "TCS", TrackingId: "TCS-2" },
    ];
    const result = parseTrackingImportCsv(rows, header);
    expect(result.rows).toHaveLength(0);
    expect(result.rowErrors).toHaveLength(2);
    expect(result.rowErrors[0].message).toContain("Invalid OrderNumber");
  });

  it("rejects a zero or negative OrderNumber", () => {
    const rows = [{ OrderNumber: "0", Courier: "TCS", TrackingId: "TCS-1" }];
    const result = parseTrackingImportCsv(rows, header);
    expect(result.rows).toHaveLength(0);
    expect(result.rowErrors[0].message).toContain("Invalid OrderNumber");
  });

  it("rejects a missing TrackingId", () => {
    const rows = [{ OrderNumber: "1042", Courier: "TCS", TrackingId: "" }];
    const result = parseTrackingImportCsv(rows, header);
    expect(result.rows).toHaveLength(0);
    expect(result.rowErrors[0].message).toContain("Missing TrackingId");
  });

  it("surfaces a column outside the core set as unmapped", () => {
    const result = parseTrackingImportCsv([], ["OrderNumber", "Courier", "TrackingId", "Notes"]);
    expect(result.unmappedFields).toEqual(["Notes"]);
  });
});
