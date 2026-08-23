"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Field, Input } from "../ui/Field";
import { ApiError, api } from "../../lib/dashboard-api";

export interface Variant {
  id: string;
  sku: string;
  price: string;
  stockQuantity: number;
  baseCost: string | null;
}

/**
 * A product needs at least one variant (price + stock) before it's really
 * sellable - this is that variant list plus the "add one" mini-form,
 * always visible on the product edit screen rather than a separate page,
 * since for a v1.0 single-variant product this is really one task
 * ("set a price and stock"), not two.
 */
export function VariantsSection({
  storeId,
  productId,
  variants,
  onChange,
}: {
  storeId: string;
  productId: string;
  variants: Variant[];
  onChange: (variants: Variant[]) => void;
}) {
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [baseCost, setBaseCost] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addVariant(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    try {
      const created = await api.post<Variant>(`/stores/${storeId}/products/${productId}/variants`, {
        sku,
        price: Number(price),
        stockQuantity: Number(stockQuantity),
        baseCost: baseCost === "" ? undefined : Number(baseCost),
      });
      onChange([...variants, created]);
      setSku("");
      setPrice("");
      setStockQuantity("0");
      setBaseCost("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that variant.");
    } finally {
      setAdding(false);
    }
  }

  async function updateVariant(variantId: string, patch: { price?: number; stockQuantity?: number; baseCost?: number }) {
    const updated = await api.patch<Variant>(`/stores/${storeId}/products/${productId}/variants/${variantId}`, patch);
    onChange(variants.map((v) => (v.id === variantId ? updated : v)));
  }

  return (
    <Card>
      <CardHeader title="Price & stock" description="A product needs at least one of these to be sellable." />
      <CardBody className="space-y-4">
        {variants.length === 0 ? (
          <EmptyState title="No price set yet" description="Add a SKU, price, and stock quantity below to make this product sellable." />
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {variants.map((variant) => (
              <div key={variant.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-24 truncate text-sm text-ink-muted">{variant.sku}</span>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={variant.price}
                  onBlur={(e) => updateVariant(variant.id, { price: Number(e.target.value) })}
                  className="h-9 w-28 rounded-md border border-border px-2 text-sm transition-smooth-fast focus:border-accent"
                  aria-label={`Price for ${variant.sku}`}
                />
                <input
                  type="number"
                  defaultValue={variant.stockQuantity}
                  onBlur={(e) => updateVariant(variant.id, { stockQuantity: Number(e.target.value) })}
                  className="h-9 w-24 rounded-md border border-border px-2 text-sm transition-smooth-fast focus:border-accent"
                  aria-label={`Stock quantity for ${variant.sku}`}
                />
                <span className="text-xs text-ink-faint">qty</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={variant.baseCost ?? ""}
                  placeholder="Base cost"
                  onBlur={(e) => updateVariant(variant.id, { baseCost: e.target.value === "" ? undefined : Number(e.target.value) })}
                  className="h-9 w-28 rounded-md border border-border px-2 text-sm transition-smooth-fast focus:border-accent"
                  aria-label={`Base cost for ${variant.sku}`}
                />
                {variant.baseCost === null && (
                  <span className="text-xs text-warning" title="Cost of goods and net profit are understated until this is set.">
                    no cost set
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <form onSubmit={addVariant} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-3">
          <Field label="SKU">
            <Input value={sku} onChange={(e) => setSku(e.target.value)} required />
          </Field>
          <Field label="Price">
            <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </Field>
          <Field label="Stock quantity">
            <Input type="number" min="0" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} required />
          </Field>
          <Field label="Base cost" hint="What this unit costs you - powers P&L.">
            <Input type="number" step="0.01" min="0" value={baseCost} onChange={(e) => setBaseCost(e.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" loading={adding}>
            Add
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
