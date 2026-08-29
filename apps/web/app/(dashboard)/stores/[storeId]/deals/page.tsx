"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";
import { api } from "@/lib/dashboard-api";

interface Deal {
  id: string;
  title: string;
  slug: string;
  discountPercent: string;
  status: "draft" | "active" | "archived";
  items: { id: string }[];
}

const statusTone = { active: "success", draft: "neutral", archived: "neutral" } as const;

/** SRS §5.67/FR-67.4 - seller dashboard Deals management, nested under the Products hub. */
export default function DealsListPage({ params }: { params: { storeId: string } }) {
  const [deals, setDeals] = useState<Deal[] | null>(null);

  useEffect(() => {
    api
      .get<Deal[]>(`/stores/${params.storeId}/deals`)
      .then(setDeals)
      .catch(() => setDeals([]));
  }, [params.storeId]);

  if (deals === null) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Deals"
        description="Bundle your own products together at one uniform percentage off."
        action={
          <Link href={`/stores/${params.storeId}/deals/new`}>
            <Button>Create deal</Button>
          </Link>
        }
      />

      <Link href={`/stores/${params.storeId}/products`} className="mb-4 inline-block text-sm text-ink-muted hover:text-ink">
        &larr; Back to Products
      </Link>

      {deals.length === 0 ? (
        <Card>
          <EmptyState
            title="No deals yet"
            description="Create one to bundle products at a discount - e.g. '20% off all 5' - with a single buy-now button on your storefront."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          <Reveal stagger={0.03}>
            {deals.map((deal) => (
              <Link
                key={deal.id}
                href={`/stores/${params.storeId}/deals/${deal.id}`}
                className="flex items-center justify-between gap-4 px-6 py-4 transition-smooth-fast hover:bg-canvas"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{deal.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {deal.items.length} item{deal.items.length === 1 ? "" : "s"} - {deal.discountPercent}% off
                  </p>
                </div>
                <Badge tone={statusTone[deal.status]}>{deal.status}</Badge>
              </Link>
            ))}
          </Reveal>
        </Card>
      )}
    </div>
  );
}
