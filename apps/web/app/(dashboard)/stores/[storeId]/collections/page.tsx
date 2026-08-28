"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { ApiError, api } from "@/lib/dashboard-api";

interface Collection {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
}

export default function CollectionsPage({ params }: { params: { storeId: string } }) {
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api
      .get<Collection[]>(`/stores/${params.storeId}/collections`)
      .then(setCollections)
      .catch(() => setCollections([]));
  }

  useEffect(refresh, [params.storeId]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await api.post(`/stores/${params.storeId}/collections`, { title, slug });
      setTitle("");
      setSlug("");
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create that collection.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader title="Collections" description="Group products together for your storefront's navigation and merchandising." />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader title="Create a collection" />
          <CardBody>
            <form onSubmit={onCreate} className="flex items-end gap-3">
              <div className="flex-1">
                <Field label="Title">
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="Slug">
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
                </Field>
              </div>
              <Button type="submit" loading={creating}>
                Create
              </Button>
            </form>
          </CardBody>
        </Card>

        {collections === null ? null : collections.length === 0 ? (
          <Card>
            <EmptyState title="No collections yet" description="Create one above to group related products for your storefront." />
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            <Reveal stagger={0.03}>
            {collections.map((collection) => (
              <Link
                key={collection.id}
                href={`/stores/${params.storeId}/collections/${collection.id}`}
                className="flex items-center justify-between gap-4 px-6 py-4 transition-smooth-fast hover:bg-canvas"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{collection.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{collection.slug}</p>
                </div>
                {!collection.isActive && <Badge tone="neutral">inactive</Badge>}
              </Link>
            ))}
            </Reveal>
          </Card>
        )}
      </div>
    </div>
  );
}
