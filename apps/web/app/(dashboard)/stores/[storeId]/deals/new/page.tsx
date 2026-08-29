"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError, api } from "@/lib/dashboard-api";

interface Variant {
  id: string;
  sku: string;
  price: string;
  stockQuantity: number;
}
interface Product {
  id: string;
  title: string;
  status: "draft" | "active" | "archived";
  variants: Variant[];
}
interface ProductPage {
  items: Product[];
}

/** SRS §5.67/FR-67.1/67.4 - item picker builds the DealItem set at creation time (create() validates every variant belongs to this store). */
export default function NewDealPage({ params }: { params: { storeId: string } }) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [discountPercent, setDiscountPercent] = useState("20");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ProductPage>(`/stores/${params.storeId}/products?limit=100`)
      .then((page) => setProducts(page.items.filter((p) => p.status === "active")))
      .catch(() => setProducts([]));
  }, [params.storeId]);

  function toggleVariant(variantId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return next;
    });
  }

  function variantsByProduct(): { product: Product; variant: Variant }[] {
    if (!products) return [];
    return products.flatMap((product) => product.variants.filter((v) => selected.has(v.id)).map((variant) => ({ product, variant })));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.size === 0) {
      setError("Select at least one product variant to bundle.");
      return;
    }
    setSubmitting(true);
    try {
      const items = variantsByProduct().map(({ product, variant }, index) => ({
        productId: product.id,
        variantId: variant.id,
        sortOrder: index,
      }));
      const deal = await api.post<{ id: string }>(`/stores/${params.storeId}/deals`, {
        title,
        slug,
        description: description || undefined,
        discountPercent: Number(discountPercent),
        items,
      });
      router.push(`/stores/${params.storeId}/deals/${deal.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create that deal.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Create a deal" description="Bundle products together at one uniform percentage off." />

      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
        <Card>
          <CardHeader title="Deal details" />
          <CardBody className="space-y-4">
            <Field label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Steal Deal" />
            </Field>
            <Field label="Slug" hint="Used in the storefront URL - lowercase letters, numbers, hyphens.">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="steal-deal" />
            </Field>
            <Field label="Description (optional)">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </Field>
            <Field label="Discount percent" hint="Applied uniformly across every item in the deal, live at checkout.">
              <Input
                type="number"
                min={1}
                max={100}
                step="0.01"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                required
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Items" description="Pick the variants to bundle into this deal." />
          <CardBody className="space-y-3">
            {products === null ? (
              <p className="text-sm text-ink-muted">Loading products...</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-ink-muted">You need at least one active product before you can create a deal.</p>
            ) : (
              products.map((product) => (
                <div key={product.id} className="space-y-1">
                  <p className="text-sm font-medium text-ink">{product.title}</p>
                  {product.variants.map((variant) => (
                    <label key={variant.id} className="flex cursor-pointer items-center gap-2 py-1 pl-2 text-sm text-ink-muted">
                      <Checkbox checked={selected.has(variant.id)} onCheckedChange={() => toggleVariant(variant.id)} />
                      {variant.sku} - Rs {variant.price} - {variant.stockQuantity} in stock
                    </label>
                  ))}
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Button type="submit" loading={submitting}>
          Create deal
        </Button>
      </form>
    </div>
  );
}
