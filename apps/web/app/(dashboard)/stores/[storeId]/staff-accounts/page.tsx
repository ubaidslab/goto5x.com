"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

type StaffScope = "orders" | "catalog" | "discounts" | "customers" | "design";
type StaffAccountStatus = "active" | "revoked";

interface StaffAccount {
  id: string;
  email: string;
  name: string | null;
  scopes: StaffScope[];
  status: StaffAccountStatus;
  createdAt: string;
  revokedAt: string | null;
}

const SCOPE_LABELS: Record<StaffScope, string> = {
  orders: "Orders",
  catalog: "Catalog",
  discounts: "Discounts",
  customers: "Customers",
  design: "Store design (customizer)",
};

const ALL_SCOPES = Object.keys(SCOPE_LABELS) as StaffScope[];

/**
 * SRS §5.52/FR-52.1-52.6 - owner-only management of staff sub-accounts.
 * Seller-scoped, not store-scoped - a hire's access spans every store the
 * owner has, same as the underlying StaffAccount model.
 */
export default function StaffAccountsPage() {
  const [staff, setStaff] = useState<StaffAccount[] | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<StaffScope[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    api
      .get<StaffAccount[]>(`/sellers/me/staff-accounts`)
      .then(setStaff)
      .catch(() => setStaff([]));
  }

  useEffect(load, []);

  if (!staff) return <PageSpinner />;

  function toggleScope(scope: StaffScope) {
    setSelectedScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (selectedScopes.length === 0) {
      setError("Select at least one scope for this staff account.");
      return;
    }
    setCreating(true);
    const form = new FormData(e.currentTarget);
    try {
      await api.post(`/sellers/me/staff-accounts`, {
        email: form.get("email"),
        password: form.get("password"),
        name: form.get("name") || undefined,
        scopes: selectedScopes,
      });
      (e.target as HTMLFormElement).reset();
      setSelectedScopes([]);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create that staff account.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setError(null);
    try {
      await api.delete(`/sellers/me/staff-accounts/${id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't revoke that staff account.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Staff Accounts"
        description="Give team members scoped, login-only access to specific parts of your stores - never billing or plan settings."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader title="Add a staff account" />
          <CardBody>
            <Alert tone="info" className="mb-4">
              For example, give a designer only the &quot;Store design&quot; scope so they can use the customizer
              without ever seeing your orders, wallet, or plan.
            </Alert>
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label="Email">
                <Input name="email" type="email" required placeholder="hire@example.com" />
              </Field>
              <Field label="Name (optional)">
                <Input name="name" placeholder="e.g. Ali" />
              </Field>
              <Field label="Password">
                <Input name="password" type="password" required minLength={8} placeholder="At least 8 characters" />
              </Field>
              <Field label="Scopes">
                <div className="flex flex-wrap gap-2">
                  {ALL_SCOPES.map((scope) => {
                    const active = selectedScopes.includes(scope);
                    return (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => toggleScope(scope)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          active
                            ? "border-accent bg-accent text-white"
                            : "border-border bg-surface text-ink-muted hover:text-ink"
                        }`}
                      >
                        {SCOPE_LABELS[scope]}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Button type="submit" loading={creating}>
                Create staff account
              </Button>
            </form>
          </CardBody>
        </Card>

        {staff.length === 0 ? (
          <Card>
            <EmptyState title="No staff accounts yet" description="Add one above to give a team member scoped access." />
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {staff.map((account) => (
              <div key={account.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{account.name || account.email}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">{account.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {account.scopes.map((scope) => (
                      <Badge key={scope} tone="neutral">
                        {SCOPE_LABELS[scope]}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={account.status === "active" ? "success" : "danger"}>{account.status}</Badge>
                  {account.status === "active" && (
                    <Button variant="secondary" size="sm" onClick={() => handleRevoke(account.id)}>
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
