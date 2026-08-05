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

interface CustomerSegment {
  id: string;
  name: string;
  minOrders: number | null;
  maxOrders: number | null;
  minTotalSpent: string | null;
  maxTotalSpent: string | null;
  lastOrderAfter: string | null;
  lastOrderBefore: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  memberCount: number;
}

interface SegmentMember {
  id: string;
  email: string;
  ordersCount: number;
  totalSpent: string;
  lastOrderAt: string | null;
}

function criteriaSummary(segment: CustomerSegment): string {
  const parts: string[] = [];
  if (segment.minOrders != null) parts.push(`${segment.minOrders}+ orders`);
  if (segment.maxOrders != null) parts.push(`up to ${segment.maxOrders} orders`);
  if (segment.minTotalSpent != null) parts.push(`spent Rs ${segment.minTotalSpent}+`);
  if (segment.maxTotalSpent != null) parts.push(`spent up to Rs ${segment.maxTotalSpent}`);
  if (segment.lastOrderAfter) parts.push(`ordered after ${new Date(segment.lastOrderAfter).toLocaleDateString()}`);
  if (segment.lastOrderBefore) parts.push(`ordered before ${new Date(segment.lastOrderBefore).toLocaleDateString()}`);
  if (segment.locationCity) parts.push(`city: ${segment.locationCity}`);
  if (segment.locationCountry) parts.push(`country: ${segment.locationCountry}`);
  return parts.length > 0 ? parts.join(" · ") : "No filters (matches all customers)";
}

export default function CustomerSegmentsPage({ params }: { params: { storeId: string } }) {
  const [segments, setSegments] = useState<CustomerSegment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [members, setMembers] = useState<SegmentMember[] | null>(null);

  function load() {
    api
      .get<CustomerSegment[]>(`/stores/${params.storeId}/customer-segments`)
      .then(setSegments)
      .catch(() => setSegments([]));
  }

  useEffect(load, [params.storeId]);

  if (!segments) return <PageSpinner />;

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const form = new FormData(e.currentTarget);
    const minOrders = form.get("minOrders") as string;
    const maxOrders = form.get("maxOrders") as string;
    const minTotalSpent = form.get("minTotalSpent") as string;
    const maxTotalSpent = form.get("maxTotalSpent") as string;
    const lastOrderAfter = form.get("lastOrderAfter") as string;
    const lastOrderBefore = form.get("lastOrderBefore") as string;
    const locationCity = form.get("locationCity") as string;
    const locationCountry = form.get("locationCountry") as string;
    try {
      await api.post(`/stores/${params.storeId}/customer-segments`, {
        name: form.get("name"),
        minOrders: minOrders ? Number(minOrders) : undefined,
        maxOrders: maxOrders ? Number(maxOrders) : undefined,
        minTotalSpent: minTotalSpent ? Number(minTotalSpent) : undefined,
        maxTotalSpent: maxTotalSpent ? Number(maxTotalSpent) : undefined,
        lastOrderAfter: lastOrderAfter ? new Date(lastOrderAfter).toISOString() : undefined,
        lastOrderBefore: lastOrderBefore ? new Date(lastOrderBefore).toISOString() : undefined,
        locationCity: locationCity || undefined,
        locationCountry: locationCountry || undefined,
      });
      (e.target as HTMLFormElement).reset();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create that segment.");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.delete(`/stores/${params.storeId}/customer-segments/${id}`);
      setSegments((prev) => prev!.filter((s) => s.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that segment.");
    }
  }

  async function toggleMembers(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setMembers(null);
      return;
    }
    setExpandedId(id);
    setMembers(null);
    try {
      const detail = await api.get<{ members: SegmentMember[] }>(`/stores/${params.storeId}/customer-segments/${id}`);
      setMembers(detail.members);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load segment members.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Customer Segments"
        description="Saved filters over your existing customers - by order count, total spent, last-order date, and location. Membership is always resolved live, never a stored list."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader title="Create a segment" />
          <CardBody>
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label="Name">
                <Input name="name" maxLength={80} required placeholder="e.g. Repeat buyers" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Min orders" hint="Leave blank for no minimum.">
                  <Input name="minOrders" type="number" min="0" />
                </Field>
                <Field label="Max orders" hint="Leave blank for no maximum.">
                  <Input name="maxOrders" type="number" min="0" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Min total spent (Rs)">
                  <Input name="minTotalSpent" type="number" step="0.01" min="0" />
                </Field>
                <Field label="Max total spent (Rs)">
                  <Input name="maxTotalSpent" type="number" step="0.01" min="0" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Last order after">
                  <Input name="lastOrderAfter" type="date" />
                </Field>
                <Field label="Last order before">
                  <Input name="lastOrderBefore" type="date" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="City" hint="Matches each customer's most recent order.">
                  <Input name="locationCity" maxLength={120} placeholder="e.g. Lahore" />
                </Field>
                <Field label="Country">
                  <Input name="locationCountry" maxLength={120} placeholder="e.g. PK" />
                </Field>
              </div>
              <Button type="submit" loading={creating}>
                Create segment
              </Button>
            </form>
          </CardBody>
        </Card>

        {segments.length === 0 ? (
          <Card>
            <EmptyState
              title="No segments yet"
              description="Create one above to group your customers by orders, spend, recency, or location - useful as a foundation for future campaigns."
            />
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {segments.map((segment) => (
              <div key={segment.id} className="px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{segment.name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{criteriaSummary(segment)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone="neutral">{segment.memberCount} customer{segment.memberCount === 1 ? "" : "s"}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => toggleMembers(segment.id)}>
                      {expandedId === segment.id ? "Hide" : "View"} customers
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(segment.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                {expandedId === segment.id && (
                  <div className="mt-3 rounded-md border border-border bg-canvas p-3">
                    {members === null ? (
                      <p className="text-xs text-ink-muted">Loading...</p>
                    ) : members.length === 0 ? (
                      <p className="text-xs text-ink-muted">No customers currently match this segment.</p>
                    ) : (
                      <ul className="space-y-1">
                        {members.map((member) => (
                          <li key={member.id} className="flex items-center justify-between text-xs text-ink">
                            <span>{member.email}</span>
                            <span className="text-ink-muted">
                              {member.ordersCount} orders · Rs {member.totalSpent}
                              {member.lastOrderAt && ` · last ${new Date(member.lastOrderAt).toLocaleDateString()}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
