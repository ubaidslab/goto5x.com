"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";

interface Category {
  id: string;
  name: string;
  slug: string;
}

/**
 * Phase 6c (Admin Terminal re-skin) - Module 25 P1's global product category
 * taxonomy list + create form (FR-2.1), restyled onto DashCard. Rename/
 * retire still out of scope, same as before.
 */
export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  function load() {
    adminApi
      .get<Category[]>("/categories")
      .then(setCategories)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load categories."));
  }

  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await adminApi.post("/categories", { name, slug });
      setName("");
      setSlug("");
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't create this category.");
    }
  }

  if (error && !categories) return <Alert tone="danger">{error}</Alert>;
  if (!categories) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Categories"
        description="The global product category list every seller's catalog draws from. Rename/retire isn't built yet (not required by any shipped FR)."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-xl space-y-4">
        <DashCard>
          <DashCardHeader title={`Categories (${categories.length})`} />
          {categories.length === 0 ? (
            <EmptyState title="No categories yet" description="Create the first one below." />
          ) : (
            <Reveal className="divide-y divide-border" stagger={0.03}>
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span className="font-medium text-ink">{c.name}</span>
                  <span className="text-ink-muted">{c.slug}</span>
                </div>
              ))}
            </Reveal>
          )}
        </DashCard>

        <DashCard>
          <DashCardHeader title="Create a category" />
          <form onSubmit={create} className="space-y-3">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Slug (lowercase, hyphenated)">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
            </Field>
            <Button type="submit">Create</Button>
          </form>
        </DashCard>
      </div>
    </div>
  );
}
