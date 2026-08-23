"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";
import { api } from "@/lib/dashboard-api";

interface Variant {
  id: string;
  price: string;
  stockQuantity: number;
}
interface Product {
  id: string;
  title: string;
  status: "draft" | "active" | "archived";
  moderationStatus: string;
  variants: Variant[];
  tags: string[];
}
interface ProductPage {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
interface Category {
  id: string;
  name: string;
}
interface Collection {
  id: string;
  name: string;
}

const statusTone = { active: "success", draft: "neutral", archived: "neutral" } as const;

const emptyFilters = {
  search: "",
  tag: "",
  stockStatus: "",
  categoryId: "",
  moderationStatus: "",
  minPrice: "",
  maxPrice: "",
};

type BulkAction = "" | "publish" | "unpublish" | "archive" | "delete" | "price" | "stock" | "category" | "collection" | "tag";

const BULK_ACTION_LABELS: Record<Exclude<BulkAction, "">, string> = {
  publish: "Publish",
  unpublish: "Unpublish (set to draft)",
  archive: "Archive",
  delete: "Delete",
  price: "Update price",
  stock: "Update stock",
  category: "Assign category",
  collection: "Assign to collection",
  tag: "Add tag",
};

/**
 * SRS §5.57/FR-57.2/57.3 (Module 50) - search/tag/stock-status/price-range/
 * category/moderation-state filters, all combinable, plus pagination.
 * SRS §5.58/FR-58.1-58.5 (Module 51) - multi-select + bulk actions, all
 * reusing the existing single-item endpoints via a client-side fan-out
 * (same precedent as the admin moderation queue's bulk approve/reject),
 * gated behind an explicit confirmation step showing the exact affected
 * count (FR-58.4).
 */
export default function ProductsListPage({ params }: { params: { storeId: string } }) {
  const [productPage, setProductPage] = useState<ProductPage | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [priceMode, setPriceMode] = useState<"fixed" | "percent">("fixed");
  const [priceValue, setPriceValue] = useState("");
  const [stockType, setStockType] = useState<"increment" | "decrement" | "set">("set");
  const [stockAmount, setStockAmount] = useState("");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkCollectionId, setBulkCollectionId] = useState("");
  const [bulkTag, setBulkTag] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Category[]>("/categories").then(setCategories).catch(() => setCategories([]));
    api
      .get<Collection[]>(`/stores/${params.storeId}/collections`)
      .then(setCollections)
      .catch(() => setCollections([]));
  }, [params.storeId]);

  function reload() {
    const query = new URLSearchParams({ page: String(page), limit: "20" });
    if (filters.search) query.set("search", filters.search);
    if (filters.tag) query.set("tag", filters.tag);
    if (filters.stockStatus) query.set("stockStatus", filters.stockStatus);
    if (filters.categoryId) query.set("categoryId", filters.categoryId);
    if (filters.moderationStatus) query.set("moderationStatus", filters.moderationStatus);
    if (filters.minPrice) query.set("minPrice", filters.minPrice);
    if (filters.maxPrice) query.set("maxPrice", filters.maxPrice);
    api
      .get<ProductPage>(`/stores/${params.storeId}/products?${query.toString()}`)
      .then(setProductPage)
      .catch(() => setProductPage({ items: [], page: 1, limit: 20, total: 0, totalPages: 1 }));
  }

  useEffect(reload, [params.storeId, filters, page]);

  function setFilter<K extends keyof typeof emptyFilters>(key: K, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function toggleSelected(productId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!productPage) return;
    const pageIds = productPage.items.map((p) => p.id);
    const allSelected = pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  const selectedProducts = productPage ? productPage.items.filter((p) => selected.has(p.id)) : [];

  function bulkActionValid(): boolean {
    switch (bulkAction) {
      case "price":
        return priceValue.trim() !== "" && !Number.isNaN(Number(priceValue));
      case "stock":
        return stockAmount.trim() !== "" && !Number.isNaN(Number(stockAmount)) && Number(stockAmount) >= 0;
      case "category":
        return bulkCategoryId !== "";
      case "collection":
        return bulkCollectionId !== "";
      case "tag":
        return bulkTag.trim() !== "";
      case "publish":
      case "unpublish":
      case "archive":
      case "delete":
        return true;
      default:
        return false;
    }
  }

  async function applyToOneProduct(product: Product): Promise<void> {
    switch (bulkAction) {
      case "publish":
        await api.patch(`/stores/${params.storeId}/products/${product.id}`, { status: "active" });
        return;
      case "unpublish":
        await api.patch(`/stores/${params.storeId}/products/${product.id}`, { status: "draft" });
        return;
      case "archive":
        await api.patch(`/stores/${params.storeId}/products/${product.id}`, { status: "archived" });
        return;
      case "delete":
        await api.delete(`/stores/${params.storeId}/products/${product.id}`);
        return;
      case "category":
        await api.patch(`/stores/${params.storeId}/products/${product.id}`, { categoryId: bulkCategoryId });
        return;
      case "collection":
        await api.post(`/stores/${params.storeId}/collections/${bulkCollectionId}/products`, { productId: product.id });
        return;
      case "tag": {
        const nextTags = Array.from(new Set([...product.tags, bulkTag.trim()]));
        await api.patch(`/stores/${params.storeId}/products/${product.id}`, { tags: nextTags });
        return;
      }
      case "price": {
        const amount = Number(priceValue);
        await Promise.all(
          product.variants.map((v) => {
            const current = Number(v.price);
            const nextPrice = priceMode === "fixed" ? amount : Math.max(0, Math.round(current * (1 + amount / 100) * 100) / 100);
            return api.patch(`/stores/${params.storeId}/products/${product.id}/variants/${v.id}`, { price: nextPrice });
          }),
        );
        return;
      }
      case "stock": {
        const amount = Number(stockAmount);
        await Promise.all(
          product.variants.map((v) =>
            api.post(`/stores/${params.storeId}/inventory/${v.id}/adjust`, {
              type: stockType,
              amount,
              reason: "Bulk stock update (dashboard)",
            }),
          ),
        );
        return;
      }
      default:
        return;
    }
  }

  async function executeBulk() {
    setBulkRunning(true);
    setBulkError(null);
    const results = await Promise.allSettled(selectedProducts.map((p) => applyToOneProduct(p)));
    const failures = results.filter((r) => r.status === "rejected").length;
    if (failures > 0) {
      setBulkError(
        `${failures} of ${selectedProducts.length} product${selectedProducts.length === 1 ? "" : "s"} couldn't be updated - the rest succeeded. Common cause: deleting a product that still has variants.`,
      );
    }
    setBulkRunning(false);
    setConfirming(false);
    setSelected(new Set());
    setBulkAction("");
    setPriceValue("");
    setStockAmount("");
    setBulkCategoryId("");
    setBulkCollectionId("");
    setBulkTag("");
    reload();
  }

  const filtersActive = Object.values(filters).some(Boolean);

  if (productPage === null) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Products"
        description="Everything you sell, in one place."
        action={
          <Link href={`/stores/${params.storeId}/products/new`}>
            <Button>Add product</Button>
          </Link>
        }
      />

      <Card className="mb-4 space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Search">
            <Input placeholder="Title or SKU" value={filters.search} onChange={(e) => setFilter("search", e.target.value)} />
          </Field>
          <Field label="Tag">
            <Input placeholder="e.g. bestseller" value={filters.tag} onChange={(e) => setFilter("tag", e.target.value)} />
          </Field>
          <Field label="Stock status">
            <Select value={filters.stockStatus} onChange={(e) => setFilter("stockStatus", e.target.value)}>
              <option value="">Any</option>
              <option value="in">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </Select>
          </Field>
          <Field label="Category">
            <Select value={filters.categoryId} onChange={(e) => setFilter("categoryId", e.target.value)}>
              <option value="">Any</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Moderation state">
            <Select value={filters.moderationStatus} onChange={(e) => setFilter("moderationStatus", e.target.value)}>
              <option value="">Any</option>
              <option value="not_required">Not required</option>
              <option value="pending">Pending review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="admin_removed">Removed by admin</option>
            </Select>
          </Field>
          <Field label="Min price (Rs)">
            <Input type="number" min={0} value={filters.minPrice} onChange={(e) => setFilter("minPrice", e.target.value)} />
          </Field>
          <Field label="Max price (Rs)">
            <Input type="number" min={0} value={filters.maxPrice} onChange={(e) => setFilter("maxPrice", e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button variant="ghost" disabled={!filtersActive} onClick={() => { setFilters(emptyFilters); setPage(1); }}>
              Clear filters
            </Button>
          </div>
        </div>
        <p className="text-xs text-ink-muted">
          {productPage.total} product{productPage.total === 1 ? "" : "s"} match{productPage.total === 1 ? "es" : ""}
        </p>
      </Card>

      {selected.size > 0 && (
        <Card className="mb-4 space-y-3 p-4">
          <p className="text-sm font-medium text-ink">
            {selected.size} product{selected.size === 1 ? "" : "s"} selected
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Bulk action">
              <Select value={bulkAction} onChange={(e) => { setBulkAction(e.target.value as BulkAction); setConfirming(false); }}>
                <option value="">Choose an action...</option>
                {Object.entries(BULK_ACTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>

            {bulkAction === "price" && (
              <>
                <Field label="Mode">
                  <Select value={priceMode} onChange={(e) => setPriceMode(e.target.value as "fixed" | "percent")}>
                    <option value="fixed">Fixed price (Rs)</option>
                    <option value="percent">Percentage change (%)</option>
                  </Select>
                </Field>
                <Field label={priceMode === "fixed" ? "New price (Rs)" : "Change (e.g. -10 or 15)"}>
                  <Input type="number" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} />
                </Field>
              </>
            )}

            {bulkAction === "stock" && (
              <>
                <Field label="Type">
                  <Select value={stockType} onChange={(e) => setStockType(e.target.value as "increment" | "decrement" | "set")}>
                    <option value="set">Set to</option>
                    <option value="increment">Increase by</option>
                    <option value="decrement">Decrease by</option>
                  </Select>
                </Field>
                <Field label="Amount">
                  <Input type="number" min={0} value={stockAmount} onChange={(e) => setStockAmount(e.target.value)} />
                </Field>
              </>
            )}

            {bulkAction === "category" && (
              <Field label="Category">
                <Select value={bulkCategoryId} onChange={(e) => setBulkCategoryId(e.target.value)}>
                  <option value="">Choose...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {bulkAction === "collection" && (
              <Field label="Collection">
                <Select value={bulkCollectionId} onChange={(e) => setBulkCollectionId(e.target.value)}>
                  <option value="">Choose...</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {bulkAction === "tag" && (
              <Field label="Tag to add">
                <Input value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} placeholder="e.g. clearance" />
              </Field>
            )}

            {bulkAction && (
              <Button variant="ghost" disabled={!bulkActionValid()} onClick={() => setConfirming(true)}>
                {BULK_ACTION_LABELS[bulkAction as Exclude<BulkAction, "">]}...
              </Button>
            )}
          </div>

          {confirming && (
            <div className="rounded-md border border-border-strong bg-canvas p-3">
              <p className="text-sm text-ink">
                <strong>{BULK_ACTION_LABELS[bulkAction as Exclude<BulkAction, "">]}</strong> will affect {selectedProducts.length}{" "}
                product{selectedProducts.length === 1 ? "" : "s"}:
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {selectedProducts
                  .slice(0, 5)
                  .map((p) => p.title)
                  .join(", ")}
                {selectedProducts.length > 5 && ` and ${selectedProducts.length - 5} more`}
              </p>
              <div className="mt-3 flex gap-2">
                <Button loading={bulkRunning} onClick={executeBulk}>
                  Confirm
                </Button>
                <Button variant="ghost" disabled={bulkRunning} onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {bulkError && <p className="text-sm text-danger">{bulkError}</p>}
        </Card>
      )}

      {productPage.items.length === 0 ? (
        <Card>
          <EmptyState
            title={filtersActive ? "No products match these filters" : "No products yet"}
            description={
              filtersActive
                ? "Try clearing a filter or two."
                : "Add your first product to start selling. You'll set a title, price, and stock quantity."
            }
            action={
              !filtersActive && (
                <Link href={`/stores/${params.storeId}/products/new`}>
                  <Button>Add product</Button>
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="flex items-center gap-4 border-b border-border px-6 py-2">
              <Checkbox
                aria-label="Select all products on this page"
                checked={productPage.items.every((p) => selected.has(p.id))}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-ink-muted">Select all on this page</span>
            </div>
            <Reveal className="divide-y divide-border" stagger={0.03}>
              {productPage.items.map((product) => {
                const priced = product.variants[0];
                return (
                  <div key={product.id} className="flex items-center gap-4 px-6 py-4 transition-smooth-fast hover:bg-canvas/60">
                    <Checkbox
                      aria-label={`Select ${product.title}`}
                      checked={selected.has(product.id)}
                      onCheckedChange={() => toggleSelected(product.id)}
                    />
                    <Link
                      href={`/stores/${params.storeId}/products/${product.id}`}
                      className="flex flex-1 items-center justify-between gap-4 transition-smooth-fast hover:opacity-80"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{product.title}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {product.variants.length} variant{product.variants.length === 1 ? "" : "s"}
                          {priced && ` · Rs ${priced.price}`}
                          {product.tags.length > 0 && ` · ${product.tags.join(", ")}`}
                        </p>
                      </div>
                      <Badge tone={statusTone[product.status]}>{product.status}</Badge>
                    </Link>
                  </div>
                );
              })}
            </Reveal>
          </Card>

          {productPage.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button variant="ghost" disabled={productPage.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="text-sm text-ink-muted">
                Page {productPage.page} of {productPage.totalPages}
              </span>
              <Button
                variant="ghost"
                disabled={productPage.page >= productPage.totalPages}
                onClick={() => setPage((p) => Math.min(productPage.totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
