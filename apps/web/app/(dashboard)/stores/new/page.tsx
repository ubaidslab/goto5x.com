"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DashCard } from "@/components/dashboard/ui/DashCard";
import { Field, Input, Select } from "@/components/ui/Field";
import { api, ApiError } from "@/lib/dashboard-api";

interface Store {
  id: string;
}

// SRS §5.70/FR-70.2 - mirrors the backend's stores.supported_currencies
// Settings Registry default (apps/api/src/tenancy/stores.seed.ts). Not
// fetched live - same "small hardcoded list that mirrors the Settings
// Registry default" convention this codebase already uses for
// DASHBOARD_THEMES in the Settings page; update both by hand if the
// founder ever extends the allowlist.
const SUPPORTED_CURRENCIES: { code: string; label: string }[] = [
  { code: "PKR", label: "PKR - Pakistani Rupee" },
  { code: "USD", label: "USD - US Dollar" },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 63);
}

/**
 * Founder walkthrough finding (pre-Milestone-A, Phase 0.1) - the backend's
 * `POST /stores` (StoresController.create()) has existed since Module 4,
 * but no frontend page ever called it - a brand-new seller had nowhere to
 * go to create their first store, and the built Module 16 onboarding
 * wizard (which only renders once a store already exists,
 * `(dashboard)/stores/[storeId]/page.tsx`) was consequently unreachable.
 * Deliberately a sibling of `stores/[storeId]/` rather than nested under
 * it - this route must never depend on an existing storeId.
 */
export default function CreateStorePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [currency, setCurrency] = useState(SUPPORTED_CURRENCIES[0].code);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onNameChange(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const store = await api.post<Store>("/stores", { name, slug, currency });
      router.push(`/stores/${store.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create your store - please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <Reveal className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display text-h4 font-bold tracking-tight text-ink">UZEYN</span>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Create your store</p>
        </div>
        <DashCard>
          <div>
            <h1 className="text-h3 text-ink">Let&apos;s set up your store</h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              Give it a name - you can change everything about it later.
            </p>

            {error && (
              <Alert className="mt-4" tone="danger">
                {error}
              </Alert>
            )}

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <Field label="Store name" htmlFor="new-store-name">
                <Input
                  id="new-store-name"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  required
                  maxLength={120}
                  autoFocus
                  placeholder="e.g. Aisha's Boutique"
                />
              </Field>
              <Field label="Store URL" htmlFor="new-store-slug" hint="Lowercase letters, numbers, and hyphens only.">
                <Input
                  id="new-store-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    setSlug(e.target.value);
                  }}
                  required
                  minLength={3}
                  maxLength={63}
                  pattern="[a-z0-9-]{3,63}"
                />
              </Field>
              <Field
                label="Currency"
                htmlFor="new-store-currency"
                hint="Choose carefully - this can't be changed once your store is live."
              >
                <Select id="new-store-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" className="w-full" loading={submitting}>
                Create store
              </Button>
            </form>
          </div>
        </DashCard>
      </Reveal>
    </main>
  );
}
