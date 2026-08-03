import { RowError } from "./product-import.util";

export interface ParsedStockUpdate {
  row: number;
  sku: string;
  quantity: number;
}

export interface StockImportParseResult {
  updates: ParsedStockUpdate[];
  unmappedFields: string[];
  rowErrors: RowError[];
}

const CORE_COLUMNS = new Set(["SKU", "Quantity"]);

/**
 * FR-39.3 - a narrower sibling of `parseProductImportCsv`: SKU + new
 * quantity only, never price/title/attributes. A bad row (missing SKU,
 * unparseable/negative quantity) is logged and skipped, same "never fails
 * the whole import" discipline as FR-18.2.
 */
export function parseStockImportCsv(rows: Record<string, string>[], header: string[]): StockImportParseResult {
  const unmappedFields = header.filter((h) => !CORE_COLUMNS.has(h));
  const updates: ParsedStockUpdate[] = [];
  const rowErrors: RowError[] = [];

  rows.forEach((row, i) => {
    const rowNumber = i + 2; // 1-indexed + header row
    const sku = row["SKU"]?.trim();
    if (!sku) {
      rowErrors.push({ row: rowNumber, message: "Missing SKU - row skipped." });
      return;
    }
    const quantityRaw = row["Quantity"]?.trim();
    const quantity = Number(quantityRaw);
    if (!quantityRaw || Number.isNaN(quantity) || quantity < 0) {
      rowErrors.push({ row: rowNumber, message: `Invalid Quantity "${quantityRaw}" for SKU "${sku}" - row skipped.` });
      return;
    }
    updates.push({ row: rowNumber, sku, quantity });
  });

  return { updates, unmappedFields, rowErrors };
}
