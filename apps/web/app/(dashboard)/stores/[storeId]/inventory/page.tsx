"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

interface InventoryVariant {
  variantId: string;
  productId: string;
  productTitle: string;
  productStatus: string;
  sku: string;
  stockQuantity: number;
  isLowStock: boolean;
}

interface InventoryResponse {
  lowStockThreshold: number;
  variants: InventoryVariant[];
}

interface StockAdjustment {
  id: string;
  quantityBefore: number;
  quantityAfter: number;
  reason: string;
  createdAt: string;
}

type AdjustType = "increment" | "decrement" | "set";

export default function InventoryPage({ params }: { params: { storeId: string } }) {
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedVariantId, setExpandedVariantId] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [adjustType, setAdjustType] = useState<AdjustType>("increment");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadInventory() {
    api
      .get<InventoryResponse>(`/stores/${params.storeId}/inventory`)
      .then(setData)
      .catch(() => setData(null));
  }

  useEffect(loadInventory, [params.storeId]);

  function toggleRow(variant: InventoryVariant) {
    if (expandedVariantId === variant.variantId) {
      setExpandedVariantId(null);
      return;
    }
    setExpandedVariantId(variant.variantId);
    setAdjustType("increment");
    setAdjustAmount("");
    setAdjustReason("");
    setAdjustments([]);
    api
      .get<StockAdjustment[]>(`/stores/${params.storeId}/inventory/${variant.variantId}/adjustments`)
      .then(setAdjustments)
      .catch(() => setAdjustments([]));
  }

  async function submitAdjustment(variantId: string) {
    setError(null);
    const amount = Number(adjustAmount);
    if (!Number.isFinite(amount) || amount < 0 || !adjustReason.trim()) {
      setError("Enter a valid amount and a reason.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/stores/${params.storeId}/inventory/${variantId}/adjust`, {
        type: adjustType,
        amount,
        reason: adjustReason.trim(),
      });
      loadInventory();
      const refreshed = await api.get<StockAdjustment[]>(`/stores/${params.storeId}/inventory/${variantId}/adjustments`);
      setAdjustments(refreshed);
      setAdjustAmount("");
      setAdjustReason("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't adjust stock.");
    } finally {
      setSubmitting(false);
    }
  }

  const visibleVariants = data ? (showLowStockOnly ? data.variants.filter((v) => v.isLowStock) : data.variants) : [];

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Stock levels across every product and variant, distinct from the Products catalog screen."
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {data === null ? (
        <PageSpinner />
      ) : data.variants.length === 0 ? (
        <Card>
          <EmptyState title="No variants yet" description="Add products with variants to manage their stock here." />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={showLowStockOnly} onChange={(e) => setShowLowStockOnly(e.target.checked)} />
              Low stock only (at or below {data.lowStockThreshold})
            </label>
          </div>

          <Card className="divide-y divide-border overflow-hidden">
            {visibleVariants.length === 0 ? (
              <div className="p-6">
                <EmptyState title="No variants match" description="Nothing at or below the low-stock threshold." />
              </div>
            ) : (
              visibleVariants.map((variant) => (
                <div key={variant.variantId}>
                  <button
                    type="button"
                    onClick={() => toggleRow(variant)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-smooth-fast hover:bg-canvas"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{variant.productTitle}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">SKU: {variant.sku}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-ink">{variant.stockQuantity} in stock</span>
                      {variant.isLowStock && <Badge tone="warning">Low stock</Badge>}
                    </div>
                  </button>

                  {expandedVariantId === variant.variantId && (
                    <div className="border-t border-border bg-canvas px-6 py-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Type">
                          <Select value={adjustType} onChange={(e) => setAdjustType(e.target.value as AdjustType)}>
                            <option value="increment">Add</option>
                            <option value="decrement">Remove</option>
                            <option value="set">Set to</option>
                          </Select>
                        </Field>
                        <Field label="Amount">
                          <input
                            type="number"
                            min={0}
                            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
                            value={adjustAmount}
                            onChange={(e) => setAdjustAmount(e.target.value)}
                          />
                        </Field>
                        <Field label="Reason">
                          <input
                            type="text"
                            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
                            value={adjustReason}
                            onChange={(e) => setAdjustReason(e.target.value)}
                            placeholder="e.g. Damaged in warehouse"
                          />
                        </Field>
                      </div>
                      <Button className="mt-3" loading={submitting} onClick={() => submitAdjustment(variant.variantId)}>
                        Save adjustment
                      </Button>

                      <div className="mt-5">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">Adjustment history</p>
                        {adjustments.length === 0 ? (
                          <p className="text-sm text-ink-muted">No adjustments yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {adjustments.map((adj) => (
                              <div key={adj.id} className="text-sm text-ink">
                                <span className="text-ink-muted">{new Date(adj.createdAt).toLocaleString()}</span>{" "}
                                {adj.quantityBefore} &rarr; {adj.quantityAfter} &mdash; {adj.reason}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </Card>
        </>
      )}
    </div>
  );
}
