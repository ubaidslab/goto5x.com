import { parseProductImportCsv } from "./product-import.util";

const CORE_HEADER = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Option1 Name",
  "Option1 Value",
  "Variant SKU",
  "Variant Price",
  "Variant Inventory Qty",
  "Image Src",
];

describe("parseProductImportCsv (FR-18.1/18.2)", () => {
  it("groups a Shopify-style multi-row product into one product with multiple variants and images", () => {
    const rows = [
      {
        Handle: "tshirt",
        Title: "Cool T-Shirt",
        "Body (HTML)": "<p>desc</p>",
        "Option1 Name": "Size",
        "Option1 Value": "S",
        "Variant SKU": "TS-S",
        "Variant Price": "999",
        "Variant Inventory Qty": "10",
        "Image Src": "https://example.com/img1.jpg",
      },
      {
        Handle: "tshirt",
        Title: "",
        "Body (HTML)": "",
        "Option1 Name": "Size",
        "Option1 Value": "M",
        "Variant SKU": "TS-M",
        "Variant Price": "999",
        "Variant Inventory Qty": "5",
        "Image Src": "https://example.com/img2.jpg",
      },
    ];

    const result = parseProductImportCsv(rows, CORE_HEADER);

    expect(result.products).toHaveLength(1);
    expect(result.products[0].title).toBe("Cool T-Shirt");
    expect(result.products[0].description).toBe("<p>desc</p>");
    expect(result.products[0].variants).toHaveLength(2);
    expect(result.products[0].variants[0]).toEqual({
      sku: "TS-S",
      price: 999,
      stockQuantity: 10,
      attributes: { Size: "S" },
    });
    expect(result.products[0].imageUrls).toEqual([
      "https://example.com/img1.jpg",
      "https://example.com/img2.jpg",
    ]);
    expect(result.rowErrors).toEqual([]);
  });

  it("lists columns outside the core-field set as unmapped, never silently dropping them", () => {
    const header = [...CORE_HEADER, "Vendor", "Tags", "SEO Title"];
    const result = parseProductImportCsv([], header);
    expect(result.unmappedFields).toEqual(["Vendor", "Tags", "SEO Title"]);
  });

  it("skips a handle with no Title and logs a row error, without failing the whole import", () => {
    const rows = [
      {
        Handle: "no-title",
        Title: "",
        "Body (HTML)": "",
        "Option1 Name": "",
        "Option1 Value": "",
        "Variant SKU": "SKU1",
        "Variant Price": "500",
        "Variant Inventory Qty": "1",
        "Image Src": "",
      },
      {
        Handle: "valid-product",
        Title: "Valid Product",
        "Body (HTML)": "",
        "Option1 Name": "",
        "Option1 Value": "",
        "Variant SKU": "SKU2",
        "Variant Price": "500",
        "Variant Inventory Qty": "1",
        "Image Src": "",
      },
    ];

    const result = parseProductImportCsv(rows, CORE_HEADER);

    expect(result.products).toHaveLength(1);
    expect(result.products[0].title).toBe("Valid Product");
    expect(result.rowErrors).toHaveLength(1);
    expect(result.rowErrors[0].message).toContain("no-title");
  });

  it("skips a row with an invalid Variant Price and logs a row error", () => {
    const rows = [
      {
        Handle: "bad-price",
        Title: "Bad Price Product",
        "Body (HTML)": "",
        "Option1 Name": "",
        "Option1 Value": "",
        "Variant SKU": "SKU1",
        "Variant Price": "not-a-number",
        "Variant Inventory Qty": "1",
        "Image Src": "",
      },
    ];

    const result = parseProductImportCsv(rows, CORE_HEADER);

    expect(result.products).toHaveLength(0);
    expect(result.rowErrors.some((e) => e.message.includes("Invalid Variant Price"))).toBe(true);
  });

  it("generates a fallback SKU when Variant SKU is blank", () => {
    const rows = [
      {
        Handle: "no-sku",
        Title: "No Sku Product",
        "Body (HTML)": "",
        "Option1 Name": "",
        "Option1 Value": "",
        "Variant SKU": "",
        "Variant Price": "100",
        "Variant Inventory Qty": "0",
        "Image Src": "",
      },
    ];

    const result = parseProductImportCsv(rows, CORE_HEADER);
    expect(result.products[0].variants[0].sku).toBe("no-sku-1");
  });
});
