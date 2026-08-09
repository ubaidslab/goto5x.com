"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
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
interface CollectionDetail {
  title: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  // Module 58 (SRS §5.65, FR-65.1/65.2) - Growth+ gated advanced SEO fields.
  canonicalUrl: string | null;
  robotsIndex: boolean | null;
  robotsFollow: boolean | null;
  ogTitle: string | null;
  ogDescription: string | null;
  sitemapIncluded: boolean | null;
  products?: CollectionProductEntry[];
}

export default function ManageCollectionPage({ params }: { params: { storeId: string; collectionId: string } }) {
  const [title, setTitle] = useState<string | null>(null);
  const [entries, setEntries] = useState<CollectionProductEntry[]>([]);
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SRS §5.16 (pre-existing gap this module closes - no seller-facing
  // seoTitle/seoDescription edit UI existed for collections before now,
  // only the FR-65.x advanced fields needed a genuinely new home).
  const [description, setDescription] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsSaved, setDetailsSaved] = useState(false);

  // Module 58 (SRS §5.65, FR-65.1/65.2) - Growth+ gated; a sub-Growth save
  // surfaces the backend's upgrade-prompt message via the `error` Alert
  // already on this page.
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [robotsFollow, setRobotsFollow] = useState(true);
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [sitemapIncluded, setSitemapIncluded] = useState(true);
  const [savingSeo, setSavingSeo] = useState(false);
  const [seoSaved, setSeoSaved] = useState(false);

  function refresh() {
    api
      .get<CollectionDetail>(`/stores/${params.storeId}/collections/${params.collectionId}`)
      .then((c) => {
        setTitle(c.title);
        setEntries(c.products ?? []);
        setDescription(c.description ?? "");
        setSeoTitle(c.seoTitle ?? "");
        setSeoDescription(c.seoDescription ?? "");
        setCanonicalUrl(c.canonicalUrl ?? "");
        setRobotsIndex(c.robotsIndex ?? true);
        setRobotsFollow(c.robotsFollow ?? true);
        setOgTitle(c.ogTitle ?? "");
        setOgDescription(c.ogDescription ?? "");
        setSitemapIncluded(c.sitemapIncluded ?? true);
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

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDetailsSaved(false);
    setSavingDetails(true);
    try {
      await api.patch(`/stores/${params.storeId}/collections/${params.collectionId}`, {
        description: description || undefined,
        seoTitle: seoTitle || undefined,
        seoDescription: seoDescription || undefined,
      });
      setDetailsSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save collection details.");
    } finally {
      setSavingDetails(false);
    }
  }

  async function saveAdvancedSeo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSeoSaved(false);
    setSavingSeo(true);
    try {
      await api.patch(`/stores/${params.storeId}/collections/${params.collectionId}`, {
        canonicalUrl: canonicalUrl || undefined,
        robotsIndex,
        robotsFollow,
        ogTitle: ogTitle || undefined,
        ogDescription: ogDescription || undefined,
        sitemapIncluded,
      });
      setSeoSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save advanced SEO settings.");
    } finally {
      setSavingSeo(false);
    }
  }

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
          <CardHeader title="Collection details" description="Basic details shown on your storefront and in search results - available on every plan." />
          <CardBody>
            <form onSubmit={saveDetails} className="space-y-4">
              {detailsSaved && <Alert tone="success">Saved.</Alert>}
              <Field label="Description" htmlFor="collection-description">
                <Textarea id="collection-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              <Field label="SEO title" htmlFor="collection-seo-title" hint="Falls back to the collection title when blank.">
                <Input id="collection-seo-title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
              </Field>
              <Field label="SEO description" htmlFor="collection-seo-description" hint="Falls back to the description above, then your store's default, when blank.">
                <Textarea id="collection-seo-description" rows={2} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
              </Field>
              <Button type="submit" loading={savingDetails}>
                Save
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Advanced SEO"
            description="Growth-plan feature. Overrides this collection's canonical URL, search-engine indexing, social preview, and sitemap inclusion. Leave blank/on to use your store's defaults."
          />
          <CardBody>
            <form onSubmit={saveAdvancedSeo} className="space-y-4">
              {seoSaved && <Alert tone="success">Saved.</Alert>}
              <Field label="Canonical URL" htmlFor="collection-canonical-url" hint="Leave blank to use this collection's own URL.">
                <Input id="collection-canonical-url" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} placeholder="https://..." />
              </Field>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={robotsIndex} onChange={(e) => setRobotsIndex(e.target.checked)} />
                Allow search engines to index this collection
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={robotsFollow} onChange={(e) => setRobotsFollow(e.target.checked)} />
                Allow search engines to follow links from this collection
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={sitemapIncluded} onChange={(e) => setSitemapIncluded(e.target.checked)} />
                Include in sitemap.xml
              </label>
              <Field label="Social preview title" htmlFor="collection-og-title" hint="Shown when this collection is shared on social media. Falls back to the SEO title above when blank.">
                <Input id="collection-og-title" value={ogTitle} onChange={(e) => setOgTitle(e.target.value)} />
              </Field>
              <Field label="Social preview description" htmlFor="collection-og-description" hint="Falls back to the SEO description above when blank.">
                <Textarea id="collection-og-description" rows={2} value={ogDescription} onChange={(e) => setOgDescription(e.target.value)} />
              </Field>
              <Button type="submit" loading={savingSeo}>
                Save advanced SEO
              </Button>
            </form>
          </CardBody>
        </Card>

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
