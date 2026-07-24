"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminApiError } from "@/lib/admin-api";

interface Category {
  id: string;
  name: string;
  slug: string;
}

/**
 * Module 25 P1 (FR-2.1) - the global, admin-managed product category
 * taxonomy. `categories.controller.ts` already had list+create; this is
 * only the missing admin UI (create form - retire/rename remain out of
 * scope per that controller's own documented note). Bare functional view
 * (no design pass yet).
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
    try {
      await adminApi.post("/categories", { name, slug });
      setName("");
      setSlug("");
      load();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Couldn't create this category.");
    }
  }

  if (error) return <main>{error}</main>;
  if (!categories) return <main>Loading...</main>;

  return (
    <main>
      <h1>Categories (bare view - no design pass yet)</h1>
      <p>The global product category list every seller's catalog draws from. Rename/retire isn't built yet (not required by any shipped FR).</p>

      <ul>
        {categories.map((c) => (
          <li key={c.id}>
            {c.name} ({c.slug})
          </li>
        ))}
      </ul>

      <h2>Create a category</h2>
      <form onSubmit={create}>
        <p>
          <label>
            Name: <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            Slug (lowercase, hyphenated): <input value={slug} onChange={(e) => setSlug(e.target.value)} required />
          </label>
        </p>
        <button type="submit">Create</button>
      </form>
    </main>
  );
}
