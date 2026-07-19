export interface ParsedVariantRow {
  sku: string;
  price: number;
  stockQuantity: number;
  attributes: Record<string, string>;
}

export interface ParsedProduct {
  title: string;
  description: string;
  variants: ParsedVariantRow[];
  imageUrls: string[];
}

export interface RowError {
  row: number;
  message: string;
}

export interface ProductImportParseResult {
  products: ParsedProduct[];
  unmappedFields: string[];
  rowErrors: RowError[];
}

/**
 * FR-18.1 - the Shopify product-export CSV's core-field columns (bounded per
 * founder decision, v0.6). Anything else in the uploaded file is reported as
 * unmapped, never silently dropped.
 */
const CORE_COLUMNS = new Set([
  "Handle",
  "Title",
  "Body (HTML)",
  "Option1 Name",
  "Option1 Value",
  "Option2 Name",
  "Option2 Value",
  "Option3 Name",
  "Option3 Value",
  "Variant SKU",
  "Variant Price",
  "Variant Inventory Qty",
  "Image Src",
]);

/**
 * Pure, unit-testable - the Shopify export format repeats a product's
 * `Handle` across one row per variant/image, so rows are grouped by handle
 * before a Product/ProductVariant shape can be built. A bad row (missing
 * title, unparseable price) is logged and skipped - it never fails the
 * whole import (FR-18.2).
 */
export function parseProductImportCsv(rows: Record<string, string>[], header: string[]): ProductImportParseResult {
  const unmappedFields = header.filter((h) => !CORE_COLUMNS.has(h));

  const groups = new Map<string, { rows: Record<string, string>[]; rowNumbers: number[] }>();
  rows.forEach((row, i) => {
    const rowNumber = i + 2; // 1-indexed + header row
    const handle = row["Handle"]?.trim() || row["Title"]?.trim() || `row-${rowNumber}`;
    const group = groups.get(handle) ?? { rows: [], rowNumbers: [] };
    group.rows.push(row);
    group.rowNumbers.push(rowNumber);
    groups.set(handle, group);
  });

  const products: ParsedProduct[] = [];
  const rowErrors: RowError[] = [];

  for (const [handle, { rows: groupRows, rowNumbers }] of groups) {
    const titleRow = groupRows.find((r) => r["Title"]?.trim());
    const title = titleRow?.["Title"]?.trim();
    if (!title) {
      rowErrors.push({ row: rowNumbers[0], message: `Handle "${handle}" has no Title - skipped.` });
      continue;
    }

    const variants: ParsedVariantRow[] = [];
    groupRows.forEach((row, idx) => {
      const priceRaw = row["Variant Price"]?.trim();
      if (!priceRaw) return; // an image-only row carries no variant data
      const price = Number(priceRaw);
      if (Number.isNaN(price) || price < 0) {
        rowErrors.push({ row: rowNumbers[idx], message: `Invalid Variant Price "${priceRaw}" - row skipped.` });
        return;
      }
      const attributes: Record<string, string> = {};
      for (const n of [1, 2, 3]) {
        const name = row[`Option${n} Name`]?.trim();
        const value = row[`Option${n} Value`]?.trim();
        if (name && value) attributes[name] = value;
      }
      const stockRaw = row["Variant Inventory Qty"]?.trim();
      const stockQuantity = stockRaw ? Number(stockRaw) : 0;
      variants.push({
        sku: row["Variant SKU"]?.trim() || `${handle}-${idx + 1}`,
        price,
        stockQuantity: Number.isNaN(stockQuantity) ? 0 : Math.max(0, stockQuantity),
        attributes,
      });
    });

    if (variants.length === 0) {
      rowErrors.push({ row: rowNumbers[0], message: `Handle "${handle}" has no row with a valid Variant Price - skipped.` });
      continue;
    }

    const imageUrls = [...new Set(groupRows.map((r) => r["Image Src"]?.trim()).filter((u): u is string => Boolean(u)))];

    products.push({ title, description: titleRow?.["Body (HTML)"]?.trim() ?? "", variants, imageUrls });
  }

  return { products, unmappedFields, rowErrors };
}
