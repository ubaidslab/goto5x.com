import { RowError } from "./product-import.util";

export interface ParsedAdSpendEntry {
  row: number;
  periodStart: string;
  periodEnd: string;
  amount: number;
  note?: string;
}

export interface AdSpendImportParseResult {
  entries: ParsedAdSpendEntry[];
  unmappedFields: string[];
  rowErrors: RowError[];
}

const CORE_COLUMNS = new Set(["PeriodStart", "PeriodEnd", "Amount", "Note"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Module 31 (SRS §5.42/FR-42.1) - a third narrow sibling of
 * `parseProductImportCsv`/`parseStockImportCsv`: PeriodStart/PeriodEnd
 * (YYYY-MM-DD)/Amount/optional Note only, creating AdSpendEntry rows. A
 * bad row (missing/malformed dates, end before start, unparseable/negative
 * amount) is logged and skipped, same "never fails the whole import"
 * discipline as FR-18.2.
 */
export function parseAdSpendImportCsv(rows: Record<string, string>[], header: string[]): AdSpendImportParseResult {
  const unmappedFields = header.filter((h) => !CORE_COLUMNS.has(h));
  const entries: ParsedAdSpendEntry[] = [];
  const rowErrors: RowError[] = [];

  rows.forEach((row, i) => {
    const rowNumber = i + 2; // 1-indexed + header row
    const periodStart = row["PeriodStart"]?.trim();
    const periodEnd = row["PeriodEnd"]?.trim();
    if (!periodStart || !DATE_RE.test(periodStart)) {
      rowErrors.push({ row: rowNumber, message: `Invalid PeriodStart "${periodStart ?? ""}" (expected YYYY-MM-DD) - row skipped.` });
      return;
    }
    if (!periodEnd || !DATE_RE.test(periodEnd)) {
      rowErrors.push({ row: rowNumber, message: `Invalid PeriodEnd "${periodEnd ?? ""}" (expected YYYY-MM-DD) - row skipped.` });
      return;
    }
    if (periodEnd < periodStart) {
      rowErrors.push({ row: rowNumber, message: `PeriodEnd "${periodEnd}" is before PeriodStart "${periodStart}" - row skipped.` });
      return;
    }
    const amountRaw = row["Amount"]?.trim();
    const amount = Number(amountRaw);
    if (!amountRaw || Number.isNaN(amount) || amount < 0) {
      rowErrors.push({ row: rowNumber, message: `Invalid Amount "${amountRaw}" - row skipped.` });
      return;
    }
    entries.push({ row: rowNumber, periodStart, periodEnd, amount, note: row["Note"]?.trim() || undefined });
  });

  return { entries, unmappedFields, rowErrors };
}
