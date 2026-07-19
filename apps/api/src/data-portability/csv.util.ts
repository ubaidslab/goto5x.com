import { parse } from "csv-parse/sync";

/** FR-18.1 - streaming CSV parser (csv-parse), not a full ETL framework, per docs/tech-stack.md. */
export function parseCsv(content: string): Record<string, string>[] {
  return parse(content, { columns: true, skip_empty_lines: true, trim: true });
}

export function csvHeader(content: string): string[] {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  return parse(firstLine, { columns: false, skip_empty_lines: true })[0] ?? [];
}

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Minimal CSV writer - no external stringify dependency needed for a handful of fixed columns. */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const lines = [header.map((h) => escapeCsvField(h)).join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvField(String(cell))).join(","));
  }
  return lines.join("\n");
}
