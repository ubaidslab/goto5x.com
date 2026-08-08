"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
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

/**
 * SRS §5.57/FR-57.2/57.3 - search/tag/stock-status/price-range/category/
 * moderation-state filters, all combinable, plus pagination. Filters fire a
 * fetch on every change (no debounce, no submit button) - the same
 * immediate-effect pattern the Customers list already established, for
 * consistency across the dashboard.
 */
export default function ProductsListPage({ params }: { params: { storeId: string } }) {
  const [productPage, setProductPage] = useState<ProductPage | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api
      .get<Category[]>("/categories")
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
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
  }, [params.storeId, filters, page]);

  function setFilter<K extends keyof typeof emptyFilters>(key: K, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
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
          <Card className="divide-y divide-border overflow-hidden">
            {productPage.items.map((product) => {
              const priced = product.variants[0];
              return (
                <Link
                  key={product.id}
                  href={`/stores/${params.storeId}/products/${product.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 transition-smooth-fast hover:bg-canvas"
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
              );
            })}
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
