"use client";

import { useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Disclosure } from "../ui/Disclosure";
import { Field, Input, Select, Textarea } from "../ui/Field";
import { ApiError, api } from "../../lib/dashboard-api";

export interface ProductFormValues {
  title: string;
  description: string;
  categoryId: string;
  status: "draft" | "active" | "archived";
  seoTitle: string;
  seoDescription: string;
  /** SRS §5.57/FR-57.1 - free-form seller-defined tags, dashboard-private by default. */
  tags: string[];
}

interface Category {
  id: string;
  name: string;
}

const empty: ProductFormValues = {
  title: "",
  description: "",
  categoryId: "",
  status: "draft",
  seoTitle: "",
  seoDescription: "",
  tags: [],
};

/**
 * Shared by /products/new and /products/[productId] - one form definition,
 * two call sites (SIMPLICITY INVARIANT §3.13(d): a consistent component set,
 * not a bespoke layout per screen). A beginner completes "add a product"
 * using only the required Title field; everything else, including SEO,
 * sits behind the Advanced disclosure (rule (b)).
 */
export function ProductForm({
  initialValues,
  submitLabel,
  onSubmit,
}: {
  initialValues?: Partial<ProductFormValues>;
  submitLabel: string;
  onSubmit: (values: ProductFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<ProductFormValues>({ ...empty, ...initialValues });
  const [tagsInput, setTagsInput] = useState((initialValues?.tags ?? []).join(", "));
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Category[]>("/categories")
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await onSubmit({ ...values, tags });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <Alert>{error}</Alert>}

      <Field label="Title" required>
        <Input
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Classic Cotton T-Shirt"
          required
          maxLength={200}
        />
      </Field>

      <Field label="Description" hint="Shown to buyers on the product page.">
        <Textarea rows={4} value={values.description} onChange={(e) => set("description", e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Category">
          <Select value={values.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status" hint="Only active products can appear in your storefront.">
          <Select value={values.status} onChange={(e) => set("status", e.target.value as ProductFormValues["status"])}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
      </div>

      <Field label="Tags" hint="Comma-separated, your own organizational labels - not shown to buyers unless you turn on storefront tag browsing.">
        <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="e.g. bestseller, summer, cotton" />
      </Field>

      <Disclosure label="Advanced: SEO">
        <Field label="SEO title" hint="Leave blank to use the product title.">
          <Input value={values.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} maxLength={70} />
        </Field>
        <Field label="SEO description" hint="Leave blank to use the product description.">
          <Textarea rows={2} value={values.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} maxLength={320} />
        </Field>
      </Disclosure>

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
