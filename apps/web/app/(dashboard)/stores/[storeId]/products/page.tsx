"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
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
}

const statusTone = { active: "success", draft: "neutral", archived: "neutral" } as const;

export default function ProductsListPage({ params }: { params: { storeId: string } }) {
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    api
      .get<Product[]>(`/stores/${params.storeId}/products`)
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [params.storeId]);

  if (products === null) return <PageSpinner />;

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

      {products.length === 0 ? (
        <Card>
          <EmptyState
            title="No products yet"
            description="Add your first product to start selling. You'll set a title, price, and stock quantity."
            action={
              <Link href={`/stores/${params.storeId}/products/new`}>
                <Button>Add product</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {products.map((product) => {
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
                  </p>
                </div>
                <Badge tone={statusTone[product.status]}>{product.status}</Badge>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
