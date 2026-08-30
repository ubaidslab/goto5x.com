"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ImagesSection } from "@/components/dashboard/ImagesSection";
import { ProductForm, ProductFormValues } from "@/components/dashboard/ProductForm";
import { Variant, VariantsSection } from "@/components/dashboard/VariantsSection";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { UpgradeLockedCard } from "@/components/ui/UpgradeLockedCard";
import { ApiError, api } from "@/lib/dashboard-api";

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
  tags: string[];
  // SRS §5.69/FR-69.1 (Module 94) - ordered, non-variant key-value pairs.
  customAttributes: { key: string; value: string }[];
  // Module 58 (SRS §5.65, FR-65.1-65.3) - Growth+ gated advanced SEO fields.
  canonicalUrl: string | null;
  robotsIndex: boolean | null;
  robotsFollow: boolean | null;
  ogTitle: string | null;
  ogDescription: string | null;
  structuredDataEnabled: boolean | null;
  sitemapIncluded: boolean | null;
  slug: string | null;
  seoAdvancedFieldsEnabled: boolean;
}

export default function EditProductPage({ params }: { params: { storeId: string; productId: string } }) {
  const [product, setProduct] = useState<ProductResponse | null>(null);

  // Module 58 (SRS §5.65, FR-65.1-65.3) - a separate card/save action from
  // the main ProductForm below, same "own card, own save button" pattern
  // as Module 57's Invoice customization card on the store settings page.
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [robotsFollow, setRobotsFollow] = useState(true);
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [structuredDataEnabled, setStructuredDataEnabled] = useState(true);
  const [sitemapIncluded, setSitemapIncluded] = useState(true);
  const [slug, setSlug] = useState("");
  const [savingSeo, setSavingSeo] = useState(false);
  const [seoSaved, setSeoSaved] = useState(false);
  const [seoError, setSeoError] = useState<string | null>(null);

  // SRS §5.69/FR-69.1-69.2 (Module 94) - own card, own save action, same
  // pattern as the Advanced SEO card above: local draft state, submitted
  // wholesale (never merged) on save.
  const [attributes, setAttributes] = useState<{ key: string; value: string }[]>([]);
  const [savingAttributes, setSavingAttributes] = useState(false);
  const [attributesSaved, setAttributesSaved] = useState(false);
  const [attributesError, setAttributesError] = useState<string | null>(null);

  function load() {
    api
      .get<ProductResponse>(`/stores/${params.storeId}/products/${params.productId}`)
      .then((p) => {
        setProduct(p);
        setCanonicalUrl(p.canonicalUrl ?? "");
        setRobotsIndex(p.robotsIndex ?? true);
        setRobotsFollow(p.robotsFollow ?? true);
        setOgTitle(p.ogTitle ?? "");
        setOgDescription(p.ogDescription ?? "");
        setStructuredDataEnabled(p.structuredDataEnabled ?? true);
        setSitemapIncluded(p.sitemapIncluded ?? true);
        setSlug(p.slug ?? "");
        setAttributes(p.customAttributes ?? []);
      })
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
      tags: values.tags,
    });
    load();
  }

  function updateAttribute(index: number, field: "key" | "value", value: string) {
    setAttributes((prev) => prev.map((attr, i) => (i === index ? { ...attr, [field]: value } : attr)));
  }

  function removeAttribute(index: number) {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  }

  function addAttribute() {
    setAttributes((prev) => [...prev, { key: "", value: "" }]);
  }

  async function saveAttributes() {
    setAttributesError(null);
    setAttributesSaved(false);

    const trimmed = attributes.map((a) => ({ key: a.key.trim(), value: a.value.trim() })).filter((a) => a.key || a.value);
    if (trimmed.some((a) => !a.key || !a.value)) {
      setAttributesError("Every attribute needs both a name and a value - remove any incomplete rows.");
      return;
    }
    const keys = trimmed.map((a) => a.key.toLowerCase());
    if (new Set(keys).size !== keys.length) {
      setAttributesError("Attribute names must be unique.");
      return;
    }

    setSavingAttributes(true);
    try {
      await api.patch(`/stores/${params.storeId}/products/${params.productId}`, { customAttributes: trimmed });
      setAttributesSaved(true);
      setAttributes(trimmed);
    } catch (err) {
      setAttributesError(err instanceof ApiError ? err.message : "Couldn't save product details.");
    } finally {
      setSavingAttributes(false);
    }
  }

  async function saveAdvancedSeo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSeoError(null);
    setSeoSaved(false);
    setSavingSeo(true);
    try {
      await api.patch(`/stores/${params.storeId}/products/${params.productId}`, {
        canonicalUrl: canonicalUrl || undefined,
        robotsIndex,
        robotsFollow,
        ogTitle: ogTitle || undefined,
        ogDescription: ogDescription || undefined,
        structuredDataEnabled,
        sitemapIncluded,
        slug: slug || undefined,
      });
      setSeoSaved(true);
      load();
    } catch (err) {
      setSeoError(err instanceof ApiError ? err.message : "Couldn't save advanced SEO settings.");
    } finally {
      setSavingSeo(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={product.title || "Edit product"}
        description="Edit this product's details, pricing, and visibility on your storefront."
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
            tags: product.tags,
          }}
          submitLabel="Save changes"
          onSubmit={handleSave}
        />

        <Card>
          <CardHeader
            title="Product details"
            description="Free-form facts a buyer sees on the product page - material, dimensions, country of origin. These never create purchase options; use Variants below for that."
          />
          <CardBody className="space-y-3">
            {attributesError && <Alert>{attributesError}</Alert>}
            {attributesSaved && <Alert tone="success">Saved.</Alert>}
            {attributes.length === 0 ? (
              <p className="text-sm text-ink-muted">No product details yet.</p>
            ) : (
              <div className="space-y-2">
                {attributes.map((attr, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-2/5">
                      <Input
                        value={attr.key}
                        onChange={(e) => updateAttribute(i, "key", e.target.value)}
                        placeholder="e.g. Material"
                        aria-label={`Attribute ${i + 1} name`}
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        value={attr.value}
                        onChange={(e) => updateAttribute(i, "value", e.target.value)}
                        placeholder="e.g. 100% Cotton"
                        aria-label={`Attribute ${i + 1} value`}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeAttribute(i)} aria-label={`Remove attribute ${i + 1}`}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={addAttribute} disabled={attributes.length >= 20}>
                Add detail
              </Button>
              <Button type="button" size="sm" loading={savingAttributes} onClick={saveAttributes}>
                Save product details
              </Button>
            </div>
          </CardBody>
        </Card>

        <ImagesSection storeId={params.storeId} productId={params.productId} />

        <Card>
          <CardHeader
            title="Advanced SEO"
            description="Overrides this product's canonical URL, search-engine indexing, social preview, structured data, and sitemap inclusion. Leave blank/on to use your store's defaults."
          />
          {product.seoAdvancedFieldsEnabled ? (
            <CardBody>
              <form onSubmit={saveAdvancedSeo} className="space-y-4">
                {seoError && <Alert>{seoError}</Alert>}
                {seoSaved && <Alert tone="success">Saved.</Alert>}
                <Field label="Canonical URL" htmlFor="product-canonical-url" hint="Leave blank to use this product's own URL.">
                  <Input id="product-canonical-url" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} placeholder="https://..." />
                </Field>
                <Field label="Custom slug" htmlFor="product-slug" hint="A canonical-URL enhancement only - this product's real storefront link is unchanged.">
                  <Input id="product-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. blue-cotton-shirt" />
                </Field>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={robotsIndex} onChange={(e) => setRobotsIndex(e.target.checked)} />
                  Allow search engines to index this product
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={robotsFollow} onChange={(e) => setRobotsFollow(e.target.checked)} />
                  Allow search engines to follow links from this product
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={structuredDataEnabled} onChange={(e) => setStructuredDataEnabled(e.target.checked)} />
                  Include structured data (rich snippets)
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={sitemapIncluded} onChange={(e) => setSitemapIncluded(e.target.checked)} />
                  Include in sitemap.xml
                </label>
                <Field label="Social preview title" htmlFor="product-og-title" hint="Shown when this product is shared on social media. Falls back to the SEO title above when blank.">
                  <Input id="product-og-title" value={ogTitle} onChange={(e) => setOgTitle(e.target.value)} />
                </Field>
                <Field label="Social preview description" htmlFor="product-og-description" hint="Falls back to the SEO description above when blank.">
                  <Textarea id="product-og-description" rows={2} value={ogDescription} onChange={(e) => setOgDescription(e.target.value)} />
                </Field>
                <Button type="submit" loading={savingSeo}>
                  Save advanced SEO
                </Button>
              </form>
            </CardBody>
          ) : (
            <UpgradeLockedCard
              requiredTier="RISE"
              title="Advanced SEO is a RISE+ feature"
              description="Override this product's canonical URL, search-engine indexing, social preview, structured data, and sitemap inclusion, once you're on RISE or FLY."
              action={
                <Link href={`/stores/${params.storeId}/billing`}>
                  <Button size="sm" variant="secondary">
                    View plans
                  </Button>
                </Link>
              }
            />
          )}
        </Card>

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
