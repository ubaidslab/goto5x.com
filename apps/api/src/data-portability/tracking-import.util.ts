import { RowError } from "./product-import.util";

export interface ParsedTrackingRow {
  row: number;
  orderNumber: number;
  trackingId: string;
  carrier?: string;
}

export interface TrackingImportParseResult {
  rows: ParsedTrackingRow[];
  unmappedFields: string[];
  rowErrors: RowError[];
}

const CORE_COLUMNS = new Set(["OrderNumber", "Courier", "TrackingId"]);

/**
 * SRS §5.59/FR-59.3(a) - a fourth narrow sibling of
 * `parseProductImportCsv`/`parseStockImportCsv`/`parseAdSpendImportCsv`:
 * OrderNumber/Courier(optional)/TrackingId only. `OrderNumber` is the
 * per-store human-readable identifier from FR-59.1, not a UUID - resolving
 * it to an actual order happens in the worker (this parser only validates
 * shape). A bad row (missing/non-numeric OrderNumber, missing TrackingId)
 * is logged and skipped, same "never fails the whole import" discipline as
 * FR-18.2.
 */
export function parseTrackingImportCsv(rows: Record<string, string>[], header: string[]): TrackingImportParseResult {
  const unmappedFields = header.filter((h) => !CORE_COLUMNS.has(h));
  const parsed: ParsedTrackingRow[] = [];
  const rowErrors: RowError[] = [];

  rows.forEach((row, i) => {
    const rowNumber = i + 2; // 1-indexed + header row
    const orderNumberRaw = row["OrderNumber"]?.trim();
    const orderNumber = Number(orderNumberRaw);
    if (!orderNumberRaw || !Number.isInteger(orderNumber) || orderNumber <= 0) {
      rowErrors.push({ row: rowNumber, message: `Invalid OrderNumber "${orderNumberRaw ?? ""}" - row skipped.` });
      return;
    }
    const trackingId = row["TrackingId"]?.trim();
    if (!trackingId) {
      rowErrors.push({ row: rowNumber, message: `Missing TrackingId for OrderNumber "${orderNumberRaw}" - row skipped.` });
      return;
    }
    parsed.push({ row: rowNumber, orderNumber, trackingId, carrier: row["Courier"]?.trim() || undefined });
  });

  return { rows: parsed, unmappedFields, rowErrors };
}
