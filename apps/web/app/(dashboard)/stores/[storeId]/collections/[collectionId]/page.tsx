"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

interface CollectionProductEntry {
  productId: string;
  sortOrder: number;
  product: { title: string };
}
interface StoreProduct {
  id: string;
  title: string;
}

export default function ManageCollectionPage({ params }: { params: { storeId: string; collectionId: string } }) {
  const [title, setTitle] = useState<string | null>(null);
  const [entries, setEntries] = useState<CollectionProductEntry[]>([]);
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api
      .get<{ title: string; products?: CollectionProductEntry[] }>(`/stores/${params.storeId}/collections/${params.collectionId}`)
      .then((c) => {
        setTitle(c.title);
        setEntries(c.products ?? []);
      })
      .catch(() => setTitle(""));
  }

  useEffect(refresh, [params.storeId, params.collectionId]);
  useEffect(() => {
    api
      .get<{ items: StoreProduct[] }>(`/stores/${params.storeId}/products?limit=100`)
      .then((page) => setStoreProducts(page.items))
      .catch(() => setStoreProducts([]));
  }, [params.storeId]);

  if (title === null) return <PageSpinner />;

  const availableProducts = storeProducts.filter((p) => !entries.some((e) => e.productId === p.id));

  async function onAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProductId) return;
    setError(null);
    setAdding(true);
    try {
      await api.post(`/stores/${params.storeId}/collections/${params.collectionId}/products`, { productId: selectedProductId });
      setSelectedProductId("");
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that product.");
    } finally {
      setAdding(false);
    }
  }

  async function onRemoveProduct(id: string) {
    setError(null);
    try {
      await api.delete(`/stores/${params.storeId}/collections/${params.collectionId}/products/${id}`);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that product.");
    }
  }

  return (
    <div>
      <PageHeader
        title={title || "Collection"}
        description="A curated group of products, shown together on your storefront."
        action={
          <Link href={`/stores/${params.storeId}/collections`}>
            <Button variant="ghost">Back to collections</Button>
          </Link>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader title="Add a product" />
          <CardBody>
            <form onSubmit={onAddProduct} className="flex items-end gap-3">
              <div className="flex-1">
                <Field label="Product">
                  <Select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
                    <option value="">Select a product…</option>
                    {availableProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button type="submit" loading={adding} disabled={!selectedProductId}>
                Add product
              </Button>
            </form>
          </CardBody>
        </Card>

        {entries.length === 0 ? (
          <Card>
            <EmptyState title="No products in this collection yet" description="Add one above." />
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {entries.map((entry) => (
              <div key={entry.productId} className="flex items-center justify-between gap-4 px-6 py-4">
                <p className="text-sm font-medium text-ink">{entry.product.title}</p>
                <Button variant="ghost" size="sm" onClick={() => onRemoveProduct(entry.productId)}>
                  Remove
                </Button>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
