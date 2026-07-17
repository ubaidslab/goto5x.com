"use client";

import { useRouter } from "next/navigation";
import { ProductForm, ProductFormValues } from "@/components/dashboard/ProductForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/dashboard-api";

export default function NewProductPage({ params }: { params: { storeId: string } }) {
  const router = useRouter();

  async function handleCreate(values: ProductFormValues) {
    const created = await api.post<{ id: string }>(`/stores/${params.storeId}/products`, {
      title: values.title,
      description: values.description || undefined,
      categoryId: values.categoryId || undefined,
      status: values.status,
      seoTitle: values.seoTitle || undefined,
      seoDescription: values.seoDescription || undefined,
    });
    router.push(`/stores/${params.storeId}/products/${created.id}`);
  }

  return (
    <div>
      <PageHeader title="Add product" description="Give it a title to get started - you can fill in the rest anytime." />
      <div className="max-w-2xl">
        <ProductForm submitLabel="Create product" onSubmit={handleCreate} />
      </div>
    </div>
  );
}
