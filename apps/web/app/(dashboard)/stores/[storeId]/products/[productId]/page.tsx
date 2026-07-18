"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ImagesSection } from "@/components/dashboard/ImagesSection";
import { ProductForm, ProductFormValues } from "@/components/dashboard/ProductForm";
import { Variant, VariantsSection } from "@/components/dashboard/VariantsSection";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { api } from "@/lib/dashboard-api";

interface ProductResponse {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  status: "draft" | "active" | "archived";
  seoTitle: string | null;
  seoDescription: string | null;
  sourceType: "self" | "supplier";
  variants: Variant[];
}

export default function EditProductPage({ params }: { params: { storeId: string; productId: string } }) {
  const [product, setProduct] = useState<ProductResponse | null>(null);

  function load() {
    api
      .get<ProductResponse>(`/stores/${params.storeId}/products/${params.productId}`)
      .then(setProduct)
      .catch(() => setProduct(null));
  }

  useEffect(load, [params.storeId, params.productId]);

  if (!product) return <PageSpinner />;

  async function handleSave(values: ProductFormValues) {
    await api.patch(`/stores/${params.storeId}/products/${params.productId}`, {
      title: values.title,
      description: values.description || undefined,
      categoryId: values.categoryId || undefined,
      status: values.status,
      seoTitle: values.seoTitle || undefined,
      seoDescription: values.seoDescription || undefined,
    });
    load();
  }

  return (
    <div>
      <PageHeader
        title={product.title || "Edit product"}
        action={
          <Link href={`/stores/${params.storeId}/products`}>
            <Button variant="ghost">Back to products</Button>
          </Link>
        }
      />

      <div className="max-w-2xl space-y-6">
        <ProductForm
          initialValues={{
            title: product.title,
            description: product.description ?? "",
            categoryId: product.categoryId ?? "",
            status: product.status,
            seoTitle: product.seoTitle ?? "",
            seoDescription: product.seoDescription ?? "",
          }}
          submitLabel="Save changes"
          onSubmit={handleSave}
        />

        <ImagesSection storeId={params.storeId} productId={params.productId} />

        {product.sourceType === "supplier" ? (
          <Alert tone="info">
            This product is sourced from a connected supplier. Price and stock are managed by them, not editable here.
          </Alert>
        ) : (
          <VariantsSection
            storeId={params.storeId}
            productId={params.productId}
            variants={product.variants}
            onChange={(variants) => setProduct({ ...product, variants })}
          />
        )}
      </div>
    </div>
  );
}
